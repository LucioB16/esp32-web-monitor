import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import {
  deleteSite,
  getSite,
  listSites,
  saveTelegramSettings,
  upsertSite,
  getTelegramSettings
} from '~/lib/kv'
import { commandPayloadSchema, publishCommand, type MqttConfig } from '~/server/utils/mqtt'

const telegramUpdateSchema = z.object({
  message: z
    .object({
      message_id: z.number(),
      text: z.string().optional(),
      chat: z.object({ id: z.union([z.string(), z.number()]) }),
      from: z
        .object({
          username: z.string().optional(),
          first_name: z.string().optional(),
          last_name: z.string().optional()
        })
        .optional()
    })
    .optional()
})

const tokenize = (text: string): string[] => {
  return (text.match(/(?:[^\s"]+|"[^"]*")+/g) ?? []).map((token) =>
    token.startsWith('"') && token.endsWith('"') ? token.slice(1, -1) : token
  )
}

const parseOptions = (tokens: string[]) => {
  const options: Record<string, string> = {}
  for (const token of tokens) {
    const [key, ...rest] = token.split('=')
    if (!key || rest.length === 0) {
      continue
    }
    options[key.toLowerCase()] = rest.join('=').trim()
  }
  return options
}

const buildSitePayload = (args: string[]) => {
  if (args.length < 2) {
    throw new Error('Uso: /add <id> <url> [selector="#precio"] [mode=selector] [interval=900]')
  }
  const [id, url, ...rest] = args
  const options = parseOptions(rest)
  const payload = commandPayloadSchema.parse({
    id,
    url,
    interval_s: options.interval ? Number.parseInt(options.interval, 10) : undefined,
    mode: options.mode as any,
    selector_css: options.selector,
    start_marker: options.start,
    end_marker: options.end,
    regex: options.regex,
    paused: options.paused ? options.paused === 'true' : undefined
  })
  return payload
}

const sendTelegramMessage = async (token: string, chatId: string, text: string) => {
  if (!token || !chatId) {
    return
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  })
}

export default defineEventHandler(async (event) => {
  const secret = getRouterParam(event, 'secret')
  const config = useRuntimeConfig(event)
  if (!secret || secret !== config.telegramWebhookSecret) {
    throw createError({ statusCode: 401, statusMessage: 'Webhook secreto inválido' })
  }

  const runtimeMqtt: MqttConfig = {
    mqttUrlWss: config.mqttUrlWss,
    deviceId: config.deviceId,
    deviceSecret: config.deviceSecret
  }

  const update = telegramUpdateSchema.parse(await readBody(event))
  const message = update.message
  if (!message?.text) {
    return { ok: true }
  }

  const chatId = String(message.chat.id)
  const storedSettings = await getTelegramSettings()
  const allowedChat = config.telegramChatId || storedSettings.chatId
  if (allowedChat && chatId !== allowedChat) {
    return { ok: true }
  }
  const telegramToken = config.telegramBotToken
  const normalizedCommand = tokenize(message.text.trim())
  if (normalizedCommand.length === 0) {
    return { ok: true }
  }

  const commandToken = normalizedCommand.shift() as string
  const command = commandToken.replace(/^\//, '').split('@')[0].toLowerCase()

  const respond = async (text: string) => {
    await sendTelegramMessage(telegramToken, chatId, text)
  }

  try {
    switch (command) {
      case 'add': {
        const payload = buildSitePayload(normalizedCommand)
        const mode = payload.mode ?? 'selector'
        if (mode === 'selector' && !payload.selector_css) {
          throw new Error('Proporciona selector=".clase" para modo selector')
        }
        if (mode === 'markers' && (!payload.start_marker || !payload.end_marker)) {
          throw new Error('Modo markers requiere start="..." y end="..."')
        }
        if (mode === 'regex' && !payload.regex) {
          throw new Error('Modo regex requiere regex="patrón"')
        }
        if (!payload.url) {
          throw new Error('URL inválida o ausente')
        }
        const commandPayload = {
          ...payload,
          mode,
          interval_s: payload.interval_s ?? 900,
          headers: payload.headers ?? {},
          paused: payload.paused ?? false
        }
        await upsertSite({
          ...commandPayload,
          mode: commandPayload.mode as any,
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        await publishCommand({ type: 'UPSERT_SITE', payload: commandPayload }, runtimeMqtt)
        await respond(`Sitio ${commandPayload.id} actualizado y enviado al ESP32.`)
        break
      }
      case 'remove':
      case 'delete': {
        const [id] = normalizedCommand
        if (!id) {
          throw new Error('Uso: /remove <id>')
        }
        await deleteSite(id)
        await publishCommand({ type: 'DELETE_SITE', payload: { id } }, runtimeMqtt)
        await respond(`Sitio ${id} eliminado.`)
        break
      }
      case 'pause':
      case 'resume': {
        const [id] = normalizedCommand
        if (!id) {
          throw new Error(`Uso: /${command} <id>`)
        }
        const existing = await getSite(id)
        if (!existing) {
          throw new Error(`Sitio ${id} no encontrado.`)
        }
        const paused = command === 'pause'
        await upsertSite({ ...existing, paused })
        await publishCommand(
          { type: paused ? 'PAUSE_SITE' : 'RESUME_SITE', payload: { id } },
          runtimeMqtt
        )
        await respond(`Sitio ${id} ${paused ? 'pausado' : 'reactivado'}.`)
        break
      }
      case 'checknow': {
        const [id] = normalizedCommand
        if (!id) {
          throw new Error('Uso: /checknow <id>')
        }
        await publishCommand({ type: 'CHECK_NOW', payload: { id } }, runtimeMqtt)
        await respond(`Se solicitó revisión inmediata de ${id}.`)
        break
      }
      case 'list': {
        const sites = await listSites()
        if (!sites.length) {
          await respond('No hay sitios configurados.')
          break
        }
        const lines = sites
          .slice(0, 20)
          .map((site) => `• ${site.id} (${site.mode}) → ${site.url}`)
          .join('\n')
        await respond(`Sitios registrados:\n${lines}`)
        break
      }
      case 'status': {
        const sites = await listSites()
        await respond(
          `ESP32 Web Monitor activo. Sitios configurados: ${sites.length}. Usa /list o /add para gestionar.`
        )
        break
      }
      case 'help':
      default: {
        await respond(
          'Comandos disponibles:\n/add id url selector="#precio" interval=900\n/remove id\n/pause id\n/resume id\n/checknow id\n/list\n/status'
        )
      }
    }
  } catch (error) {
    await respond(error instanceof Error ? error.message : 'Error procesando el comando')
  }

  if (!config.telegramChatId && !storedSettings.chatId && chatId) {
    await saveTelegramSettings({ chatId, updatedAt: Date.now() })
  }

  return { ok: true }
})

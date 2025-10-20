import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { z } from 'zod'
import {
  deleteSite,
  getSite,
  listSites,
  pauseSite,
  resumeSite,
  upsertSite
} from '~/server/data/sites'
import { resolveTelegramCredentials, saveTelegramConfig } from '~/server/data/config'
import { publishCommand, resolveMqttConfig } from '~/server/utils/mqtt'
import { commandPayloadSchema } from '~/lib/mqtt/commands'
import { buildIdPayload, buildSiteCommandPayload } from '~/server/utils/siteCommands'
import type { Mode } from '~/lib/schemas/sites'

const telegramUpdateSchema = z.object({
  message: z
    .object({
      message_id: z.number(),
      text: z.string().optional(),
      chat: z.object({ id: z.union([z.string(), z.number()]) })
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

const parseMode = (value: string | undefined): Mode => {
  if (!value) {
    return 'selector'
  }
  const lower = value.toLowerCase()
  if (lower === 'full' || lower === 'selector' || lower === 'markers' || lower === 'regex') {
    return lower
  }
  throw new Error('Modo inválido. Usa full, selector, markers o regex.')
}

const buildSitePayload = (args: string[]) => {
  if (args.length < 2) {
    throw new Error('Uso: /add <id> <url> [selector="#precio"] [mode=selector] [interval=900]')
  }
  const [id, url, ...rest] = args
  const options = parseOptions(rest)
  const mode = parseMode(options.mode)
  const interval = options.interval ? Number.parseInt(options.interval, 10) : 900
  const payload = commandPayloadSchema.parse({
    id,
    url,
    interval_s: Number.isFinite(interval) ? interval : 900,
    mode,
    selector_css: options.selector,
    start_marker: options.start,
    end_marker: options.end,
    regex: options.regex,
    paused: options.paused ? options.paused === 'true' : undefined
  })
  return {
    id: payload.id,
    url: payload.url!,
    interval_s: payload.interval_s ?? 900,
    mode: (payload.mode ?? mode) as Mode,
    selector_css: payload.selector_css,
    start_marker: payload.start_marker,
    end_marker: payload.end_marker,
    regex: payload.regex,
    headers: payload.headers,
    paused: payload.paused ?? false
  }
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
  const runtimeConfig = useRuntimeConfig(event)
  if (!secret || secret !== runtimeConfig.telegramWebhookSecret) {
    throw createError({ statusCode: 401, statusMessage: 'Webhook secreto inválido' })
  }

  const mqttConfig = resolveMqttConfig(event)
  const credentials = await resolveTelegramCredentials(event)

  const update = telegramUpdateSchema.parse(await readBody(event))
  const message = update.message
  if (!message?.text) {
    return { ok: true }
  }

  const chatId = String(message.chat.id)
  if (credentials.chatId && chatId !== credentials.chatId) {
    return { ok: true }
  }

  const respond = async (text: string) => {
    await sendTelegramMessage(credentials.token, chatId, text)
  }

  const parts = tokenize(message.text.trim())
  if (parts.length === 0) {
    return { ok: true }
  }

  const commandToken = parts.shift() as string
  const command = commandToken.replace(/^\//, '').split('@')[0].toLowerCase()

  try {
    switch (command) {
      case 'add': {
        const payload = buildSitePayload(parts)
        if (payload.mode === 'selector' && !payload.selector_css) {
          throw new Error('Proporciona selector=".clase" para modo selector')
        }
        if (payload.mode === 'markers' && (!payload.start_marker || !payload.end_marker)) {
          throw new Error('Modo markers requiere start="..." y end="..."')
        }
        if (payload.mode === 'regex' && !payload.regex) {
          throw new Error('Modo regex requiere regex="patrón"')
        }
        const site = await upsertSite({
          id: payload.id,
          url: payload.url,
          interval_s: payload.interval_s,
          mode: payload.mode,
          selector_css: payload.selector_css,
          start_marker: payload.start_marker,
          end_marker: payload.end_marker,
          regex: payload.regex,
          headers: payload.headers,
          paused: payload.paused
        })
        await publishCommand(
          { type: 'UPSERT_SITE', payload: buildSiteCommandPayload(site) },
          mqttConfig
        )
        await respond(`Sitio ${site.id} actualizado y enviado al ESP32.`)
        break
      }
      case 'remove':
      case 'delete': {
        const [id] = parts
        if (!id) {
          throw new Error('Uso: /remove <id>')
        }
        await deleteSite(id)
        await publishCommand({ type: 'DELETE_SITE', payload: buildIdPayload(id) }, mqttConfig)
        await respond(`Sitio ${id} eliminado.`)
        break
      }
      case 'pause':
      case 'resume': {
        const [id] = parts
        if (!id) {
          throw new Error(`Uso: /${command} <id>`)
        }
        const site = command === 'pause' ? await pauseSite(id) : await resumeSite(id)
        await publishCommand(
          { type: command === 'pause' ? 'PAUSE_SITE' : 'RESUME_SITE', payload: buildIdPayload(id) },
          mqttConfig
        )
        await respond(`Sitio ${id} ${command === 'pause' ? 'pausado' : 'reactivado'}.`)
        break
      }
      case 'checknow': {
        const [id] = parts
        if (!id) {
          throw new Error('Uso: /checknow <id>')
        }
        const existing = await getSite(id)
        if (!existing) {
          throw new Error(`Sitio ${id} no encontrado.`)
        }
        await publishCommand({ type: 'CHECK_NOW', payload: buildIdPayload(id) }, mqttConfig)
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

  if (!credentials.chatId && chatId) {
    await saveTelegramConfig({ chatId })
  }

  return { ok: true }
})

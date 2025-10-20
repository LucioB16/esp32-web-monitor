import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { resolveTelegramCredentials, saveTelegramConfig } from '~/server/data/config'

const bodySchema = z
  .object({
    chatId: z.string().optional(),
    botToken: z.string().optional()
  })
  .optional()

const normalizeInput = (value: string | undefined): string | null | undefined => {
  if (value === undefined) {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = bodySchema.parse(body) ?? {}
  const update: Partial<Record<'botToken' | 'chatId', string | null>> = {}
  const chatId = normalizeInput(parsed.chatId)
  const botToken = normalizeInput(parsed.botToken)
  if (chatId !== undefined) {
    update.chatId = chatId
  }
  if (botToken !== undefined) {
    update.botToken = botToken
  }
  if (Object.keys(update).length > 0) {
    await saveTelegramConfig(update)
  }
  const credentials = await resolveTelegramCredentials(event)
  return {
    chatId: credentials.chatId ?? '',
    tokenMasked: credentials.token ? `${credentials.token.slice(0, 3)}***${credentials.token.slice(-3)}` : '',
    hasToken: Boolean(credentials.token),
    hasChatId: Boolean(credentials.chatId),
    updatedAt: credentials.stored?.updatedAt ?? null,
    source: credentials.source
  }
})

import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { getTelegramSettings, saveTelegramSettings } from '~/lib/kv'

const bodySchema = z.object({
  chatId: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .optional()
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = bodySchema.parse(body)
  const current = await getTelegramSettings()
  const next = await saveTelegramSettings({
    chatId: parsed.chatId ?? current.chatId,
    updatedAt: Date.now()
  })

  return {
    chatId: next.chatId,
    updatedAt: next.updatedAt
  }
})

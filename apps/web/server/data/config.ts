import { useRuntimeConfig } from '#imports'
import type { H3Event } from 'h3'
import { redisGet, redisSet } from '~/server/utils/redis'

const TELEGRAM_KEY = ['config', 'telegram'] as const

export type TelegramConfig = {
  botToken?: string
  chatId?: string
  updatedAt: number
}

const normalizeValue = (value?: string | null): string | undefined => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export const getStoredTelegramConfig = async (): Promise<TelegramConfig | null> => {
  const stored = await redisGet<TelegramConfig>([...TELEGRAM_KEY])
  if (!stored) {
    return null
  }
  return stored
}

export const saveTelegramConfig = async (
  input: Partial<Record<'botToken' | 'chatId', string | null>>
): Promise<TelegramConfig> => {
  const current = await getStoredTelegramConfig()
  const next: TelegramConfig = {
    botToken:
      input.botToken === null
        ? undefined
        : normalizeValue(input.botToken) ?? current?.botToken,
    chatId:
      input.chatId === null
        ? undefined
        : normalizeValue(input.chatId) ?? current?.chatId,
    updatedAt: Date.now()
  }
  await redisSet([...TELEGRAM_KEY], next)
  return next
}

export const resolveTelegramCredentials = async (
  event: H3Event
): Promise<{
  token: string
  chatId: string
  source: { token: 'storage' | 'env' | null; chatId: 'storage' | 'env' | null }
  stored: TelegramConfig | null
}> => {
  const runtime = useRuntimeConfig(event)
  const stored = await getStoredTelegramConfig()
  const token = normalizeValue(stored?.botToken) ?? normalizeValue(runtime.telegramBotToken) ?? ''
  const chatId = normalizeValue(stored?.chatId) ?? normalizeValue(runtime.telegramChatId) ?? ''
  return {
    token,
    chatId,
    source: {
      token: stored?.botToken ? 'storage' : runtime.telegramBotToken ? 'env' : null,
      chatId: stored?.chatId ? 'storage' : runtime.telegramChatId ? 'env' : null
    },
    stored
  }
}

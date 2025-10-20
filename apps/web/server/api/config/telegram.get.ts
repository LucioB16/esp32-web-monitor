import { defineEventHandler } from 'h3'
import { getTelegramSettings } from '~/lib/kv'

const maskToken = (token: string): string => {
  if (!token) {
    return ''
  }
  if (token.length <= 6) {
    return '*'.repeat(token.length)
  }
  return `${token.slice(0, 3)}***${token.slice(-3)}`
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const settings = await getTelegramSettings()
  const chatId = settings.chatId || config.telegramChatId || ''
  const token = config.telegramBotToken || ''

  return {
    chatId,
    tokenMasked: maskToken(token),
    hasToken: Boolean(token),
    hasChatId: Boolean(chatId),
    updatedAt: settings.updatedAt
  }
})

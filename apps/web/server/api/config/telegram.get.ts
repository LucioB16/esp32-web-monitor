import { defineEventHandler } from 'h3'
import { resolveTelegramCredentials } from '~/server/data/config'

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
  const credentials = await resolveTelegramCredentials(event)
  return {
    chatId: credentials.chatId ?? '',
    tokenMasked: maskToken(credentials.token),
    hasToken: Boolean(credentials.token),
    hasChatId: Boolean(credentials.chatId),
    updatedAt: credentials.stored?.updatedAt ?? null,
    source: credentials.source
  }
})

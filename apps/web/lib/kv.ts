import { kvDel, kvGet, kvScan, kvSet } from '~/server/utils/kv'

export type SiteMode = 'full' | 'selector' | 'markers' | 'regex'

export interface SiteConfig {
  id: string
  url: string
  interval_s: number
  mode: SiteMode
  selector_css?: string
  start_marker?: string
  end_marker?: string
  regex?: string
  headers?: Record<string, string>
  paused?: boolean
  createdAt: number
  updatedAt: number
}

export interface TelegramSettings {
  chatId: string
  updatedAt: number
}

const SITE_PREFIX = ['sites'] as const
const TELEGRAM_KEY = ['config', 'telegram'] as const

type Prefix = readonly (string | number | boolean)[]

type KeyParts = (string | number | boolean)[]

const asMutable = (parts: Prefix): KeyParts => [...parts]

const envText = (name: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name] as string
  }
  return ''
}

export const listSites = async (): Promise<SiteConfig[]> => {
  const sites: SiteConfig[] = []
  for await (const site of kvScan<SiteConfig>(asMutable(SITE_PREFIX))) {
    sites.push(site)
  }
  return sites.sort((a, b) => a.id.localeCompare(b.id))
}

export const getSite = async (id: string): Promise<SiteConfig | null> => {
  return kvGet<SiteConfig>([...SITE_PREFIX, id])
}

export const upsertSite = async (
  site: Omit<SiteConfig, 'createdAt' | 'updatedAt'> & { createdAt?: number; updatedAt?: number }
): Promise<SiteConfig> => {
  const now = Date.now()
  const existing = await getSite(site.id)
  const next: SiteConfig = {
    ...site,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  }
  await kvSet([...SITE_PREFIX, site.id], next)
  return next
}

export const deleteSite = async (id: string): Promise<void> => {
  await kvDel([...SITE_PREFIX, id])
}

const defaultTelegram = (): TelegramSettings => ({
  chatId: envText('TELEGRAM_CHAT_ID'),
  updatedAt: Date.now()
})

export const getTelegramSettings = async (): Promise<TelegramSettings> => {
  const stored = await kvGet<TelegramSettings>(asMutable(TELEGRAM_KEY))
  if (stored) {
    return stored
  }
  const initial = defaultTelegram()
  if (initial.chatId) {
    await kvSet(asMutable(TELEGRAM_KEY), initial)
  }
  return initial
}

export const saveTelegramSettings = async (
  settings: Pick<TelegramSettings, 'chatId'> & Partial<Pick<TelegramSettings, 'updatedAt'>>
): Promise<TelegramSettings> => {
  const payload: TelegramSettings = {
    chatId: settings.chatId,
    updatedAt: settings.updatedAt ?? Date.now()
  }
  await kvSet(asMutable(TELEGRAM_KEY), payload)
  return payload
}

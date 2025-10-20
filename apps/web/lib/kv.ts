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

type KvLike = {
  get<T>(key: unknown[]): Promise<{ value: T | null }>
  set(key: unknown[], value: unknown): Promise<void>
  delete(key: unknown[]): Promise<void>
  list<T>(options: { prefix: unknown[] }): AsyncIterableIterator<{ key: unknown[]; value: T }>
}

const memoryState = {
  sites: new Map<string, SiteConfig>(),
  telegram: null as TelegramSettings | null
}

const deno = (globalThis as typeof globalThis & { Deno?: { env?: { get: (name: string) => string | undefined }; openKv?: () => Promise<KvLike> } }).Deno

const textEnv = (name: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name] as string
  }
  if (deno?.env) {
    try {
      const value = deno.env.get(name)
      if (value) {
        return value
      }
    } catch {
      // Ignorar errores de permisos en Deno Deploy
    }
  }
  return ''
}

const shouldUseDenoKv = (): boolean => {
  if (!deno?.openKv) {
    return false
  }
  const fromEnv = textEnv('USE_DENO_KV').toLowerCase() === 'true'
  const denoDeployment = Boolean(textEnv('DENO_DEPLOYMENT_ID'))
  return fromEnv || denoDeployment
}

const globalAny = globalThis as typeof globalThis & { __esp32KvPromise?: Promise<KvLike> }

const getKv = async (): Promise<KvLike> => {
  if (!shouldUseDenoKv()) {
    throw new Error('Deno KV no disponible en este entorno')
  }
  if (!globalAny.__esp32KvPromise) {
    if (!deno?.openKv) {
      throw new Error('Deno.openKv no expuesto')
    }
    globalAny.__esp32KvPromise = deno.openKv()
  }
  return globalAny.__esp32KvPromise
}

const SITE_PREFIX = ['sites'] as const
const TELEGRAM_KEY = ['config', 'telegram'] as const

export const listSites = async (): Promise<SiteConfig[]> => {
  if (shouldUseDenoKv()) {
    const kv = await getKv()
    const items: SiteConfig[] = []
    for await (const entry of kv.list<SiteConfig>({ prefix: [...SITE_PREFIX] })) {
      items.push(entry.value)
    }
    return items.sort((a, b) => a.id.localeCompare(b.id))
  }
  return [...memoryState.sites.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export const getSite = async (id: string): Promise<SiteConfig | null> => {
  if (shouldUseDenoKv()) {
    const kv = await getKv()
    const entry = await kv.get<SiteConfig>([...SITE_PREFIX, id])
    return entry.value ?? null
  }
  return memoryState.sites.get(id) ?? null
}

export const upsertSite = async (site: Omit<SiteConfig, 'createdAt' | 'updatedAt'> & { createdAt?: number; updatedAt?: number }): Promise<SiteConfig> => {
  const now = Date.now()
  const existing = await getSite(site.id)
  const next: SiteConfig = {
    ...site,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  }
  if (shouldUseDenoKv()) {
    const kv = await getKv()
    await kv.set([...SITE_PREFIX, site.id], next)
  } else {
    memoryState.sites.set(site.id, next)
  }
  return next
}

export const deleteSite = async (id: string): Promise<void> => {
  if (shouldUseDenoKv()) {
    const kv = await getKv()
    await kv.delete([...SITE_PREFIX, id])
  } else {
    memoryState.sites.delete(id)
  }
}

const defaultTelegram = (): TelegramSettings => ({
  chatId: textEnv('TELEGRAM_CHAT_ID'),
  updatedAt: Date.now()
})

export const getTelegramSettings = async (): Promise<TelegramSettings> => {
  if (shouldUseDenoKv()) {
    const kv = await getKv()
    const stored = await kv.get<TelegramSettings>([...TELEGRAM_KEY])
    if (stored.value) {
      return stored.value
    }
    const initial = defaultTelegram()
    await kv.set([...TELEGRAM_KEY], initial)
    return initial
  }
  if (!memoryState.telegram) {
    memoryState.telegram = defaultTelegram()
  }
  return memoryState.telegram
}

export const saveTelegramSettings = async (settings: TelegramSettings): Promise<TelegramSettings> => {
  const payload: TelegramSettings = {
    ...settings,
    updatedAt: Date.now()
  }
  if (shouldUseDenoKv()) {
    const kv = await getKv()
    await kv.set([...TELEGRAM_KEY], payload)
  } else {
    memoryState.telegram = payload
  }
  return payload
}

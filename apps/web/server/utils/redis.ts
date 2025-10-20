import { Redis } from '@upstash/redis'

type KeyPart = string | number | boolean

type StorageKind = 'upstash' | 'memory'

type ScanResult<T> = AsyncGenerator<{ key: string; value: T }>

type Adapter = {
  kind: StorageKind
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  del(key: string): Promise<void>
  scan<T>(prefix: string): ScanResult<T>
  sadd(key: string, members: string[]): Promise<number>
  srem(key: string, members: string[]): Promise<number>
  smembers(key: string): Promise<string[]>
  expire(key: string, seconds: number): Promise<void>
}

type MemoryEntry =
  | { kind: 'value'; value: string; expiresAt?: number }
  | { kind: 'set'; value: Set<string>; expiresAt?: number }

type RedisCredentials = {
  url: string
  token: string
}

const KEY_SEPARATOR = ':'

const memoryStore = new Map<string, MemoryEntry>()

const toKey = (parts: KeyPart[]): string => parts.map((part) => String(part)).join(KEY_SEPARATOR)

const toPrefix = (parts: KeyPart[]): string => (parts.length === 0 ? '' : `${toKey(parts)}${KEY_SEPARATOR}`)

const now = () => Date.now()

const getEnv = (name: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name] as string
  }
  return ''
}

const parseRedisCredentials = (): RedisCredentials | null => {
  const envUrl = getEnv('REDIS_URL') || getEnv('UPSTASH_REDIS_REST_URL')
  const envToken = getEnv('REDIS_TOKEN') || getEnv('UPSTASH_REDIS_REST_TOKEN')

  let url = envUrl.trim()
  let token = envToken.trim()

  if (!token && url.includes('|')) {
    const [parsedUrl, parsedToken] = url.split('|', 2)
    url = parsedUrl.trim()
    token = (parsedToken ?? '').trim()
  }

  if (url && !token) {
    try {
      const parsed = new URL(url)
      if (parsed.password) {
        token = parsed.password
        parsed.password = ''
        parsed.username = ''
        url = parsed.toString()
      }
    } catch (error) {
      console.warn('REDIS_URL inválida, no se pudo parsear', error)
      return null
    }
  }

  if (!url || !token) {
    return null
  }

  if (!url.toLowerCase().startsWith('https://')) {
    console.warn('REDIS_URL no es una URL HTTPS compatible con Upstash. Se usará almacenamiento en memoria.')
    return null
  }

  return { url, token }
}

const createUpstashAdapter = (): Adapter | null => {
  const credentials = parseRedisCredentials()
  if (!credentials) {
    return null
  }

  const client = new Redis({ url: credentials.url, token: credentials.token })

  const parseJson = <T>(value: unknown): T | null => {
    if (value === null || value === undefined) {
      return null
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T
      } catch (error) {
        console.error('Error parsing Redis JSON value', error)
        return null
      }
    }
    return value as T
  }

  const stringify = (value: unknown): string => JSON.stringify(value)

  const adapter: Adapter = {
    kind: 'upstash',
    async get<T>(key) {
      const raw = await client.get<string | T | null>(key)
      return parseJson<T>(raw)
    },
    async set<T>(key, value) {
      await client.set(key, stringify(value))
    },
    async del(key) {
      await client.del(key)
    },
    async *scan<T>(prefix) {
      let cursor = 0
      const match = prefix ? `${prefix}*` : '*'
      do {
        const [nextCursor, keys] = await client.scan(cursor, { match, count: 100 })
        cursor = Number(nextCursor)
        if (!keys || keys.length === 0) {
          continue
        }
        const values = await client.mget<string | null[]>(...keys)
        for (let index = 0; index < keys.length; index += 1) {
          const raw = values[index]
          if (raw === null || raw === undefined) {
            continue
          }
          const parsed = parseJson<T>(raw)
          if (parsed !== null) {
            yield { key: keys[index]!, value: parsed }
          }
        }
      } while (cursor !== 0)
    },
    async sadd(key, members) {
      if (members.length === 0) {
        return 0
      }
      return client.sadd(key, ...members)
    },
    async srem(key, members) {
      if (members.length === 0) {
        return 0
      }
      return client.srem(key, ...members)
    },
    async smembers(key) {
      const members = await client.smembers<string[]>(key)
      return Array.isArray(members) ? members : []
    },
    async expire(key, seconds) {
      if (seconds <= 0) {
        await client.del(key)
        return
      }
      await client.expire(key, seconds)
    }
  }

  return adapter
}

const isExpired = (entry: MemoryEntry | undefined): boolean => {
  if (!entry || !entry.expiresAt) {
    return false
  }
  return entry.expiresAt <= now()
}

const getMemoryEntry = (key: string): MemoryEntry | null => {
  const entry = memoryStore.get(key)
  if (!entry) {
    return null
  }
  if (isExpired(entry)) {
    memoryStore.delete(key)
    return null
  }
  return entry
}

const createMemoryAdapter = (): Adapter => ({
  kind: 'memory',
  async get<T>(key) {
    const entry = getMemoryEntry(key)
    if (!entry || entry.kind !== 'value') {
      return null
    }
    try {
      return JSON.parse(entry.value) as T
    } catch (error) {
      console.error('Error parsing memory value', error)
      return null
    }
  },
  async set<T>(key, value) {
    memoryStore.set(key, { kind: 'value', value: JSON.stringify(value) })
  },
  async del(key) {
    memoryStore.delete(key)
  },
  async *scan<T>(prefix) {
    for (const [key, entry] of memoryStore.entries()) {
      if (!key.startsWith(prefix)) {
        continue
      }
      if (isExpired(entry) || entry.kind !== 'value') {
        if (isExpired(entry)) {
          memoryStore.delete(key)
        }
        continue
      }
      try {
        yield { key, value: JSON.parse(entry.value) as T }
      } catch (error) {
        console.error('Error parsing memory value', error)
      }
    }
  },
  async sadd(key, members) {
    if (members.length === 0) {
      return 0
    }
    let entry = getMemoryEntry(key)
    if (!entry) {
      entry = { kind: 'set', value: new Set<string>() }
      memoryStore.set(key, entry)
    }
    if (entry.kind !== 'set') {
      entry = { kind: 'set', value: new Set<string>() }
      memoryStore.set(key, entry)
    }
    let added = 0
    for (const member of members) {
      if (!entry.value.has(member)) {
        entry.value.add(member)
        added += 1
      }
    }
    return added
  },
  async srem(key, members) {
    const entry = getMemoryEntry(key)
    if (!entry || entry.kind !== 'set' || members.length === 0) {
      return 0
    }
    let removed = 0
    for (const member of members) {
      if (entry.value.delete(member)) {
        removed += 1
      }
    }
    return removed
  },
  async smembers(key) {
    const entry = getMemoryEntry(key)
    if (!entry || entry.kind !== 'set') {
      return []
    }
    return Array.from(entry.value)
  },
  async expire(key, seconds) {
    const entry = memoryStore.get(key)
    if (!entry) {
      return
    }
    if (seconds <= 0) {
      memoryStore.delete(key)
      return
    }
    entry.expiresAt = now() + seconds * 1000
    memoryStore.set(key, entry)
  }
})

const adapter: Adapter = createUpstashAdapter() ?? createMemoryAdapter()

export const getStorageKind = (): StorageKind => adapter.kind

export const redisGet = async <T>(parts: KeyPart[]): Promise<T | null> => {
  const key = toKey(parts)
  return adapter.get<T>(key)
}

export const redisSet = async <T>(parts: KeyPart[], value: T): Promise<void> => {
  const key = toKey(parts)
  await adapter.set<T>(key, value)
}

export const redisDel = async (parts: KeyPart[]): Promise<void> => {
  const key = toKey(parts)
  await adapter.del(key)
}

export const redisScan = async function* <T>(parts: KeyPart[]): AsyncGenerator<T> {
  const prefix = toPrefix(parts)
  for await (const { value } of adapter.scan<T>(prefix)) {
    yield value
  }
}

export const redisSAdd = async (parts: KeyPart[], members: string[]): Promise<number> => {
  const key = toKey(parts)
  return adapter.sadd(key, members)
}

export const redisSRem = async (parts: KeyPart[], members: string[]): Promise<number> => {
  const key = toKey(parts)
  return adapter.srem(key, members)
}

export const redisSMembers = async (parts: KeyPart[]): Promise<string[]> => {
  const key = toKey(parts)
  return adapter.smembers(key)
}

export const redisExpire = async (parts: KeyPart[], seconds: number): Promise<void> => {
  const key = toKey(parts)
  await adapter.expire(key, seconds)
}

export type { StorageKind }

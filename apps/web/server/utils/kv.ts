import Redis from 'ioredis'

type KeyPart = string | number | boolean

type StorageKind = 'redis' | 'memory'

type ScanResult<T> = AsyncGenerator<{ key: string; value: T }>

type Adapter = {
  kind: StorageKind
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  del(key: string): Promise<void>
  scan<T>(prefix: string): ScanResult<T>
}

const redisUrl = process.env.REDIS_URL ?? ''

const memoryStore = new Map<string, string>()

const createRedisAdapter = (): Adapter | null => {
  if (!redisUrl) {
    return null
  }

  const client = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    enableReadyCheck: false
  })

  const connect = async () => {
    if (client.status === 'end') {
      await client.connect()
      return client
    }
    if (client.status === 'wait') {
      await client.connect()
    }
    return client
  }

  const parseJson = <T>(value: string | null): T | null => {
    if (value === null) {
      return null
    }
    try {
      return JSON.parse(value) as T
    } catch (error) {
      console.error('Error parsing Redis value', error)
      return null
    }
  }

  const stringify = (value: unknown): string => {
    return JSON.stringify(value)
  }

  const adapter: Adapter = {
    kind: 'redis',
    async get<T>(key) {
      const redis = await connect()
      const raw = await redis.get(key)
      return parseJson<T>(raw)
    },
    async set<T>(key, value) {
      const redis = await connect()
      await redis.set(key, stringify(value))
    },
    async del(key) {
      const redis = await connect()
      await redis.del(key)
    },
    async *scan<T>(prefix) {
      const redis = await connect()
      let cursor = '0'
      const match = `${prefix}*`
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', match, 'COUNT', '50')
        cursor = nextCursor
        if (keys.length === 0) {
          continue
        }
        const values = await redis.mget(...keys)
        for (let index = 0; index < keys.length; index += 1) {
          const raw = values[index]
          if (raw === null) {
            continue
          }
          const value = parseJson<T>(raw)
          if (value !== null) {
            yield { key: keys[index], value }
          }
        }
      } while (cursor !== '0')
    }
  }

  return adapter
}

const redisAdapter = createRedisAdapter()

const memoryAdapter: Adapter = {
  kind: 'memory',
  async get<T>(key) {
    const raw = memoryStore.get(key) ?? null
    if (raw === null) {
      return null
    }
    try {
      return JSON.parse(raw) as T
    } catch (error) {
      console.error('Error parsing memory value', error)
      return null
    }
  },
  async set<T>(key, value) {
    memoryStore.set(key, JSON.stringify(value))
  },
  async del(key) {
    memoryStore.delete(key)
  },
  async *scan<T>(prefix) {
    for (const [key, raw] of memoryStore.entries()) {
      if (!key.startsWith(prefix)) {
        continue
      }
      try {
        const value = JSON.parse(raw) as T
        yield { key, value }
      } catch (error) {
        console.error('Error parsing memory value', error)
      }
    }
  }
}

const adapter: Adapter = redisAdapter ?? memoryAdapter

const KEY_SEPARATOR = ':'

const toKey = (parts: KeyPart[]): string => parts.map((part) => String(part)).join(KEY_SEPARATOR)

const toPrefix = (parts: KeyPart[]): string =>
  parts.length === 0 ? '' : `${toKey(parts)}${KEY_SEPARATOR}`

export const getStorageKind = (): StorageKind => adapter.kind

export const kvGet = async <T>(parts: KeyPart[]): Promise<T | null> => {
  const key = toKey(parts)
  return adapter.get<T>(key)
}

export const kvSet = async <T>(parts: KeyPart[], value: T): Promise<void> => {
  const key = toKey(parts)
  await adapter.set<T>(key, value)
}

export const kvDel = async (parts: KeyPart[]): Promise<void> => {
  const key = toKey(parts)
  await adapter.del(key)
}

export const kvScan = async function* <T>(parts: KeyPart[]): AsyncGenerator<T> {
  const prefix = toPrefix(parts)
  for await (const { value } of adapter.scan<T>(prefix)) {
    yield value
  }
}

import { siteSchema, siteStatusSchema, siteWriteSchema, siteIdSchema, type Site, type SiteStatus, type SiteWrite } from '~/lib/schemas/sites'
import {
  redisDel,
  redisExpire,
  redisGet,
  redisSAdd,
  redisSMembers,
  redisSRem,
  redisSet
} from '~/server/utils/redis'

const SITES_INDEX_KEY = ['sites', 'all'] as const
const STATUS_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 días

const siteKey = (id: string) => ['site', id] as const
const statusKey = (id: string) => ['site', id, 'status'] as const

export class SiteNotFoundError extends Error {
  constructor(id: string) {
    super(`No existe el sitio ${id}`)
    this.name = 'SiteNotFoundError'
  }
}

const sanitizeHeaders = (headers: Record<string, string> | undefined): Record<string, string> | undefined => {
  if (!headers) {
    return undefined
  }
  const entries = Object.entries(headers)
    .map(([key, value]) => [key.trim(), value.trim()] as const)
    .filter(([key, value]) => key.length > 0 && value.length > 0)
  if (entries.length === 0) {
    return undefined
  }
  return Object.fromEntries(entries)
}

const normalizeSiteInput = (input: SiteWrite): SiteWrite => {
  return {
    ...input,
    headers: sanitizeHeaders(input.headers),
    paused: input.paused ?? false
  }
}

const ensureSiteId = (id: string): string => siteIdSchema.parse(id)

const sortSites = (sites: Site[]): Site[] => [...sites].sort((a, b) => a.id.localeCompare(b.id))

export const listSiteIds = async (): Promise<string[]> => {
  const ids = await redisSMembers([...SITES_INDEX_KEY])
  return ids.sort((a, b) => a.localeCompare(b))
}

export const listSites = async (): Promise<Site[]> => {
  const ids = await listSiteIds()
  if (ids.length === 0) {
    return []
  }
  const sites = await Promise.all(ids.map((id) => redisGet<Site>([...siteKey(id)])))
  const result: Site[] = []
  for (let index = 0; index < ids.length; index += 1) {
    const raw = sites[index]
    if (!raw) {
      continue
    }
    try {
      result.push(siteSchema.parse(raw))
    } catch (error) {
      console.error('Registro de sitio inválido en almacenamiento', { id: ids[index], error })
    }
  }
  return sortSites(result)
}

export const getSite = async (id: string): Promise<Site | null> => {
  const normalizedId = ensureSiteId(id)
  const raw = await redisGet<Site>([...siteKey(normalizedId)])
  if (!raw) {
    return null
  }
  return siteSchema.parse(raw)
}

const saveSite = async (site: Site): Promise<void> => {
  await redisSet([...siteKey(site.id)], site)
  await redisSAdd([...SITES_INDEX_KEY], [site.id])
}

export const upsertSite = async (input: unknown): Promise<Site> => {
  const parsed = siteWriteSchema.parse(input)
  const normalized = normalizeSiteInput(parsed)
  const existing = await getSite(normalized.id)
  const now = Date.now()
  const payload: Site = siteSchema.parse({
    ...existing,
    ...normalized,
    paused: normalized.paused ?? existing?.paused ?? false,
    created_at: existing?.created_at ?? normalized.created_at ?? now,
    updated_at: normalized.updated_at ?? now
  })
  await saveSite(payload)
  return payload
}

export const deleteSite = async (id: string): Promise<void> => {
  const normalizedId = ensureSiteId(id)
  await redisDel([...siteKey(normalizedId)])
  await redisDel([...statusKey(normalizedId)])
  await redisSRem([...SITES_INDEX_KEY], [normalizedId])
}

const mutateSite = async (id: string, updater: (site: Site) => Site): Promise<Site> => {
  const existing = await getSite(id)
  if (!existing) {
    throw new SiteNotFoundError(id)
  }
  const next = updater(existing)
  await saveSite(next)
  return next
}

export const pauseSite = async (id: string): Promise<Site> => {
  return mutateSite(id, (site) => {
    if (site.paused) {
      return site
    }
    return {
      ...site,
      paused: true,
      updated_at: Date.now()
    }
  })
}

export const resumeSite = async (id: string): Promise<Site> => {
  return mutateSite(id, (site) => {
    if (!site.paused) {
      return site
    }
    return {
      ...site,
      paused: false,
      updated_at: Date.now()
    }
  })
}

export const getSiteStatus = async (id: string): Promise<SiteStatus | null> => {
  const normalizedId = ensureSiteId(id)
  const raw = await redisGet<SiteStatus>([...statusKey(normalizedId)])
  if (!raw) {
    return null
  }
  try {
    return siteStatusSchema.parse(raw)
  } catch (error) {
    console.error('Estado de sitio inválido en almacenamiento', { id: normalizedId, error })
    return null
  }
}

export const listSitesWithStatus = async (): Promise<Array<{ site: Site; status: SiteStatus | null }>> => {
  const sites = await listSites()
  if (sites.length === 0) {
    return []
  }
  const statuses = await Promise.all(sites.map((site) => getSiteStatus(site.id)))
  return sites.map((site, index) => ({ site, status: statuses[index] ?? null }))
}

export const updateStatus = async (status: unknown): Promise<SiteStatus> => {
  const parsedInput = siteStatusSchema.parse(status)
  const parsed: SiteStatus = {
    ...parsedInput,
    updated_at: parsedInput.updated_at ?? Date.now()
  }
  await redisSet([...statusKey(parsed.id)], parsed)
  await redisExpire([...statusKey(parsed.id)], STATUS_TTL_SECONDS)
  return parsed
}

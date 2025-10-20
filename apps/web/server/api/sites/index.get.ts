import { defineEventHandler } from 'h3'
import { listSitesWithStatus } from '~/server/data/sites'

export default defineEventHandler(async () => {
  const items = await listSitesWithStatus()
  const statuses: Record<string, unknown> = {}
  for (const { site, status } of items) {
    statuses[site.id] = status ?? null
  }
  return {
    sites: items.map((item) => item.site),
    statuses
  }
})

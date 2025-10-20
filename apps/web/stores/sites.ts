import { defineStore } from 'pinia'
import type { Site, SiteStatus, SiteWrite } from '~/lib/schemas/sites'

type StatusMap = Record<string, SiteStatus | null>

type SitesState = {
  items: Site[]
  statuses: StatusMap
  loading: boolean
  error: string | null
}

const ensureStatusMap = (input: Record<string, SiteStatus | null> | undefined): StatusMap => {
  if (!input) {
    return {}
  }
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value ?? null])
  ) as StatusMap
}

export const useSitesStore = defineStore('sites', {
  state: (): SitesState => ({
    items: [],
    statuses: {},
    loading: false,
    error: null
  }),
  getters: {
    hasSites: (state) => state.items.length > 0
  },
  actions: {
    updateSite(site: Site) {
      const index = this.items.findIndex((item) => item.id === site.id)
      if (index === -1) {
        this.items.push(site)
      } else {
        this.items.splice(index, 1, site)
      }
      this.items.sort((a, b) => a.id.localeCompare(b.id))
      if (!(site.id in this.statuses)) {
        this.statuses = { ...this.statuses, [site.id]: this.statuses[site.id] ?? null }
      }
    },
    setStatus(id: string, status: SiteStatus | null) {
      this.statuses = { ...this.statuses, [id]: status }
    },
    removeSite(id: string) {
      this.items = this.items.filter((item) => item.id !== id)
      const { [id]: _removed, ...rest } = this.statuses
      this.statuses = rest
    },
    async fetchSites() {
      this.loading = true
      this.error = null
      try {
        const response = await $fetch<{ sites: Site[]; statuses: Record<string, SiteStatus | null> }>(
          '/api/sites'
        )
        this.items = (response.sites ?? []).slice().sort((a, b) => a.id.localeCompare(b.id))
        this.statuses = ensureStatusMap(response.statuses)
        return response
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error cargando sitios'
        this.error = message
        throw error
      } finally {
        this.loading = false
      }
    },
    getStatus(id: string): SiteStatus | null {
      return this.statuses[id] ?? null
    },
    async deleteSite(id: string) {
      await $fetch(`/api/sites/${id}`, { method: 'DELETE' })
      this.removeSite(id)
    },
    async pause(id: string) {
      const response = await $fetch<{ site: Site }>(`/api/sites/${id}/pause`, { method: 'POST' })
      this.updateSite(response.site)
    },
    async resume(id: string) {
      const response = await $fetch<{ site: Site }>(`/api/sites/${id}/resume`, { method: 'POST' })
      this.updateSite(response.site)
    },
    async upsert(payload: SiteWrite) {
      const response = await $fetch<{ site: Site }>('/api/sites', {
        method: 'POST',
        body: payload
      })
      this.updateSite(response.site)
      return response.site
    },
    async checkNow(id: string) {
      await $fetch(`/api/sites/${id}/check`, { method: 'POST' })
    }
  }
})

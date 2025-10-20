import type { Site } from '~/lib/schemas/sites'

type CommandPayload = {
  id: string
  url: string
  interval_s: number
  mode: Site['mode']
  selector_css?: string
  start_marker?: string
  end_marker?: string
  regex?: string
  headers?: Record<string, string>
  paused?: boolean
}

export const buildSiteCommandPayload = (site: Site): CommandPayload => ({
  id: site.id,
  url: site.url,
  interval_s: site.interval_s,
  mode: site.mode,
  selector_css: site.selector_css ?? undefined,
  start_marker: site.start_marker ?? undefined,
  end_marker: site.end_marker ?? undefined,
  regex: site.regex ?? undefined,
  headers: site.headers && Object.keys(site.headers).length > 0 ? site.headers : undefined,
  paused: site.paused ?? false
})

export const buildIdPayload = (id: string) => ({ id })

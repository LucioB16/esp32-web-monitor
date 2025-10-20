import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  deleteSite,
  getSiteStatus,
  listSiteIds,
  listSites,
  pauseSite,
  resumeSite,
  upsertSite,
  updateStatus
} from '../sites'

const baseSite = {
  id: 'demo-site',
  url: 'https://example.com',
  interval_s: 120,
  mode: 'full' as const
}

beforeEach(async () => {
  const ids = await listSiteIds()
  await Promise.all(ids.map((id) => deleteSite(id)))
})

test('create and list sites', async () => {
  const site = await upsertSite(baseSite)
  assert.equal(site.id, baseSite.id)
  const sites = await listSites()
  assert.equal(sites.length, 1)
  assert.equal(sites[0]?.id, baseSite.id)
  assert.equal(sites[0]?.paused, false)
})

test('pause and resume site', async () => {
  const site = await upsertSite(baseSite)
  assert.equal(site.paused, false)
  const paused = await pauseSite(site.id)
  assert.equal(paused.paused, true)
  const resumed = await resumeSite(site.id)
  assert.equal(resumed.paused, false)
})

test('update site status', async () => {
  await upsertSite(baseSite)
  const status = await updateStatus({ id: baseSite.id, last_http: 200, last_changed: true })
  assert.equal(status.id, baseSite.id)
  const stored = await getSiteStatus(baseSite.id)
  assert.equal(stored?.last_http, 200)
  assert.equal(stored?.last_changed, true)
})

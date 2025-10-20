import { defineEventHandler, readBody } from 'h3'
import { upsertSite } from '~/server/data/sites'
import { publishCommand, resolveMqttConfig } from '~/server/utils/mqtt'
import { buildSiteCommandPayload } from '~/server/utils/siteCommands'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const site = await upsertSite(body)
  await publishCommand(
    {
      type: 'UPSERT_SITE',
      payload: buildSiteCommandPayload(site)
    },
    resolveMqttConfig(event)
  )
  return { site }
})

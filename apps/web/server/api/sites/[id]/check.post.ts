import { createError, defineEventHandler } from 'h3'
import { getSite } from '~/server/data/sites'
import { siteIdSchema } from '~/lib/schemas/sites'
import { publishCommand, resolveMqttConfig } from '~/server/utils/mqtt'
import { buildIdPayload } from '~/server/utils/siteCommands'

export default defineEventHandler(async (event) => {
  const id = siteIdSchema.parse(event.context.params?.id)
  const site = await getSite(id)
  if (!site) {
    throw createError({ statusCode: 404, statusMessage: 'Sitio no encontrado' })
  }
  await publishCommand({ type: 'CHECK_NOW', payload: buildIdPayload(id) }, resolveMqttConfig(event))
  return { ok: true }
})

import { createError, defineEventHandler } from 'h3'
import { deleteSite, getSite } from '~/server/data/sites'
import { publishCommand, resolveMqttConfig } from '~/server/utils/mqtt'
import { buildIdPayload } from '~/server/utils/siteCommands'
import { siteIdSchema } from '~/lib/schemas/sites'

export default defineEventHandler(async (event) => {
  const id = siteIdSchema.parse(event.context.params?.id)
  const existing = await getSite(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Sitio no encontrado' })
  }
  await deleteSite(id)
  await publishCommand({ type: 'DELETE_SITE', payload: buildIdPayload(id) }, resolveMqttConfig(event))
  return { ok: true }
})

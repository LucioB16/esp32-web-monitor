import { createError, defineEventHandler } from 'h3'
import { pauseSite, SiteNotFoundError } from '~/server/data/sites'
import { publishCommand, resolveMqttConfig } from '~/server/utils/mqtt'
import { buildIdPayload } from '~/server/utils/siteCommands'
import { siteIdSchema } from '~/lib/schemas/sites'

export default defineEventHandler(async (event) => {
  const id = siteIdSchema.parse(event.context.params?.id)
  try {
    const site = await pauseSite(id)
    await publishCommand({ type: 'PAUSE_SITE', payload: buildIdPayload(site.id) }, resolveMqttConfig(event))
    return { site }
  } catch (error) {
    if (error instanceof SiteNotFoundError) {
      throw createError({ statusCode: 404, statusMessage: 'Sitio no encontrado' })
    }
    throw error
  }
})

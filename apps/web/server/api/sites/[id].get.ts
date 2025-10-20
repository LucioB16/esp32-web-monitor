import { createError, defineEventHandler } from 'h3'
import { getSite, getSiteStatus } from '~/server/data/sites'
import { siteIdSchema } from '~/lib/schemas/sites'

export default defineEventHandler(async (event) => {
  const id = siteIdSchema.parse(event.context.params?.id)
  const site = await getSite(id)
  if (!site) {
    throw createError({ statusCode: 404, statusMessage: 'Sitio no encontrado' })
  }
  const status = await getSiteStatus(id)
  return { site, status }
})

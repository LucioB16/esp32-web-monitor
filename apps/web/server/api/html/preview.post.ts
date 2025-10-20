import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'

const requestSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string()).optional()
})

const MAX_BYTES = 400_000
const TIMEOUT_MS = 8_000

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = requestSchema.parse(body)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(parsed.url, {
      headers: parsed.headers,
      signal: controller.signal,
      redirect: 'follow'
    })
  } catch (error) {
    clearTimeout(timeout)
    throw createError({
      statusCode: 502,
      statusMessage: 'Error al obtener la página para vista previa',
      data: { message: (error as Error).message }
    })
  }

  clearTimeout(timeout)

  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      statusMessage: `No se pudo obtener la página (HTTP ${response.status})`
    })
  }

  const reader = response.body?.getReader()
  let received = 0
  const chunks: Uint8Array[] = []

  if (reader) {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      if (value) {
        received += value.byteLength
        if (received > MAX_BYTES) {
          throw createError({
            statusCode: 413,
            statusMessage: 'La respuesta HTML excede el tamaño permitido para vista previa'
          })
        }
        chunks.push(value)
      }
    }
  }

  const rawHtml = reader
    ? (() => {
        const merged = new Uint8Array(received)
        let offset = 0
        for (const chunk of chunks) {
          merged.set(chunk, offset)
          offset += chunk.byteLength
        }
        return new TextDecoder('utf-8', { fatal: false }).decode(merged)
      })()
    : await response.text()

  const sanitized = rawHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')

  const url = new URL(parsed.url)
  const baseHref = `${url.origin}${url.pathname.replace(/[^/]*$/, '')}`

  return {
    ok: true,
    html: sanitized,
    baseHref,
    status: response.status
  }
})

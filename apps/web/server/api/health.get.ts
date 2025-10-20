import { defineEventHandler } from 'h3'
import { getStorageKind } from '~/server/utils/redis'

export default defineEventHandler(() => {
  return {
    ok: true,
    timestamp: new Date().toISOString(),
    storage: {
      type: getStorageKind()
    }
  }
})

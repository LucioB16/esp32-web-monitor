import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { commandSchema, publishCommand, resolveMqttConfig } from '~/server/utils/mqtt'

type CommandInput = z.infer<typeof commandSchema>

const ensureConfig = (config: MqttConfig) => {
  if (!config.mqttUrlWss) {
    throw createError({ statusCode: 500, statusMessage: 'MQTT_URL_WSS no definido' })
  }
  if (!config.deviceId) {
    throw createError({ statusCode: 500, statusMessage: 'DEVICE_ID no definido' })
  }
  if (!config.deviceSecret) {
    throw createError({ statusCode: 500, statusMessage: 'DEVICE_SECRET no definido' })
  }
}

export default defineEventHandler(async (event) => {
  const runtimeConfig = resolveMqttConfig(event)
  ensureConfig(runtimeConfig)

  const body = (await readBody(event)) as CommandInput
  const parsed = commandSchema.parse(body)
  const result = await publishCommand(parsed, runtimeConfig)

  return { ok: true, topic: result.topic, ts: result.command.ts }
})

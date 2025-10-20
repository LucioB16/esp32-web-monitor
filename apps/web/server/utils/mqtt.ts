import mqtt, { type IClientOptions, type MqttClient } from 'mqtt'
import { useRuntimeConfig } from '#imports'
import type { H3Event } from 'h3'
import { commandSchema, type CommandInput } from '~/lib/mqtt/commands'
import { deriveTopicSuffix, hmacSha256Base64 } from '~/lib/crypto/hmac'

export interface MqttConfig {
  mqttUrlWss: string
  deviceId: string
  deviceSecret: string
}

export const resolveMqttConfig = (event: H3Event): MqttConfig => {
  const config = useRuntimeConfig(event)
  return {
    mqttUrlWss: config.mqttUrlWss,
    deviceId: config.deviceId,
    deviceSecret: config.deviceSecret
  }
}

const connectClient = (url: string, options: IClientOptions): Promise<MqttClient> => {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(url, options)
    const cleanup = () => {
      client.removeListener('error', onError)
      client.removeListener('connect', onConnect)
    }
    const onError = (err: Error) => {
      cleanup()
      reject(err)
    }
    const onConnect = () => {
      cleanup()
      resolve(client)
    }
    client.once('error', onError)
    client.once('connect', onConnect)
  })
}

const publishAsync = (client: MqttClient, topic: string, payload: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    client.publish(topic, payload, { qos: 1, retain: false }, (error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

const ensureConfig = (config: MqttConfig) => {
  if (!config.mqttUrlWss) {
    throw new Error('MQTT_URL_WSS no definido')
  }
  if (!config.deviceId) {
    throw new Error('DEVICE_ID no definido')
  }
  if (!config.deviceSecret) {
    throw new Error('DEVICE_SECRET no definido')
  }
}

export const publishCommand = async (
  commandInput: CommandInput,
  config: MqttConfig
): Promise<{ topic: string; command: CommandInput & { hmac: string; ts: number } }> => {
  ensureConfig(config)
  const parsed = commandSchema.parse(commandInput)
  const command = {
    type: parsed.type,
    payload: parsed.payload,
    ts: parsed.ts ?? Date.now()
  }

  const message = JSON.stringify(command)
  const hmac = await hmacSha256Base64(config.deviceSecret, message)
  const commandWithHmac = { ...command, hmac }
  const suffix = await deriveTopicSuffix(config.deviceId, config.deviceSecret)
  const topic = `devices/${config.deviceId}-${suffix}/commands`

  const clientId = `admin-${crypto.randomUUID().slice(0, 8)}`
  const client = await connectClient(config.mqttUrlWss, {
    clientId,
    protocolVersion: 5,
    clean: true,
    reconnectPeriod: 0,
    rejectUnauthorized: true
  })

  try {
    await publishAsync(client, topic, JSON.stringify(commandWithHmac))
  } finally {
    client.end(true)
  }

  return { topic, command: commandWithHmac }
}

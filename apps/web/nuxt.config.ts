import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  ssr: true,
  nitro: {
    preset: 'vercel'
  },
  typescript: {
    strict: true,
    shim: false
  },
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss'],
  css: ['~/assets/css/tailwind.css'],
  runtimeConfig: {
    mqttUrlWss: process.env.MQTT_URL_WSS ?? '',
    deviceId: process.env.DEVICE_ID ?? '',
    deviceSecret: process.env.DEVICE_SECRET ?? '',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    telegramChatId: process.env.TELEGRAM_CHAT_ID ?? '',
    telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? '',
    public: {
      mqttUrlWss:
        process.env.NUXT_PUBLIC_MQTT_URL_WSS ?? process.env.MQTT_URL_WSS ?? '',
      deviceId: process.env.DEVICE_ID ?? ''
    }
  }
})

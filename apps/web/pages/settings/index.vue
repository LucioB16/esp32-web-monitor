<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <h1 class="text-2xl font-semibold">Ajustes</h1>
      <p class="text-sm text-slate-400">
        Configura la integración con Telegram y revisa credenciales clave del dispositivo y MQTT.
      </p>
    </header>

    <div class="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
      <form class="grid gap-4 rounded-lg border border-slate-800 bg-slate-900/60 p-6" @submit.prevent="handleSubmit">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-100">Telegram</h2>
          <span v-if="state.updatedAt" class="text-xs text-slate-500">
            Última actualización: {{ formatTimestamp(state.updatedAt) }}
          </span>
        </div>

        <div class="grid gap-2">
          <label class="text-sm font-medium text-slate-200" for="telegram-chat">Chat ID</label>
          <input
            id="telegram-chat"
            v-model.trim="form.chatId"
            type="text"
            placeholder="123456789"
            class="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          />
          <p class="text-xs text-slate-500">
            ID numérico del chat o grupo. El bot debe estar invitado para enviar mensajes.
          </p>
        </div>

        <div class="grid gap-2">
          <label class="text-sm font-medium text-slate-200" for="telegram-token">Bot Token</label>
          <input
            id="telegram-token"
            v-model.trim="form.botToken"
            type="password"
            placeholder="Introduce nuevo token para reemplazar"
            class="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          />
          <p class="text-xs text-slate-500">
            Actual: <span class="font-mono text-slate-300">{{ state.tokenMasked || '—' }}</span>
          </p>
          <label class="flex items-center gap-2 text-xs text-slate-400">
            <input v-model="form.clearToken" type="checkbox" class="rounded border-slate-700 bg-slate-950" />
            Eliminar token almacenado (volverá a usar el de entorno si existe).
          </label>
        </div>

        <div class="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span class="rounded bg-slate-800/70 px-2 py-1">Chat configurado: {{ state.hasChat ? 'sí' : 'no' }}</span>
          <span class="rounded bg-slate-800/70 px-2 py-1">Token disponible: {{ state.hasToken ? 'sí' : 'no' }}</span>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button
            type="button"
            class="rounded border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 disabled:cursor-not-allowed disabled:text-slate-500"
            :disabled="state.saving"
            @click="resetForm"
          >
            Restablecer
          </button>
          <button
            type="submit"
            class="rounded bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            :disabled="state.saving"
          >
            {{ state.saving ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </form>

      <aside class="grid gap-4 rounded-lg border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
        <h2 class="text-lg font-semibold text-slate-100">Variables visibles</h2>
        <div class="space-y-3">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500">Device ID</p>
            <p class="font-mono text-slate-100">{{ deviceId || '—' }}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500">MQTT WSS</p>
            <p class="font-mono text-slate-100 break-all">{{ mqttUrl || '—' }}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500">Webhook path</p>
            <p class="font-mono text-slate-100">/api/telegram/webhook/{{ webhookSecret }}</p>
            <p class="text-xs text-slate-500">Configura el endpoint en BotFather usando la URL pública de Vercel.</p>
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { useToasts } from '~/composables/useToasts'

const runtime = useRuntimeConfig()
const { push } = useToasts()

const deviceId = runtime.public.deviceId
const mqttUrl = runtime.public.mqttUrlWss
const webhookSecret = runtime.telegramWebhookSecret || '—'

const form = reactive({
  chatId: '',
  botToken: '',
  clearToken: false
})

const state = reactive({
  tokenMasked: '',
  hasToken: false,
  hasChat: false,
  updatedAt: null as number | null,
  saving: false
})

const resetForm = () => {
  form.botToken = ''
  form.clearToken = false
}

const formatTimestamp = (ts: number | null) => {
  if (!ts) {
    return '—'
  }
  try {
    return new Date(ts).toLocaleString()
  } catch (error) {
    return '—'
  }
}

const loadConfig = async () => {
  try {
    const response = await $fetch<{ chatId: string; tokenMasked: string; hasToken: boolean; hasChatId: boolean; updatedAt: number | null }>(
      '/api/config/telegram'
    )
    form.chatId = response.chatId ?? ''
    state.tokenMasked = response.tokenMasked ?? ''
    state.hasToken = response.hasToken
    state.hasChat = response.hasChatId
    state.updatedAt = response.updatedAt ?? null
    resetForm()
  } catch (error) {
    if (import.meta.client) {
      push({ message: 'No se pudo cargar la configuración de Telegram', variant: 'error' })
    }
  }
}

await loadConfig()

const handleSubmit = async () => {
  state.saving = true
  try {
    const payload: Record<string, string> = { chatId: form.chatId }
    if (form.clearToken) {
      payload.botToken = ''
    } else if (form.botToken.trim().length > 0) {
      payload.botToken = form.botToken.trim()
    }
    const response = await $fetch<{
      chatId: string
      tokenMasked: string
      hasToken: boolean
      hasChatId: boolean
      updatedAt: number | null
    }>('/api/config/telegram', {
      method: 'PUT',
      body: payload
    })
    state.tokenMasked = response.tokenMasked ?? ''
    state.hasToken = response.hasToken
    state.hasChat = response.hasChatId
    state.updatedAt = response.updatedAt ?? null
    form.chatId = response.chatId ?? ''
    resetForm()
    push({ message: 'Configuración de Telegram actualizada', variant: 'success' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar la configuración'
    push({ message, variant: 'error' })
  } finally {
    state.saving = false
  }
}
</script>

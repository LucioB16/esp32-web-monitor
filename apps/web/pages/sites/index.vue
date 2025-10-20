<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <h1 class="text-2xl font-semibold">Sitios monitoreados</h1>
      <p class="text-sm text-slate-400">
        Gestiona los sitios que el ESP32 vigilará. Completa el formulario y utiliza el helper para generar un selector CSS preciso.
      </p>
    </header>

    <form class="grid gap-6 rounded-lg border border-slate-800 bg-slate-900/60 p-6" @submit.prevent="handleSubmit">
      <div class="grid gap-2">
        <label class="text-sm font-medium text-slate-200" for="site-id">Identificador</label>
        <input
          id="site-id"
          v-model.trim="form.id"
          type="text"
          required
          placeholder="ej. tienda-ps5"
          class="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        />
        <p class="text-xs text-slate-500">Usado como clave en MQTT y almacenamiento.</p>
      </div>

      <div class="grid gap-2">
        <label class="text-sm font-medium text-slate-200" for="site-url">URL a monitorear</label>
        <input
          id="site-url"
          v-model.trim="form.url"
          type="url"
          required
          placeholder="https://ejemplo.com/producto"
          class="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        />
        <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Intervalo</span>
          <input
            v-model.number="form.interval_s"
            type="number"
            min="60"
            step="60"
            class="w-28 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
          />
          <span>segundos</span>
        </div>
      </div>

      <div class="grid gap-2">
        <label class="text-sm font-medium text-slate-200" for="site-mode">Modo de extracción</label>
        <select
          id="site-mode"
          v-model="form.mode"
          class="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        >
          <option value="full">Descarga completa</option>
          <option value="selector">Selector CSS</option>
          <option value="markers">Marcadores de texto</option>
          <option value="regex">Expresión regular</option>
        </select>
        <p class="text-xs text-slate-500">
          El firmware soporta múltiples estrategias. El helper es ideal para <strong>Selector CSS</strong>.
        </p>
      </div>

      <div v-if="form.mode === 'selector'" class="grid gap-3">
        <div class="grid gap-2">
          <label class="text-sm font-medium text-slate-200" for="site-selector">Selector CSS</label>
          <input
            id="site-selector"
            v-model="form.selector_css"
            type="text"
            placeholder="#price span"
            class="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          />
          <p class="text-xs text-slate-500">Se actualiza automáticamente con el helper.</p>
        </div>

        <div>
          <button
            type="button"
            class="rounded bg-sky-500/90 px-3 py-1.5 text-sm font-medium text-sky-50 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700"
            :disabled="!form.url || preview.loading"
            @click="generatePreview"
          >
            {{ preview.loading ? 'Generando vista previa…' : 'Generar vista previa' }}
          </button>
          <p v-if="preview.error" class="mt-2 text-xs text-red-300">{{ preview.error }}</p>
        </div>

        <HelperSelector
          v-if="preview.html || preview.loading"
          v-model="form.selector_css"
          :html="preview.html"
          :base-url="preview.baseHref"
          :loading="preview.loading"
          :error="preview.error"
          @select="handleSelect"
        />

        <p v-if="preview.lastSample" class="text-xs text-slate-400">
          Último texto detectado: <span class="text-slate-200">{{ preview.lastSample }}</span>
        </p>
      </div>

      <div v-if="form.mode === 'markers'" class="grid gap-2">
        <label class="text-sm font-medium text-slate-200" for="site-start">Marcadores HTML</label>
        <input
          id="site-start"
          v-model="form.start_marker"
          type="text"
          placeholder="&lt;!--START--&gt;"
          class="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        />
        <input
          id="site-end"
          v-model="form.end_marker"
          type="text"
          placeholder="&lt;!--END--&gt;"
          class="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <div v-if="form.mode === 'regex'" class="grid gap-2">
        <label class="text-sm font-medium text-slate-200" for="site-regex">Expresión regular</label>
        <textarea
          id="site-regex"
          v-model="form.regex"
          rows="3"
          placeholder="Precio:\\s*\\$([0-9\.]+)"
          class="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        />
        <p class="text-xs text-slate-500">Recuerda escapar barras invertidas.</p>
      </div>

      <div class="grid gap-2">
        <label class="text-sm font-medium text-slate-200" for="site-headers">Cabeceras HTTP opcionales</label>
        <textarea
          id="site-headers"
          v-model="headersRaw"
          rows="3"
          placeholder="User-Agent: ESP32Monitor"
          class="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        />
        <p class="text-xs text-slate-500">Formato: <code>Nombre: Valor</code> por línea.</p>
      </div>

      <div class="flex justify-end gap-3">
        <button
          type="reset"
          class="rounded border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
          @click="resetForm"
        >
          Limpiar
        </button>
        <button
          type="submit"
          class="rounded bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400"
        >
          Guardar sitio (pendiente de MQTT)
        </button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import HelperSelector from '~/components/HelperSelector.vue'

interface SiteForm {
  id: string
  url: string
  interval_s: number
  mode: 'full' | 'selector' | 'markers' | 'regex'
  selector_css: string
  start_marker: string
  end_marker: string
  regex: string
  headers: Record<string, string>
}

const defaultForm = (): SiteForm => ({
  id: '',
  url: '',
  interval_s: 900,
  mode: 'selector',
  selector_css: '',
  start_marker: '',
  end_marker: '',
  regex: '',
  headers: {}
})

const form = reactive<SiteForm>(defaultForm())
const headersRaw = ref('')

const preview = reactive({
  html: '',
  baseHref: '',
  loading: false,
  error: '',
  lastSample: ''
})

const parseHeaders = () => {
  const result: Record<string, string> = {}
  headersRaw.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [key, ...rest] = line.split(':')
      if (!key || rest.length === 0) {
        return
      }
      result[key.trim()] = rest.join(':').trim()
    })
  return result
}

const generatePreview = async () => {
  preview.loading = true
  preview.error = ''
  preview.html = ''
  preview.baseHref = ''
  preview.lastSample = ''
  try {
    const response = await $fetch<{ html: string; baseHref: string }>('/api/html/preview', {
      method: 'POST',
      body: {
        url: form.url,
        headers: parseHeaders()
      }
    })
    preview.html = response.html
    preview.baseHref = response.baseHref
  } catch (error) {
    preview.error = error instanceof Error ? error.message : 'Error desconocido generando vista previa'
  } finally {
    preview.loading = false
  }
}

const handleSelect = (payload: { selector: string; text: string }) => {
  preview.lastSample = payload.text
  form.selector_css = payload.selector
}

const resetForm = () => {
  Object.assign(form, defaultForm())
  headersRaw.value = ''
  preview.html = ''
  preview.baseHref = ''
  preview.error = ''
  preview.lastSample = ''
}

const handleSubmit = () => {
  // La persistencia se implementará junto con las APIs de sitios.
  form.headers = parseHeaders()
  if (import.meta.client) {
    window.alert('Guardar sitio vía MQTT se implementará en commits posteriores.')
  } else {
    console.info('Guardar sitio vía MQTT se implementará en commits posteriores.')
  }
}
</script>

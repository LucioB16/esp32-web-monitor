<template>
  <section class="space-y-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="space-y-2">
        <h1 class="text-2xl font-semibold">Sitios monitoreados</h1>
        <p class="text-sm text-slate-400">
          Administra la lista de sitios que el ESP32 vigilará. Desde aquí puedes pausar, reanudar o eliminar entradas, y pronto
          podrás guardar cambios con el formulario asistido.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500"
          :disabled="store.loading"
          @click="refresh"
        >
          {{ store.loading ? 'Actualizando…' : 'Actualizar' }}
        </button>
        <button
          type="button"
          class="rounded bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400"
          @click="openCreateForm"
        >
          Agregar sitio
        </button>
      </div>
    </header>

    <div class="rounded-lg border border-slate-800 bg-slate-900/60">
      <div v-if="store.loading && !store.hasSites" class="p-6 text-sm text-slate-400">Cargando sitios…</div>
      <div v-else-if="!store.hasSites" class="flex flex-col gap-4 p-6 text-sm text-slate-400">
        <p>No hay sitios configurados todavía.</p>
        <p>Haz clic en <strong>Agregar sitio</strong> para crear el primero y utiliza el helper visual para definir el selector.</p>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[720px] divide-y divide-slate-800 text-sm">
          <thead class="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="px-4 py-3 text-left">Sitio</th>
              <th class="px-4 py-3 text-left">Intervalo</th>
              <th class="px-4 py-3 text-left">Modo</th>
              <th class="px-4 py-3 text-left">Estado</th>
              <th class="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800">
            <tr v-for="entry in sitesWithStatus" :key="entry.site.id" class="hover:bg-slate-900/60">
              <td class="px-4 py-3 align-top">
                <div class="space-y-1">
                  <p class="font-medium text-slate-100">{{ entry.site.id }}</p>
                  <NuxtLink :to="entry.site.url" target="_blank" class="block text-xs text-sky-400 hover:underline">
                    {{ entry.site.url }}
                  </NuxtLink>
                  <p v-if="entry.site.paused" class="text-xs text-amber-300">Pausado</p>
                </div>
              </td>
              <td class="px-4 py-3 align-top text-xs text-slate-300">
                Cada <strong>{{ entry.site.interval_s }}</strong> segundos
              </td>
              <td class="px-4 py-3 align-top text-xs text-slate-300">{{ modeLabel(entry.site.mode) }}</td>
              <td class="px-4 py-3 align-top text-xs">
                <div class="space-y-1 text-slate-300">
                  <p>
                    Última actualización:
                    <span class="font-medium text-slate-100">{{ formatTimestamp(entry.status?.updated_at) }}</span>
                  </p>
                  <p>
                    HTTP:
                    <span :class="httpStatusClass(entry.status?.last_http)">
                      {{ entry.status?.last_http ?? '—' }}
                    </span>
                  </p>
                  <p v-if="entry.status?.last_changed" class="text-emerald-300">Cambios detectados recientemente.</p>
                  <p v-if="entry.status?.last_error" class="text-red-300">{{ entry.status.last_error }}</p>
                </div>
              </td>
              <td class="px-4 py-3 align-top">
                <div class="flex flex-wrap justify-end gap-2 text-xs">
                  <button
                    type="button"
                    class="rounded border border-slate-700 px-3 py-1 font-medium text-slate-200 transition hover:border-slate-500"
                    @click="editSite(entry.site)"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    class="rounded border border-sky-500/60 px-3 py-1 font-medium text-sky-300 transition hover:border-sky-400"
                    :disabled="isActionBusy(entry.site.id)"
                    @click="handleCheckNow(entry.site)"
                  >
                    Check Now
                  </button>
                  <button
                    type="button"
                    class="rounded border px-3 py-1 font-medium transition"
                    :class="entry.site.paused ? 'border-emerald-500/60 text-emerald-300 hover:border-emerald-400' : 'border-amber-500/60 text-amber-300 hover:border-amber-400'"
                    :disabled="isActionBusy(entry.site.id)"
                    @click="togglePause(entry.site)"
                  >
                    {{ entry.site.paused ? 'Reanudar' : 'Pausar' }}
                  </button>
                  <button
                    type="button"
                    class="rounded border border-red-500/60 px-3 py-1 font-medium text-red-300 transition hover:border-red-400"
                    :disabled="isActionBusy(entry.site.id)"
                    @click="handleDelete(entry.site)"
                  >
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <form v-if="showForm" class="grid gap-6 rounded-lg border border-slate-800 bg-slate-900/60 p-6" @submit.prevent="handleSubmit">
      <header class="flex flex-col gap-1">
        <h2 class="text-xl font-semibold">{{ isEditing ? 'Editar sitio' : 'Nuevo sitio' }}</h2>
        <p class="text-sm text-slate-400">
          Completa los datos del sitio y utiliza el helper para identificar el elemento HTML a monitorear.
        </p>
      </header>

      <div class="grid gap-2">
        <label class="text-sm font-medium text-slate-200" for="site-id">Identificador</label>
        <input
          id="site-id"
          v-model.trim="form.id"
          type="text"
          :disabled="isEditing"
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

      <div class="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          class="rounded border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 disabled:cursor-not-allowed disabled:text-slate-500"
          :disabled="saving"
          @click="closeForm"
        >
          Cancelar
        </button>
        <button
          type="submit"
          class="rounded bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          :disabled="saving"
        >
          {{ saving ? 'Guardando…' : 'Guardar sitio' }}
        </button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import HelperSelector from '~/components/HelperSelector.vue'
import { useToasts } from '~/composables/useToasts'
import type { Mode, Site, SiteWrite } from '~/lib/schemas/sites'
import { useSitesStore } from '~/stores/sites'

interface SiteForm {
  id: string
  url: string
  interval_s: number
  mode: Mode
  selector_css?: string
  start_marker?: string
  end_marker?: string
  regex?: string
  headers: Record<string, string>
  paused?: boolean
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
  headers: {},
  paused: false
})

const store = useSitesStore()
const { push } = useToasts()

const form = reactive<SiteForm>(defaultForm())
const headersRaw = ref('')
const showForm = ref(false)
const editingId = ref<string | null>(null)
const actionBusy = reactive<Record<string, boolean>>({})
const saving = ref(false)

const preview = reactive({
  html: '',
  baseHref: '',
  loading: false,
  error: '',
  lastSample: ''
})

const modeLabel = (mode: Mode): string => {
  switch (mode) {
    case 'full':
      return 'Descarga completa'
    case 'selector':
      return 'Selector CSS'
    case 'markers':
      return 'Marcadores'
    case 'regex':
      return 'Exp. regular'
    default:
      return mode
  }
}

const httpStatusClass = (status?: number) => {
  if (!status) {
    return 'text-slate-300'
  }
  if (status >= 200 && status < 300) {
    return 'text-emerald-300'
  }
  if (status >= 400) {
    return 'text-red-300'
  }
  return 'text-slate-300'
}

const formatTimestamp = (timestamp?: number | null): string => {
  if (!timestamp) {
    return '—'
  }
  try {
    return new Date(timestamp).toLocaleString()
  } catch (error) {
    return '—'
  }
}

const sitesWithStatus = computed(() =>
  store.items.map((site) => ({ site, status: store.getStatus(site.id) }))
)

const isEditing = computed(() => editingId.value !== null)

const resetPreview = () => {
  preview.html = ''
  preview.baseHref = ''
  preview.loading = false
  preview.error = ''
  preview.lastSample = ''
}

const resetForm = () => {
  Object.assign(form, defaultForm())
  headersRaw.value = ''
  resetPreview()
}

const openCreateForm = () => {
  editingId.value = null
  resetForm()
  showForm.value = true
}

const closeForm = () => {
  showForm.value = false
  editingId.value = null
  resetForm()
  saving.value = false
}

const stringifyHeaders = (headers?: Record<string, string>) => {
  if (!headers) {
    return ''
  }
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
}

const fillFormFromSite = (site: Site) => {
  Object.assign(form, {
    id: site.id,
    url: site.url,
    interval_s: site.interval_s,
    mode: site.mode,
    selector_css: site.selector_css ?? '',
    start_marker: site.start_marker ?? '',
    end_marker: site.end_marker ?? '',
    regex: site.regex ?? '',
    headers: site.headers ?? {},
    paused: site.paused ?? false
  })
  headersRaw.value = stringifyHeaders(site.headers)
  resetPreview()
}

const editSite = (site: Site) => {
  editingId.value = site.id
  fillFormFromSite(site)
  showForm.value = true
}

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

const buildPayload = (): SiteWrite => {
  const headers = parseHeaders()
  const payload: SiteWrite = {
    id: form.id.trim(),
    url: form.url.trim(),
    interval_s: Number(form.interval_s),
    mode: form.mode,
    selector_css: form.mode === 'selector' ? form.selector_css?.trim() || undefined : undefined,
    start_marker: form.mode === 'markers' ? form.start_marker?.trim() || undefined : undefined,
    end_marker: form.mode === 'markers' ? form.end_marker?.trim() || undefined : undefined,
    regex: form.mode === 'regex' ? form.regex?.trim() || undefined : undefined,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    paused: form.paused ?? false
  }
  return payload
}

const setActionBusy = (id: string, value: boolean) => {
  if (value) {
    actionBusy[id] = true
    return
  }
  delete actionBusy[id]
}

const isActionBusy = (id: string): boolean => Boolean(actionBusy[id])

const refresh = async () => {
  try {
    await store.fetchSites()
    if (import.meta.client) {
      push({ message: 'Lista de sitios actualizada', variant: 'success' })
    }
  } catch (error) {
    if (import.meta.client) {
      push({ message: 'No se pudo actualizar la lista de sitios', variant: 'error' })
    }
  }
}

try {
  await store.fetchSites()
} catch (error) {
  if (import.meta.client) {
    push({ message: 'No se pudo cargar la lista de sitios', variant: 'error' })
  }
}

const handleDelete = async (site: Site) => {
  if (import.meta.client && !window.confirm(`¿Eliminar el sitio “${site.id}”?`)) {
    return
  }
  setActionBusy(site.id, true)
  try {
    await store.deleteSite(site.id)
    push({ message: `Sitio “${site.id}” eliminado`, variant: 'success' })
  } catch (error) {
    push({ message: 'No se pudo eliminar el sitio', variant: 'error' })
  } finally {
    setActionBusy(site.id, false)
  }
}

const togglePause = async (site: Site) => {
  setActionBusy(site.id, true)
  try {
    if (site.paused) {
      await store.resume(site.id)
      push({ message: `Sitio “${site.id}” reanudado`, variant: 'success' })
    } else {
      await store.pause(site.id)
      push({ message: `Sitio “${site.id}” pausado`, variant: 'success' })
    }
  } catch (error) {
    push({ message: 'No se pudo cambiar el estado del sitio', variant: 'error' })
  } finally {
    setActionBusy(site.id, false)
  }
}

const handleCheckNow = async (site: Site) => {
  setActionBusy(site.id, true)
  try {
    await store.checkNow(site.id)
    push({ message: `Se solicitó verificación inmediata para “${site.id}”`, variant: 'success' })
  } catch (error) {
    push({ message: 'No se pudo solicitar la verificación inmediata', variant: 'error' })
  } finally {
    setActionBusy(site.id, false)
  }
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
    preview.error =
      error instanceof Error ? error.message : 'Error desconocido generando vista previa'
  } finally {
    preview.loading = false
  }
}

const handleSelect = (payload: { selector: string; text: string }) => {
  preview.lastSample = payload.text
  form.selector_css = payload.selector
}

const handleSubmit = async () => {
  const payload = buildPayload()
  saving.value = true
  try {
    const site = await store.upsert(payload)
    push({ message: `Sitio “${site.id}” guardado`, variant: 'success' })
    closeForm()
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo guardar el sitio'
    push({ message, variant: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

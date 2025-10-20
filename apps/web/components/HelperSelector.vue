<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="rounded px-3 py-1.5 text-sm font-medium transition"
        :class="buttonClass"
        :disabled="!html || loading"
        @click="toggleSelection"
      >
        {{ selecting ? 'Finalizar selección' : 'Elegir elemento en la vista' }}
      </button>
      <span class="text-xs text-slate-400">
        {{ selecting ? 'Haz clic en el elemento dentro de la vista previa.' : 'Activa la selección para generar selector CSS.' }}
      </span>
      <span v-if="hoveredSelector" class="rounded bg-slate-800 px-2 py-1 text-[11px] text-sky-300">
        Hover: <code class="break-all">{{ hoveredSelector }}</code>
      </span>
    </div>

    <div class="relative aspect-video w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60">
      <iframe
        ref="iframeRef"
        class="h-full w-full"
        title="Vista previa HTML"
        sandbox="allow-same-origin allow-scripts"
      />
      <div
        v-if="loading"
        class="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur"
      >
        <span class="text-sm text-slate-200">Cargando vista previa…</span>
      </div>
      <div
        v-else-if="error"
        class="absolute inset-x-0 bottom-0 bg-red-900/80 px-3 py-2 text-xs text-red-100"
      >
        {{ error }}
      </div>
    </div>

    <div class="grid gap-2 text-xs text-slate-300">
      <div>
        <span class="text-slate-400">Selector actual:</span>
        <code class="block break-all rounded bg-slate-900 px-2 py-1 text-emerald-300">
          {{ modelValue || '—' }}
        </code>
      </div>
      <div v-if="lastText">
        <span class="text-slate-400">Texto capturado:</span>
        <p class="rounded bg-slate-900 px-2 py-1 text-slate-200">{{ lastText }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import CssSelectorGenerator from 'css-selector-generator'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type SelectionResult = {
  selector: string
  text: string
}

const props = defineProps<{
  modelValue: string
  html: string
  baseUrl: string
  loading?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'select', payload: SelectionResult): void
}>()

const iframeRef = ref<HTMLIFrameElement | null>(null)
const selecting = ref(false)
const hoveredSelector = ref('')
const lastText = ref('')
const currentDoc = ref<Document | null>(null)
let cleanupFns: Array<() => void> = []

const generator = new CssSelectorGenerator({
  selectors: ['id', 'class', 'tag', 'nthchild']
})

const buttonClass = computed(() => {
  if (!props.html || props.loading) {
    return 'cursor-not-allowed bg-slate-700 text-slate-400'
  }
  return selecting.value
    ? 'bg-emerald-600 text-emerald-50 hover:bg-emerald-500'
    : 'bg-emerald-500/90 text-emerald-50 hover:bg-emerald-400'
})

const srcdoc = computed(() => {
  const base = props.baseUrl ? `<base href="${props.baseUrl}">` : ''
  const html = props.html?.trim()
    ? props.html
    : '<p style="font-family:system-ui;color:#94a3b8;text-align:center;padding:2rem;">Sin vista previa disponible.</p>'
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />${base}<style>
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; font-family: system-ui, sans-serif; }
      body { background: #0f172a; color: #e2e8f0; min-height: 100vh; }
      a { color: #38bdf8; }
    </style></head><body>${html}</body></html>`
})

const resetCleanup = () => {
  for (const fn of cleanupFns) {
    fn()
  }
  cleanupFns = []
}

const updateIframe = () => {
  const iframe = iframeRef.value
  if (!iframe) {
    return
  }
  selecting.value = false
  hoveredSelector.value = ''
  currentDoc.value = null
  iframe.srcdoc = srcdoc.value
}

const hideHighlight = (doc: Document | null, highlight: HTMLElement | null) => {
  if (!doc || !highlight) {
    return
  }
  highlight.style.display = 'none'
  hoveredSelector.value = ''
}

const setupDocument = (doc: Document) => {
  const highlight = doc.createElement('div')
  highlight.id = 'helper-highlight'
  highlight.style.position = 'absolute'
  highlight.style.background = 'rgba(16, 185, 129, 0.25)'
  highlight.style.outline = '2px solid rgba(16, 185, 129, 0.9)'
  highlight.style.pointerEvents = 'none'
  highlight.style.zIndex = '2147483647'
  highlight.style.display = 'none'
  doc.body.appendChild(highlight)

  const updateHighlight = (element: Element | null) => {
    if (!element) {
      hideHighlight(doc, highlight)
      return
    }
    const rect = element.getBoundingClientRect()
    const view = doc.defaultView
    const scrollY = view ? view.scrollY : 0
    const scrollX = view ? view.scrollX : 0
    highlight.style.display = 'block'
    highlight.style.top = `${rect.top + scrollY}px`
    highlight.style.left = `${rect.left + scrollX}px`
    highlight.style.width = `${rect.width}px`
    highlight.style.height = `${rect.height}px`
  }

  const handleMouseMove = (event: MouseEvent) => {
    if (!selecting.value) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const target = event.target as Element
    updateHighlight(target)
    hoveredSelector.value = generator.getSelector(target)
  }

  const handleClick = (event: MouseEvent) => {
    if (!selecting.value) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const target = event.target as Element
    const selector = generator.getSelector(target)
    const text = (target.textContent || '').trim().slice(0, 200)
    emit('update:modelValue', selector)
    emit('select', { selector, text })
    lastText.value = text
    selecting.value = false
    hideHighlight(doc, highlight)
  }

  const handleKey = (event: KeyboardEvent) => {
    if (!selecting.value) {
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      selecting.value = false
      hideHighlight(doc, highlight)
    }
  }

  const handleLeave = () => {
    hideHighlight(doc, highlight)
  }

  doc.addEventListener('mousemove', handleMouseMove, true)
  doc.addEventListener('click', handleClick, true)
  doc.addEventListener('keydown', handleKey, true)
  doc.addEventListener('mouseleave', handleLeave, true)

  cleanupFns.push(() => {
    doc.removeEventListener('mousemove', handleMouseMove, true)
    doc.removeEventListener('click', handleClick, true)
    doc.removeEventListener('keydown', handleKey, true)
    doc.removeEventListener('mouseleave', handleLeave, true)
    highlight.remove()
  })
}

const handleLoad = () => {
  const iframe = iframeRef.value
  if (!iframe) {
    return
  }
  const doc = iframe.contentDocument
  if (!doc) {
    return
  }
  resetCleanup()
  currentDoc.value = doc
  hoveredSelector.value = ''
  selecting.value = false
  setupDocument(doc)
}

watch(srcdoc, () => {
  updateIframe()
})

onMounted(() => {
  updateIframe()
  iframeRef.value?.addEventListener('load', handleLoad)
})

onBeforeUnmount(() => {
  iframeRef.value?.removeEventListener('load', handleLoad)
  resetCleanup()
})

const toggleSelection = () => {
  if (!iframeRef.value?.contentDocument) {
    return
  }
  if (!selecting.value) {
    selecting.value = true
  } else {
    selecting.value = false
    const doc = currentDoc.value
    hideHighlight(doc, doc?.getElementById('helper-highlight') as HTMLElement | null)
  }
}
</script>

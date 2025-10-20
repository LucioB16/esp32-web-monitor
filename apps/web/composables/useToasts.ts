import { computed } from 'vue'

type ToastVariant = 'info' | 'success' | 'error'

type ToastInput = {
  id?: string
  title?: string
  message: string
  variant?: ToastVariant
  timeoutMs?: number
}

type ToastItem = Required<Pick<ToastInput, 'message'>> & {
  id: string
  title?: string
  variant: ToastVariant
  timeoutMs: number
}

const DEFAULT_TIMEOUT = 4_000

const generateId = (): string => {
  const random = globalThis.crypto?.randomUUID?.()
  if (random) {
    return random
  }
  return Math.random().toString(36).slice(2)
}

export const useToasts = () => {
  const state = useState<ToastItem[]>('toasts', () => [])

  const dismiss = (id: string) => {
    state.value = state.value.filter((toast) => toast.id !== id)
  }

  const push = (input: ToastInput): string => {
    const id = input.id ?? generateId()
    const toast: ToastItem = {
      id,
      title: input.title,
      message: input.message,
      variant: input.variant ?? 'info',
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT
    }
    state.value = [...state.value, toast]
    if (toast.timeoutMs > 0) {
      const timer = setTimeout(() => {
        dismiss(id)
      }, toast.timeoutMs)
      if ((timer as unknown as { unref?: () => void }).unref) {
        ;(timer as unknown as { unref: () => void }).unref()
      }
    }
    return id
  }

  const items = computed(() => state.value)

  return {
    toasts: items,
    push,
    dismiss
  }
}

export type { ToastItem, ToastVariant }

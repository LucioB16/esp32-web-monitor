<template>
  <teleport to="body">
    <transition-group name="toast" tag="div" class="fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-3 px-4">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="w-full max-w-sm rounded-lg border px-4 py-3 shadow-lg backdrop-blur"
        :class="toastClass(toast.variant)"
        role="status"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1">
            <p v-if="toast.title" class="text-sm font-semibold">{{ toast.title }}</p>
            <p class="text-sm">{{ toast.message }}</p>
          </div>
          <button
            type="button"
            class="text-xs text-slate-300 transition hover:text-white"
            @click="dismiss(toast.id)"
          >
            Cerrar
          </button>
        </div>
      </div>
    </transition-group>
  </teleport>
</template>

<script setup lang="ts">
import { useToasts } from '~/composables/useToasts'

const { toasts, dismiss } = useToasts()

const toastClass = (variant: 'info' | 'success' | 'error') => {
  if (variant === 'success') {
    return 'border-emerald-500/50 bg-emerald-950/70 text-emerald-100'
  }
  if (variant === 'error') {
    return 'border-red-500/50 bg-red-950/70 text-red-100'
  }
  return 'border-slate-700 bg-slate-900/80 text-slate-100'
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>

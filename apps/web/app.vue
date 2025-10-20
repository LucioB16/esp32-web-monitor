<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <NuxtLoadingIndicator />
    <header class="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <NuxtLink to="/sites" class="text-lg font-semibold">
          ESP32 Web Monitor
        </NuxtLink>
        <nav class="flex gap-4 text-sm">
          <NuxtLink to="/sites" class="hover:underline">Sitios</NuxtLink>
          <NuxtLink to="/settings" class="hover:underline">Ajustes</NuxtLink>
        </nav>
      </div>
    </header>
    <main class="mx-auto max-w-5xl px-4 py-8">
      <NuxtPage />
    </main>
    <footer class="border-t border-slate-800 bg-slate-900/80 px-4 py-6 text-center text-xs text-slate-400">
      Proyecto educativo — usa servicios gratuitos con responsabilidad.
    </footer>
    <ToastStack />
  </div>
</template>

<script setup lang="ts">
import ToastStack from '~/components/ToastStack.vue'
</script>

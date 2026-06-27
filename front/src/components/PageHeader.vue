<script>
// Reusable page header bar: title left, optional subtitle, actions slot right.
// Matches the design's sticky header pattern (white bg, border-b, 57px height).
export default {
  name: 'PageHeader',
  props: {
    title: { type: String, required: true },
    subtitle: { type: String, default: null },
    back: { type: [Object, String], default: null }, // router link target
  },
}
</script>

<template>
  <header class="flex-shrink-0 px-6 border-b border-zinc-200 flex items-center justify-between gap-5 bg-white"
    style="min-height:57px;padding-top:14px;padding-bottom:14px;">
    <div class="flex items-center gap-3">
      <router-link v-if="back" :to="back" title="Retour"
        class="inline-flex items-center justify-center w-7 h-7 text-zinc-500 hover:text-blue-600 rounded transition-colors">
        <i data-lucide="arrow-left" width="16" height="16"></i>
      </router-link>
      <div>
        <h1 class="text-[19px] font-bold tracking-[-0.02em] text-zinc-900 leading-tight">{{ title }}</h1>
        <p v-if="subtitle" class="text-[13px] text-zinc-400 leading-tight mt-0.5">{{ subtitle }}</p>
      </div>
    </div>
    <div class="flex items-center gap-2 flex-shrink-0">
      <slot />
    </div>
  </header>
</template>

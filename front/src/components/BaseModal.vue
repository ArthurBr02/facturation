<script>
// Modal dialog — backdrop click closes, X button closes. Footer slot for actions.
export default {
  name: 'BaseModal',
  props: {
    title: { type: String, default: '' },
    size: { type: String, default: 'md' }, // sm | md | lg
  },
  emits: ['close'],
  computed: {
    maxW() {
      return { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[this.size] || 'max-w-lg'
    },
  },
  mounted() {
    this.$nextTick(() => window.lucide?.createIcons())
  },
  updated() {
    this.$nextTick(() => window.lucide?.createIcons())
  },
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-zinc-900/30" @click="$emit('close')"></div>
    <div
      class="relative bg-white rounded border border-zinc-200 w-full flex flex-col max-h-[90vh]"
      :class="maxW"
      style="box-shadow: -10px 0 36px rgba(0,0,0,.10)"
    >
      <div class="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <h3 class="text-[16px] font-bold tracking-tight text-zinc-900">{{ title }}</h3>
        <button class="btn-icon" title="Fermer" @click="$emit('close')">
          <i data-lucide="x" width="18" height="18"></i>
        </button>
      </div>
      <div class="px-6 py-5 overflow-y-auto flex-1">
        <slot />
      </div>
      <div v-if="$slots.footer" class="flex-shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-200">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script>
// Reusable button matching the design's compact style (33px, border-radius 4px).
export default {
  name: 'BaseButton',
  props: {
    variant: { type: String, default: 'primary' },  // primary | secondary | ghost | danger
    size: { type: String, default: 'md' },           // md | sm | icon
    icon: { type: String, default: null },           // lucide icon name
    iconRight: { type: String, default: null },
    disabled: { type: Boolean, default: false },
    type: { type: String, default: 'button' },
  },
  emits: ['click'],
  computed: {
    cls() {
      const v = {
        primary: 'btn-primary',
        secondary: 'btn-secondary',
        ghost: 'btn-ghost',
        danger: 'btn-danger',
      }[this.variant] || 'btn-primary'
      const s = this.size === 'sm' ? 'btn-sm' : this.size === 'icon' ? 'btn-icon' : ''
      return [v, s].filter(Boolean).join(' ')
    },
  },
  mounted() {
    this.$nextTick(() => window.lucide?.createIcons())
  },
}
</script>

<template>
  <button :type="type" :disabled="disabled" :class="cls" @click="$emit('click', $event)">
    <i v-if="icon" :data-lucide="icon" width="15" height="15"></i>
    <slot />
    <i v-if="iconRight" :data-lucide="iconRight" width="15" height="15"></i>
  </button>
</template>

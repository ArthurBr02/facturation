<script>
// Colored dot + label badge matching the design's status style.
// Pass dot color + label color + label text via the `meta` prop,
// or use a named `status` + `statusMap` to auto-resolve them.
export default {
  name: 'StatusDot',
  props: {
    dot: { type: String, default: '#a1a1aa' },
    color: { type: String, default: '#52525b' },
    label: { type: String, required: true },
  },
}
</script>

<template>
  <span class="inline-flex items-center gap-[7px]">
    <span class="status-dot" :style="`background:${dot}`"></span>
    <span class="text-[12.5px] font-semibold" :style="`color:${color}`">{{ label }}</span>
  </span>
</template>

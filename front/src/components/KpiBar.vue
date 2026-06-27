<script>
// Horizontal KPI strip displayed below the page header.
// Props: items = [{ label, value, color? }]
export default {
  name: 'KpiBar',
  props: {
    items: { type: Array, required: true },
  },
}
</script>

<template>
  <div class="flex-shrink-0 flex border-b border-zinc-200 bg-zinc-50">
    <div
      v-for="(k, i) in items"
      :key="i"
      class="flex-1 px-6 py-[13px] border-r border-zinc-100 last:border-r-0"
    >
      <div class="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-zinc-400">{{ k.label }}</div>
      <div class="text-[18px] font-bold mt-1 tracking-[-0.02em] tabular leading-none" :style="k.color ? `color:${k.color}` : 'color:#18181b'">
        {{ k.value }}
      </div>
    </div>
  </div>
</template>

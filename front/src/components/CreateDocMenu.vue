<script>
// Dropdown button to create a new document of any primary type.
// Optionally carries a clientId so the target edit view pre-selects the client.
const DOC_TYPES = [
  { name: 'devis-new', label: 'Devis', icon: 'file-text' },
  { name: 'facture-new', label: 'Facture', icon: 'receipt' },
  { name: 'contrat-new', label: 'Contrat de maintenance', icon: 'file-signature' },
]

export default {
  name: 'CreateDocMenu',
  props: {
    clientId: { type: [String, Number], default: null },
    label: { type: String, default: 'Nouveau document' },
  },
  data() {
    return { open: false, types: DOC_TYPES }
  },
  methods: {
    toggle() {
      this.open = !this.open
      if (this.open) this.$nextTick(() => window.lucide?.createIcons())
    },
    close() {
      this.open = false
    },
    create(name) {
      this.close()
      const query = this.clientId ? { clientId: this.clientId } : undefined
      this.$router.push({ name, query })
    },
  },
}
</script>

<template>
  <div class="relative inline-block">
    <button class="btn btn-primary" @click="toggle">
      <i data-lucide="plus" width="15" height="15"></i>
      {{ label }}
      <i data-lucide="chevron-down" width="14" height="14"></i>
    </button>

    <!-- Click-away backdrop -->
    <div v-if="open" class="fixed inset-0 z-30" @click="close"></div>

    <div v-if="open" class="absolute right-0 mt-1 z-40 w-56 bg-white border border-zinc-200 rounded shadow-lg py-1">
      <button
        v-for="t in types"
        :key="t.name"
        class="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-zinc-700 hover:bg-zinc-50 text-left"
        @click="create(t.name)"
      >
        <i :data-lucide="t.icon" width="15" height="15" class="text-zinc-400"></i>
        {{ t.label }}
      </button>
    </div>
  </div>
</template>

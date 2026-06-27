<script>
// Autocomplete designation field: typing filters the product catalog and shows
// a fixed-position dropdown (Teleported to body to escape table stacking context).
// Emits v-model for designation text + 'select-product' with { prixUnitaire }
// so the parent can fill the price on selection.
import { produitsApi } from '@/api'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

export default {
  name: 'ProductPicker',
  props: {
    modelValue: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    placeholder: { type: String, default: 'Désignation ou rechercher dans le catalogue…' },
    rows: { type: Number, default: 1 },
  },
  emits: ['update:modelValue', 'select-product'],
  data() {
    return {
      products: [],
      showDropdown: false,
      dropdownStyle: {},
    }
  },
  computed: {
    filtered() {
      const q = (this.modelValue || '').toLowerCase().trim()
      if (!q) return this.products.slice(0, 8)
      return this.products.filter(
        (p) =>
          p.designation.toLowerCase().includes(q) ||
          (p.reference || '').toLowerCase().includes(q) ||
          (p.categorie || '').toLowerCase().includes(q),
      ).slice(0, 8)
    },
  },
  async created() {
    try {
      this.products = await produitsApi.list({ actif: true })
    } catch { /* silent */ }
  },
  methods: {
    onInput(e) {
      this.$emit('update:modelValue', e.target.value)
      this.$nextTick(() => {
        this.reposition()
        this.showDropdown = this.products.length > 0
      })
    },
    onFocus() {
      if (!this.products.length) return
      this.reposition()
      this.showDropdown = true
    },
    onBlur() {
      // Delay lets the click on a dropdown item register before closing.
      setTimeout(() => { this.showDropdown = false }, 200)
    },
    reposition() {
      const el = this.$refs.input
      if (!el) return
      const r = el.getBoundingClientRect()
      this.dropdownStyle = {
        position: 'fixed',
        top: r.bottom + 4 + 'px',
        left: r.left + 'px',
        width: Math.max(r.width, 320) + 'px',
        zIndex: '9999',
      }
    },
    pick(product) {
      this.$emit('update:modelValue', product.designation)
      this.$emit('select-product', { prixUnitaire: Number(product.prixDefaut) })
      this.showDropdown = false
    },
    fmtEuro(n) { return euro.format(n || 0) },
  },
}
</script>

<template>
  <div class="relative w-full">
    <textarea
      ref="input"
      :value="modelValue"
      :rows="rows"
      :disabled="disabled"
      :placeholder="placeholder"
      class="field-textarea min-h-[34px] w-full"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
    ></textarea>

    <Teleport to="body">
      <div
        v-if="showDropdown && !disabled"
        :style="dropdownStyle"
        class="bg-white border border-zinc-200 rounded-xl shadow-2xl overflow-hidden"
      >
        <!-- Header -->
        <div class="px-3 py-2 bg-zinc-50 border-b border-zinc-100 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-zinc-400"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          <span class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            {{ modelValue ? 'Produits correspondants' : 'Catalogue' }}
          </span>
          <span class="ml-auto text-[11px] text-zinc-300">{{ filtered.length }} / {{ products.length }}</span>
        </div>

        <!-- Results -->
        <div class="max-h-56 overflow-y-auto">
          <div v-if="!filtered.length" class="px-4 py-4 text-center text-[13px] text-zinc-400">
            Aucun produit correspondant
          </div>
          <button
            v-for="p in filtered"
            :key="p.id"
            type="button"
            class="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-start justify-between gap-4 border-b border-zinc-50 last:border-0 transition-colors group"
            @mousedown.prevent="pick(p)"
          >
            <div class="min-w-0">
              <div class="text-[13px] font-medium text-zinc-900 leading-snug group-hover:text-blue-700">{{ p.designation }}</div>
              <div v-if="p.reference || p.categorie" class="text-[11px] text-zinc-400 mt-0.5">
                {{ [p.reference, p.categorie].filter(Boolean).join(' · ') }}
              </div>
            </div>
            <div class="text-right flex-shrink-0 pt-0.5">
              <div class="text-[13px] font-semibold tabular text-zinc-700 group-hover:text-blue-600">{{ fmtEuro(p.prixDefaut) }}</div>
              <div class="text-[11px] text-zinc-400">/ {{ p.unite }}</div>
            </div>
          </button>
        </div>

        <div class="px-3 py-1.5 bg-zinc-50 border-t border-zinc-100 text-[11px] text-zinc-400 text-center">
          Cliquer pour insérer — le prix sera pré-rempli
        </div>
      </div>
    </Teleport>
  </div>
</template>

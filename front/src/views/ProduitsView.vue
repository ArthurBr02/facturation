<script>
import { produitsApi } from '@/api'
import PageHeader from '@/components/PageHeader.vue'
import BaseModal from '@/components/BaseModal.vue'

const UNITE_LABEL = { jour: 'Jour', heure: 'Heure', forfait: 'Forfait', unite: 'Unité' }
const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

function emptyForm() {
  return { reference: '', designation: '', description: '', categorie: '', prixDefaut: 0, unite: 'unite', actif: true }
}

export default {
  name: 'ProduitsView',
  components: { PageHeader, BaseModal },
  data() {
    return {
      produits: [],
      loading: true,
      search: '',
      categorieFilter: '',
      showArchived: false,
      searchTimer: null,
      // modal
      showModal: false,
      editing: null,
      form: emptyForm(),
      saving: false,
      error: '',
    }
  },
  computed: {
    categories() {
      const cats = new Set(this.produits.map((p) => p.categorie).filter(Boolean))
      return [...cats].sort()
    },
    filtered() {
      return this.produits.filter((p) => {
        if (!this.showArchived && !p.actif) return false
        if (this.categorieFilter && p.categorie !== this.categorieFilter) return false
        if (this.search) {
          const q = this.search.toLowerCase()
          return (
            p.designation.toLowerCase().includes(q) ||
            (p.reference && p.reference.toLowerCase().includes(q)) ||
            (p.categorie && p.categorie.toLowerCase().includes(q))
          )
        }
        return true
      })
    },
  },
  created() { this.fetch() },
  methods: {
    async fetch() {
      this.loading = true
      try {
        this.produits = await produitsApi.list()
      } finally { this.loading = false }
    },
    fmtEuro(n) { return euro.format(n || 0) },
    uniteLabel(u) { return UNITE_LABEL[u] || u },
    openCreate() { this.editing = null; this.form = emptyForm(); this.error = ''; this.showModal = true },
    openEdit(p)   { this.editing = p; this.form = { ...p }; this.error = ''; this.showModal = true },
    closeModal()  { this.showModal = false },
    async save() {
      if (!this.form.designation) { this.error = 'La désignation est requise.'; return }
      this.saving = true; this.error = ''
      try {
        const payload = { reference: this.form.reference || null, designation: this.form.designation, description: this.form.description || null, categorie: this.form.categorie || null, prixDefaut: Number(this.form.prixDefaut) || 0, unite: this.form.unite || 'unite', actif: this.form.actif !== false }
        if (this.editing) await produitsApi.update(this.editing.id, payload)
        else await produitsApi.create(payload)
        this.showModal = false; await this.fetch()
      } catch (e) { this.error = e.response?.data?.error || 'Enregistrement impossible' }
      finally { this.saving = false }
    },
    async archive(p) {
      if (!window.confirm(`Archiver « ${p.designation} » ?`)) return
      await produitsApi.archive(p.id); await this.fetch()
    },
  },
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <PageHeader title="Produits & services" subtitle="Catalogue de facturation">
      <div class="relative flex items-center">
        <i data-lucide="search" width="15" height="15" class="absolute left-[9px] text-zinc-400 pointer-events-none"></i>
        <input v-model="search" class="field-input w-[228px] pl-[30px]" placeholder="Rechercher un article…" />
      </div>
      <select v-model="categorieFilter" class="field-input w-40">
        <option value="">Toutes catégories</option>
        <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
      </select>
      <label class="flex items-center gap-1.5 text-[13px] text-zinc-600 cursor-pointer whitespace-nowrap">
        <input v-model="showArchived" type="checkbox" class="rounded" />
        Archivés
      </label>
      <button class="btn-primary" @click="openCreate">
        <i data-lucide="plus" width="15" height="15"></i>
        Nouveau produit
      </button>
    </PageHeader>

    <div class="flex-1 overflow-auto bg-white">
      <div v-if="loading" class="p-8 text-center text-[13px] text-zinc-400">Chargement…</div>
      <table v-else class="w-full border-collapse">
        <thead class="t-head">
          <tr>
            <th class="t-th">Référence</th>
            <th class="t-th">Désignation</th>
            <th class="t-th">Catégorie</th>
            <th class="t-th-right">Prix HT</th>
            <th class="t-th">Unité</th>
            <th class="w-[70px] border-b border-zinc-200"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!filtered.length">
            <td colspan="6" class="px-4 py-8 text-center text-[13px] text-zinc-400">
              Aucun produit.
              <button class="text-blue-600 hover:underline ml-1" @click="openCreate">Créer le premier</button>
            </td>
          </tr>
          <tr v-for="p in filtered" :key="p.id" class="t-tr" :class="!p.actif ? 'opacity-50' : ''">
            <td class="t-td-mono text-zinc-600">{{ p.reference || '—' }}</td>
            <td class="t-td text-zinc-900">{{ p.designation }}</td>
            <td class="t-td">
              <span v-if="p.categorie" class="tag">{{ p.categorie }}</span>
              <span v-else class="text-zinc-400">—</span>
            </td>
            <td class="t-td-right t-td-mono text-zinc-900">{{ fmtEuro(p.prixDefaut) }}</td>
            <td class="t-td text-zinc-500">{{ uniteLabel(p.unite) }}</td>
            <td class="px-3 text-right">
              <div class="flex items-center justify-end gap-0.5">
                <button class="btn-icon" title="Modifier" @click="openEdit(p)">
                  <i data-lucide="pencil" width="14" height="14"></i>
                </button>
                <button v-if="p.actif" class="btn-icon" title="Archiver" @click="archive(p)">
                  <i data-lucide="archive" width="14" height="14"></i>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <BaseModal v-if="showModal" :title="editing ? 'Modifier le produit' : 'Nouveau produit'" @close="closeModal">
      <div class="space-y-4">
        <p v-if="error" class="text-[13px] text-error-fg bg-error-bg p-3 rounded">{{ error }}</p>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="field-label">Référence</label>
            <input v-model="form.reference" class="field-input" placeholder="DEV-JR" />
          </div>
          <div>
            <label class="field-label">Catégorie</label>
            <input v-model="form.categorie" class="field-input" placeholder="Développement" list="cats" />
            <datalist id="cats">
              <option v-for="c in categories" :key="c" :value="c" />
            </datalist>
          </div>
        </div>
        <div>
          <label class="field-label">Désignation <span class="text-error-fg">*</span></label>
          <input v-model="form.designation" class="field-input" placeholder="Développement — journée" />
        </div>
        <div>
          <label class="field-label">Description</label>
          <textarea v-model="form.description" rows="2" class="field-textarea" placeholder="Détails optionnels…"></textarea>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="field-label">Prix par défaut (€)</label>
            <input v-model.number="form.prixDefaut" type="number" step="0.01" min="0" class="field-input text-right" />
          </div>
          <div>
            <label class="field-label">Unité</label>
            <select v-model="form.unite" class="field-input">
              <option value="jour">Jour</option>
              <option value="heure">Heure</option>
              <option value="forfait">Forfait</option>
              <option value="unite">Unité</option>
            </select>
          </div>
        </div>
        <div v-if="editing" class="flex items-center gap-2">
          <input id="prod-actif" v-model="form.actif" type="checkbox" class="rounded" />
          <label for="prod-actif" class="text-[13px] text-zinc-700 cursor-pointer">Produit actif</label>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="closeModal">Annuler</button>
        <button class="btn-primary" :disabled="saving" @click="save">
          {{ saving ? 'Enregistrement…' : (editing ? 'Mettre à jour' : 'Créer') }}
        </button>
      </template>
    </BaseModal>
  </div>
</template>

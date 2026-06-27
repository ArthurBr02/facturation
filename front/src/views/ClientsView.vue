<script>
import { clientsApi } from '@/api'
import PageHeader from '@/components/PageHeader.vue'
import BaseModal from '@/components/BaseModal.vue'

function emptyClient() {
  return {
    type: 'pro', pays: 'France', nom: '', denomination: '', formeJuridique: '',
    email: '', telephone: '', adresse1: '', adresse2: '', codePostal: '', ville: '',
    siren: '', tvaIntra: '', conditionsPaiement: null, actif: true,
    // Phase 3.5
    contactPrincipal: '', tjmNegocie: null, notesInternes: '',
  }
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function formatEur(value) {
  if (value == null || value === 0) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

export default {
  name: 'ClientsView',
  components: { PageHeader, BaseModal },
  data() {
    return {
      clients: [],
      loading: true,
      search: '',
      typeFilter: '',
      searchTimer: null,
      showModal: false,
      saving: false,
      editingId: null,
      form: emptyClient(),
      error: '',
    }
  },
  created() { this.fetch() },
  methods: {
    async fetch() {
      this.loading = true
      try {
        const params = {}
        if (this.search) params.search = this.search
        if (this.typeFilter) params.type = this.typeFilter
        this.clients = await clientsApi.list(params)
      } finally { this.loading = false }
    },
    onSearch() {
      clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => this.fetch(), 250)
    },
    openCreate()  { this.editingId = null; this.form = emptyClient(); this.error = ''; this.showModal = true },
    openEdit(c)   { this.editingId = c.id; this.form = { ...emptyClient(), ...c }; this.error = ''; this.showModal = true },
    openDetail(c) { this.$router.push({ name: 'client-detail', params: { id: c.id } }) },
    async save() {
      this.saving = true; this.error = ''
      try {
        const payload = { ...this.form }
        if (payload.email === '') payload.email = null
        if (!payload.tjmNegocie) payload.tjmNegocie = null
        if (!payload.contactPrincipal) payload.contactPrincipal = null
        if (!payload.notesInternes) payload.notesInternes = null
        if (this.editingId) await clientsApi.update(this.editingId, payload)
        else await clientsApi.create(payload)
        this.showModal = false; await this.fetch()
      } catch (e) { this.error = e.response?.data?.error || 'Enregistrement impossible' }
      finally { this.saving = false }
    },
    async remove(c) {
      if (!window.confirm(`Supprimer « ${c.nom} » ?`)) return
      await clientsApi.remove(c.id)
      await this.fetch()
    },
    initials,
    formatEur,
  },
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <PageHeader title="Clients" :subtitle="`${clients.length} client(s)`">
      <div class="relative flex items-center">
        <i data-lucide="search" width="15" height="15" class="absolute left-[9px] text-zinc-400 pointer-events-none"></i>
        <input
          v-model="search"
          class="field-input w-[228px] pl-[30px]"
          placeholder="Rechercher un client…"
          @input="onSearch"
        />
      </div>
      <select v-model="typeFilter" class="field-input w-40" @change="fetch">
        <option value="">Tous les types</option>
        <option value="pro">Professionnels</option>
        <option value="particulier">Particuliers</option>
      </select>
      <button class="btn-primary" @click="openCreate">
        <i data-lucide="plus" width="15" height="15"></i>
        Nouveau client
      </button>
    </PageHeader>

    <div class="flex-1 overflow-auto bg-white">
      <table class="w-full border-collapse">
        <thead class="t-head">
          <tr>
            <th class="t-th">Client</th>
            <th class="t-th">Contact</th>
            <th class="t-th">Ville</th>
            <th class="t-th-right">Documents</th>
            <th class="t-th-right">CA généré</th>
            <th class="t-th-right">En attente</th>
            <th class="w-[80px] border-b border-zinc-200"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="7" class="px-4 py-8 text-center text-[13px] text-zinc-400">Chargement…</td>
          </tr>
          <tr v-else-if="!clients.length">
            <td colspan="7" class="px-4 py-8 text-center text-[13px] text-zinc-400">
              Aucun client.
              <button class="text-blue-600 hover:underline ml-1" @click="openCreate">Créer le premier</button>
            </td>
          </tr>
          <tr
            v-for="c in clients"
            :key="c.id"
            class="t-tr cursor-pointer"
            @click="openDetail(c)"
          >
            <td class="t-td h-[42px]">
              <span class="inline-flex items-center gap-[10px]">
                <span class="w-[28px] h-[28px] rounded-full bg-blue-100 text-blue-700 inline-flex items-center justify-center font-semibold text-[11px] flex-shrink-0">
                  {{ initials(c.nom) }}
                </span>
                <span>
                  <span class="text-[13.5px] font-semibold text-zinc-900">{{ c.nom }}</span>
                  <span v-if="c.denomination" class="block text-[11px] text-zinc-400">{{ c.denomination }}</span>
                </span>
              </span>
            </td>
            <td class="t-td text-[12px]">
              <div v-if="c.contactPrincipal" class="text-zinc-600">{{ c.contactPrincipal }}</div>
              <div v-if="c.email" class="text-zinc-400">{{ c.email }}</div>
              <span v-if="!c.contactPrincipal && !c.email" class="text-zinc-300">—</span>
            </td>
            <td class="t-td">{{ c.ville || '—' }}</td>
            <td class="t-td-right">
              <span v-if="c._stats?.nbDocuments" class="text-zinc-700">{{ c._stats.nbDocuments }}</span>
              <span v-else class="text-zinc-300">—</span>
            </td>
            <td class="t-td-right font-semibold">
              <span v-if="c._stats?.caGenere" class="text-zinc-900">{{ formatEur(c._stats.caGenere) }}</span>
              <span v-else class="text-zinc-300">—</span>
            </td>
            <td class="t-td-right">
              <span v-if="c._stats?.enAttente" class="text-amber-600 font-medium">{{ formatEur(c._stats.enAttente) }}</span>
              <span v-else class="text-zinc-300">—</span>
            </td>
            <td class="px-3 text-right" @click.stop>
              <button class="btn-icon text-zinc-400 hover:text-blue-600 mr-1" title="Modifier" @click="openEdit(c)">
                <i data-lucide="pencil" width="14" height="14"></i>
              </button>
              <button class="btn-icon text-zinc-400 hover:text-error-fg" title="Supprimer" @click="remove(c)">
                <i data-lucide="trash-2" width="14" height="14"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit/Create modal -->
    <BaseModal v-if="showModal" :title="editingId ? 'Modifier le client' : 'Nouveau client'" @close="showModal = false">
      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-2">
          <label class="field-label">Type</label>
          <select v-model="form.type" class="field-input">
            <option value="pro">Professionnel (B2B)</option>
            <option value="particulier">Particulier (B2C)</option>
          </select>
        </div>
        <div class="col-span-2">
          <label class="field-label">Nom / Contact <span class="text-error-fg">*</span></label>
          <input v-model="form.nom" class="field-input" required />
        </div>
        <div v-if="form.type === 'pro'" class="col-span-2">
          <label class="field-label">Dénomination sociale</label>
          <input v-model="form.denomination" class="field-input" />
        </div>
        <div v-if="form.type === 'pro'">
          <label class="field-label">Forme juridique</label>
          <input v-model="form.formeJuridique" class="field-input" placeholder="SAS, SARL…" />
        </div>
        <div v-if="form.type === 'pro'">
          <label class="field-label">SIREN</label>
          <input v-model="form.siren" class="field-input" />
        </div>
        <div v-if="form.type === 'pro'" class="col-span-2">
          <label class="field-label">TVA intracommunautaire</label>
          <input v-model="form.tvaIntra" class="field-input" />
        </div>
        <!-- Phase 3.5: contact principal -->
        <div class="col-span-2">
          <label class="field-label">Contact principal</label>
          <input v-model="form.contactPrincipal" class="field-input" placeholder="Prénom Nom du contact" />
        </div>
        <div>
          <label class="field-label">E-mail</label>
          <input v-model="form.email" type="email" class="field-input" />
        </div>
        <div>
          <label class="field-label">Téléphone</label>
          <input v-model="form.telephone" class="field-input" />
        </div>
        <div class="col-span-2">
          <label class="field-label">Adresse</label>
          <input v-model="form.adresse1" class="field-input mb-2" placeholder="Ligne 1" />
          <input v-model="form.adresse2" class="field-input" placeholder="Ligne 2 (optionnel)" />
        </div>
        <div>
          <label class="field-label">Code postal</label>
          <input v-model="form.codePostal" class="field-input" />
        </div>
        <div>
          <label class="field-label">Ville</label>
          <input v-model="form.ville" class="field-input" />
        </div>
        <div>
          <label class="field-label">Délai de paiement (jours)</label>
          <input v-model.number="form.conditionsPaiement" type="number" class="field-input" placeholder="30" />
        </div>
        <!-- Phase 3.5: TJM négocié -->
        <div>
          <label class="field-label">TJM négocié (€/jour)</label>
          <input v-model.number="form.tjmNegocie" type="number" step="50" class="field-input" placeholder="TJM par défaut" />
        </div>
        <!-- Phase 3.5: notes internes -->
        <div class="col-span-2">
          <label class="field-label">Notes internes</label>
          <textarea v-model="form.notesInternes" class="field-input h-20 resize-none" placeholder="Informations internes, contexte…"></textarea>
        </div>
        <div class="flex items-center gap-2">
          <input id="actif-check" v-model="form.actif" type="checkbox" class="rounded" />
          <label for="actif-check" class="text-[13px] text-zinc-700 cursor-pointer">Client actif</label>
        </div>
      </div>
      <p v-if="error" class="text-[13px] text-error-fg mt-3">{{ error }}</p>
      <template #footer>
        <button class="btn-secondary" @click="showModal = false">Annuler</button>
        <button class="btn-primary" :disabled="saving || !form.nom" @click="save">
          {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </template>
    </BaseModal>
  </div>
</template>

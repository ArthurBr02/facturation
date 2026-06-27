<script>
import { clientsApi } from '@/api'
import PageHeader from '@/components/PageHeader.vue'
import KpiBar from '@/components/KpiBar.vue'
import BaseModal from '@/components/BaseModal.vue'
import CreateDocMenu from '@/components/CreateDocMenu.vue'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const dateF = (d) => d ? new Intl.DateTimeFormat('fr-FR').format(new Date(d)) : '—'

const STATUS_COLORS = {
  brouillon:  'tag-zinc',
  finalise:   'tag-blue',
  finalisee:  'tag-blue',
  envoye:     'tag-blue',
  accepte:    'tag-green',
  refuse:     'tag-red',
  expire:     'tag-red',
  annule:     'tag-zinc',
  payee:      'tag-green',
  partielle:  'tag-amber',
  actif:      'tag-green',
  suspendu:   'tag-amber',
  resilie:    'tag-red',
}

const STATUS_LABELS = {
  brouillon:  'Brouillon',
  finalise:   'Finalisé',
  finalisee:  'Finalisée',
  envoye:     'Envoyé',
  accepte:    'Accepté',
  refuse:     'Refusé',
  expire:     'Expiré',
  annule:     'Annulé',
  payee:      'Payée',
  partielle:  'Partielle',
  actif:      'Actif',
  suspendu:   'Suspendu',
  resilie:    'Résilié',
}

export default {
  name: 'ClientDetailView',
  components: { PageHeader, KpiBar, BaseModal, CreateDocMenu },
  props: { id: { type: String, required: true } },
  data() {
    return {
      loading: true,
      data: null,
      error: '',
      activeTab: 'factures',
      showEditModal: false,
      saving: false,
      form: {},
      formError: '',
    }
  },
  computed: {
    client() { return this.data?.client },
    synthese() { return this.data?.synthese },
    kpis() {
      if (!this.synthese) return []
      return [
        { label: 'CA total facturé',   value: euro.format(this.synthese.caTotal),    color: '#15803d' },
        { label: 'CA encaissé',        value: euro.format(this.synthese.caEncaisse) },
        { label: 'Factures en cours',  value: String(this.synthese.facturesEnCours) },
        { label: 'Contrats actifs',    value: String(this.synthese.contratsActifs) },
      ]
    },
    factures() {
      return (this.data?.factures || []).filter((f) => f.type !== 'avoir')
    },
    avoirs() {
      return (this.data?.factures || []).filter((f) => f.type === 'avoir')
    },
    devis() { return this.data?.devis || [] },
    avenants() { return this.data?.avenants || [] },
    contrats() { return this.data?.contrats || [] },
  },
  async created() {
    await this.load()
  },
  methods: {
    async load() {
      this.loading = true
      try {
        this.data = await clientsApi.documents(this.id)
      } catch (e) {
        this.error = e.response?.data?.error || e.message
      } finally {
        this.loading = false
      }
    },
    openEdit() {
      this.form = { ...this.client }
      this.formError = ''
      this.showEditModal = true
    },
    async save() {
      this.saving = true; this.formError = ''
      try {
        const payload = { ...this.form }
        if (payload.email === '') payload.email = null
        if (!payload.tjmNegocie) payload.tjmNegocie = null
        if (!payload.contactPrincipal) payload.contactPrincipal = null
        if (!payload.notesInternes) payload.notesInternes = null
        await clientsApi.update(this.id, payload)
        this.showEditModal = false
        await this.load()
      } catch (e) {
        this.formError = e.response?.data?.error || 'Enregistrement impossible'
      } finally {
        this.saving = false
      }
    },
    fmtEuro(n) { return euro.format(n || 0) },
    fmtDate(d) { return dateF(d) },
    statusTag(s) { return STATUS_COLORS[s] || 'tag-zinc' },
    statusLabel(s) { return STATUS_LABELS[s] || s },
    navTo(route, id) { this.$router.push({ name: route, params: { id } }) },
    initials(name) {
      if (!name) return '?'
      return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    },
    // Compute overdue status for invoices
    isOverdue(f) {
      if (!f.dateEcheance || ['payee'].includes(f.statut)) return false
      return new Date(f.dateEcheance) < new Date()
    },
  },
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <template v-if="client">
      <PageHeader
        :title="client.nom"
        :subtitle="[client.denomination, client.ville].filter(Boolean).join(' · ')"
        :back="{ name: 'clients' }"
      >
        <button class="btn-secondary" @click="openEdit">
          <i data-lucide="pencil" width="14" height="14"></i>
          Modifier
        </button>
        <CreateDocMenu :client-id="client.id" />
      </PageHeader>

      <KpiBar :items="kpis" />

      <div class="flex-1 overflow-hidden flex">
        <!-- ── Left sidebar: client info ─────────────────────────────── -->
        <div class="w-[260px] flex-shrink-0 border-r border-zinc-200 overflow-auto bg-white p-5 space-y-5">
          <!-- Avatar + name -->
          <div class="flex items-center gap-3">
            <span class="w-10 h-10 rounded-full bg-blue-100 text-blue-700 inline-flex items-center justify-center font-bold text-[15px] flex-shrink-0">
              {{ initials(client.nom) }}
            </span>
            <div>
              <p class="text-[14px] font-bold text-zinc-900">{{ client.nom }}</p>
              <span class="tag text-[10px]" :class="client.type === 'pro' ? 'tag-blue' : 'tag-zinc'">{{ client.type }}</span>
            </div>
          </div>

          <!-- Contact info -->
          <div class="space-y-2 text-[12px]">
            <div v-if="client.contactPrincipal" class="flex items-start gap-2">
              <i data-lucide="user" width="13" height="13" class="text-zinc-400 mt-0.5 flex-shrink-0"></i>
              <span class="text-zinc-700">{{ client.contactPrincipal }}</span>
            </div>
            <div v-if="client.email" class="flex items-start gap-2">
              <i data-lucide="mail" width="13" height="13" class="text-zinc-400 mt-0.5 flex-shrink-0"></i>
              <a :href="`mailto:${client.email}`" class="text-blue-600 hover:underline break-all">{{ client.email }}</a>
            </div>
            <div v-if="client.telephone" class="flex items-start gap-2">
              <i data-lucide="phone" width="13" height="13" class="text-zinc-400 mt-0.5 flex-shrink-0"></i>
              <span class="text-zinc-700">{{ client.telephone }}</span>
            </div>
            <div v-if="client.adresse1 || client.ville" class="flex items-start gap-2">
              <i data-lucide="map-pin" width="13" height="13" class="text-zinc-400 mt-0.5 flex-shrink-0"></i>
              <span class="text-zinc-600">
                <span v-if="client.adresse1" class="block">{{ client.adresse1 }}</span>
                <span v-if="client.adresse2" class="block">{{ client.adresse2 }}</span>
                <span v-if="client.codePostal || client.ville" class="block">{{ [client.codePostal, client.ville].filter(Boolean).join(' ') }}</span>
              </span>
            </div>
          </div>

          <!-- Business info -->
          <div v-if="client.type === 'pro'" class="border-t border-zinc-100 pt-4 space-y-2 text-[12px]">
            <div v-if="client.siren" class="flex justify-between">
              <span class="text-zinc-400">SIREN</span>
              <span class="text-zinc-700 font-mono">{{ client.siren }}</span>
            </div>
            <div v-if="client.tvaIntra" class="flex justify-between">
              <span class="text-zinc-400">TVA intra</span>
              <span class="text-zinc-700 font-mono">{{ client.tvaIntra }}</span>
            </div>
            <div v-if="client.formeJuridique" class="flex justify-between">
              <span class="text-zinc-400">Forme</span>
              <span class="text-zinc-700">{{ client.formeJuridique }}</span>
            </div>
          </div>

          <!-- Facturation conditions -->
          <div class="border-t border-zinc-100 pt-4 space-y-2 text-[12px]">
            <div v-if="client.tjmNegocie" class="flex justify-between">
              <span class="text-zinc-400">TJM négocié</span>
              <span class="text-zinc-800 font-semibold">{{ fmtEuro(client.tjmNegocie) }}/j</span>
            </div>
            <div v-if="client.conditionsPaiement" class="flex justify-between">
              <span class="text-zinc-400">Délai paiement</span>
              <span class="text-zinc-700">{{ client.conditionsPaiement }}j</span>
            </div>
          </div>

          <!-- Internal notes -->
          <div v-if="client.notesInternes" class="border-t border-zinc-100 pt-4">
            <p class="text-[11px] text-zinc-400 mb-1 uppercase tracking-wide font-semibold">Notes internes</p>
            <p class="text-[12px] text-zinc-600 whitespace-pre-line">{{ client.notesInternes }}</p>
          </div>
        </div>

        <!-- ── Right: tabs + document lists ─────────────────────────── -->
        <div class="flex-1 flex flex-col overflow-hidden bg-zinc-50">
          <!-- Tab bar -->
          <div class="flex border-b border-zinc-200 bg-white px-4">
            <button
              v-for="tab in [
                { key: 'factures',  label: 'Factures', count: factures.length },
                { key: 'avoirs',    label: 'Avoirs',   count: avoirs.length },
                { key: 'devis',     label: 'Devis',    count: devis.length },
                { key: 'avenants',  label: 'Avenants', count: avenants.length },
                { key: 'contrats',  label: 'Contrats', count: contrats.length },
              ]"
              :key="tab.key"
              class="relative px-4 py-3 text-[13px] font-medium transition-colors"
              :class="activeTab === tab.key
                ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-blue-600'
                : 'text-zinc-500 hover:text-zinc-800'"
              @click="activeTab = tab.key"
            >
              {{ tab.label }}
              <span v-if="tab.count" class="ml-1.5 text-[10px] bg-zinc-100 text-zinc-600 rounded-full px-1.5 py-0.5 font-semibold">
                {{ tab.count }}
              </span>
            </button>
          </div>

          <div class="flex-1 overflow-auto p-4">

            <!-- Factures tab -->
            <div v-if="activeTab === 'factures'">
              <div v-if="!factures.length" class="py-8 text-center text-[13px] text-zinc-400">Aucune facture</div>
              <table v-else class="w-full border-collapse bg-white rounded border border-zinc-200">
                <thead class="t-head">
                  <tr>
                    <th class="t-th">Numéro</th>
                    <th class="t-th">Date</th>
                    <th class="t-th">Type</th>
                    <th class="t-th">Statut</th>
                    <th class="t-th-right">Total HT</th>
                    <th class="t-th-right">Encaissé</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="f in factures"
                    :key="f.id"
                    class="t-tr cursor-pointer"
                    :class="isOverdue(f) ? 'bg-red-50' : ''"
                    @click="navTo('facture-edit', f.id)"
                  >
                    <td class="t-td font-semibold text-blue-600">{{ f.numero || `#${f.id}` }}</td>
                    <td class="t-td text-[12px] text-zinc-500">{{ fmtDate(f.dateEmission) }}</td>
                    <td class="t-td">
                      <span class="tag tag-zinc text-[10px] capitalize">{{ f.type }}</span>
                    </td>
                    <td class="t-td">
                      <span class="tag text-[10px]" :class="statusTag(f.statut)">{{ statusLabel(f.statut) }}</span>
                      <span v-if="isOverdue(f)" class="ml-1 text-[10px] text-red-600 font-semibold">En retard</span>
                    </td>
                    <td class="t-td-right font-semibold tabular-nums">{{ fmtEuro(f.totalHt) }}</td>
                    <td class="t-td-right text-[12px] tabular-nums" :class="f.caEncaisse >= f.totalHt ? 'text-green-600' : 'text-amber-600'">
                      {{ fmtEuro(f.caEncaisse) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Avoirs tab -->
            <div v-if="activeTab === 'avoirs'">
              <div v-if="!avoirs.length" class="py-8 text-center text-[13px] text-zinc-400">Aucun avoir</div>
              <table v-else class="w-full border-collapse bg-white rounded border border-zinc-200">
                <thead class="t-head">
                  <tr>
                    <th class="t-th">Numéro</th>
                    <th class="t-th">Date</th>
                    <th class="t-th">Statut</th>
                    <th class="t-th-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="f in avoirs" :key="f.id" class="t-tr cursor-pointer" @click="navTo('facture-edit', f.id)">
                    <td class="t-td font-semibold text-violet-600">{{ f.numero || `#${f.id}` }}</td>
                    <td class="t-td text-[12px] text-zinc-500">{{ fmtDate(f.dateEmission) }}</td>
                    <td class="t-td"><span class="tag text-[10px]" :class="statusTag(f.statut)">{{ statusLabel(f.statut) }}</span></td>
                    <td class="t-td-right font-semibold tabular-nums">{{ fmtEuro(f.totalHt) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Devis tab -->
            <div v-if="activeTab === 'devis'">
              <div v-if="!devis.length" class="py-8 text-center text-[13px] text-zinc-400">Aucun devis</div>
              <table v-else class="w-full border-collapse bg-white rounded border border-zinc-200">
                <thead class="t-head">
                  <tr>
                    <th class="t-th">Numéro</th>
                    <th class="t-th">Titre</th>
                    <th class="t-th">Date</th>
                    <th class="t-th">Statut</th>
                    <th class="t-th-right">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="d in devis" :key="d.id" class="t-tr cursor-pointer" @click="navTo('devis-edit', d.id)">
                    <td class="t-td font-semibold text-blue-600">{{ d.numero || `#${d.id}` }}</td>
                    <td class="t-td text-zinc-700">{{ d.titre || '—' }}</td>
                    <td class="t-td text-[12px] text-zinc-500">{{ fmtDate(d.dateEmission) }}</td>
                    <td class="t-td"><span class="tag text-[10px]" :class="statusTag(d.statut)">{{ statusLabel(d.statut) }}</span></td>
                    <td class="t-td-right font-semibold tabular-nums">{{ fmtEuro(d.totalHt) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Avenants tab -->
            <div v-if="activeTab === 'avenants'">
              <div v-if="!avenants.length" class="py-8 text-center text-[13px] text-zinc-400">Aucun avenant</div>
              <table v-else class="w-full border-collapse bg-white rounded border border-zinc-200">
                <thead class="t-head">
                  <tr>
                    <th class="t-th">Numéro</th>
                    <th class="t-th">Devis lié</th>
                    <th class="t-th">Date</th>
                    <th class="t-th">Statut</th>
                    <th class="t-th-right">Montant additionnel</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="a in avenants" :key="a.id" class="t-tr cursor-pointer" @click="navTo('devis-edit', a.devis?.id)">
                    <td class="t-td font-semibold text-violet-600">{{ a.numero || `#${a.id}` }}</td>
                    <td class="t-td text-[12px] text-zinc-500">{{ a.devis?.numero || '—' }}</td>
                    <td class="t-td text-[12px] text-zinc-500">{{ fmtDate(a.dateEmission) }}</td>
                    <td class="t-td"><span class="tag text-[10px]" :class="statusTag(a.statut)">{{ statusLabel(a.statut) }}</span></td>
                    <td class="t-td-right font-semibold tabular-nums">{{ fmtEuro(a.totalHt) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Contrats tab -->
            <div v-if="activeTab === 'contrats'">
              <div v-if="!contrats.length" class="py-8 text-center text-[13px] text-zinc-400">Aucun contrat de maintenance</div>
              <table v-else class="w-full border-collapse bg-white rounded border border-zinc-200">
                <thead class="t-head">
                  <tr>
                    <th class="t-th">Numéro</th>
                    <th class="t-th">Titre</th>
                    <th class="t-th">Début</th>
                    <th class="t-th">Statut</th>
                    <th class="t-th-right">Mensuel</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in contrats" :key="c.id" class="t-tr cursor-pointer" @click="navTo('contrat-edit', c.id)">
                    <td class="t-td font-semibold text-violet-600">{{ c.numero }}</td>
                    <td class="t-td text-zinc-700">{{ c.titre || '—' }}</td>
                    <td class="t-td text-[12px] text-zinc-500">{{ fmtDate(c.dateDebut) }}</td>
                    <td class="t-td"><span class="tag text-[10px]" :class="statusTag(c.statut)">{{ statusLabel(c.statut) }}</span></td>
                    <td class="t-td-right font-semibold tabular-nums">{{ fmtEuro(c.montantMensuel) }}/mois</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    </template>

    <div v-else-if="loading" class="flex-1 flex items-center justify-center text-[13px] text-zinc-400">
      Chargement…
    </div>
    <div v-else-if="error" class="flex-1 flex items-center justify-center text-[13px] text-error-fg">
      {{ error }}
    </div>

    <!-- Edit modal -->
    <BaseModal v-if="showEditModal" title="Modifier le client" @close="showEditModal = false">
      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-2">
          <label class="field-label">Nom / Contact <span class="text-error-fg">*</span></label>
          <input v-model="form.nom" class="field-input" required />
        </div>
        <div v-if="form.type === 'pro'" class="col-span-2">
          <label class="field-label">Dénomination sociale</label>
          <input v-model="form.denomination" class="field-input" />
        </div>
        <div class="col-span-2">
          <label class="field-label">Contact principal</label>
          <input v-model="form.contactPrincipal" class="field-input" placeholder="Prénom Nom" />
        </div>
        <div>
          <label class="field-label">E-mail</label>
          <input v-model="form.email" type="email" class="field-input" />
        </div>
        <div>
          <label class="field-label">Téléphone</label>
          <input v-model="form.telephone" class="field-input" />
        </div>
        <div>
          <label class="field-label">Délai paiement (jours)</label>
          <input v-model.number="form.conditionsPaiement" type="number" class="field-input" />
        </div>
        <div>
          <label class="field-label">TJM négocié (€/jour)</label>
          <input v-model.number="form.tjmNegocie" type="number" step="50" class="field-input" />
        </div>
        <div class="col-span-2">
          <label class="field-label">Notes internes</label>
          <textarea v-model="form.notesInternes" class="field-input h-20 resize-none"></textarea>
        </div>
      </div>
      <p v-if="formError" class="text-[13px] text-error-fg mt-3">{{ formError }}</p>
      <template #footer>
        <button class="btn-secondary" @click="showEditModal = false">Annuler</button>
        <button class="btn-primary" :disabled="saving || !form.nom" @click="save">
          {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </template>
    </BaseModal>
  </div>
</template>

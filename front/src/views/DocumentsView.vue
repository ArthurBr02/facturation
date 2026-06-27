<script>
import { devisApi, facturesApi, avenantsApi, contratsApi } from '@/api'
import { openPdfTab } from '@/utils/pdf'
import PageHeader from '@/components/PageHeader.vue'
import KpiBar from '@/components/KpiBar.vue'
import StatusDot from '@/components/StatusDot.vue'
import BaseModal from '@/components/BaseModal.vue'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

// Status dot/color meta per document type
const DEVIS_META = {
  brouillon: { label: 'Brouillon', dot: '#cbd5e1', color: '#71717a' },
  finalise:  { label: 'Finalisé',  dot: '#93c5fd', color: '#1d4ed8' },
  envoye:    { label: 'Envoyé',    dot: '#93c5fd', color: '#1d4ed8' },
  accepte:   { label: 'Accepté',   dot: '#16a34a', color: '#15803d' },
  refuse:    { label: 'Refusé',    dot: '#dc2626', color: '#b91c1c' },
  expire:    { label: 'Expiré',    dot: '#d97706', color: '#b45309' },
  annule:    { label: 'Annulé',    dot: '#cbd5e1', color: '#71717a' },
}
const FACTURE_META = {
  brouillon: { label: 'Brouillon', dot: '#cbd5e1', color: '#71717a' },
  finalisee: { label: 'Envoyée',   dot: '#94a3b8', color: '#475569' },
  partielle: { label: 'Partiel',   dot: '#d97706', color: '#b45309' },
  payee:     { label: 'Payée',     dot: '#16a34a', color: '#15803d' },
}
const AVENANT_META = {
  brouillon: { label: 'Brouillon', dot: '#cbd5e1', color: '#71717a' },
  finalise:  { label: 'Finalisé',  dot: '#93c5fd', color: '#1d4ed8' },
  envoye:    { label: 'Envoyé',    dot: '#93c5fd', color: '#1d4ed8' },
  accepte:   { label: 'Accepté',   dot: '#16a34a', color: '#15803d' },
  refuse:    { label: 'Refusé',    dot: '#dc2626', color: '#b91c1c' },
  annule:    { label: 'Annulé',    dot: '#cbd5e1', color: '#71717a' },
}
const CONTRAT_META = {
  actif:    { label: 'Actif',    dot: '#16a34a', color: '#15803d' },
  suspendu: { label: 'Suspendu', dot: '#d97706', color: '#b45309' },
  resilie:  { label: 'Résilié',  dot: '#cbd5e1', color: '#71717a' },
}

const TABS = [
  { key: 'devis',    label: 'Devis' },
  { key: 'factures', label: 'Factures' },
  { key: 'avoirs',   label: 'Avoirs' },
  { key: 'avenants', label: 'Avenants' },
  { key: 'contrats', label: 'Contrats' },
]

export default {
  name: 'DocumentsView',
  components: { PageHeader, KpiBar, StatusDot, BaseModal },
  data() {
    return {
      tabs: TABS,
      tab: 'devis',
      loading: false,
      devis: [],
      factures: [],
      avenants: [],
      contrats: [],
      anneeFilter: new Date().getFullYear(),
      statutFilter: '',
      showAvenantUploadModal: false,
      selectedAvenant: null,
      avenantUploadFile: null,
      avenantUploadError: '',
    }
  },
  computed: {
    annees() {
      const y = new Date().getFullYear()
      return [y, y - 1, y - 2]
    },
    showAnneeFilter() {
      return this.tab !== 'contrats'
    },
    currentStatuts() {
      if (this.tab === 'devis')     return ['','brouillon','finalise','envoye','accepte','refuse','expire','annule']
      if (this.tab === 'avenants')  return ['','brouillon','finalise','envoye','accepte','refuse','annule']
      if (this.tab === 'contrats')  return ['','actif','suspendu','resilie']
      return ['','brouillon','finalisee','partielle','payee']
    },
    devisKpis() {
      const d = this.devis
      return [
        { label: 'Total devis',  value: d.length.toString() },
        { label: 'En attente',   value: d.filter((x) => x.statut === 'envoye').length.toString(), color: '#1d4ed8' },
        { label: 'Acceptés',     value: d.filter((x) => x.statut === 'accepte').length.toString(), color: '#15803d' },
        { label: 'Montant actif',value: euro.format(d.filter((x) => ['finalise','envoye','accepte'].includes(x.statut)).reduce((s,x) => s + x.totalHt, 0)) },
      ]
    },
    factureKpis() {
      const f = this.factures.filter((x) => x.statut !== 'brouillon')
      return [
        { label: 'Factures émises', value: f.length.toString() },
        { label: 'CA facturé',      value: euro.format(f.reduce((s,x) => s + x.totalHt, 0)) },
        { label: 'Impayé',          value: euro.format(f.reduce((s,x) => s + (x.reste || 0), 0)), color: this.factures.some(this.isLate) ? '#b91c1c' : undefined },
      ]
    },
    contratKpis() {
      const c = this.contrats
      const actifs = c.filter((x) => x.statut === 'actif')
      return [
        { label: 'Contrats',        value: c.length.toString() },
        { label: 'Actifs',          value: actifs.length.toString(), color: '#15803d' },
        { label: 'CA mensuel',      value: euro.format(actifs.reduce((s, x) => s + x.montantMensuel, 0)) },
      ]
    },
    headerSubtitle() {
      if (this.tab === 'contrats') return `${this.contrats.length} contrat(s)`
      const count = this.tab === 'devis' ? this.devis.length
        : this.tab === 'avenants' ? this.avenants.length
        : this.factures.length
      return `${count} document(s) · ${this.anneeFilter}`
    },
  },
  watch: {
    tab() { this.statutFilter = ''; this.fetch() },
    anneeFilter() { if (this.tab !== 'contrats') this.fetch() },
    statutFilter() { this.fetch() },
  },
  created() { this.fetch() },
  methods: {
    async fetch() {
      this.loading = true
      try {
        const p = { annee: this.anneeFilter, ...(this.statutFilter && { statut: this.statutFilter }) }
        if (this.tab === 'devis')         this.devis    = await devisApi.list(p)
        else if (this.tab === 'avenants') this.avenants = await avenantsApi.list(p)
        else if (this.tab === 'contrats') this.contrats = await contratsApi.list(this.statutFilter ? { statut: this.statutFilter } : {})
        else this.factures = await facturesApi.list({ ...p, type: this.tab === 'avoirs' ? 'avoir' : 'standard,acompte,solde' })
      } finally { this.loading = false }
    },
    fmtEuro(n) { return euro.format(n || 0) },
    fmtDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR') : '—' },
    devisMeta(s)   { return DEVIS_META[s]   || DEVIS_META.brouillon },
    factureMeta(s) { return FACTURE_META[s] || FACTURE_META.brouillon },
    avenantMeta(s) { return AVENANT_META[s] || AVENANT_META.brouillon },
    contratMeta(s) { return CONTRAT_META[s] || CONTRAT_META.actif },
    statutLabel(s, type) {
      if (type === 'devis')   return DEVIS_META[s]?.label   || s
      if (type === 'avenant') return AVENANT_META[s]?.label || s
      if (type === 'contrat') return CONTRAT_META[s]?.label || s
      return FACTURE_META[s]?.label || s
    },
    isLate(f) {
      return f.statut !== 'payee' && f.statut !== 'brouillon' && f.type !== 'avoir'
        && f.dateEcheance && new Date(f.dateEcheance) < new Date()
    },
    clientLabel(item) {
      if (!item.client) return '—'
      return item.client.denomination || item.client.nom
    },
    async avenantPdf(a) {
      const showPdf = openPdfTab()
      try {
        const blob = await avenantsApi.pdf(a.id)
        showPdf(blob)
      } catch { /* ignore */ }
    },
    async avenantPdfSigne(a) {
      const showPdf = openPdfTab()
      try {
        const blob = await avenantsApi.pdfSigne(a.id)
        showPdf(blob)
      } catch { /* ignore */ }
    },
    openAvenantUploadModal(a) {
      this.selectedAvenant = a
      this.avenantUploadFile = null
      this.avenantUploadError = ''
      this.showAvenantUploadModal = true
    },
    onAvenantUploadFile(e) { this.avenantUploadFile = e.target.files[0] || null },
    async submitAvenantUploadSigne() {
      if (!this.avenantUploadFile) { this.avenantUploadError = 'Sélectionnez un fichier PDF.'; return }
      this.avenantUploadError = ''
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const base64 = ev.target.result.split(',')[1]
        try {
          await avenantsApi.uploadSigne(this.selectedAvenant.id, base64)
          this.showAvenantUploadModal = false
          await this.fetch()
        } catch (e) {
          this.avenantUploadError = e.response?.data?.error || 'Upload impossible'
        }
      }
      reader.readAsDataURL(this.avenantUploadFile)
    },
    async dupliquerAvenant(a) {
      if (!window.confirm('Dupliquer cet avenant ? Un nouveau brouillon sera créé.')) return
      try {
        const copy = await avenantsApi.dupliquer(a.id)
        this.avenants = await avenantsApi.list({ annee: this.anneeFilter })
        // Navigate to parent devis if possible
        if (copy.devisId) this.$router.push({ name: 'devis-edit', params: { id: copy.devisId } })
      } catch { /* ignore */ }
    },
  },
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <PageHeader title="Documents" :subtitle="headerSubtitle">
      <template #actions>
        <button v-if="tab === 'devis'" class="btn btn-primary" @click="$router.push({ name: 'devis-new' })">
          <i data-lucide="plus" width="15" height="15"></i> Nouveau devis
        </button>
        <button v-else-if="tab === 'factures'" class="btn btn-primary" @click="$router.push({ name: 'facture-new' })">
          <i data-lucide="plus" width="15" height="15"></i> Nouvelle facture
        </button>
        <button v-else-if="tab === 'contrats'" class="btn btn-primary" @click="$router.push({ name: 'contrat-new' })">
          <i data-lucide="plus" width="15" height="15"></i> Nouveau contrat
        </button>
      </template>
    </PageHeader>

    <!-- KPI bar -->
    <KpiBar v-if="tab === 'devis'" :items="devisKpis" />
    <KpiBar v-else-if="tab === 'factures'" :items="factureKpis" />
    <KpiBar v-else-if="tab === 'contrats'" :items="contratKpis" />

    <!-- Tabs + filters row -->
    <div class="flex-shrink-0 flex items-center justify-between px-6 border-b border-zinc-200 bg-white">
      <div class="flex">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="px-4 py-3 text-[13.5px] border-b-2 -mb-px transition-colors"
          :class="tab === t.key
            ? 'border-blue-600 text-blue-600 font-semibold'
            : 'border-transparent text-zinc-500 hover:text-zinc-900'"
          @click="tab = t.key"
        >
          {{ t.label }}
        </button>
      </div>
      <div class="flex items-center gap-2 py-2">
        <select v-if="showAnneeFilter" v-model="anneeFilter" class="field-input w-24">
          <option v-for="y in annees" :key="y" :value="y">{{ y }}</option>
        </select>
        <select v-model="statutFilter" class="field-input w-40">
          <option value="">Tous les statuts</option>
          <option v-for="s in currentStatuts.slice(1)" :key="s" :value="s">
            {{ statutLabel(s, tab === 'avenants' ? 'avenant' : tab === 'devis' ? 'devis' : tab === 'contrats' ? 'contrat' : 'facture') }}
          </option>
        </select>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-auto bg-white">
      <div v-if="loading" class="p-8 text-center text-zinc-400 text-[13px]">Chargement…</div>

      <!-- Devis table -->
      <table v-else-if="tab === 'devis'" class="w-full border-collapse">
        <thead class="t-head">
          <tr>
            <th class="t-th">Statut</th>
            <th class="t-th">N°</th>
            <th class="t-th">Client</th>
            <th class="t-th">Titre</th>
            <th class="t-th">Émission</th>
            <th class="t-th">Validité</th>
            <th class="t-th-right">Total HT</th>
            <th class="w-[60px] border-b border-zinc-200"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!devis.length">
            <td colspan="8" class="px-4 py-8 text-center text-[13px] text-zinc-400">
              Aucun devis pour cette période.
              <button class="text-blue-600 hover:underline ml-1" @click="$router.push({ name: 'devis-new' })">Créer le premier</button>
            </td>
          </tr>
          <tr
            v-for="d in devis"
            :key="d.id"
            class="t-tr cursor-pointer"
            @click="$router.push({ name: 'devis-edit', params: { id: d.id } })"
          >
            <td class="t-td"><StatusDot :dot="devisMeta(d.statut).dot" :color="devisMeta(d.statut).color" :label="devisMeta(d.statut).label" /></td>
            <td class="t-td-mono text-blue-600">{{ d.numero || '—' }}</td>
            <td class="t-td text-zinc-900">{{ clientLabel(d) }}</td>
            <td class="t-td text-zinc-500">{{ d.titre || '—' }}</td>
            <td class="t-td tabular whitespace-nowrap">{{ fmtDate(d.dateEmission) }}</td>
            <td class="t-td tabular whitespace-nowrap" :style="d.statut === 'expire' ? 'color:#b45309' : ''">{{ fmtDate(d.dateValidite) }}</td>
            <td class="t-td-right t-td-mono">{{ fmtEuro(d.totalHt) }}</td>
            <td class="px-3 text-right">
              <div class="flex items-center justify-end gap-0.5">
                <button class="btn-icon" title="Aperçu PDF" @click.stop="$router.push({ name: 'devis-edit', params: { id: d.id } })">
                  <i data-lucide="eye" width="15" height="15"></i>
                </button>
                <button class="btn-icon" title="Éditer" @click.stop="$router.push({ name: 'devis-edit', params: { id: d.id } })">
                  <i data-lucide="pencil" width="14" height="14"></i>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Factures / Avoirs table -->
      <table v-else-if="tab === 'factures' || tab === 'avoirs'" class="w-full border-collapse">
        <thead class="t-head">
          <tr>
            <th class="t-th">Statut</th>
            <th class="t-th">N°</th>
            <th class="t-th">Client</th>
            <th class="t-th">Émission</th>
            <th class="t-th">Échéance</th>
            <th class="t-th-right">Total HT</th>
            <th class="t-th-right">Reste à payer</th>
            <th class="w-[60px] border-b border-zinc-200"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!factures.length">
            <td colspan="8" class="px-4 py-8 text-center text-[13px] text-zinc-400">
              {{ tab === 'avoirs' ? 'Aucun avoir' : 'Aucune facture' }} pour cette période.
            </td>
          </tr>
          <tr
            v-for="f in factures"
            :key="f.id"
            class="t-tr cursor-pointer"
            @click="$router.push({ name: 'facture-edit', params: { id: f.id } })"
          >
            <td class="t-td">
              <StatusDot
                :dot="isLate(f) ? '#dc2626' : factureMeta(f.statut).dot"
                :color="isLate(f) ? '#b91c1c' : factureMeta(f.statut).color"
                :label="isLate(f) ? 'En retard' : factureMeta(f.statut).label"
              />
            </td>
            <td class="t-td-mono text-blue-600">{{ f.numero || 'Brouillon' }}</td>
            <td class="t-td text-zinc-900">{{ clientLabel(f) }}</td>
            <td class="t-td tabular whitespace-nowrap">{{ fmtDate(f.dateEmission) }}</td>
            <td class="t-td tabular whitespace-nowrap" :style="isLate(f) ? 'color:#b91c1c;font-weight:600' : ''">{{ fmtDate(f.dateEcheance) }}</td>
            <td class="t-td-right t-td-mono">{{ fmtEuro(f.totalHt) }}</td>
            <td class="t-td-right text-[13px] font-semibold tabular whitespace-nowrap"
              :style="f.reste > 0 ? (isLate(f) ? 'color:#b91c1c' : 'color:#3f3f46') : 'color:#a1a1aa'">
              {{ f.reste > 0 ? fmtEuro(f.reste) : '—' }}
            </td>
            <td class="px-3 text-right">
              <div class="flex items-center justify-end gap-0.5">
                <button class="btn-icon" title="Voir la facture" @click.stop="$router.push({ name: 'facture-edit', params: { id: f.id } })">
                  <i data-lucide="eye" width="15" height="15"></i>
                </button>
                <button class="btn-icon" title="Éditer" @click.stop="$router.push({ name: 'facture-edit', params: { id: f.id } })">
                  <i data-lucide="pencil" width="14" height="14"></i>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Avenants table -->
      <table v-else-if="tab === 'avenants'" class="w-full border-collapse">
        <thead class="t-head">
          <tr>
            <th class="t-th">Statut</th>
            <th class="t-th">N°</th>
            <th class="t-th">Devis</th>
            <th class="t-th">Client</th>
            <th class="t-th">Objet</th>
            <th class="t-th">Date</th>
            <th class="t-th-right">Montant</th>
            <th class="w-[60px] border-b border-zinc-200"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!avenants.length">
            <td colspan="8" class="px-4 py-8 text-center text-[13px] text-zinc-400">Aucun avenant pour cette période.</td>
          </tr>
          <tr v-for="a in avenants" :key="a.id" class="t-tr">
            <td class="t-td"><StatusDot :dot="avenantMeta(a.statut).dot" :color="avenantMeta(a.statut).color" :label="avenantMeta(a.statut).label" /></td>
            <td class="t-td-mono text-blue-600">{{ a.numero || '—' }}</td>
            <td class="t-td-mono text-zinc-500">{{ a.devisNumero || '—' }}</td>
            <td class="t-td text-zinc-900">{{ clientLabel(a) }}</td>
            <td class="t-td text-zinc-500">{{ a.objet || '—' }}</td>
            <td class="t-td tabular whitespace-nowrap">{{ fmtDate(a.dateEmission) }}</td>
            <td class="t-td-right t-td-mono">{{ fmtEuro(a.totalHt) }}</td>
            <td class="px-3 py-2 whitespace-nowrap">
              <div class="flex items-center gap-1 justify-end">
                <button v-if="a.hasPdf" class="btn-icon" title="PDF généré" @click.stop="avenantPdf(a)">
                  <i data-lucide="file-text" width="14" height="14"></i>
                </button>
                <button v-if="a.hasSignedPdf" class="btn-icon text-green-700" title="PDF signé" @click.stop="avenantPdfSigne(a)">
                  <i data-lucide="file-check" width="14" height="14"></i>
                </button>
                <button v-if="a.verrouillee" class="btn-icon" :title="a.hasSignedPdf ? 'Remplacer signé' : 'Uploader signé'" @click.stop="openAvenantUploadModal(a)">
                  <i data-lucide="upload" width="14" height="14"></i>
                </button>
                <button class="btn-icon" title="Dupliquer" @click.stop="dupliquerAvenant(a)">
                  <i data-lucide="copy" width="14" height="14"></i>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Contrats table -->
      <table v-else-if="tab === 'contrats'" class="w-full border-collapse">
        <thead class="t-head">
          <tr>
            <th class="t-th">Statut</th>
            <th class="t-th">N°</th>
            <th class="t-th">Client</th>
            <th class="t-th">Intitulé</th>
            <th class="t-th">Début</th>
            <th class="t-th-right">Mensualité</th>
            <th class="t-th">Heures/mois</th>
            <th class="w-[60px] border-b border-zinc-200"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!contrats.length">
            <td colspan="8" class="px-4 py-8 text-center text-[13px] text-zinc-400">
              Aucun contrat de maintenance.
              <button class="text-blue-600 hover:underline ml-1" @click="$router.push({ name: 'contrat-new' })">Créer le premier</button>
            </td>
          </tr>
          <tr
            v-for="c in contrats"
            :key="c.id"
            class="t-tr cursor-pointer"
            @click="$router.push({ name: 'contrat-edit', params: { id: c.id } })"
          >
            <td class="t-td"><StatusDot :dot="contratMeta(c.statut).dot" :color="contratMeta(c.statut).color" :label="contratMeta(c.statut).label" /></td>
            <td class="t-td-mono text-blue-600">{{ c.numero }}</td>
            <td class="t-td text-zinc-900">{{ clientLabel(c) }}</td>
            <td class="t-td text-zinc-500">{{ c.titre || '—' }}</td>
            <td class="t-td tabular whitespace-nowrap">{{ fmtDate(c.dateDebut) }}</td>
            <td class="t-td-right t-td-mono">{{ fmtEuro(c.montantMensuel) }}</td>
            <td class="t-td text-zinc-500">
              <span v-if="Number(c.heuresIncluses) > 0">{{ c.heuresIncluses }} h</span>
              <span v-else class="text-zinc-300">—</span>
            </td>
            <td class="px-3 text-right">
              <button class="btn-icon" title="Voir le contrat" @click.stop="$router.push({ name: 'contrat-edit', params: { id: c.id } })">
                <i data-lucide="eye" width="15" height="15"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Avenant upload signé modal -->
    <BaseModal v-if="showAvenantUploadModal" title="Uploader l'avenant signé" @close="showAvenantUploadModal = false">
      <div class="space-y-4">
        <p class="text-[13px] text-zinc-500">Uploadez le PDF signé par le client pour l'avenant <strong>{{ selectedAvenant?.numero }}</strong>.</p>
        <p v-if="avenantUploadError" class="text-[13px] text-error-fg bg-error-bg p-3 rounded">{{ avenantUploadError }}</p>
        <div>
          <label class="field-label">Fichier PDF signé *</label>
          <input type="file" accept=".pdf,application/pdf" class="field-input" @change="onAvenantUploadFile" />
        </div>
        <p v-if="avenantUploadFile" class="text-[12px] text-zinc-500">{{ avenantUploadFile.name }} — {{ (avenantUploadFile.size / 1024).toFixed(0) }} Ko</p>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showAvenantUploadModal = false">Annuler</button>
        <button class="btn-primary" :disabled="!avenantUploadFile" @click="submitAvenantUploadSigne">
          <i data-lucide="upload" width="14" height="14"></i>
          Uploader
        </button>
      </template>
    </BaseModal>
  </div>
</template>

<script>
import { dashboardApi, revenusMaltApi, urssafApi, livreRecettesApi, encaissementsApi } from '@/api'
import { openPdfTab } from '@/utils/pdf'
import PageHeader from '@/components/PageHeader.vue'
import BaseModal from '@/components/BaseModal.vue'

const euro = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)
const euroExact = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n || 0)
const dateF = (d) => d ? new Intl.DateTimeFormat('fr-FR').format(new Date(d)) : '—'
const pct = (n) => `${Math.round((n || 0) * 100)} %`

const NIVEAU_COLOR = { ok: '#16a34a', alerte: '#ca8a04', danger: '#d97706', depasse: '#dc2626' }
const NIVEAU_LABEL = { ok: 'Sous le seuil', alerte: 'Approché (70 %)', danger: 'Proche (90 %)', depasse: 'Dépassé !' }
const QUARTER_LABELS = ['T1 — Janv./Mars', 'T2 — Avr./Juin', 'T3 — Juil./Sept.', 'T4 — Oct./Déc.']
const MOIS_LABELS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']

export default {
  name: 'RapportsView',
  components: { PageHeader, BaseModal },

  data() {
    return {
      tab: 'seuils',
      annee: new Date().getFullYear(),

      seuils: null,
      caMensuel: null,
      urssaf: null,
      recettes: null,
      maltList: [],

      loadingSeuils: false,
      loadingCa: false,
      loadingUrssaf: false,
      loadingRecettes: false,
      loadingMalt: false,

      // Malt modal
      showMaltModal: false,
      maltForm: { dateEncaissement: '', montantNet: '', description: '' },
      maltSaving: false,
      maltError: '',

      // CSV import
      showImportModal: false,
      csvText: '',
      importError: '',
      importSaving: false,

      NIVEAU_COLOR,
      NIVEAU_LABEL,
      QUARTER_LABELS,
      MOIS_LABELS,
    }
  },

  computed: {
    annees() {
      const y = new Date().getFullYear()
      return [y - 1, y, y + 1].filter((x) => x >= 2026)
    },
    tvaPct100() {
      return Math.min((this.seuils?.franchiseTva?.pct || 0) * 100, 100)
    },
    microPct100() {
      return Math.min((this.seuils?.plafondMicro?.pct || 0) * 100, 100)
    },
    maxMensuel() {
      return Math.max(...(this.caMensuel?.mois?.map((m) => m.total) || [1]), 1)
    },
    totalRecettes() {
      return this.recettes?.total || 0
    },
  },

  watch: {
    annee() { this.reloadAll() },
  },

  async created() {
    await this.reloadAll()
  },

  methods: {
    euro(n) { return euro(n) },
    euroExact(n) { return euroExact(n) },
    fmtDate(d) { return dateF(d) },
    pct(n) { return pct(n) },

    async reloadAll() {
      await Promise.all([this.loadSeuils(), this.loadMalt()])
    },

    async setTab(t) {
      this.tab = t
      if (t === 'ca' && !this.caMensuel) await this.loadCaMensuel()
      if (t === 'urssaf' && !this.urssaf) await this.loadUrssaf()
      if (t === 'recettes' && !this.recettes) await this.loadRecettes()
    },

    async loadSeuils() {
      this.loadingSeuils = true
      try { this.seuils = await dashboardApi.seuils({ annee: this.annee }) } catch {}
      finally { this.loadingSeuils = false }
    },

    async loadMalt() {
      this.loadingMalt = true
      try { this.maltList = await revenusMaltApi.list({ annee: this.annee }) } catch {}
      finally { this.loadingMalt = false }
    },

    async loadCaMensuel() {
      this.loadingCa = true
      try { this.caMensuel = await dashboardApi.caMensuel({ annee: this.annee }) } catch {}
      finally { this.loadingCa = false }
    },

    async loadUrssaf() {
      this.loadingUrssaf = true
      try { this.urssaf = await urssafApi.synthese({ annee: this.annee }) } catch {}
      finally { this.loadingUrssaf = false }
    },

    async loadRecettes() {
      this.loadingRecettes = true
      try { this.recettes = await livreRecettesApi.list({ annee: this.annee }) } catch {}
      finally { this.loadingRecettes = false }
    },

    // ── Malt modal ────────────────────────────────────────────────────────────
    openMaltModal() {
      const today = new Date().toISOString().slice(0, 10)
      this.maltForm = { dateEncaissement: today, montantNet: '', description: '' }
      this.maltError = ''
      this.showMaltModal = true
    },

    async saveMalt() {
      if (!this.maltForm.dateEncaissement || !this.maltForm.montantNet) {
        this.maltError = 'Date et montant requis'
        return
      }
      this.maltSaving = true
      this.maltError = ''
      try {
        await revenusMaltApi.create(this.maltForm)
        this.showMaltModal = false
        this.urssaf = null
        await Promise.all([this.loadSeuils(), this.loadMalt()])
        if (this.tab === 'urssaf') await this.loadUrssaf()
        if (this.tab === 'recettes') { this.recettes = null; await this.loadRecettes() }
      } catch (e) {
        this.maltError = e.response?.data?.error || e.message
      } finally {
        this.maltSaving = false
      }
    },

    async deleteMalt(id) {
      if (!confirm('Supprimer ce revenu Malt ?')) return
      try {
        await revenusMaltApi.remove(id)
        this.urssaf = null
        await Promise.all([this.loadSeuils(), this.loadMalt()])
        if (this.tab === 'urssaf') await this.loadUrssaf()
        if (this.tab === 'recettes') { this.recettes = null; await this.loadRecettes() }
      } catch (e) { console.error(e) }
    },

    // ── CSV import ────────────────────────────────────────────────────────────
    openImportModal() {
      this.csvText = ''
      this.importError = ''
      this.showImportModal = true
    },

    parseCsv(text) {
      const lines = text.trim().split('\n').filter(Boolean)
      const lignes = []
      for (const line of lines) {
        const parts = line.split(';').map((s) => s.trim())
        if (parts.length < 2) continue
        const [dateStr, montantStr, description] = parts
        const date = dateStr.split('/').reverse().join('-') // DD/MM/YYYY → YYYY-MM-DD
        const montant = parseFloat(montantStr.replace(',', '.'))
        if (!date || isNaN(montant)) continue
        lignes.push({ dateEncaissement: date, montantNet: montant, description: description || undefined })
      }
      return lignes
    },

    async importCsv() {
      const lignes = this.parseCsv(this.csvText)
      if (!lignes.length) { this.importError = 'Aucune ligne valide trouvée'; return }
      this.importSaving = true
      this.importError = ''
      try {
        const r = await revenusMaltApi.importCsv(lignes)
        this.showImportModal = false
        this.urssaf = null
        await Promise.all([this.loadSeuils(), this.loadMalt()])
        if (this.tab === 'urssaf') await this.loadUrssaf()
        if (this.tab === 'recettes') { this.recettes = null; await this.loadRecettes() }
      } catch (e) {
        this.importError = e.response?.data?.error || e.message
      } finally {
        this.importSaving = false
      }
    },

    // ── Exports ───────────────────────────────────────────────────────────────
    dlBlob(blob, name) {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = name; a.click()
      URL.revokeObjectURL(url)
    },

    async exportRecettesCsv() {
      try { this.dlBlob(await livreRecettesApi.exportCsv({ annee: this.annee }), `livre-recettes-${this.annee}.csv`) } catch {}
    },

    async exportRecettesPdf() {
      const showPdf = openPdfTab()
      try {
        const blob = await livreRecettesApi.exportPdf({ annee: this.annee })
        showPdf(blob)
      } catch {}
    },

    async exportEncaissementsCsv() {
      try { this.dlBlob(await encaissementsApi.exportCsv({ annee: this.annee }), `encaissements-${this.annee}.csv`) } catch {}
    },

    // ── Helpers ───────────────────────────────────────────────────────────────
    niveauColor(n) { return NIVEAU_COLOR[n] || '#16a34a' },
    niveauLabel(n) { return NIVEAU_LABEL[n] || '' },

    barWidth(val, max) {
      return Math.round((val / Math.max(max, 1)) * 100)
    },

    isNextQuarter(trimestre) {
      if (!this.urssaf) return false
      const e = this.urssaf.trimestres[trimestre - 1]?.echeance
      return e && new Date(e) >= new Date() && new Date(e) === new Date(this.urssaf.prochaineEcheance)
    },
  },
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <PageHeader title="Rapports" subtitle="Seuils, URSSAF, livre des recettes et exports" icon="bar-chart-2" />

    <!-- Year selector + tabs -->
    <div class="flex items-center gap-6 px-6 py-3 border-b border-zinc-200 bg-white flex-shrink-0">
      <div class="flex items-center gap-2">
        <span class="text-xs text-zinc-500 font-medium">Année</span>
        <select v-model.number="annee" class="field-input py-1 px-2 text-sm w-20">
          <option v-for="y in annees" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>
      <nav class="flex gap-1">
        <button v-for="t in [
          { key: 'seuils', label: 'Seuils', icon: 'gauge' },
          { key: 'urssaf', label: 'URSSAF', icon: 'calculator' },
          { key: 'ca', label: 'CA mensuel', icon: 'trending-up' },
          { key: 'recettes', label: 'Livre des recettes', icon: 'book-open' },
          { key: 'exports', label: 'Exports', icon: 'download' },
        ]" :key="t.key"
          @click="setTab(t.key)"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded text-[13px] font-medium transition-colors"
          :class="tab === t.key ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:bg-zinc-100'"
        >
          <i :data-lucide="t.icon" width="14" height="14"></i>
          {{ t.label }}
        </button>
      </nav>
    </div>

    <div class="flex-1 overflow-y-auto p-6">

      <!-- ── Tab: Seuils ───────────────────────────────────────────────────── -->
      <div v-if="tab === 'seuils'">
        <div v-if="loadingSeuils" class="text-zinc-400 text-sm">Chargement…</div>
        <div v-else-if="seuils" class="space-y-6">

          <!-- KPI row -->
          <div class="grid grid-cols-4 gap-4">
            <div class="card p-4">
              <div class="text-xs text-zinc-500 mb-1">CA encaissé {{ annee }}</div>
              <div class="text-2xl font-bold text-zinc-900">{{ euro(seuils.caEncaisse) }}</div>
              <div class="text-xs text-zinc-400 mt-1">Encaissements {{ euro(seuils.caEncaissements) }} + Malt {{ euro(seuils.caRevenusMalt) }}</div>
            </div>
            <div class="card p-4">
              <div class="text-xs text-zinc-500 mb-1">CA facturé {{ annee }}</div>
              <div class="text-2xl font-bold text-zinc-900">{{ euro(seuils.caEmis) }}</div>
              <div class="text-xs text-zinc-400 mt-1">Factures finalisées hors avoirs</div>
            </div>
            <div class="card p-4">
              <div class="text-xs text-zinc-500 mb-1">Franchise TVA</div>
              <div class="text-2xl font-bold" :style="{ color: niveauColor(seuils.franchiseTva.niveau) }">
                {{ pct(seuils.franchiseTva.pct) }}
              </div>
              <div class="text-xs mt-1" :style="{ color: niveauColor(seuils.franchiseTva.niveau) }">
                {{ niveauLabel(seuils.franchiseTva.niveau) }}
              </div>
            </div>
            <div class="card p-4">
              <div class="text-xs text-zinc-500 mb-1">Plafond micro</div>
              <div class="text-2xl font-bold" :style="{ color: niveauColor(seuils.plafondMicro.niveau) }">
                {{ pct(seuils.plafondMicro.pct) }}
              </div>
              <div class="text-xs mt-1" :style="{ color: niveauColor(seuils.plafondMicro.niveau) }">
                {{ niveauLabel(seuils.plafondMicro.niveau) }}
              </div>
            </div>
          </div>

          <!-- Jauges -->
          <div class="grid grid-cols-2 gap-6">

            <!-- Franchise TVA -->
            <div class="card p-5">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <div class="font-semibold text-zinc-900">Franchise en base de TVA</div>
                  <div class="text-xs text-zinc-500">Seuil base {{ euro(seuils.franchiseTva.seuilBase) }} · majoré {{ euro(seuils.franchiseTva.seuilMajore) }}</div>
                </div>
                <span class="tag" :style="{ background: niveauColor(seuils.franchiseTva.niveau) + '20', color: niveauColor(seuils.franchiseTva.niveau) }">
                  {{ niveauLabel(seuils.franchiseTva.niveau) }}
                </span>
              </div>
              <div class="relative h-3 bg-zinc-100 rounded-full overflow-hidden mb-2">
                <div class="h-full rounded-full transition-all" :style="{ width: tvaPct100 + '%', background: niveauColor(seuils.franchiseTva.niveau) }"></div>
                <!-- 70% marker -->
                <div class="absolute top-0 bottom-0 w-px bg-yellow-400 opacity-70" style="left:70%"></div>
                <!-- 90% marker -->
                <div class="absolute top-0 bottom-0 w-px bg-orange-400 opacity-70" style="left:90%"></div>
              </div>
              <div class="flex justify-between text-xs text-zinc-500">
                <span>{{ euro(seuils.caEncaisse) }} encaissé</span>
                <span>Reste {{ euro(seuils.franchiseTva.restant) }}</span>
              </div>
            </div>

            <!-- Plafond micro -->
            <div class="card p-5">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <div class="font-semibold text-zinc-900">Plafond micro-entreprise</div>
                  <div class="text-xs text-zinc-500">
                    {{ seuils.plafondMicro.proratise ? `Proratisé depuis le ${fmtDate(seuils.plafondMicro.debutActivite)}` : 'Plafond annuel complet' }}
                    — {{ euro(seuils.plafondMicro.plafondProratise) }}
                  </div>
                </div>
                <span class="tag" :style="{ background: niveauColor(seuils.plafondMicro.niveau) + '20', color: niveauColor(seuils.plafondMicro.niveau) }">
                  {{ niveauLabel(seuils.plafondMicro.niveau) }}
                </span>
              </div>
              <div class="relative h-3 bg-zinc-100 rounded-full overflow-hidden mb-2">
                <div class="h-full rounded-full transition-all" :style="{ width: microPct100 + '%', background: niveauColor(seuils.plafondMicro.niveau) }"></div>
                <div class="absolute top-0 bottom-0 w-px bg-yellow-400 opacity-70" style="left:70%"></div>
                <div class="absolute top-0 bottom-0 w-px bg-orange-400 opacity-70" style="left:90%"></div>
              </div>
              <div class="flex justify-between text-xs text-zinc-500">
                <span>{{ euro(seuils.caEncaisse) }} encaissé</span>
                <span>Reste {{ euro(seuils.plafondMicro.restant) }}</span>
              </div>
            </div>
          </div>

          <!-- Projection -->
          <div v-if="seuils.projection" class="card p-5 bg-blue-50 border-blue-100">
            <div class="flex items-start gap-3">
              <i data-lucide="trending-up" width="18" height="18" class="text-blue-600 mt-0.5 flex-shrink-0"></i>
              <div>
                <div class="font-semibold text-blue-900">Projection fin d'année</div>
                <div class="text-sm text-blue-700 mt-1">
                  Sur {{ seuils.projection.daysElapsed }} jours écoulés / {{ seuils.projection.daysInYear }}, le CA projeté est de
                  <strong>{{ euro(seuils.projection.caProjecte) }}</strong>.
                  <span v-if="seuils.projection.caProjecte > seuils.plafondMicro.plafondProratise" class="text-orange-700 font-semibold ml-1">
                    ⚠ Risque de dépassement du plafond micro.
                  </span>
                  <span v-if="seuils.projection.caProjecte > seuils.franchiseTva.seuilBase" class="text-red-700 font-semibold ml-1">
                    ⚠ Risque de dépassement de la franchise TVA.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Revenus Malt résumé -->
          <div class="card p-5">
            <div class="flex items-center justify-between mb-3">
              <div class="font-semibold text-zinc-900">Revenus Malt {{ annee }}</div>
              <div class="flex gap-2">
                <button class="btn-secondary text-xs py-1 px-3" @click="openImportModal">Importer CSV</button>
                <button class="btn-primary text-xs py-1 px-3" @click="openMaltModal">+ Ajouter</button>
              </div>
            </div>
            <div v-if="!maltList.length" class="text-sm text-zinc-400">Aucun revenu Malt enregistré pour {{ annee }}.</div>
            <table v-else class="w-full">
              <thead><tr>
                <th class="t-th">Date</th>
                <th class="t-th">Description</th>
                <th class="t-th text-right">Montant</th>
                <th class="t-th w-8"></th>
              </tr></thead>
              <tbody>
                <tr v-for="r in maltList" :key="r.id" class="hover:bg-zinc-50">
                  <td class="t-td text-sm">{{ fmtDate(r.dateEncaissement) }}</td>
                  <td class="t-td text-sm text-zinc-600">{{ r.description || '—' }}</td>
                  <td class="t-td text-right font-semibold text-sm">{{ euroExact(r.montantNet) }}</td>
                  <td class="t-td">
                    <button class="text-zinc-400 hover:text-red-500 transition-colors" title="Supprimer" @click="deleteMalt(r.id)">
                      <i data-lucide="trash-2" width="14" height="14"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ── Tab: URSSAF ────────────────────────────────────────────────────── -->
      <div v-if="tab === 'urssaf'">
        <div v-if="loadingUrssaf" class="text-zinc-400 text-sm">Chargement…</div>
        <div v-else-if="!urssaf" class="text-zinc-400 text-sm">
          <button class="btn-secondary" @click="loadUrssaf">Charger</button>
        </div>
        <div v-else class="space-y-4">
          <div class="card p-4 bg-blue-50 border-blue-100 flex items-center gap-3">
            <i data-lucide="info" width="16" height="16" class="text-blue-600 flex-shrink-0"></i>
            <div class="text-sm text-blue-800">
              Taux cotisations BNC micro : <strong>{{ Math.round(urssaf.taux * 100) }} %</strong>
              (+ {{ Math.round(urssaf.tauxVL * 100) }} % versement libératoire) ·
              Prochaine échéance : <strong>{{ fmtDate(urssaf.prochaineEcheance) }}</strong>
              (dans {{ urssaf.joursAvantEcheance }} j)
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div v-for="t in urssaf.trimestres" :key="t.trimestre"
              class="card p-5"
              :class="{ 'border-blue-300 ring-1 ring-blue-200': new Date(t.echeance) >= new Date() && t.trimestre === urssaf.trimestres.find(x => new Date(x.echeance) >= new Date())?.trimestre }"
            >
              <div class="flex items-center justify-between mb-3">
                <div class="font-semibold text-zinc-900">{{ t.label }}</div>
                <div class="text-xs text-zinc-400">Échéance {{ fmtDate(t.echeance) }}</div>
              </div>
              <div class="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div class="text-xs text-zinc-500 mb-1">Encaissements</div>
                  <div class="font-semibold text-sm">{{ euro(t.caEncaissements) }}</div>
                </div>
                <div>
                  <div class="text-xs text-zinc-500 mb-1">Malt</div>
                  <div class="font-semibold text-sm">{{ euro(t.caRevenusMalt) }}</div>
                </div>
                <div>
                  <div class="text-xs text-zinc-500 mb-1">Total CA</div>
                  <div class="font-bold text-blue-700">{{ euro(t.caTotal) }}</div>
                </div>
              </div>
              <div class="mt-3 pt-3 border-t border-zinc-100 flex justify-between items-center">
                <div class="text-xs text-zinc-500">Cotisations estimées</div>
                <div class="font-bold text-zinc-900">{{ euroExact(t.estimationCotisations) }}</div>
              </div>
              <div class="flex justify-between items-center mt-1">
                <div class="text-xs text-zinc-400">Avec versement libératoire</div>
                <div class="text-xs text-zinc-500">{{ euroExact(t.estimationAvecVL) }}</div>
              </div>
            </div>
          </div>

          <!-- Total année -->
          <div class="card p-5 bg-zinc-50">
            <div class="font-semibold text-zinc-900 mb-3">Total {{ annee }}</div>
            <div class="grid grid-cols-4 gap-4 text-center">
              <div>
                <div class="text-xs text-zinc-500 mb-1">Encaissements</div>
                <div class="font-bold">{{ euro(urssaf.totalAnnee.caEncaissements) }}</div>
              </div>
              <div>
                <div class="text-xs text-zinc-500 mb-1">Malt</div>
                <div class="font-bold">{{ euro(urssaf.totalAnnee.caRevenusMalt) }}</div>
              </div>
              <div>
                <div class="text-xs text-zinc-500 mb-1">CA Total</div>
                <div class="font-bold text-blue-700">{{ euro(urssaf.totalAnnee.caTotal) }}</div>
              </div>
              <div>
                <div class="text-xs text-zinc-500 mb-1">Cotisations estimées</div>
                <div class="font-bold text-zinc-900">{{ euroExact(urssaf.totalAnnee.estimationCotisations) }}</div>
              </div>
            </div>
          </div>

          <!-- Revenus Malt management -->
          <div class="card p-5">
            <div class="flex items-center justify-between mb-3">
              <div class="font-semibold text-zinc-900">Revenus Malt {{ annee }}</div>
              <div class="flex gap-2">
                <button class="btn-secondary text-xs py-1 px-3" @click="openImportModal">Importer CSV</button>
                <button class="btn-primary text-xs py-1 px-3" @click="openMaltModal">+ Ajouter</button>
              </div>
            </div>
            <div v-if="!maltList.length" class="text-sm text-zinc-400">Aucun revenu Malt pour {{ annee }}.</div>
            <table v-else class="w-full">
              <thead><tr>
                <th class="t-th">Date</th>
                <th class="t-th">Description</th>
                <th class="t-th text-right">Montant net</th>
                <th class="t-th w-8"></th>
              </tr></thead>
              <tbody>
                <tr v-for="r in maltList" :key="r.id" class="hover:bg-zinc-50">
                  <td class="t-td text-sm">{{ fmtDate(r.dateEncaissement) }}</td>
                  <td class="t-td text-sm text-zinc-600">{{ r.description || '—' }}</td>
                  <td class="t-td text-right font-semibold text-sm">{{ euroExact(r.montantNet) }}</td>
                  <td class="t-td">
                    <button class="text-zinc-400 hover:text-red-500 transition-colors" title="Supprimer" @click="deleteMalt(r.id)">
                      <i data-lucide="trash-2" width="14" height="14"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ── Tab: CA Mensuel ────────────────────────────────────────────────── -->
      <div v-if="tab === 'ca'">
        <div v-if="loadingCa" class="text-zinc-400 text-sm">Chargement…</div>
        <div v-else-if="!caMensuel" class="text-zinc-400 text-sm">
          <button class="btn-secondary" @click="loadCaMensuel">Charger</button>
        </div>
        <div v-else class="card overflow-hidden">
          <table class="w-full">
            <thead>
              <tr>
                <th class="t-th">Mois</th>
                <th class="t-th text-right">Encaissements</th>
                <th class="t-th text-right">Revenus Malt</th>
                <th class="t-th text-right">Total</th>
                <th class="t-th" style="width:200px">Répartition</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in caMensuel.mois" :key="m.mois" class="hover:bg-zinc-50" :class="{ 'bg-blue-50': m.mois === new Date().getMonth() + 1 && annee === new Date().getFullYear() }">
                <td class="t-td font-medium text-sm">{{ m.label }}</td>
                <td class="t-td text-right text-sm">{{ m.encaissements ? euro(m.encaissements) : '—' }}</td>
                <td class="t-td text-right text-sm">{{ m.revenus ? euro(m.revenus) : '—' }}</td>
                <td class="t-td text-right font-semibold text-sm" :class="m.total ? 'text-zinc-900' : 'text-zinc-300'">
                  {{ m.total ? euro(m.total) : '—' }}
                </td>
                <td class="t-td">
                  <div class="flex gap-px h-4 items-end">
                    <div v-if="m.encaissements" class="bg-blue-500 rounded-sm" :style="{ width: barWidth(m.encaissements, maxMensuel) * 0.6 + '%', height: '100%' }"></div>
                    <div v-if="m.revenus" class="bg-orange-400 rounded-sm" :style="{ width: barWidth(m.revenus, maxMensuel) * 0.6 + '%', height: '100%' }"></div>
                  </div>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="bg-zinc-50 font-bold">
                <td class="t-td">Total {{ annee }}</td>
                <td class="t-td text-right text-sm">{{ euro(caMensuel.mois.reduce((s,m) => s+m.encaissements, 0)) }}</td>
                <td class="t-td text-right text-sm">{{ euro(caMensuel.mois.reduce((s,m) => s+m.revenus, 0)) }}</td>
                <td class="t-td text-right text-blue-700">{{ euro(caMensuel.totalAnnee) }}</td>
                <td class="t-td">
                  <div class="flex gap-2 text-xs">
                    <span class="flex items-center gap-1"><span class="w-3 h-3 bg-blue-500 rounded-sm inline-block"></span> Encaissements</span>
                    <span class="flex items-center gap-1"><span class="w-3 h-3 bg-orange-400 rounded-sm inline-block"></span> Malt</span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- ── Tab: Livre des recettes ─────────────────────────────────────────── -->
      <div v-if="tab === 'recettes'">
        <div v-if="loadingRecettes" class="text-zinc-400 text-sm">Chargement…</div>
        <div v-else-if="!recettes" class="text-zinc-400 text-sm">
          <button class="btn-secondary" @click="loadRecettes">Charger</button>
        </div>
        <div v-else>
          <div class="flex items-center justify-between mb-4">
            <div class="text-sm text-zinc-600">
              <strong>{{ recettes.count }}</strong> ligne(s) · Total
              <strong class="text-blue-700">{{ euroExact(recettes.total) }}</strong>
            </div>
            <div class="flex gap-2">
              <button class="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5" @click="exportRecettesCsv">
                <i data-lucide="download" width="13" height="13"></i> CSV
              </button>
              <button class="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5" @click="exportRecettesPdf">
                <i data-lucide="file-down" width="13" height="13"></i> PDF
              </button>
            </div>
          </div>
          <div class="card overflow-hidden">
            <table class="w-full">
              <thead><tr>
                <th class="t-th w-6">#</th>
                <th class="t-th">Date</th>
                <th class="t-th">Référence</th>
                <th class="t-th">Client</th>
                <th class="t-th">Nature</th>
                <th class="t-th text-right">Montant</th>
              </tr></thead>
              <tbody>
                <tr v-if="!recettes.lignes.length">
                  <td colspan="6" class="t-td text-center text-zinc-400 py-8">Aucun encaissement pour {{ annee }}</td>
                </tr>
                <tr v-for="(l, i) in recettes.lignes" :key="i" class="hover:bg-zinc-50">
                  <td class="t-td text-xs text-zinc-400">{{ i + 1 }}</td>
                  <td class="t-td text-sm">{{ fmtDate(l.date) }}</td>
                  <td class="t-td text-sm font-medium">
                    <span :class="l.source === 'malt' ? 'tag bg-orange-50 text-orange-700' : ''">{{ l.reference }}</span>
                  </td>
                  <td class="t-td text-sm text-zinc-600">{{ l.client || '—' }}</td>
                  <td class="t-td text-sm text-zinc-500 max-w-[240px] truncate">{{ l.nature }}</td>
                  <td class="t-td text-right font-semibold text-sm">{{ euroExact(l.montant) }}</td>
                </tr>
              </tbody>
              <tfoot v-if="recettes.lignes.length">
                <tr class="bg-zinc-50 font-bold">
                  <td colspan="5" class="t-td">TOTAL {{ annee }}</td>
                  <td class="t-td text-right text-blue-700">{{ euroExact(recettes.total) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <!-- ── Tab: Exports ───────────────────────────────────────────────────── -->
      <div v-if="tab === 'exports'" class="max-w-lg space-y-4">
        <div class="card p-5">
          <div class="font-semibold text-zinc-900 mb-1">Livre des recettes {{ annee }}</div>
          <div class="text-xs text-zinc-500 mb-4">Encaissements + revenus Malt triés par date — obligation légale micro-entreprise</div>
          <div class="flex gap-2">
            <button class="btn-secondary flex items-center gap-2" @click="exportRecettesCsv">
              <i data-lucide="download" width="14" height="14"></i> Télécharger CSV
            </button>
            <button class="btn-secondary flex items-center gap-2" @click="exportRecettesPdf">
              <i data-lucide="file-down" width="14" height="14"></i> Télécharger PDF
            </button>
          </div>
        </div>

        <div class="card p-5">
          <div class="font-semibold text-zinc-900 mb-1">Encaissements {{ annee }}</div>
          <div class="text-xs text-zinc-500 mb-4">Export CSV de tous les paiements reçus sur factures (hors Malt)</div>
          <button class="btn-secondary flex items-center gap-2" @click="exportEncaissementsCsv">
            <i data-lucide="download" width="14" height="14"></i> Télécharger CSV
          </button>
        </div>
      </div>

    </div><!-- /content -->

    <!-- ── Modal: Ajouter revenu Malt ────────────────────────────────────────── -->
    <BaseModal v-if="showMaltModal" title="Ajouter un revenu Malt" @close="showMaltModal = false">
      <div class="space-y-4">
        <div>
          <label class="field-label">Date d'encaissement *</label>
          <input v-model="maltForm.dateEncaissement" type="date" class="field-input" />
        </div>
        <div>
          <label class="field-label">Montant net reçu (€) *</label>
          <input v-model="maltForm.montantNet" type="number" step="0.01" min="0" class="field-input" placeholder="1500.00" />
        </div>
        <div>
          <label class="field-label">Description (optionnelle)</label>
          <input v-model="maltForm.description" type="text" class="field-input" placeholder="Mission Malt — Refonte site e-commerce" />
        </div>
        <div v-if="maltError" class="text-red-600 text-sm">{{ maltError }}</div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showMaltModal = false">Annuler</button>
        <button class="btn-primary" @click="saveMalt" :disabled="maltSaving">
          {{ maltSaving ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </template>
    </BaseModal>

    <!-- ── Modal: Import CSV Malt ─────────────────────────────────────────────── -->
    <BaseModal v-if="showImportModal" title="Importer des revenus Malt (CSV)" @close="showImportModal = false">
      <div class="space-y-4">
        <div class="text-xs text-zinc-500 bg-zinc-50 rounded p-3 font-mono leading-relaxed">
          Format attendu : <strong>Date;Montant;Description</strong><br>
          Exemple :<br>
          15/07/2026;1500;Mission refonte site<br>
          20/07/2026;2000.50;Développement API
        </div>
        <div>
          <label class="field-label">Coller le contenu CSV</label>
          <textarea v-model="csvText" rows="8" class="field-input font-mono text-xs" placeholder="15/07/2026;1500;Mission..."></textarea>
        </div>
        <div v-if="importError" class="text-red-600 text-sm">{{ importError }}</div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showImportModal = false">Annuler</button>
        <button class="btn-primary" @click="importCsv" :disabled="importSaving">
          {{ importSaving ? 'Import…' : 'Importer' }}
        </button>
      </template>
    </BaseModal>
  </div>
</template>

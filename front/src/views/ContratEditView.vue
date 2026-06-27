<script>
import { contratsApi, clientsApi } from '@/api'
import { openPdfTab } from '@/utils/pdf'
import PageHeader from '@/components/PageHeader.vue'
import BaseModal from '@/components/BaseModal.vue'
import StatusDot from '@/components/StatusDot.vue'
import KpiBar from '@/components/KpiBar.vue'

const STATUT_META = {
  actif:    { label: 'Actif',    dot: '#16a34a', color: '#15803d' },
  suspendu: { label: 'Suspendu', dot: '#d97706', color: '#b45309' },
  resilie:  { label: 'Résilié',  dot: '#dc2626', color: '#b91c1c' },
}

const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

const TODAY = new Date().toISOString().slice(0, 10)

export default {
  name: 'ContratEditView',
  components: { PageHeader, BaseModal, StatusDot, KpiBar },
  props: { id: String },

  data() {
    const now = new Date()
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
    const prevYear  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    return {
      contrat: null,
      clients: [],
      loading: false,
      saving: false,
      error: null,
      // form for new contract
      form: {
        clientId: null,
        titre: '',
        description: '',
        dateDebut: TODAY,
        dureeMois: null,
        reconduction: true,
        preavisJours: 30,
        montantMensuel: 0,
        heuresIncluses: 0,
        reportHeures: false,
        thmDepassement: 0,
        perimetreCouvert: '',
        exclusions: '',
      },
      // intervention modal
      showInterventionModal: false,
      interventionForm: { date: TODAY, dureeH: 1, description: '' },
      interventionSaving: false,
      interventionError: null,
      // generate invoice modal
      showGenererModal: false,
      genererForm: { annee: prevYear, mois: prevMonth },
      genererResult: null,
      genererSaving: false,
      genererError: null,
      // lifecycle modal
      showResilierConfirm: false,
      // signed PDF upload modal
      showUploadSigneModal: false,
      uploadSigneFile: null,
      uploadSigneError: '',
      statutMeta: STATUT_META,
      moisFr: MOIS_FR,
    }
  },

  computed: {
    isNew() { return !this.id },
    pageTitle() {
      if (this.isNew) return 'Nouveau contrat de maintenance'
      return this.contrat ? `Contrat ${this.contrat.numero}` : 'Chargement…'
    },
    isEditable() {
      return this.isNew || (this.contrat && this.contrat.statut !== 'resilie')
    },
    currentMonthLabel() {
      const now = new Date()
      return `${MOIS_FR[now.getMonth()]} ${now.getFullYear()}`
    },
    heuresProgressPct() {
      if (!this.contrat || Number(this.contrat.heuresIncluses) === 0) return 0
      return Math.min(100, Math.round((this.contrat.heuresMoisCourant / Number(this.contrat.heuresIncluses)) * 100))
    },
    heuresProgressColor() {
      const pct = this.heuresProgressPct
      if (pct >= 100) return '#dc2626'
      if (pct >= 80) return '#d97706'
      return '#16a34a'
    },
    contratKpis() {
      const c = this.contrat
      if (!c) return []
      const heures = Number(c.heuresIncluses) > 0
        ? `${c.heuresMoisCourant.toFixed(1)} / ${c.heuresIncluses} h`
        : `${c.heuresMoisCourant.toFixed(1)} h`
      return [
        { label: 'Mensualité', value: this.euro(c.montantMensuel) },
        { label: `Heures — ${this.currentMonthLabel}`, value: heures, color: this.heuresProgressColor },
        { label: 'Dépassement', value: c.depassementMoisCourant > 0 ? `+${c.depassementMoisCourant.toFixed(1)} h` : '—', color: c.depassementMoisCourant > 0 ? '#dc2626' : undefined },
        { label: 'Factures générées', value: String(c.factures?.length || 0) },
      ]
    },
    genererMoisOptions() {
      return MOIS_FR.map((l, i) => ({ value: i + 1, label: l }))
    },
    genererAnneeOptions() {
      const y = new Date().getFullYear()
      return [y - 1, y, y + 1]
    },
    // Group interventions by month for display
    interventionsByMonth() {
      if (!this.contrat?.interventions?.length) return []
      const groups = {}
      for (const i of this.contrat.interventions) {
        const d = new Date(i.date)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const label = `${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`
        if (!groups[key]) groups[key] = { key, label, items: [], total: 0 }
        groups[key].items.push(i)
        groups[key].total += i.dureeH
      }
      return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key))
    },
  },

  async created() {
    await this.loadClients()
    if (!this.isNew) await this.loadContrat()
    else if (this.$route.query.clientId) this.form.clientId = Number(this.$route.query.clientId)
  },

  mounted() {
    this.$nextTick(() => window.lucide?.createIcons())
  },

  updated() {
    this.$nextTick(() => window.lucide?.createIcons())
  },

  methods: {
    async loadClients() {
      try {
        this.clients = await clientsApi.list({ actif: true })
      } catch { /* silent */ }
    },

    async loadContrat() {
      this.loading = true
      this.error = null
      try {
        this.contrat = await contratsApi.get(Number(this.id))
      } catch (e) {
        this.error = e.response?.data?.error || 'Erreur de chargement'
      } finally {
        this.loading = false
      }
    },

    async save() {
      this.saving = true
      this.error = null
      try {
        const payload = {
          ...this.form,
          clientId: Number(this.form.clientId),
          montantMensuel: Number(this.form.montantMensuel),
          heuresIncluses: Number(this.form.heuresIncluses),
          thmDepassement: Number(this.form.thmDepassement),
          preavisJours: Number(this.form.preavisJours),
          dureeMois: this.form.dureeMois ? Number(this.form.dureeMois) : null,
        }
        const created = await contratsApi.create(payload)
        this.$router.replace({ name: 'contrat-edit', params: { id: created.id } })
        this.contrat = created
      } catch (e) {
        this.error = e.response?.data?.error || 'Erreur lors de la création'
      } finally {
        this.saving = false
      }
    },

    // Open the contract PDF through the authenticated axios wrapper. A raw
    // window.open() would not carry the Bearer token and gets a 401.
    async openPdf() {
      const showPdf = openPdfTab()
      try {
        const blob = await contratsApi.pdf(this.id)
        showPdf(blob)
      } catch {
        this.error = 'Aperçu PDF indisponible'
      }
    },
    openUploadSigneModal() { this.uploadSigneFile = null; this.uploadSigneError = ''; this.showUploadSigneModal = true },
    closeUploadSigneModal() { this.showUploadSigneModal = false },
    onUploadSigneFile(e) { this.uploadSigneFile = e.target.files[0] || null },
    async submitUploadSigne() {
      if (!this.uploadSigneFile) { this.uploadSigneError = 'Sélectionnez un fichier PDF.'; return }
      this.uploadSigneError = ''
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const base64 = ev.target.result.split(',')[1]
        try {
          await contratsApi.uploadSigne(this.id, base64)
          this.showUploadSigneModal = false
          await this.loadContrat()
        } catch (e) {
          this.uploadSigneError = e.response?.data?.error || 'Upload impossible'
        }
      }
      reader.readAsDataURL(this.uploadSigneFile)
    },
    async viewSignedPdf() {
      const showPdf = openPdfTab()
      try {
        const blob = await contratsApi.pdfSigne(this.id)
        showPdf(blob)
      } catch {
        this.error = 'PDF signé indisponible'
      }
    },

    async changeStatut(action) {
      this.saving = true
      try {
        this.contrat = await contratsApi[action](Number(this.id))
        this.showResilierConfirm = false
      } catch (e) {
        this.error = e.response?.data?.error || 'Erreur'
      } finally {
        this.saving = false
      }
    },

    openInterventionModal() {
      this.interventionForm = { date: TODAY, dureeH: 1, description: '' }
      this.interventionError = null
      this.showInterventionModal = true
    },

    async saveIntervention() {
      this.interventionSaving = true
      this.interventionError = null
      try {
        await contratsApi.addIntervention(Number(this.id), {
          ...this.interventionForm,
          dureeH: Number(this.interventionForm.dureeH),
        })
        this.showInterventionModal = false
        await this.loadContrat()
      } catch (e) {
        this.interventionError = e.response?.data?.error || 'Erreur lors de la saisie'
      } finally {
        this.interventionSaving = false
      }
    },

    async removeIntervention(intId) {
      if (!confirm('Supprimer cette intervention ?')) return
      try {
        await contratsApi.removeIntervention(Number(this.id), intId)
        await this.loadContrat()
      } catch (e) {
        this.error = e.response?.data?.error || 'Erreur de suppression'
      }
    },

    openGenererModal() {
      this.genererResult = null
      this.genererError = null
      this.showGenererModal = true
    },

    async genererFacture() {
      this.genererSaving = true
      this.genererError = null
      this.genererResult = null
      try {
        const result = await contratsApi.genererFacture(Number(this.id), {
          annee: Number(this.genererForm.annee),
          mois: Number(this.genererForm.mois),
        })
        this.genererResult = result
        await this.loadContrat()
      } catch (e) {
        this.genererError = e.response?.data?.error || 'Erreur de génération'
      } finally {
        this.genererSaving = false
      }
    },

    goToFacture(id) {
      this.$router.push({ name: 'facture-edit', params: { id } })
    },

    frDate(d) {
      return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
    },

    euro(n) {
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0)
    },
  },
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <PageHeader
      :title="pageTitle"
      :subtitle="contrat ? `Depuis le ${frDate(contrat.dateDebut)}` : ''"
      :back="{ name: 'documents' }"
    >
      <template v-if="!isNew && contrat">
        <StatusDot :dot="statutMeta[contrat.statut]?.dot" :color="statutMeta[contrat.statut]?.color" :label="statutMeta[contrat.statut]?.label" />
        <button class="btn-secondary btn-sm" title="Aperçu PDF" @click="openPdf">
          <i data-lucide="file-text" width="14" height="14"></i> PDF
        </button>
        <button v-if="contrat.hasSignedPdf" class="btn-secondary btn-sm text-green-700 border-green-300 hover:bg-green-50" title="Voir le document signé" @click="viewSignedPdf">
          <i data-lucide="file-check" width="14" height="14"></i> Signé
        </button>
        <button class="btn-secondary btn-sm" :title="contrat.hasSignedPdf ? 'Remplacer le document signé' : 'Uploader le document signé'" :disabled="saving" @click="openUploadSigneModal">
          <i data-lucide="upload" width="14" height="14"></i> {{ contrat.hasSignedPdf ? 'Remplacer signé' : 'Uploader signé' }}
        </button>
        <template v-if="contrat.statut === 'actif'">
          <button class="btn-secondary btn-sm" :disabled="saving" @click="changeStatut('suspendre')">Suspendre</button>
          <button class="btn-secondary btn-sm text-red-600 hover:bg-error-bg" :disabled="saving" @click="showResilierConfirm = true">Résilier</button>
        </template>
        <template v-else-if="contrat.statut === 'suspendu'">
          <button class="btn-primary btn-sm" :disabled="saving" @click="changeStatut('reactiver')">Réactiver</button>
          <button class="btn-secondary btn-sm text-red-600 hover:bg-error-bg" :disabled="saving" @click="showResilierConfirm = true">Résilier</button>
        </template>
      </template>
    </PageHeader>

    <KpiBar v-if="!isNew && contrat" :items="contratKpis" />

    <div v-if="error" class="mx-6 mt-4 bg-error-bg text-error-fg text-[13px] px-4 py-2 rounded border border-red-200">{{ error }}</div>

    <div class="flex-1 overflow-y-auto p-6">

      <!-- NEW CONTRACT FORM -->
      <template v-if="isNew">
        <form @submit.prevent="save" class="max-w-2xl mx-auto space-y-6">
          <div class="card p-6 space-y-4">
            <h3 class="text-[13px] font-semibold text-zinc-900">Informations générales</h3>
            <div>
              <label class="field-label">Client *</label>
              <select v-model="form.clientId" class="field-input" required>
                <option value="">— Sélectionner un client —</option>
                <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.denomination || c.nom }}</option>
              </select>
            </div>
            <div>
              <label class="field-label">Intitulé du contrat</label>
              <input v-model="form.titre" class="field-input" placeholder="ex. Maintenance site web + serveur" />
            </div>
            <div>
              <label class="field-label">Description</label>
              <textarea v-model="form.description" class="field-input" rows="3" placeholder="Description du périmètre global…"></textarea>
            </div>
          </div>

          <div class="card p-6 space-y-4">
            <h3 class="text-[13px] font-semibold text-zinc-900">Durée & conditions</h3>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="field-label">Date de début *</label>
                <input v-model="form.dateDebut" type="date" class="field-input" required />
              </div>
              <div>
                <label class="field-label">Durée (mois, vide = indéterminée)</label>
                <input v-model="form.dureeMois" type="number" min="1" class="field-input" placeholder="12" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="field-label">Reconduction tacite</label>
                <select v-model="form.reconduction" class="field-input">
                  <option :value="true">Oui</option>
                  <option :value="false">Non</option>
                </select>
              </div>
              <div>
                <label class="field-label">Préavis de résiliation (jours)</label>
                <input v-model="form.preavisJours" type="number" min="0" class="field-input" />
              </div>
            </div>
          </div>

          <div class="card p-6 space-y-4">
            <h3 class="text-[13px] font-semibold text-zinc-900">Conditions financières</h3>
            <div>
              <label class="field-label">Montant mensuel HT (€) *</label>
              <input v-model="form.montantMensuel" type="number" min="0" step="0.01" class="field-input" required />
            </div>
            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="field-label">Heures incluses / mois</label>
                <input v-model="form.heuresIncluses" type="number" min="0" step="0.5" class="field-input" />
              </div>
              <div>
                <label class="field-label">THM dépassement (€/h)</label>
                <input v-model="form.thmDepassement" type="number" min="0" step="0.01" class="field-input" />
              </div>
              <div>
                <label class="field-label">Report d'heures</label>
                <select v-model="form.reportHeures" class="field-input">
                  <option :value="false">Non</option>
                  <option :value="true">Oui</option>
                </select>
              </div>
            </div>
          </div>

          <div class="card p-6 space-y-4">
            <h3 class="text-[13px] font-semibold text-zinc-900">Périmètre (optionnel)</h3>
            <div>
              <label class="field-label">Couvert par le contrat</label>
              <textarea v-model="form.perimetreCouvert" class="field-input" rows="4" placeholder="Corrections de bugs, petites évolutions, supervision serveur…"></textarea>
            </div>
            <div>
              <label class="field-label">Exclusions</label>
              <textarea v-model="form.exclusions" class="field-input" rows="3" placeholder="Nouvelles fonctionnalités majeures → avenant ou facture directe…"></textarea>
            </div>
          </div>

          <div class="flex justify-end gap-3">
            <button type="button" class="btn btn-secondary" @click="$router.back()">Annuler</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Création…' : 'Créer le contrat' }}
            </button>
          </div>
        </form>
      </template>

      <!-- EXISTING CONTRACT VIEW -->
      <template v-else-if="contrat">
        <div class="max-w-5xl mx-auto space-y-5">

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <!-- Contract details -->
            <div class="card p-5 space-y-3">
              <h3 class="text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.04em]">Détails du contrat</h3>
              <div class="space-y-2 text-[13px]">
                <div class="flex justify-between">
                  <span class="text-zinc-500">Client</span>
                  <span class="font-medium text-zinc-900">{{ contrat.client?.denomination || contrat.client?.nom }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-zinc-500">Date de début</span>
                  <span class="font-mono text-zinc-700 tabular">{{ frDate(contrat.dateDebut) }}</span>
                </div>
                <div v-if="contrat.dureeMois" class="flex justify-between">
                  <span class="text-zinc-500">Durée</span>
                  <span class="font-mono text-zinc-700 tabular">{{ contrat.dureeMois }} mois</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-zinc-500">Reconduction</span>
                  <span class="text-zinc-700">{{ contrat.reconduction ? 'Oui (tacite)' : 'Non' }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-zinc-500">Préavis</span>
                  <span class="text-zinc-700">{{ contrat.preavisJours }} jours</span>
                </div>
                <template v-if="Number(contrat.heuresIncluses) > 0">
                  <hr class="border-zinc-100">
                  <div class="flex justify-between">
                    <span class="text-zinc-500">Heures incluses</span>
                    <span class="font-mono text-zinc-700 tabular">{{ contrat.heuresIncluses }} h/mois</span>
                  </div>
                  <div v-if="Number(contrat.thmDepassement) > 0" class="flex justify-between">
                    <span class="text-zinc-500">THM dépassement</span>
                    <span class="font-mono text-zinc-700 tabular">{{ euro(contrat.thmDepassement) }}/h</span>
                  </div>
                </template>
                <template v-if="contrat.dateResiliation">
                  <hr class="border-zinc-100">
                  <div class="flex justify-between">
                    <span class="text-zinc-500">Date de résiliation</span>
                    <span class="font-mono text-error-fg tabular">{{ frDate(contrat.dateResiliation) }}</span>
                  </div>
                </template>
              </div>

              <template v-if="contrat.perimetreCouvert">
                <hr class="border-zinc-100">
                <div>
                  <div class="text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.04em] mb-2">Périmètre couvert</div>
                  <p class="text-[13px] text-zinc-600 whitespace-pre-wrap">{{ contrat.perimetreCouvert }}</p>
                </div>
              </template>
              <template v-if="contrat.exclusions">
                <hr class="border-zinc-100">
                <div>
                  <div class="text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.04em] mb-2">Exclusions</div>
                  <p class="text-[13px] text-zinc-600 whitespace-pre-wrap">{{ contrat.exclusions }}</p>
                </div>
              </template>
            </div>

            <!-- Actions + Invoices -->
            <div class="space-y-5">
              <!-- Quick actions -->
              <div v-if="contrat.statut !== 'resilie'" class="card p-5">
                <h3 class="text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.04em] mb-3">Actions</h3>
                <div class="space-y-2">
                  <button class="w-full btn-secondary justify-start" @click="openInterventionModal">
                    <i data-lucide="clock" width="14" height="14"></i> Saisir une intervention
                  </button>
                  <button class="w-full btn-primary justify-start" @click="openGenererModal">
                    <i data-lucide="file-plus" width="14" height="14"></i> Générer une facture mensuelle
                  </button>
                </div>
              </div>

              <!-- Recent invoices -->
              <div class="card p-5">
                <h3 class="text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.04em] mb-3">Factures générées</h3>
                <div v-if="!contrat.factures?.length" class="text-[13px] text-zinc-400 italic">Aucune facture</div>
                <div v-else class="space-y-1">
                  <div
                    v-for="f in contrat.factures.slice(0, 8)"
                    :key="f.id"
                    class="flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-50 cursor-pointer"
                    @click="goToFacture(f.id)"
                  >
                    <div>
                      <div class="text-[13px] font-mono font-semibold text-zinc-700">{{ f.numero || `Brouillon #${f.id}` }}</div>
                      <div class="text-[12px] text-zinc-400">{{ frDate(f.dateEmission) }}</div>
                    </div>
                    <span class="text-[13px] font-medium text-zinc-700 tabular">{{ euro(f.totalHt) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Interventions by month -->
          <div class="card p-5">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.04em]">Interventions</h3>
              <button v-if="contrat.statut !== 'resilie'" class="btn-secondary btn-sm" @click="openInterventionModal">
                <i data-lucide="plus" width="14" height="14"></i> Saisir
              </button>
            </div>

            <div v-if="!interventionsByMonth.length" class="text-[13px] text-zinc-400 italic">Aucune intervention enregistrée</div>
            <div v-else class="space-y-4">
              <div v-for="group in interventionsByMonth" :key="group.key">
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.04em]">{{ group.label }}</span>
                  <span class="text-[12px] font-mono text-zinc-600 tabular">{{ group.total.toFixed(1) }} h
                    <template v-if="Number(contrat.heuresIncluses) > 0">
                      / {{ contrat.heuresIncluses }} h incluses
                    </template>
                  </span>
                </div>
                <table class="w-full text-[13px]">
                  <tbody>
                    <tr v-for="i in group.items" :key="i.id" class="border-t border-row">
                      <td class="py-2 font-mono text-zinc-500 tabular w-28">{{ frDate(i.date) }}</td>
                      <td class="py-2 text-zinc-700">{{ i.description || '—' }}</td>
                      <td class="py-2 font-mono text-right text-zinc-700 tabular w-20">{{ i.dureeH.toFixed(1) }} h</td>
                      <td class="py-2 w-8 text-right">
                        <button class="btn-icon ml-auto hover:text-error-fg" title="Supprimer l'intervention" @click="removeIntervention(i.id)">
                          <i data-lucide="trash-2" width="14" height="14"></i>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </template>

      <!-- Loading -->
      <div v-else-if="loading" class="flex items-center justify-center h-full text-zinc-400">Chargement…</div>
    </div>

    <!-- Intervention modal -->
    <BaseModal v-if="showInterventionModal" title="Saisir une intervention" @close="showInterventionModal = false">
      <form @submit.prevent="saveIntervention" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="field-label">Date *</label>
            <input v-model="interventionForm.date" type="date" class="field-input" required />
          </div>
          <div>
            <label class="field-label">Durée (heures) *</label>
            <input v-model="interventionForm.dureeH" type="number" min="0.25" step="0.25" class="field-input" required />
          </div>
        </div>
        <div>
          <label class="field-label">Description</label>
          <textarea v-model="interventionForm.description" class="field-input" rows="3" placeholder="Détail de l'intervention…"></textarea>
        </div>
        <div v-if="interventionError" class="text-[13px] text-error-fg">{{ interventionError }}</div>
        <div class="flex justify-end gap-3 pt-2">
          <button type="button" class="btn btn-secondary" @click="showInterventionModal = false">Annuler</button>
          <button type="submit" class="btn btn-primary" :disabled="interventionSaving">
            {{ interventionSaving ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
        </div>
      </form>
    </BaseModal>

    <!-- Generate invoice modal -->
    <BaseModal v-if="showGenererModal" title="Générer une facture mensuelle" @close="showGenererModal = false">
      <div class="space-y-4">
        <p class="text-[13px] text-zinc-600">Choisissez la période pour laquelle générer le brouillon de facture. Un brouillon sera créé avec le montant forfaitaire et les heures supplémentaires éventuelles.</p>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="field-label">Mois</label>
            <select v-model="genererForm.mois" class="field-input">
              <option v-for="m in genererMoisOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
          </div>
          <div>
            <label class="field-label">Année</label>
            <select v-model="genererForm.annee" class="field-input">
              <option v-for="y in genererAnneeOptions" :key="y" :value="y">{{ y }}</option>
            </select>
          </div>
        </div>

        <!-- Result -->
        <div v-if="genererResult" class="p-4 bg-green-50 border border-green-200 rounded text-[13px] text-green-800 space-y-1">
          <div class="font-semibold">{{ genererResult.message }}</div>
          <div>Heures utilisées : {{ genererResult.heuresUtilisees.toFixed(1) }} h
            <template v-if="genererResult.depassement > 0"> · Dépassement : {{ genererResult.depassement.toFixed(1) }} h</template>
          </div>
          <button class="mt-2 btn-primary btn-sm" @click="goToFacture(genererResult.id); showGenererModal = false">
            Voir la facture
          </button>
        </div>
        <div v-if="genererError" class="text-[13px] text-error-fg">{{ genererError }}</div>
        <div class="flex justify-end gap-3 pt-2">
          <button type="button" class="btn btn-secondary" @click="showGenererModal = false">Fermer</button>
          <button v-if="!genererResult" class="btn btn-primary" @click="genererFacture" :disabled="genererSaving">
            {{ genererSaving ? 'Génération…' : 'Générer le brouillon' }}
          </button>
        </div>
      </div>
    </BaseModal>

    <!-- Resilier confirm -->
    <BaseModal v-if="showResilierConfirm" title="Résilier le contrat" @close="showResilierConfirm = false">
      <div class="space-y-4">
        <p class="text-[13px] text-zinc-600">Cette action est irréversible. Le contrat sera marqué comme résilié avec la date d'aujourd'hui.</p>
        <div class="flex justify-end gap-3">
          <button class="btn btn-secondary" @click="showResilierConfirm = false">Annuler</button>
          <button class="btn btn-secondary text-red-600" @click="changeStatut('resilier')" :disabled="saving">
            {{ saving ? '…' : 'Confirmer la résiliation' }}
          </button>
        </div>
      </div>
    </BaseModal>

    <!-- Upload signed PDF modal -->
    <BaseModal v-if="showUploadSigneModal" title="Uploader le document signé" @close="closeUploadSigneModal">
      <div class="space-y-4">
        <p class="text-[13px] text-zinc-500">Uploadez le PDF signé par le client (scan ou export signé électroniquement). Ce fichier remplacera tout document signé précédent et sera envoyé sur le Drive.</p>
        <p v-if="uploadSigneError" class="text-[13px] text-error-fg bg-error-bg p-3 rounded">{{ uploadSigneError }}</p>
        <div>
          <label class="field-label">Fichier PDF signé *</label>
          <input type="file" accept=".pdf,application/pdf" class="field-input" @change="onUploadSigneFile" />
        </div>
        <p v-if="uploadSigneFile" class="text-[12px] text-zinc-500">{{ uploadSigneFile.name }} — {{ (uploadSigneFile.size / 1024).toFixed(0) }} Ko</p>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="closeUploadSigneModal">Annuler</button>
        <button class="btn-primary" :disabled="!uploadSigneFile" @click="submitUploadSigne">
          <i data-lucide="upload" width="14" height="14"></i>
          Uploader
        </button>
      </template>
    </BaseModal>

  </div>
</template>

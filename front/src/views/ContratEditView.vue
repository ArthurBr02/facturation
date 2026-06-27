<script>
import { contratsApi, clientsApi } from '@/api'
import PageHeader from '@/components/PageHeader.vue'
import BaseModal from '@/components/BaseModal.vue'
import StatusDot from '@/components/StatusDot.vue'

const STATUT_META = {
  actif:    { label: 'Actif',    dot: '#16a34a', color: '#15803d' },
  suspendu: { label: 'Suspendu', dot: '#d97706', color: '#b45309' },
  resilie:  { label: 'Résilié',  dot: '#dc2626', color: '#b91c1c' },
}

const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

const TODAY = new Date().toISOString().slice(0, 10)

export default {
  name: 'ContratEditView',
  components: { PageHeader, BaseModal, StatusDot },
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

    openPdf() {
      window.open(`/api/contrats/${this.id}/pdf`, '_blank')
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
    <PageHeader :title="pageTitle" :subtitle="contrat ? `${statutMeta[contrat.statut]?.label} · Depuis le ${frDate(contrat.dateDebut)}` : ''">
      <template #actions>
        <template v-if="!isNew && contrat">
          <button class="btn btn-secondary" @click="openPdf">
            <i data-lucide="file-text" width="15" height="15"></i> PDF
          </button>
          <template v-if="contrat.statut === 'actif'">
            <button class="btn btn-secondary" @click="changeStatut('suspendre')" :disabled="saving">Suspendre</button>
            <button class="btn btn-secondary text-red-600" @click="showResilierConfirm = true" :disabled="saving">Résilier</button>
          </template>
          <template v-else-if="contrat.statut === 'suspendu'">
            <button class="btn btn-primary" @click="changeStatut('reactiver')" :disabled="saving">Réactiver</button>
            <button class="btn btn-secondary text-red-600" @click="showResilierConfirm = true" :disabled="saving">Résilier</button>
          </template>
        </template>
      </template>
    </PageHeader>

    <div v-if="error" class="mx-6 mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{{ error }}</div>

    <div class="flex-1 overflow-y-auto p-6">

      <!-- NEW CONTRACT FORM -->
      <template v-if="isNew">
        <form @submit.prevent="save" class="max-w-2xl mx-auto space-y-6">
          <div class="card p-6 space-y-4">
            <h3 class="text-sm font-semibold text-zinc-900">Informations générales</h3>
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
            <h3 class="text-sm font-semibold text-zinc-900">Durée & conditions</h3>
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
            <h3 class="text-sm font-semibold text-zinc-900">Conditions financières</h3>
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
            <h3 class="text-sm font-semibold text-zinc-900">Périmètre (optionnel)</h3>
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
        <div class="max-w-5xl mx-auto space-y-6">

          <!-- Status + KPIs -->
          <div class="grid grid-cols-4 gap-4">
            <div class="card p-4">
              <div class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Statut</div>
              <div class="flex items-center gap-2 mt-1">
                <StatusDot :color="statutMeta[contrat.statut]?.dot" />
                <span class="font-semibold text-sm" :style="{ color: statutMeta[contrat.statut]?.color }">
                  {{ statutMeta[contrat.statut]?.label }}
                </span>
              </div>
            </div>
            <div class="card p-4">
              <div class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Mensualité</div>
              <div class="text-xl font-bold text-zinc-900">{{ euro(contrat.montantMensuel) }}</div>
            </div>
            <div class="card p-4">
              <div class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Heures — {{ currentMonthLabel }}</div>
              <div class="text-xl font-bold" :style="{ color: heuresProgressColor }">
                {{ contrat.heuresMoisCourant.toFixed(1) }} h
                <span v-if="Number(contrat.heuresIncluses) > 0" class="text-sm font-normal text-zinc-400">
                  / {{ contrat.heuresIncluses }} h
                </span>
              </div>
              <div v-if="Number(contrat.heuresIncluses) > 0" class="mt-2 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all" :style="{ width: heuresProgressPct + '%', background: heuresProgressColor }"></div>
              </div>
              <div v-if="contrat.depassementMoisCourant > 0" class="text-xs text-red-600 mt-1">
                +{{ contrat.depassementMoisCourant.toFixed(1) }} h dépassement
              </div>
            </div>
            <div class="card p-4">
              <div class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Factures</div>
              <div class="text-xl font-bold text-zinc-900">{{ contrat.factures?.length || 0 }}</div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6">
            <!-- Contract details -->
            <div class="card p-5 space-y-3">
              <h3 class="text-sm font-semibold text-zinc-700">Détails du contrat</h3>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-zinc-500">Client</span>
                  <span class="font-medium text-zinc-900">{{ contrat.client?.denomination || contrat.client?.nom }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-zinc-500">Date de début</span>
                  <span class="font-mono text-zinc-700">{{ frDate(contrat.dateDebut) }}</span>
                </div>
                <div v-if="contrat.dureeMois" class="flex justify-between">
                  <span class="text-zinc-500">Durée</span>
                  <span class="font-mono text-zinc-700">{{ contrat.dureeMois }} mois</span>
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
                    <span class="font-mono text-zinc-700">{{ contrat.heuresIncluses }} h/mois</span>
                  </div>
                  <div v-if="Number(contrat.thmDepassement) > 0" class="flex justify-between">
                    <span class="text-zinc-500">THM dépassement</span>
                    <span class="font-mono text-zinc-700">{{ euro(contrat.thmDepassement) }}/h</span>
                  </div>
                </template>
                <template v-if="contrat.dateResiliation">
                  <hr class="border-zinc-100">
                  <div class="flex justify-between">
                    <span class="text-zinc-500">Date de résiliation</span>
                    <span class="font-mono text-red-600">{{ frDate(contrat.dateResiliation) }}</span>
                  </div>
                </template>
              </div>

              <template v-if="contrat.perimetreCouvert">
                <hr class="border-zinc-100">
                <div>
                  <div class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Périmètre couvert</div>
                  <p class="text-sm text-zinc-600 whitespace-pre-wrap">{{ contrat.perimetreCouvert }}</p>
                </div>
              </template>
              <template v-if="contrat.exclusions">
                <hr class="border-zinc-100">
                <div>
                  <div class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Exclusions</div>
                  <p class="text-sm text-zinc-600 whitespace-pre-wrap">{{ contrat.exclusions }}</p>
                </div>
              </template>
            </div>

            <!-- Actions + Invoices -->
            <div class="space-y-4">
              <!-- Quick actions -->
              <div v-if="contrat.statut !== 'resilie'" class="card p-5">
                <h3 class="text-sm font-semibold text-zinc-700 mb-3">Actions</h3>
                <div class="space-y-2">
                  <button class="w-full btn btn-secondary justify-start gap-2" @click="openInterventionModal">
                    <i data-lucide="clock" width="15" height="15"></i> Saisir une intervention
                  </button>
                  <button class="w-full btn btn-primary justify-start gap-2" @click="openGenererModal">
                    <i data-lucide="file-plus" width="15" height="15"></i> Générer une facture mensuelle
                  </button>
                </div>
              </div>

              <!-- Recent invoices -->
              <div class="card p-5">
                <h3 class="text-sm font-semibold text-zinc-700 mb-3">Factures générées</h3>
                <div v-if="!contrat.factures?.length" class="text-sm text-zinc-400 italic">Aucune facture</div>
                <div v-else class="space-y-2">
                  <div
                    v-for="f in contrat.factures.slice(0, 8)"
                    :key="f.id"
                    class="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 cursor-pointer"
                    @click="goToFacture(f.id)"
                  >
                    <div>
                      <div class="text-sm font-mono text-zinc-800">{{ f.numero || `Brouillon #${f.id}` }}</div>
                      <div class="text-xs text-zinc-400">{{ frDate(f.dateEmission) }}</div>
                    </div>
                    <span class="text-sm font-medium text-zinc-700">{{ euro(f.totalHt) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Interventions by month -->
          <div class="card p-5">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-semibold text-zinc-700">Interventions</h3>
              <button v-if="contrat.statut !== 'resilie'" class="btn btn-secondary text-xs py-1 px-3" @click="openInterventionModal">
                <i data-lucide="plus" width="14" height="14"></i> Saisir
              </button>
            </div>

            <div v-if="!interventionsByMonth.length" class="text-sm text-zinc-400 italic">Aucune intervention enregistrée</div>
            <div v-else class="space-y-4">
              <div v-for="group in interventionsByMonth" :key="group.key">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{{ group.label }}</span>
                  <span class="text-xs font-mono text-zinc-600">{{ group.total.toFixed(1) }} h
                    <template v-if="Number(contrat.heuresIncluses) > 0">
                      / {{ contrat.heuresIncluses }} h incluses
                    </template>
                  </span>
                </div>
                <table class="w-full text-sm">
                  <tbody>
                    <tr v-for="i in group.items" :key="i.id" class="border-t border-zinc-100">
                      <td class="py-2 font-mono text-zinc-500 w-28">{{ frDate(i.date) }}</td>
                      <td class="py-2 text-zinc-700">{{ i.description || '—' }}</td>
                      <td class="py-2 font-mono text-right text-zinc-700 w-20">{{ i.dureeH.toFixed(1) }} h</td>
                      <td class="py-2 w-8 text-right">
                        <button class="text-zinc-300 hover:text-red-500 transition-colors" title="Supprimer l'intervention" @click="removeIntervention(i.id)">
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
        <div v-if="interventionError" class="text-sm text-red-600">{{ interventionError }}</div>
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
        <p class="text-sm text-zinc-600">Choisissez la période pour laquelle générer le brouillon de facture. Un brouillon sera créé avec le montant forfaitaire et les heures supplémentaires éventuelles.</p>
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
        <div v-if="genererResult" class="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 space-y-1">
          <div class="font-semibold">{{ genererResult.message }}</div>
          <div>Heures utilisées : {{ genererResult.heuresUtilisees.toFixed(1) }} h
            <template v-if="genererResult.depassement > 0"> · Dépassement : {{ genererResult.depassement.toFixed(1) }} h</template>
          </div>
          <button class="mt-2 btn btn-primary text-xs py-1 px-3" @click="goToFacture(genererResult.id); showGenererModal = false">
            Voir la facture
          </button>
        </div>
        <div v-if="genererError" class="text-sm text-red-600">{{ genererError }}</div>
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
        <p class="text-sm text-zinc-600">Cette action est irréversible. Le contrat sera marqué comme résilié avec la date d'aujourd'hui.</p>
        <div class="flex justify-end gap-3">
          <button class="btn btn-secondary" @click="showResilierConfirm = false">Annuler</button>
          <button class="btn btn-secondary text-red-600" @click="changeStatut('resilier')" :disabled="saving">
            {{ saving ? '…' : 'Confirmer la résiliation' }}
          </button>
        </div>
      </div>
    </BaseModal>

  </div>
</template>

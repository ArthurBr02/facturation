<script>
// Invoice draft editor (create + edit). Mirrors design/cr_ation_de_document.
// Sprint 1.1: draft persistence with live HT=TTC totals. Finalisation (locking,
// numbering, PDF) is wired in Sprint 1.2.
import { facturesApi, clientsApi, settingsApi } from '@/api'
import { openPdfTab } from '@/utils/pdf'
import PageHeader from '@/components/PageHeader.vue'
import StatusDot from '@/components/StatusDot.vue'
import ProductPicker from '@/components/ProductPicker.vue'
import BaseModal from '@/components/BaseModal.vue'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

const MOYEN_LABEL = { virement: 'Virement', malt: 'Malt', especes: 'Espèces', cheque: 'Chèque', autre: 'Autre' }

function emptyLine(prixUnitaire = 0) {
  return { designation: '', quantite: 1, prixUnitaire }
}

function toDateInput(d) {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}

const STATUT_META = {
  brouillon:  { dot: '#cbd5e1', color: '#71717a', label: 'Brouillon' },
  finalisee:  { dot: '#94a3b8', color: '#475569', label: 'Envoyée' },
  partielle:  { dot: '#d97706', color: '#b45309', label: 'Partiel' },
  payee:      { dot: '#16a34a', color: '#15803d', label: 'Payée' },
}

export default {
  name: 'FactureEditView',
  components: { PageHeader, StatusDot, ProductPicker, BaseModal },
  props: {
    id: { type: [String, Number], default: null },
  },
  data() {
    return {
      STATUT_META,
      loading: true,
      saving: false,
      error: '',
      clients: [],
      settings: {}, // cle -> valeur
      form: {
        type: 'standard',
        clientId: null,
        dateEmission: toDateInput(new Date()),
        dateExecutionDebut: '',
        dateExecutionFin: '',
        dateEcheance: '',
        bonCommande: '',
        conditionsReglement: '',
        objet: '',
        notes: '',
        lignes: [emptyLine()],
      },
      verrouillee: false,
      numero: null,
      statut: 'brouillon',
      encaissements: [],
      paye: 0,
      reste: 0,
      encForm: { dateEncaissement: toDateInput(new Date()), montant: null, moyen: 'virement', reference: '' },
      relatedOrigine: null,
      relatedAvoirs: [],
      hasSignedPdf: false,
      showUploadSigneModal: false,
      uploadSigneFile: null,
      uploadSigneError: '',
    }
  },
  watch: {
    // Navigating between finalised documents (e.g. invoice -> its avoir) reuses
    // this component, so created() doesn't refire; reload on id change.
    id(val) {
      if (val) this.load(val)
    },
  },
  computed: {
    isEdit() {
      return Boolean(this.id)
    },
    totalHt() {
      return this.form.lignes.reduce(
        (sum, l) => sum + (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0),
        0,
      )
    },
    selectedClient() {
      return this.clients.find((c) => c.id === this.form.clientId) || null
    },
    defaultTjm() {
      return Number(this.settings['emetteur.tjm_defaut']) || 400
    },
  },
  async created() {
    await Promise.all([this.loadClients(), this.loadSettings()])
    if (this.isEdit) {
      await this.load()
    } else {
      this.form.lignes = [emptyLine(this.defaultTjm)]
      if (this.$route.query.clientId) this.form.clientId = Number(this.$route.query.clientId)
      this.loading = false
    }
  },
  methods: {
    async loadClients() {
      this.clients = await clientsApi.list()
    },
    async loadSettings() {
      const { groups } = await settingsApi.getAll()
      const dict = {}
      for (const list of Object.values(groups)) {
        for (const s of list) dict[s.cle] = s.valeur
      }
      this.settings = dict
    },
    async load(id = this.id) {
      this.loading = true
      try {
        const f = await facturesApi.get(id)
        this.verrouillee = f.verrouillee
        this.numero = f.numero
        this.statut = f.statut
        this.form = {
          type: f.type,
          clientId: f.clientId,
          dateEmission: toDateInput(f.dateEmission),
          dateExecutionDebut: toDateInput(f.dateExecutionDebut),
          dateExecutionFin: toDateInput(f.dateExecutionFin),
          dateEcheance: toDateInput(f.dateEcheance),
          bonCommande: f.bonCommande || '',
          conditionsReglement: f.conditionsReglement || '',
          objet: f.objet || '',
          notes: f.notes || '',
          lignes: f.lignes.length
            ? f.lignes.map((l) => ({ designation: l.designation, quantite: l.quantite, prixUnitaire: l.prixUnitaire }))
            : [emptyLine(this.defaultTjm)],
        }
        this.encaissements = f.encaissements || []
        this.paye = f.paye || 0
        this.reste = f.reste || 0
        this.encForm.montant = f.reste || null
        this.relatedOrigine = f.factureOrigine || null
        this.relatedAvoirs = f.avoirs || []
        this.hasSignedPdf = f.hasSignedPdf || false
      } finally {
        this.loading = false
      }
    },
    addLine() {
      this.form.lignes.push(emptyLine(this.defaultTjm))
    },
    removeLine(i) {
      this.form.lignes.splice(i, 1)
      if (this.form.lignes.length === 0) this.addLine()
    },
    lineTotal(l) {
      return (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0)
    },
    fmtEuro(n) {
      return euro.format(n || 0)
    },
    payload() {
      return {
        type: this.form.type,
        clientId: this.form.clientId || null,
        dateEmission: this.form.dateEmission || null,
        dateExecutionDebut: this.form.dateExecutionDebut || null,
        dateExecutionFin: this.form.dateExecutionFin || null,
        dateEcheance: this.form.dateEcheance || null,
        bonCommande: this.form.bonCommande || null,
        conditionsReglement: this.form.conditionsReglement || null,
        objet: this.form.objet || null,
        notes: this.form.notes || null,
        lignes: this.form.lignes.map((l, i) => ({
          designation: l.designation,
          quantite: Number(l.quantite) || 0,
          prixUnitaire: Number(l.prixUnitaire) || 0,
          ordre: i,
        })),
      }
    },
    // Persist the draft (create or update) and return its id.
    async persist() {
      if (this.isEdit) {
        await facturesApi.update(this.id, this.payload())
        return Number(this.id)
      }
      const created = await facturesApi.create(this.payload())
      // Switch to edit mode so further saves update the same draft.
      this.$router.replace({ name: 'facture-edit', params: { id: created.id } })
      return created.id
    },
    async save() {
      this.saving = true
      this.error = ''
      try {
        const id = await this.persist()
        await this.load(id)
      } catch (e) {
        this.error = e.response?.data?.error || 'Enregistrement impossible'
      } finally {
        this.saving = false
      }
    },
    async finalize() {
      if (!this.form.clientId) {
        this.error = 'Sélectionnez un client avant de finaliser.'
        return
      }
      if (this.totalHt <= 0) {
        this.error = 'Le total doit être strictement positif.'
        return
      }
      if (!window.confirm('Finaliser cette facture ? Elle sera verrouillée et numérotée définitivement.')) return
      this.saving = true
      this.error = ''
      try {
        const id = await this.persist()
        await facturesApi.finalize(id)
        await this.load(id)
      } catch (e) {
        this.error = e.response?.data?.error || 'Finalisation impossible'
      } finally {
        this.saving = false
      }
    },
    async viewPdf() {
      const showPdf = openPdfTab()
      try {
        const blob = await facturesApi.pdf(this.id)
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
          await facturesApi.uploadSigne(this.id, base64)
          this.showUploadSigneModal = false
          await this.load(this.id)
        } catch (e) {
          this.uploadSigneError = e.response?.data?.error || 'Upload impossible'
        }
      }
      reader.readAsDataURL(this.uploadSigneFile)
    },
    async viewSignedPdf() {
      const showPdf = openPdfTab()
      try {
        const blob = await facturesApi.pdfSigne(this.id)
        showPdf(blob)
      } catch { this.error = 'PDF signé indisponible' }
    },
    moyenLabel(m) {
      return MOYEN_LABEL[m] || m
    },
    async addEncaissement() {
      if (!this.encForm.montant || this.encForm.montant <= 0) {
        this.error = "Montant d'encaissement invalide."
        return
      }
      this.saving = true
      this.error = ''
      try {
        await facturesApi.addEncaissement(this.id, {
          dateEncaissement: this.encForm.dateEncaissement,
          montant: Number(this.encForm.montant),
          moyen: this.encForm.moyen,
          reference: this.encForm.reference || null,
        })
        this.encForm.reference = ''
        await this.load(this.id)
      } catch (e) {
        this.error = e.response?.data?.error || 'Encaissement impossible'
      } finally {
        this.saving = false
      }
    },
    async removeEncaissement(eid) {
      if (!window.confirm('Supprimer cet encaissement ?')) return
      await facturesApi.removeEncaissement(this.id, eid)
      await this.load(this.id)
    },
    async createAvoir() {
      if (!window.confirm('Créer un avoir pour corriger cette facture ? Il sera numéroté et verrouillé.')) return
      this.saving = true
      this.error = ''
      try {
        const avoir = await facturesApi.createAvoir(this.id)
        this.$router.push({ name: 'facture-edit', params: { id: avoir.id } })
      } catch (e) {
        this.error = e.response?.data?.error || "Création de l'avoir impossible"
      } finally {
        this.saving = false
      }
    },
    async dupliquer() {
      if (!window.confirm('Dupliquer ce document ? Un nouveau brouillon sera créé.')) return
      this.saving = true; this.error = ''
      try {
        const copy = await facturesApi.dupliquer(this.id)
        this.$router.push({ name: 'facture-edit', params: { id: copy.id } })
      } catch (e) {
        this.error = e.response?.data?.error || 'Duplication impossible'
      } finally { this.saving = false }
    },
    openFacture(id) {
      this.$router.push({ name: 'facture-edit', params: { id } })
    },
    goBack() {
      this.$router.push({ name: 'factures' })
    },
    // Sprint 3.5.4 — Relance by email (mailto pre-filled)
    isOverdue() {
      if (!this.form.dateEcheance || this.statut === 'payee') return false
      return new Date(this.form.dateEcheance) < new Date()
    },
    relancerMailto() {
      const client = this.selectedClient
      const to = client?.email ? encodeURIComponent(client.email) : ''
      const subject = encodeURIComponent(`Relance — Facture ${this.numero} du ${new Intl.DateTimeFormat('fr-FR').format(new Date(this.form.dateEmission))}`)
      const iban = this.settings['emetteur.iban'] || ''
      const body = encodeURIComponent(
        `Bonjour${client?.contactPrincipal ? ` ${client.contactPrincipal}` : ''},\n\n` +
        `Sauf erreur de notre part, la facture ${this.numero} d'un montant de ${this.fmtEuro(this.reste)} reste à régler.\n` +
        `L'échéance initiale était le ${new Intl.DateTimeFormat('fr-FR').format(new Date(this.form.dateEcheance))}.\n\n` +
        (iban ? `Merci de procéder au règlement par virement bancaire :\nIBAN : ${iban}\n\n` : '') +
        `En cas de doute, n'hésitez pas à nous contacter.\n\nCordialement,\nAB Corp`
      )
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`
    },
  },
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <PageHeader
      :title="isEdit ? (numero || 'Brouillon') : 'Nouvelle facture'"
      :subtitle="verrouillee ? STATUT_META[statut]?.label : 'Brouillon · non finalisé'"
      :back="{ name: 'documents' }"
    >
      <StatusDot v-if="statut" :dot="STATUT_META[statut]?.dot" :color="STATUT_META[statut]?.color" :label="STATUT_META[statut]?.label || statut" />
      <button v-if="isEdit" class="btn-secondary btn-sm" title="Aperçu PDF" :disabled="saving" @click="viewPdf">
        <i data-lucide="file-text" width="14" height="14"></i>
        PDF
      </button>
      <button v-if="isEdit" class="btn-ghost btn-sm" title="Dupliquer" :disabled="saving" @click="dupliquer">
        <i data-lucide="copy" width="14" height="14"></i>
        Dupliquer
      </button>
      <template v-if="!verrouillee">
        <button class="btn-secondary btn-sm" :disabled="saving" @click="save">
          {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
        <button class="btn-primary btn-sm" title="Finaliser" :disabled="saving" @click="finalize">
          <i data-lucide="lock" width="14" height="14"></i>
          Finaliser
        </button>
      </template>
      <template v-else>
        <button
          v-if="verrouillee && form.type !== 'avoir' && isOverdue()"
          class="btn-secondary btn-sm text-amber-700 border-amber-300 hover:bg-amber-50"
          title="Relancer le client par email"
          @click="relancerMailto"
        >
          <i data-lucide="mail" width="14" height="14"></i>
          Relancer
        </button>
        <button v-if="form.type !== 'avoir'" class="btn-secondary btn-sm" title="Créer un avoir" :disabled="saving" @click="createAvoir">
          <i data-lucide="receipt" width="14" height="14"></i>
          Avoir
        </button>
        <button v-if="hasSignedPdf" class="btn-secondary btn-sm text-green-700 border-green-300 hover:bg-green-50" title="Voir le document signé" @click="viewSignedPdf">
          <i data-lucide="file-check" width="14" height="14"></i>
          Signé
        </button>
        <button class="btn-secondary btn-sm" :title="hasSignedPdf ? 'Remplacer le document signé' : 'Uploader le document signé'" :disabled="saving" @click="openUploadSigneModal">
          <i data-lucide="upload" width="14" height="14"></i>
          {{ hasSignedPdf ? 'Remplacer signé' : 'Uploader signé' }}
        </button>
      </template>
    </PageHeader>

    <div class="flex-1 overflow-auto p-6 space-y-5 bg-zinc-50">
      <!-- Alerts -->
      <p v-if="error" class="bg-error-bg text-error-fg text-[13px] px-4 py-2 rounded border border-red-200">{{ error }}</p>

      <div
        v-if="relatedOrigine"
        class="text-[13px] bg-error-bg text-error-fg border border-red-200 px-4 py-2 rounded flex items-center gap-2 cursor-pointer"
        @click="openFacture(relatedOrigine.id)"
      >
        <i data-lucide="undo-2" width="14" height="14"></i>
        Avoir rattaché à la facture
        <span class="font-semibold font-mono">{{ relatedOrigine.numero }}</span>
      </div>
      <div v-if="relatedAvoirs.length" class="text-[13px] bg-zinc-100 border border-zinc-200 px-4 py-2 rounded flex items-center gap-2 flex-wrap">
        <i data-lucide="receipt" width="14" height="14" class="text-zinc-500"></i>
        <span class="text-zinc-600">Avoir(s) émis :</span>
        <button v-for="a in relatedAvoirs" :key="a.id" class="font-mono font-semibold text-blue-600 hover:underline" @click="openFacture(a.id)">
          {{ a.numero }}
        </button>
      </div>

      <div v-if="loading" class="text-center text-[13px] text-zinc-400 py-10">Chargement…</div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        <!-- Main form card -->
        <div class="space-y-5">
          <!-- Header info -->
          <div class="bg-white border border-zinc-200 rounded p-5">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label class="field-label">Type</label>
                <select v-model="form.type" class="field-input" :disabled="verrouillee">
                  <option value="standard">Facture</option>
                  <option value="acompte">Acompte</option>
                  <option value="solde">Solde</option>
                </select>
              </div>
              <div>
                <label class="field-label">N° facture</label>
                <input class="field-input bg-zinc-50" :value="numero || 'À la finalisation'" disabled />
              </div>
              <div>
                <label class="field-label">Date d'émission</label>
                <input v-model="form.dateEmission" type="date" class="field-input" :disabled="verrouillee" />
              </div>
              <div>
                <label class="field-label">Échéance</label>
                <input v-model="form.dateEcheance" type="date" class="field-input" :disabled="verrouillee" />
              </div>
              <div class="col-span-2">
                <label class="field-label">Client</label>
                <select v-model="form.clientId" class="field-input" :disabled="verrouillee">
                  <option :value="null">— Sans client —</option>
                  <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.denomination || c.nom }}</option>
                </select>
              </div>
              <div class="col-span-2">
                <label class="field-label">Objet</label>
                <input v-model="form.objet" class="field-input" :disabled="verrouillee" placeholder="Prestation de développement…" />
              </div>
              <div class="col-span-2">
                <label class="field-label">Bon de commande</label>
                <input v-model="form.bonCommande" class="field-input" :disabled="verrouillee" placeholder="—" />
              </div>
              <div>
                <label class="field-label">Début d'exécution</label>
                <input v-model="form.dateExecutionDebut" type="date" class="field-input" :disabled="verrouillee" />
              </div>
              <div>
                <label class="field-label">Fin d'exécution</label>
                <input v-model="form.dateExecutionFin" type="date" class="field-input" :disabled="verrouillee" />
              </div>
              <div class="col-span-4">
                <label class="field-label">Conditions de règlement</label>
                <input v-model="form.conditionsReglement" class="field-input" :disabled="verrouillee" placeholder="Par virement, à réception" />
              </div>
            </div>
          </div>

          <!-- Lines table -->
          <div class="bg-white border border-zinc-200 rounded overflow-hidden">
            <table class="w-full border-collapse">
              <thead class="t-head">
                <tr>
                  <th class="t-th">Désignation</th>
                  <th class="t-th-right w-24">Qté</th>
                  <th class="t-th-right w-32">Prix unit. (€)</th>
                  <th class="t-th-right w-32">Total (€)</th>
                  <th class="w-10 border-b border-zinc-200"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(l, i) in form.lignes" :key="i" class="border-b border-zinc-100 align-top">
                  <td class="p-2">
                    <ProductPicker
                      v-model="l.designation"
                      :disabled="verrouillee"
                      @select-product="(p) => (l.prixUnitaire = p.prixUnitaire)"
                    />
                  </td>
                  <td class="p-2">
                    <input v-model.number="l.quantite" type="number" step="0.25" min="0" class="field-input text-right" :disabled="verrouillee" />
                  </td>
                  <td class="p-2">
                    <input v-model.number="l.prixUnitaire" type="number" step="0.01" min="0" class="field-input text-right" :disabled="verrouillee" />
                  </td>
                  <td class="p-2 text-right font-semibold text-[13px] tabular text-zinc-900 pt-[10px]">{{ fmtEuro(lineTotal(l)) }}</td>
                  <td class="p-2 text-center pt-[8px]">
                    <button v-if="!verrouillee" class="btn-icon" title="Supprimer la ligne" @click="removeLine(i)">
                      <i data-lucide="x" width="14" height="14"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="!verrouillee" class="px-3 py-2">
              <button class="btn-ghost btn-sm" @click="addLine">
                <i data-lucide="plus" width="13" height="13"></i>
                Ajouter une ligne
              </button>
            </div>
          </div>

          <!-- Encaissements -->
          <div v-if="verrouillee && form.type !== 'avoir'" class="bg-white border border-zinc-200 rounded p-5">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-[14px] font-bold text-zinc-900">Encaissements</h3>
              <div class="flex items-center gap-4 text-[13px]">
                <span class="text-zinc-500">Payé <span class="font-semibold text-zinc-900 tabular">{{ fmtEuro(paye) }}</span></span>
                <span :class="reste > 0 ? 'text-warning-fg font-semibold' : 'text-success-fg font-semibold'">
                  Reste {{ fmtEuro(reste) }}
                </span>
              </div>
            </div>

            <table v-if="encaissements.length" class="w-full border-collapse mb-4">
              <thead>
                <tr class="border-b border-zinc-200">
                  <th class="t-th">Date</th>
                  <th class="t-th">Moyen</th>
                  <th class="t-th">Référence</th>
                  <th class="t-th-right">Montant</th>
                  <th class="w-10 border-b border-zinc-200"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in encaissements" :key="e.id" class="t-tr">
                  <td class="t-td tabular">{{ new Date(e.dateEncaissement).toLocaleDateString('fr-FR') }}</td>
                  <td class="t-td">{{ moyenLabel(e.moyen) }}</td>
                  <td class="t-td text-zinc-500">{{ e.reference || '—' }}</td>
                  <td class="t-td-right t-td-mono text-zinc-900">{{ fmtEuro(e.montant) }}</td>
                  <td class="px-3 text-center">
                    <button class="btn-icon" title="Supprimer l'encaissement" @click="removeEncaissement(e.id)"><i data-lucide="x" width="13" height="13"></i></button>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-else class="text-[13px] text-zinc-400 mb-4">Aucun encaissement enregistré.</p>

            <div v-if="reste > 0" class="grid grid-cols-12 gap-3 items-end border-t border-zinc-100 pt-4">
              <div class="col-span-3">
                <label class="field-label">Date</label>
                <input v-model="encForm.dateEncaissement" type="date" class="field-input" />
              </div>
              <div class="col-span-2">
                <label class="field-label">Montant (€)</label>
                <input v-model.number="encForm.montant" type="number" step="0.01" min="0" class="field-input text-right" />
              </div>
              <div class="col-span-3">
                <label class="field-label">Moyen</label>
                <select v-model="encForm.moyen" class="field-input">
                  <option value="virement">Virement</option>
                  <option value="malt">Malt</option>
                  <option value="especes">Espèces</option>
                  <option value="cheque">Chèque</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div class="col-span-2">
                <label class="field-label">Référence</label>
                <input v-model="encForm.reference" class="field-input" placeholder="—" />
              </div>
              <div class="col-span-2">
                <button class="btn-primary w-full" :disabled="saving" @click="addEncaissement">
                  <i data-lucide="plus" width="14" height="14"></i>
                  Encaisser
                </button>
              </div>
            </div>
            <p v-else class="flex items-center gap-2 text-[13px] font-semibold text-success-fg border-t border-zinc-100 pt-4">
              <i data-lucide="check-circle-2" width="14" height="14"></i>
              Facture intégralement réglée.
            </p>
          </div>
        </div>

        <!-- Right sidebar: client card + total -->
        <div class="space-y-5">
          <div v-if="selectedClient" class="bg-white border border-zinc-200 rounded p-4 text-[13px]">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Client</p>
            <p class="font-semibold text-zinc-900">{{ selectedClient.denomination || selectedClient.nom }}</p>
            <p v-if="selectedClient.adresse1" class="text-zinc-500">{{ selectedClient.adresse1 }}</p>
            <p v-if="selectedClient.adresse2" class="text-zinc-500">{{ selectedClient.adresse2 }}</p>
            <p v-if="selectedClient.codePostal || selectedClient.ville" class="text-zinc-500">{{ selectedClient.codePostal }} {{ selectedClient.ville }}</p>
            <p v-if="selectedClient.siren" class="font-mono text-zinc-400 mt-2">SIREN {{ selectedClient.siren }}</p>
          </div>

          <!-- Total block -->
          <div class="bg-white border border-zinc-200 rounded p-4">
            <div class="flex justify-between py-2 border-b border-zinc-100 text-[13px]">
              <span class="text-zinc-500">Sous-total HT</span>
              <span class="font-semibold tabular text-zinc-900">{{ fmtEuro(totalHt) }}</span>
            </div>
            <div class="flex justify-between py-2 text-[12px] text-zinc-400 border-b border-zinc-100">
              <span>TVA</span>
              <span>art. 293 B du CGI</span>
            </div>
            <div class="flex justify-between items-baseline pt-3">
              <span class="text-[12px] font-bold uppercase tracking-wider text-zinc-500">Net à payer</span>
              <span class="text-[22px] font-bold tabular text-blue-600">{{ fmtEuro(totalHt) }}</span>
            </div>
          </div>

          <!-- Bank info -->
          <div class="bg-white border border-zinc-200 rounded p-4 text-[12px] font-mono text-zinc-600">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2 font-sans">Coordonnées bancaires</p>
            <p>IBAN : {{ settings['emetteur.iban'] || '—' }}</p>
            <p>BIC : {{ settings['emetteur.bic'] || '—' }}</p>
          </div>

          <!-- Notes -->
          <div>
            <label class="field-label">Notes internes</label>
            <textarea v-model="form.notes" rows="3" class="field-textarea" :disabled="verrouillee" placeholder="Notes non imprimées…"></textarea>
          </div>
        </div>
      </div>
    </div>

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

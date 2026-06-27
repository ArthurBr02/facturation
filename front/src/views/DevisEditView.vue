<script>
// Full-page devis editor — create, edit draft, lifecycle actions.
// Sprint 2.1 + 2.2: lifecycle, PDF preview, facture creation from accepted devis.
import { devisApi, avenantsApi, clientsApi, settingsApi } from '@/api'
import { openPdfTab } from '@/utils/pdf'
import PageHeader from '@/components/PageHeader.vue'
import StatusDot from '@/components/StatusDot.vue'
import BaseModal from '@/components/BaseModal.vue'
import ProductPicker from '@/components/ProductPicker.vue'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

const DEFAULT_CLAUSE_REVISION =
  'Le présent devis inclut {{cycles}} révisions mineures. Une révision mineure désigne tout ajustement ' +
  'de contenu, formulation ou visuel qui ne modifie pas le périmètre fonctionnel. Au-delà de ce quota, ' +
  'toute révision supplémentaire sera facturée au taux journalier en vigueur. ' +
  'Les modifications majeures (ajout de fonctionnalités, changement de périmètre) font l\'objet d\'un avenant.'

const DEFAULT_CLAUSE_HEBERGEMENT =
  'L\'hébergement sera mis en place sur l\'infrastructure du client (compte Hetzner fourni par le client). ' +
  'Le client s\'engage à créer un compte Hetzner et à fournir un accès développeur. ' +
  'La supervision et la maintenance de l\'infrastructure font l\'objet d\'un contrat de maintenance séparé.'

const STATUT_META = {
  brouillon: { label: 'Brouillon', dot: '#cbd5e1', color: '#71717a' },
  finalise:  { label: 'Finalisé',  dot: '#93c5fd', color: '#1d4ed8' },
  envoye:    { label: 'Envoyé',    dot: '#93c5fd', color: '#1d4ed8' },
  accepte:   { label: 'Accepté',   dot: '#16a34a', color: '#15803d' },
  refuse:    { label: 'Refusé',    dot: '#dc2626', color: '#b91c1c' },
  expire:    { label: 'Expiré',    dot: '#d97706', color: '#b45309' },
  annule:    { label: 'Annulé',    dot: '#cbd5e1', color: '#71717a' },
}

function emptyLine(prix = 0) {
  return { designation: '', quantite: 1, prixUnitaire: prix }
}

function toDateInput(d) {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}

export default {
  name: 'DevisEditView',
  components: { PageHeader, StatusDot, BaseModal, ProductPicker },
  props: { id: { type: [String, Number], default: null } },
  data() {
    return {
      loading: true,
      saving: false,
      error: '',
      clients: [],
      settings: {},
      devis: null, // full loaded devis object
      form: {
        clientId: null,
        titre: '',
        description: '',
        dateEmission: toDateInput(new Date()),
        validiteJours: 30,
        acomptePct: null,
        cyclesInclus: 3,
        clauseRevision: DEFAULT_CLAUSE_REVISION,
        clauseHebergement: DEFAULT_CLAUSE_HEBERGEMENT,
        lignes: [emptyLine()],
      },
      statut: 'brouillon',
      numero: null,
      verrouillee: false,
      hasSignedPdf: false,
      showUploadSigneModal: false,
      uploadSigneFile: null,
      uploadSigneError: '',
      // avenant creation modal
      showAvenantModal: false,
      avenantForm: {
        objet: '',
        description: '',
        delaiAdd: null,
        dateEmission: toDateInput(new Date()),
        lignes: [emptyLine()],
      },
      // facture creation modal
      showFactureModal: false,
      factureForm: { type: 'standard', acomptePct: 30 },
    }
  },
  computed: {
    isEdit() { return Boolean(this.id) },
    totalHt() {
      return this.form.lignes.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0), 0)
    },
    avenantTotal() {
      return this.avenantForm.lignes.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0), 0)
    },
    selectedClient() {
      return this.clients.find((c) => c.id === this.form.clientId) || null
    },
    defaultTjm() { return Number(this.settings['emetteur.tjm_defaut']) || 400 },
    canEdit() { return !this.verrouillee },
    canFinalise() { return !this.verrouillee && this.statut === 'brouillon' },
    canEnvoyer() { return this.statut === 'finalise' },
    canAccepterRefuser() { return ['finalise', 'envoye'].includes(this.statut) },
    canAnnuler() { return this.verrouillee && !['annule', 'accepte'].includes(this.statut) },
    canCreateFacture() { return this.statut === 'accepte' },
    canCreateAvenant() { return this.verrouillee },
    statutMeta() { return STATUT_META[this.statut] || STATUT_META.brouillon },
    cyclesAlert() {
      return this.devis && this.devis.cyclesUtilises >= this.devis.cyclesInclus
    },
  },
  watch: {
    id(val) { if (val) this.load(val) },
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
      for (const list of Object.values(groups)) for (const s of list) dict[s.cle] = s.valeur
      this.settings = dict
    },
    async load(id = this.id) {
      this.loading = true
      try {
        const d = await devisApi.get(id)
        this.devis = d
        this.statut = d.statut
        this.numero = d.numero
        this.verrouillee = d.verrouillee
        this.hasSignedPdf = d.hasSignedPdf || false
        this.form = {
          clientId: d.clientId,
          titre: d.titre || '',
          description: d.description || '',
          dateEmission: toDateInput(d.dateEmission),
          validiteJours: d.validiteJours || 30,
          acomptePct: d.acomptePct ?? null,
          cyclesInclus: d.cyclesInclus ?? 3,
          clauseRevision: d.clauseRevision || DEFAULT_CLAUSE_REVISION,
          clauseHebergement: d.clauseHebergement || DEFAULT_CLAUSE_HEBERGEMENT,
          lignes: d.lignes.length
            ? d.lignes.map((l) => ({ designation: l.designation, quantite: l.quantite, prixUnitaire: l.prixUnitaire }))
            : [emptyLine(this.defaultTjm)],
        }
      } finally {
        this.loading = false
      }
    },
    payload() {
      return {
        clientId: this.form.clientId || null,
        titre: this.form.titre || null,
        description: this.form.description || null,
        dateEmission: this.form.dateEmission || null,
        validiteJours: Number(this.form.validiteJours) || 30,
        acomptePct: this.form.acomptePct ? Number(this.form.acomptePct) : null,
        cyclesInclus: Number(this.form.cyclesInclus) || 3,
        clauseRevision: this.form.clauseRevision || null,
        clauseHebergement: this.form.clauseHebergement || null,
        lignes: this.form.lignes.map((l, i) => ({
          designation: l.designation,
          quantite: Number(l.quantite) || 0,
          prixUnitaire: Number(l.prixUnitaire) || 0,
          ordre: i,
        })),
      }
    },
    async persist() {
      if (this.isEdit) {
        await devisApi.update(this.id, this.payload())
        return Number(this.id)
      }
      const created = await devisApi.create(this.payload())
      this.$router.replace({ name: 'devis-edit', params: { id: created.id } })
      return created.id
    },
    async save() {
      this.saving = true; this.error = ''
      try {
        const id = await this.persist()
        await this.load(id)
      } catch (e) {
        this.error = e.response?.data?.error || 'Enregistrement impossible'
      } finally { this.saving = false }
    },
    async finalise() {
      if (!this.form.clientId) { this.error = 'Sélectionnez un client avant de finaliser.'; return }
      if (this.totalHt <= 0) { this.error = 'Le total doit être strictement positif.'; return }
      if (!window.confirm('Finaliser ce devis ? Il sera verrouillé et numéroté définitivement.')) return
      this.saving = true; this.error = ''
      try {
        const id = await this.persist()
        await devisApi.finaliser(id)
        await this.load(id)
      } catch (e) {
        this.error = e.response?.data?.error || 'Finalisation impossible'
      } finally { this.saving = false }
    },
    async envoyer() {
      this.saving = true; this.error = ''
      try {
        await devisApi.envoyer(this.id)
        await this.load(this.id)
      } catch (e) {
        this.error = e.response?.data?.error || 'Action impossible'
      } finally { this.saving = false }
    },
    async accepter() {
      this.saving = true; this.error = ''
      try {
        await devisApi.accepter(this.id)
        await this.load(this.id)
      } catch (e) {
        this.error = e.response?.data?.error || 'Action impossible'
      } finally { this.saving = false }
    },
    async refuser() {
      if (!window.confirm('Marquer ce devis comme refusé ?')) return
      this.saving = true; this.error = ''
      try {
        await devisApi.refuser(this.id)
        await this.load(this.id)
      } catch (e) {
        this.error = e.response?.data?.error || 'Action impossible'
      } finally { this.saving = false }
    },
    async annuler() {
      if (!window.confirm('Annuler ce devis ? Le numéro DEV restera consommé.')) return
      this.saving = true; this.error = ''
      try {
        await devisApi.annuler(this.id)
        await this.load(this.id)
      } catch (e) {
        this.error = e.response?.data?.error || 'Action impossible'
      } finally { this.saving = false }
    },
    async incrementerCycle() {
      this.saving = true; this.error = ''
      try {
        await devisApi.incrementerCycle(this.id)
        await this.load(this.id)
      } catch (e) {
        this.error = e.response?.data?.error || 'Action impossible'
      } finally { this.saving = false }
    },
    async viewPdf() {
      const showPdf = openPdfTab()
      try {
        const blob = await devisApi.pdf(this.id)
        showPdf(blob)
      } catch { this.error = 'Aperçu PDF indisponible' }
    },
    addLine() { this.form.lignes.push(emptyLine(this.defaultTjm)) },
    removeLine(i) { this.form.lignes.splice(i, 1); if (!this.form.lignes.length) this.addLine() },
    lineTotal(l) { return (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0) },
    fmtEuro(n) { return euro.format(n || 0) },
    goBack() { this.$router.push({ name: 'documents' }) },

    // --- Avenant modal ---
    openAvenantModal() {
      this.avenantForm = { objet: '', description: '', delaiAdd: null, dateEmission: toDateInput(new Date()), lignes: [emptyLine(this.defaultTjm)] }
      this.showAvenantModal = true
    },
    closeAvenantModal() { this.showAvenantModal = false },
    addAvenantLine() { this.avenantForm.lignes.push(emptyLine(this.defaultTjm)) },
    removeAvenantLine(i) { this.avenantForm.lignes.splice(i, 1); if (!this.avenantForm.lignes.length) this.addAvenantLine() },
    async saveAvenant() {
      if (this.avenantTotal <= 0) { this.error = 'Montant de l\'avenant invalide.'; return }
      this.saving = true; this.error = ''
      try {
        await avenantsApi.create({
          devisId: Number(this.id),
          objet: this.avenantForm.objet || null,
          description: this.avenantForm.description || null,
          delaiAdd: this.avenantForm.delaiAdd ? Number(this.avenantForm.delaiAdd) : null,
          dateEmission: this.avenantForm.dateEmission || null,
          lignes: this.avenantForm.lignes.map((l, i) => ({
            designation: l.designation,
            quantite: Number(l.quantite) || 0,
            prixUnitaire: Number(l.prixUnitaire) || 0,
            ordre: i,
          })),
        })
        this.showAvenantModal = false
        await this.load(this.id)
      } catch (e) {
        this.error = e.response?.data?.error || 'Création avenant impossible'
      } finally { this.saving = false }
    },

    async dupliquer() {
      if (!window.confirm('Dupliquer ce devis ? Un nouveau brouillon sera créé.')) return
      this.saving = true; this.error = ''
      try {
        const copy = await devisApi.dupliquer(this.id)
        this.$router.push({ name: 'devis-edit', params: { id: copy.id } })
      } catch (e) {
        this.error = e.response?.data?.error || 'Duplication impossible'
      } finally { this.saving = false }
    },

    // --- Upload signé ---
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
          await devisApi.uploadSigne(this.id, base64)
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
        const blob = await devisApi.pdfSigne(this.id)
        showPdf(blob)
      } catch { this.error = 'PDF signé indisponible' }
    },

    // --- Facture creation ---
    openFactureModal() { this.factureForm = { type: 'standard', acomptePct: 30 }; this.showFactureModal = true },
    closeFactureModal() { this.showFactureModal = false },
    async createFactureFromDevis() {
      this.saving = true; this.error = ''
      try {
        const f = await devisApi.createFacture(this.id, {
          type: this.factureForm.type,
          acomptePct: this.factureForm.type === 'acompte' ? Number(this.factureForm.acomptePct) : null,
        })
        this.showFactureModal = false
        this.$router.push({ name: 'facture-edit', params: { id: f.id } })
      } catch (e) {
        this.error = e.response?.data?.error || 'Création facture impossible'
      } finally { this.saving = false }
    },
  },
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <PageHeader
      :title="isEdit ? (numero || 'Brouillon de devis') : 'Nouveau devis'"
      :back="{ name: 'documents' }"
    >
      <StatusDot v-if="statut" :dot="statutMeta.dot" :color="statutMeta.color" :label="statutMeta.label" />
      <span v-if="devis && devis.cyclesInclus > 0" class="text-[12px] text-zinc-500 whitespace-nowrap">
        {{ devis.cyclesUtilises || 0 }}/{{ devis.cyclesInclus }} révisions
        <span v-if="cyclesAlert" class="text-warning-fg ml-1">⚠</span>
      </span>
      <button v-if="isEdit" class="btn-secondary btn-sm" title="Aperçu PDF" :disabled="saving" @click="viewPdf">
        <i data-lucide="file-text" width="14" height="14"></i>
        PDF
      </button>
      <button v-if="isEdit && hasSignedPdf" class="btn-secondary btn-sm text-green-700 border-green-300 hover:bg-green-50" title="Voir le document signé" @click="viewSignedPdf">
        <i data-lucide="file-check" width="14" height="14"></i>
        Signé
      </button>
      <button v-if="isEdit && verrouillee" class="btn-secondary btn-sm" :title="hasSignedPdf ? 'Remplacer le document signé' : 'Uploader le document signé'" :disabled="saving" @click="openUploadSigneModal">
        <i data-lucide="upload" width="14" height="14"></i>
        {{ hasSignedPdf ? 'Remplacer signé' : 'Uploader signé' }}
      </button>
      <button v-if="isEdit" class="btn-ghost btn-sm" title="Dupliquer" :disabled="saving" @click="dupliquer">
        <i data-lucide="copy" width="14" height="14"></i>
        Dupliquer
      </button>
      <!-- Draft actions -->
      <template v-if="canEdit">
        <button class="btn-secondary btn-sm" :disabled="saving" @click="save">
          {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
        <button class="btn-primary btn-sm" title="Finaliser" :disabled="saving" @click="finalise">
          <i data-lucide="lock" width="14" height="14"></i>
          Finaliser
        </button>
      </template>
      <!-- Post-finalisation actions -->
      <template v-else>
        <button v-if="canEnvoyer" class="btn-secondary btn-sm" title="Marquer comme envoyé" :disabled="saving" @click="envoyer">
          <i data-lucide="send" width="14" height="14"></i>
          Marquer envoyé
        </button>
        <template v-if="canAccepterRefuser">
          <button class="btn-primary btn-sm" title="Marquer comme accepté" :disabled="saving" @click="accepter">
            <i data-lucide="check" width="14" height="14"></i>
            Accepté
          </button>
          <button class="btn-danger btn-sm" title="Marquer comme refusé" :disabled="saving" @click="refuser">
            Refusé
          </button>
        </template>
        <button v-if="canCreateFacture" class="btn-primary btn-sm" title="Créer une facture" :disabled="saving" @click="openFactureModal">
          <i data-lucide="file-plus" width="14" height="14"></i>
          Créer une facture
        </button>
        <button v-if="canCreateAvenant" class="btn-secondary btn-sm" title="Créer un avenant" :disabled="saving" @click="openAvenantModal">
          <i data-lucide="plus-square" width="14" height="14"></i>
          Avenant
        </button>
        <button v-if="statut === 'accepte'" class="btn-ghost btn-sm" title="Incrémenter le compteur de révisions" :disabled="saving" @click="incrementerCycle">
          <i data-lucide="refresh-cw" width="13" height="13"></i>
          +1 révision
        </button>
        <button v-if="canAnnuler" class="btn-danger btn-sm" title="Annuler le devis" :disabled="saving" @click="annuler">Annuler</button>
      </template>
    </PageHeader>

    <div class="flex-1 overflow-auto p-6 bg-zinc-50 space-y-5">
      <p v-if="error" class="bg-error-bg text-error-fg text-[13px] px-4 py-2 rounded border border-red-200">{{ error }}</p>

      <!-- Related documents chips -->
      <div v-if="devis && devis.avenants && devis.avenants.length" class="flex items-center gap-2 flex-wrap">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Avenants :</span>
        <span
          v-for="a in devis.avenants" :key="a.id"
          class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white border border-zinc-200 rounded text-[12px] text-zinc-700"
        >
          <span class="font-mono font-semibold">{{ a.numero || `#${a.id}` }}</span>
          <span class="text-zinc-400">{{ fmtEuro(a.totalHt) }}</span>
        </span>
      </div>
      <div v-if="devis && devis.factures && devis.factures.length" class="flex items-center gap-2 flex-wrap">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Factures :</span>
        <button
          v-for="f in devis.factures" :key="f.id"
          class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white border border-zinc-200 rounded text-[12px] text-blue-600 hover:bg-blue-50"
          @click="$router.push({ name: 'facture-edit', params: { id: f.id } })"
        >
          <span class="font-mono font-semibold">{{ f.numero || `#${f.id}` }}</span>
          <span class="text-zinc-400">{{ fmtEuro(f.totalHt) }}</span>
        </button>
      </div>

      <div v-if="loading" class="text-center text-[13px] text-zinc-400 py-10">Chargement…</div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        <!-- Main card -->
        <div class="space-y-5">
          <!-- Meta + client -->
          <div class="bg-white border border-zinc-200 rounded p-5">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div>
                <label class="field-label">N° devis</label>
                <input class="field-input bg-zinc-50" :value="numero || 'À la finalisation'" disabled />
              </div>
              <div>
                <label class="field-label">Date d'émission</label>
                <input v-model="form.dateEmission" type="date" class="field-input" :disabled="!canEdit" />
              </div>
              <div>
                <label class="field-label">Validité (jours)</label>
                <input v-model.number="form.validiteJours" type="number" min="1" class="field-input" :disabled="!canEdit" />
              </div>
              <div>
                <label class="field-label">Acompte (%)</label>
                <input v-model.number="form.acomptePct" type="number" min="0" max="100" class="field-input" :disabled="!canEdit" placeholder="—" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2 sm:col-span-1">
                <label class="field-label">Client</label>
                <select v-model="form.clientId" class="field-input" :disabled="!canEdit">
                  <option :value="null">— Sans client —</option>
                  <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.denomination || c.nom }}</option>
                </select>
              </div>
              <div class="col-span-2 sm:col-span-1">
                <label class="field-label">Révisions incluses</label>
                <input v-model.number="form.cyclesInclus" type="number" min="0" class="field-input" :disabled="!canEdit" />
              </div>
              <div class="col-span-2">
                <label class="field-label">Titre / objet</label>
                <input v-model="form.titre" class="field-input" :disabled="!canEdit" placeholder="Développement application web…" />
              </div>
              <div class="col-span-2">
                <label class="field-label">Description</label>
                <textarea v-model="form.description" rows="3" class="field-textarea" :disabled="!canEdit" placeholder="Contexte et périmètre…"></textarea>
              </div>
            </div>
          </div>

          <!-- Lines -->
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
                      :disabled="!canEdit"
                      @select-product="(p) => (l.prixUnitaire = p.prixUnitaire)"
                    />
                  </td>
                  <td class="p-2"><input v-model.number="l.quantite" type="number" step="0.25" min="0" class="field-input text-right" :disabled="!canEdit" /></td>
                  <td class="p-2"><input v-model.number="l.prixUnitaire" type="number" step="0.01" min="0" class="field-input text-right" :disabled="!canEdit" /></td>
                  <td class="p-2 text-right font-semibold text-[13px] tabular text-zinc-900 pt-[10px]">{{ fmtEuro(lineTotal(l)) }}</td>
                  <td class="p-2 text-center pt-[8px]">
                    <button v-if="canEdit" class="btn-icon" title="Supprimer la ligne" @click="removeLine(i)"><i data-lucide="x" width="14" height="14"></i></button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="canEdit" class="px-3 py-2">
              <button class="btn-ghost btn-sm" @click="addLine">
                <i data-lucide="plus" width="13" height="13"></i>
                Ajouter une ligne
              </button>
            </div>
          </div>

          <!-- Clauses -->
          <div class="bg-white border border-zinc-200 rounded p-5 space-y-4">
            <h3 class="text-[13px] font-bold text-zinc-900">Clauses contractuelles</h3>
            <div>
              <label class="field-label">Clause révisions</label>
              <textarea v-model="form.clauseRevision" rows="4" class="field-textarea" :disabled="!canEdit"></textarea>
            </div>
            <div>
              <label class="field-label">Clause hébergement</label>
              <textarea v-model="form.clauseHebergement" rows="3" class="field-textarea" :disabled="!canEdit"></textarea>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="space-y-4">
          <!-- Client card -->
          <div v-if="selectedClient" class="bg-white border border-zinc-200 rounded p-4 text-[13px]">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Client</p>
            <p class="font-semibold text-zinc-900">{{ selectedClient.denomination || selectedClient.nom }}</p>
            <p v-if="selectedClient.adresse1" class="text-zinc-500">{{ selectedClient.adresse1 }}</p>
            <p v-if="selectedClient.codePostal || selectedClient.ville" class="text-zinc-500">{{ selectedClient.codePostal }} {{ selectedClient.ville }}</p>
          </div>

          <!-- Total block -->
          <div class="bg-white border border-zinc-200 rounded p-4">
            <div class="flex justify-between py-2 border-b border-zinc-100 text-[13px]">
              <span class="text-zinc-500">Total HT</span>
              <span class="font-semibold tabular text-zinc-900">{{ fmtEuro(totalHt) }}</span>
            </div>
            <div class="flex justify-between py-2 text-[12px] text-zinc-400 border-b border-zinc-100">
              <span>TVA</span>
              <span>art. 293 B du CGI</span>
            </div>
            <div v-if="form.acomptePct" class="flex justify-between py-2 text-[13px] text-zinc-500 border-b border-zinc-100">
              <span>Acompte ({{ form.acomptePct }} %)</span>
              <span class="tabular">{{ fmtEuro(totalHt * form.acomptePct / 100) }}</span>
            </div>
            <div class="flex justify-between items-baseline pt-3">
              <span class="text-[12px] font-bold uppercase tracking-wider text-zinc-500">Total devis</span>
              <span class="text-[22px] font-bold tabular text-blue-600">{{ fmtEuro(totalHt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload signé modal -->
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

    <!-- Avenant creation modal -->
    <BaseModal v-if="showAvenantModal" size="lg" title="Créer un avenant" @close="closeAvenantModal">
      <div class="space-y-4">
        <p v-if="error" class="text-[13px] text-error-fg bg-error-bg p-3 rounded">{{ error }}</p>
        <div>
          <label class="field-label">Objet de l'avenant</label>
          <input v-model="avenantForm.objet" class="field-input" placeholder="Ajout du module de paiement…" />
        </div>
        <div>
          <label class="field-label">Description</label>
          <textarea v-model="avenantForm.description" rows="3" class="field-textarea" placeholder="Détail des modifications…"></textarea>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="field-label">Date d'émission</label>
            <input v-model="avenantForm.dateEmission" type="date" class="field-input" />
          </div>
          <div>
            <label class="field-label">Délai additionnel (jours)</label>
            <input v-model.number="avenantForm.delaiAdd" type="number" min="0" class="field-input" placeholder="—" />
          </div>
        </div>
        <table class="w-full border-collapse">
          <thead class="t-head">
            <tr>
              <th class="t-th">Désignation</th>
              <th class="t-th-right w-20">Qté</th>
              <th class="t-th-right w-28">Prix unit. (€)</th>
              <th class="t-th-right w-28">Total</th>
              <th class="w-8 border-b border-zinc-200"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in avenantForm.lignes" :key="i" class="border-b border-zinc-100 align-top">
              <td class="p-2">
                <ProductPicker
                  v-model="l.designation"
                  placeholder="Prestation additionnelle ou rechercher…"
                  @select-product="(p) => (l.prixUnitaire = p.prixUnitaire)"
                />
              </td>
              <td class="p-2"><input v-model.number="l.quantite" type="number" step="0.25" min="0" class="field-input text-right" /></td>
              <td class="p-2"><input v-model.number="l.prixUnitaire" type="number" step="0.01" min="0" class="field-input text-right" /></td>
              <td class="p-2 text-right text-[13px] font-semibold tabular text-zinc-900 pt-[10px]">
                {{ fmtEuro((Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0)) }}
              </td>
              <td class="p-2 text-center pt-[8px]">
                <button class="btn-icon" title="Supprimer la ligne" @click="removeAvenantLine(i)"><i data-lucide="x" width="13" height="13"></i></button>
              </td>
            </tr>
          </tbody>
        </table>
        <button class="btn-ghost btn-sm" @click="addAvenantLine">
          <i data-lucide="plus" width="13" height="13"></i>
          Ajouter une ligne
        </button>
        <div class="flex justify-between items-baseline bg-zinc-50 border border-zinc-200 rounded px-4 py-3">
          <span class="text-[12px] font-bold uppercase tracking-wider text-zinc-500">Total avenant</span>
          <span class="text-[18px] font-bold tabular text-blue-600">{{ fmtEuro(avenantTotal) }}</span>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="closeAvenantModal">Annuler</button>
        <button class="btn-primary" :disabled="saving" @click="saveAvenant">
          {{ saving ? 'Création…' : "Créer l'avenant" }}
        </button>
      </template>
    </BaseModal>

    <!-- Facture creation modal -->
    <BaseModal v-if="showFactureModal" title="Créer une facture" @close="closeFactureModal">
      <div class="space-y-4">
        <p v-if="error" class="text-[13px] text-error-fg bg-error-bg p-3 rounded">{{ error }}</p>
        <div>
          <label class="field-label">Type de facture</label>
          <select v-model="factureForm.type" class="field-input">
            <option value="standard">Facture complète (lignes du devis)</option>
            <option value="acompte">Facture d'acompte</option>
          </select>
        </div>
        <div v-if="factureForm.type === 'acompte'">
          <label class="field-label">Pourcentage d'acompte (%)</label>
          <input v-model.number="factureForm.acomptePct" type="number" min="1" max="100" class="field-input" />
          <p class="text-[12px] text-zinc-500 mt-1">
            → {{ fmtEuro(totalHt * factureForm.acomptePct / 100) }} sur {{ fmtEuro(totalHt) }}
          </p>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="closeFactureModal">Annuler</button>
        <button class="btn-primary" :disabled="saving" @click="createFactureFromDevis">
          {{ saving ? 'Création…' : 'Créer la facture' }}
        </button>
      </template>
    </BaseModal>
  </div>
</template>

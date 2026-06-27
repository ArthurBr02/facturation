<script>
// Template management + Phase 6 custom HTML personalisation.
// Users can download the default HTML, modify it, and re-upload for full
// visual customisation. Editing creates a new server-side version (history preserved).
import { templatesApi } from '@/api'
import { openPdfTab } from '@/utils/pdf'
import PageHeader from '@/components/PageHeader.vue'
import BaseModal from '@/components/BaseModal.vue'

const TYPES = [
  { value: 'devis', label: 'Devis' },
  { value: 'facture', label: 'Facture' },
  { value: 'avenant', label: 'Avenant' },
  { value: 'contrat', label: 'Contrat' },
]
const CLAUSE_KEYS = ['objet', 'description', 'modalites', 'hebergement', 'revision', 'paiement']

// Placeholders documented per type — kept as plain strings to avoid Vue interpolation conflicts.
const PLACEHOLDERS_DOC = {
  common: [
    { token: 'emetteur.nom', desc: 'Nom du prestataire' },
    { token: 'emetteur.entreprise', desc: 'Raison sociale (entreprise)' },
    { token: 'emetteur.statut', desc: 'Statut juridique (ex. EI)' },
    { token: 'emetteur.siret', desc: 'Numéro SIRET' },
    { token: 'emetteur.ape', desc: 'Code APE' },
    { token: 'emetteur.adresse1', desc: 'Ligne 1 adresse' },
    { token: 'emetteur.adresse2', desc: 'Ligne 2 adresse' },
    { token: 'emetteur.cp', desc: 'Code postal' },
    { token: 'emetteur.ville', desc: 'Ville' },
    { token: 'emetteur.pays', desc: 'Pays' },
    { token: 'emetteur.email', desc: 'E-mail professionnel' },
    { token: 'emetteur.telephone', desc: 'Téléphone' },
    { token: 'emetteur.iban', desc: 'IBAN' },
    { token: 'emetteur.bic', desc: 'BIC' },
    { token: 'client.nom', desc: 'Nom du client' },
    { token: 'client.denomination', desc: 'Dénomination sociale' },
    { token: 'client.forme_juridique', desc: 'Forme juridique' },
    { token: 'client.adresse1', desc: 'Ligne 1 adresse client' },
    { token: 'client.adresse2', desc: 'Ligne 2 adresse client' },
    { token: 'client.code_postal', desc: 'Code postal client' },
    { token: 'client.ville', desc: 'Ville client' },
    { token: 'client.pays', desc: 'Pays client' },
    { token: 'client.siren', desc: 'SIREN client' },
    { token: 'client.tva_intra', desc: 'TVA intracommunautaire client' },
    { token: 'document.numero', desc: 'Numéro du document' },
    { token: 'document.date_emission', desc: "Date d'émission (JJ/MM/AAAA)" },
    { token: 'document.total_ht', desc: 'Total HT = TTC (ex. 2 800,00 €)' },
    { token: 'document.objet', desc: 'Objet / titre du document' },
    { token: 'mention_tva', desc: "Mention TVA non applicable, art. 293 B du CGI" },
    { token: 'mention_penalites', desc: 'Mention pénalités de retard' },
    { token: 'annee', desc: 'Année en cours' },
  ],
  facture: [
    { token: 'document.label', desc: 'Label du document (Facture / Avoir / Facture d\'acompte…)' },
    { token: 'document.date_echeance', desc: "Date d'échéance" },
    { token: 'document.bon_commande', desc: 'Numéro de bon de commande' },
    { token: 'document.facture_origine_numero', desc: 'Numéro de la facture d\'origine (avoirs)' },
    { token: 'document.date_execution', desc: "Période ou date d'exécution" },
  ],
  devis: [
    { token: 'document.titre', desc: 'Titre du devis' },
    { token: 'document.description', desc: 'Description du devis' },
    { token: 'document.date_validite', desc: 'Date de validité' },
    { token: 'document.validite_jours', desc: 'Durée de validité en jours' },
    { token: 'document.cycles_inclus', desc: 'Nombre de cycles de révision inclus' },
    { token: 'document.acompte_pct', desc: "Pourcentage d'acompte (ex. 30 %)" },
    { token: 'document.acompte_montant', desc: "Montant de l'acompte formaté" },
    { token: 'clause.revision', desc: 'Clause cycles de révision' },
    { token: 'clause.hebergement', desc: 'Clause hébergement' },
  ],
  avenant: [
    { token: 'document.devis_numero', desc: 'Numéro du devis d\'origine' },
    { token: 'document.description', desc: 'Description de la modification' },
    { token: 'document.delai_add', desc: 'Délai additionnel (jours)' },
  ],
  contrat: [
    { token: 'document.titre', desc: 'Titre du contrat' },
    { token: 'document.description', desc: 'Description du contrat' },
    { token: 'document.date_debut', desc: 'Date de début' },
    { token: 'document.duree', desc: 'Durée formatée (ex. 12 mois — reconduction tacite)' },
    { token: 'document.montant_mensuel', desc: 'Montant mensuel fixe' },
    { token: 'document.heures_incluses', desc: 'Heures incluses par mois' },
    { token: 'document.thm_depassement', desc: 'Taux horaire dépassement' },
    { token: 'document.report_heures', desc: 'Report d\'heures (Oui / Non)' },
    { token: 'document.preavis_jours', desc: 'Préavis de résiliation (jours)' },
    { token: 'document.reconduction', desc: 'Reconduction tacite (Oui / Non)' },
    { token: 'document.perimetre_couvert', desc: 'Périmètre couvert' },
    { token: 'document.exclusions', desc: 'Exclusions' },
  ],
}

function emptyTemplate() {
  return { nom: '', type: 'devis', description: '', estDefaut: false, lignes: [], clauses: [] }
}

export default {
  name: 'TemplatesView',
  components: { PageHeader, BaseModal },
  data() {
    return {
      templates: [],
      loading: true,
      types: TYPES,
      clauseKeys: CLAUSE_KEYS,
      placeholdersDoc: PLACEHOLDERS_DOC,
      showModal: false,
      editingId: null,
      form: emptyTemplate(),
      saving: false,
      error: '',
      preview: null,
      showPreview: false,
      // Custom HTML
      uploadingId: null,
      uploadError: '',
      showDocs: false,
      docsType: 'facture',
    }
  },
  computed: {
    grouped() {
      return TYPES.map((t) => ({
        ...t,
        items: this.templates.filter((tpl) => tpl.type === t.value),
      }))
    },
    docsPlaceholders() {
      return [
        ...this.placeholdersDoc.common,
        ...(this.placeholdersDoc[this.docsType] || []),
      ]
    },
  },
  created() {
    this.fetch()
  },
  methods: {
    async fetch() {
      this.loading = true
      try {
        this.templates = await templatesApi.list()
      } finally {
        this.loading = false
        this.$nextTick(() => window.lucide?.createIcons())
      }
    },
    openCreate() {
      this.editingId = null
      this.form = emptyTemplate()
      this.error = ''
      this.showModal = true
    },
    openEdit(tpl) {
      this.editingId = tpl.id
      this.form = {
        nom: tpl.nom,
        type: tpl.type,
        description: tpl.description || '',
        estDefaut: tpl.estDefaut,
        lignes: tpl.lignes.map((l) => ({
          designationTemplate: l.designationTemplate,
          quantiteTemplate: Number(l.quantiteTemplate),
          prixUnitaireTemplate: Number(l.prixUnitaireTemplate),
          ordre: l.ordre,
        })),
        clauses: tpl.clauses.map((c) => ({ cle: c.cle, contenuTemplate: c.contenuTemplate })),
      }
      this.error = ''
      this.showModal = true
    },
    addLine() {
      this.form.lignes.push({ designationTemplate: '', quantiteTemplate: 0, prixUnitaireTemplate: 0, ordre: this.form.lignes.length })
    },
    removeLine(i) { this.form.lignes.splice(i, 1) },
    addClause() { this.form.clauses.push({ cle: 'objet', contenuTemplate: '' }) },
    removeClause(i) { this.form.clauses.splice(i, 1) },
    async save() {
      this.saving = true
      this.error = ''
      try {
        if (this.editingId) await templatesApi.update(this.editingId, this.form)
        else await templatesApi.create(this.form)
        this.showModal = false
        await this.fetch()
      } catch (e) {
        this.error = e.response?.data?.error || 'Enregistrement impossible'
      } finally {
        this.saving = false
      }
    },
    async setDefaut(tpl) {
      await templatesApi.setDefaut(tpl.id)
      await this.fetch()
    },
    async remove(tpl) {
      if (!window.confirm(`Supprimer le template « ${tpl.nom} » ?`)) return
      await templatesApi.remove(tpl.id)
      await this.fetch()
    },
    async openPreview(tpl) {
      this.preview = await templatesApi.preview(tpl.id)
      this.showPreview = true
    },
    // ── Phase 6 ─────────────────────────────────────────────────────────────
    async downloadDefaultHtml(type) {
      try {
        const blob = await templatesApi.defaultHtml(type)
        const url = URL.createObjectURL(new Blob([blob], { type: 'text/html' }))
        const a = document.createElement('a')
        a.href = url
        a.download = `template-${type}-defaut.html`
        a.click()
        URL.revokeObjectURL(url)
      } catch (e) {
        console.error('Download failed', e)
      }
    },
    async openPreviewPdf(tpl) {
      const showPdf = openPdfTab()
      try {
        const blob = await templatesApi.previewPdf(tpl.id)
        showPdf(blob)
      } catch (e) {
        console.error('Preview PDF failed', e)
      }
    },
    triggerHtmlUpload(tpl) {
      this.uploadingId = tpl.id
      this.uploadError = ''
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.html,text/html'
      input.addEventListener('change', (event) => this.onHtmlFileSelected(tpl, event))
      input.click()
    },
    async onHtmlFileSelected(tpl, event) {
      const file = event.target.files[0]
      if (!file) return
      if (file.size > 2_000_000) {
        this.uploadError = 'Fichier trop volumineux (max 2 Mo)'
        this.uploadingId = null
        return
      }
      try {
        const html = await file.text()
        await templatesApi.uploadHtml(tpl.id, html)
        await this.fetch()
        this.uploadError = ''
      } catch (e) {
        this.uploadError = e.response?.data?.error || "Erreur lors de l'upload"
      } finally {
        this.uploadingId = null
      }
    },
    async removeCustomHtml(tpl) {
      if (!window.confirm(`Réinitialiser le HTML personnalisé de « ${tpl.nom} » ?`)) return
      await templatesApi.removeCustomHtml(tpl.id)
      await this.fetch()
    },
    openDocs(type) {
      this.docsType = type
      this.showDocs = true
    },
  },
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <PageHeader title="Templates" subtitle="Modèles réutilisables — personnalisez l'apparence PDF avec votre propre HTML.">
      <button class="btn-primary" @click="openCreate">
        <i data-lucide="plus" width="15" height="15"></i>
        Nouveau template
      </button>
    </PageHeader>

    <div class="flex-1 overflow-auto p-6 bg-zinc-50">
      <div v-if="loading" class="text-[13px] text-zinc-400">Chargement…</div>

      <div v-else class="space-y-7">
        <section v-for="group in grouped" :key="group.value">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{{ group.label }}</h3>
            <div class="flex items-center gap-2">
              <button class="btn-ghost btn-sm" title="Voir les placeholders disponibles" @click="openDocs(group.value)">
                <i data-lucide="book-open" width="13" height="13"></i>
                Placeholders
              </button>
              <button class="btn-ghost btn-sm" title="Télécharger le HTML par défaut" @click="downloadDefaultHtml(group.value)">
                <i data-lucide="download" width="13" height="13"></i>
                HTML défaut
              </button>
            </div>
          </div>
          <p v-if="!group.items.length" class="text-[13px] text-zinc-400 mb-1">Aucun template.</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="tpl in group.items" :key="tpl.id" class="bg-white border border-zinc-200 rounded p-4 flex flex-col">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-[14px] font-semibold text-zinc-900 truncate">{{ tpl.nom }}</p>
                  <p class="text-[12px] text-zinc-400 mt-0.5">v{{ tpl.version }} · {{ tpl.lignes.length }} ligne(s)</p>
                </div>
                <div class="flex items-center gap-1 flex-shrink-0">
                  <span v-if="tpl.estDefaut" class="tag whitespace-nowrap">Défaut</span>
                  <span v-if="tpl.customHtml" class="tag bg-violet-50 text-violet-700 border-violet-200 whitespace-nowrap">HTML perso</span>
                </div>
              </div>
              <p v-if="tpl.description" class="text-[12.5px] text-zinc-500 mt-2">{{ tpl.description }}</p>

              <!-- Actions ligne 1: aperçu + édition -->
              <div class="flex items-center gap-0.5 mt-3">
                <button class="btn-icon" title="Aperçu placeholders" @click="openPreview(tpl)">
                  <i data-lucide="eye" width="14" height="14"></i>
                </button>
                <button class="btn-icon" title="Aperçu PDF (données factices)" @click="openPreviewPdf(tpl)">
                  <i data-lucide="file-text" width="14" height="14"></i>
                </button>
                <button class="btn-icon" title="Modifier" @click="openEdit(tpl)">
                  <i data-lucide="pencil" width="14" height="14"></i>
                </button>
                <button v-if="!tpl.estDefaut" class="btn-icon" title="Définir par défaut" @click="setDefaut(tpl)">
                  <i data-lucide="star" width="14" height="14"></i>
                </button>
                <button class="btn-icon hover:text-error-fg" title="Supprimer" @click="remove(tpl)">
                  <i data-lucide="trash-2" width="14" height="14"></i>
                </button>
              </div>

              <!-- Actions ligne 2: HTML personnalisé -->
              <div class="flex items-center gap-1 mt-1 pt-2 border-t border-zinc-100">
                <button class="btn-ghost btn-sm" title="Uploader un HTML personnalisé" @click="triggerHtmlUpload(tpl)">
                  <i data-lucide="upload" width="13" height="13"></i>
                  {{ tpl.customHtml ? 'Remplacer HTML' : 'Uploader HTML' }}
                </button>
                <button v-if="tpl.customHtml" class="btn-ghost btn-sm text-zinc-400 hover:text-error-fg" title="Réinitialiser HTML" @click="removeCustomHtml(tpl)">
                  <i data-lucide="rotate-ccw" width="13" height="13"></i>
                  Réinitialiser
                </button>
              </div>
              <p v-if="uploadError && uploadingId === tpl.id" class="text-[12px] text-error-fg mt-1">{{ uploadError }}</p>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Create / edit modal -->
    <BaseModal v-if="showModal" size="lg" :title="editingId ? 'Modifier (nouvelle version)' : 'Nouveau template'" @close="showModal = false">
      <div class="space-y-5">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="field-label">Nom <span class="text-error-fg">*</span></label>
            <input v-model="form.nom" class="field-input" />
          </div>
          <div>
            <label class="field-label">Type</label>
            <select v-model="form.type" class="field-input">
              <option v-for="t in types" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </div>
          <div class="col-span-2">
            <label class="field-label">Description</label>
            <input v-model="form.description" class="field-input" />
          </div>
          <label class="col-span-2 flex items-center gap-2 text-[13px] text-zinc-700 cursor-pointer">
            <input v-model="form.estDefaut" type="checkbox" class="rounded" />
            Template par défaut pour ce type
          </label>
        </div>

        <!-- Lines -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="field-label mb-0">Lignes de prestation</span>
            <button class="btn-ghost btn-sm" @click="addLine">
              <i data-lucide="plus" width="12" height="12"></i>
              Ligne
            </button>
          </div>
          <div v-for="(l, i) in form.lignes" :key="i" class="flex gap-2 mb-2">
            <input v-model="l.designationTemplate" class="field-input flex-1" placeholder="Désignation" />
            <input v-model.number="l.quantiteTemplate" type="number" step="0.25" class="field-input w-20 text-right" placeholder="Qté" />
            <input v-model.number="l.prixUnitaireTemplate" type="number" step="0.01" class="field-input w-24 text-right" placeholder="PU" />
            <button class="btn-icon flex-shrink-0" @click="removeLine(i)"><i data-lucide="x" width="13" height="13"></i></button>
          </div>
        </div>

        <!-- Clauses -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="field-label mb-0">Clauses</span>
            <button class="btn-ghost btn-sm" @click="addClause">
              <i data-lucide="plus" width="12" height="12"></i>
              Clause
            </button>
          </div>
          <div v-for="(c, i) in form.clauses" :key="i" class="flex gap-2 mb-2">
            <select v-model="c.cle" class="field-input w-40 flex-shrink-0">
              <option v-for="k in clauseKeys" :key="k" :value="k">{{ k }}</option>
            </select>
            <textarea v-model="c.contenuTemplate" rows="2" class="field-textarea flex-1" placeholder="Texte avec placeholders…"></textarea>
            <button class="btn-icon flex-shrink-0 self-start mt-1" @click="removeClause(i)"><i data-lucide="x" width="13" height="13"></i></button>
          </div>
        </div>

        <p v-if="error" class="text-[13px] text-error-fg">{{ error }}</p>
      </div>

      <template #footer>
        <button class="btn-secondary" @click="showModal = false">Annuler</button>
        <button class="btn-primary" :disabled="saving || !form.nom" @click="save">
          {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </template>
    </BaseModal>

    <!-- Placeholder preview modal -->
    <BaseModal v-if="showPreview" title="Aperçu (placeholders résolus)" @close="showPreview = false">
      <div v-if="preview" class="space-y-4">
        <div class="flex items-center gap-2">
          <p class="text-[14px] font-semibold text-zinc-900">{{ preview.nom }}</p>
          <span v-if="preview.hasCustomHtml" class="tag bg-violet-50 text-violet-700 border-violet-200">HTML perso actif</span>
        </div>
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-zinc-200">
              <th class="t-th">Désignation</th>
              <th class="t-th-right">Qté</th>
              <th class="t-th-right">PU</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in preview.lignes" :key="i" class="t-tr">
              <td class="t-td">{{ l.designation }}</td>
              <td class="t-td-right font-mono">{{ l.quantite }}</td>
              <td class="t-td-right font-mono">{{ l.prixUnitaire }}</td>
            </tr>
          </tbody>
        </table>
        <div v-for="(c, i) in preview.clauses" :key="i">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{{ c.cle }}</p>
          <p class="text-[13px] text-zinc-700 mt-1">{{ c.contenu }}</p>
        </div>
      </div>
    </BaseModal>

    <!-- Placeholders documentation modal -->
    <BaseModal v-if="showDocs" size="lg" title="Documentation des placeholders" @close="showDocs = false">
      <div class="space-y-4">
        <div class="flex items-center gap-2">
          <label class="field-label mb-0 flex-shrink-0">Type :</label>
          <select v-model="docsType" class="field-input w-36">
            <option v-for="t in types" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </div>

        <div class="bg-zinc-50 border border-zinc-200 rounded p-3 text-[12px] text-zinc-500 leading-5">
          Utilisez ces tokens dans votre HTML personnalisé. Pour les lignes :
          <code class="font-mono bg-zinc-100 px-1 rounded">&lcub;&lcub;#lignes&rcub;&rcub;...&lcub;&lcub;/lignes&rcub;&rcub;</code>
          avec <code class="font-mono bg-zinc-100 px-1 rounded">ligne.designation</code>,
          <code class="font-mono bg-zinc-100 px-1 rounded">ligne.quantite</code>,
          <code class="font-mono bg-zinc-100 px-1 rounded">ligne.prix_unitaire</code>,
          <code class="font-mono bg-zinc-100 px-1 rounded">ligne.montant</code>.
        </div>

        <table class="w-full border-collapse text-[13px]">
          <thead>
            <tr class="border-b border-zinc-200">
              <th class="t-th w-1/2">Placeholder</th>
              <th class="t-th">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ph in docsPlaceholders" :key="ph.token" class="t-tr">
              <td class="t-td">
                <code class="font-mono text-[12px] bg-zinc-100 px-1.5 py-0.5 rounded text-violet-700">&lcub;&lcub;{{ ph.token }}&rcub;&rcub;</code>
              </td>
              <td class="t-td text-zinc-500">{{ ph.desc }}</td>
            </tr>
          </tbody>
        </table>

        <div class="bg-blue-50 border border-blue-200 rounded p-3 text-[12px] text-blue-700">
          <strong>Astuce :</strong> Téléchargez le HTML par défaut de votre type de document, modifiez-le dans votre éditeur, puis uploadez-le sur le template de votre choix. L'aperçu PDF (icône <i data-lucide="file-text" width="12" height="12" class="inline"></i>) génère un PDF avec des données factices.
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<script>
// Settings page (PLAN.md §5.7). Edit emitter info grouped in sections, with a
// live preview of an invoice header, plus a button to relaunch the wizard.
import { settingsApi } from '@/api'
import PageHeader from '@/components/PageHeader.vue'

const GROUP_LABELS = {
  identite: 'Identité',
  coordonnees: 'Coordonnées',
  bancaire: 'Coordonnées bancaires',
  facturation: 'Préférences de facturation',
  alertes: 'Alertes',
}
const GROUP_ORDER = ['identite', 'coordonnees', 'bancaire', 'facturation', 'alertes']

export default {
  name: 'SettingsView',
  components: { PageHeader },
  data() {
    return { groups: {}, values: {}, loading: true, saving: false, saved: false, error: '' }
  },
  computed: {
    orderedGroups() {
      return GROUP_ORDER.filter((g) => this.groups[g]).map((g) => ({
        key: g,
        label: GROUP_LABELS[g] || g,
        fields: this.groups[g],
      }))
    },
    // Values used by the invoice-header preview.
    preview() {
      const v = this.values
      return {
        nom: v['emetteur.nom'] || 'Votre nom',
        entreprise: v['emetteur.entreprise'] || '',
        statut: v['emetteur.statut'] || 'Entrepreneur individuel (EI)',
        adresse1: v['emetteur.adresse1'] || 'Adresse',
        cpville: [v['emetteur.cp'], v['emetteur.ville']].filter(Boolean).join(' ') || '',
        siret: v['emetteur.siret'] || '— — —',
        ape: v['emetteur.ape'] || '—',
        email: v['emetteur.email'] || '',
      }
    },
  },
  created() {
    this.fetch()
  },
  methods: {
    async fetch() {
      this.loading = true
      const { groups } = await settingsApi.getAll()
      this.groups = groups
      for (const fields of Object.values(groups)) {
        for (const f of fields) this.values[f.cle] = f.valeur || ''
      }
      this.loading = false
    },
    isTextarea(cle) {
      return cle === 'emetteur.penalites' || cle === 'emetteur.mention_tva'
    },
    async save() {
      this.saving = true
      this.saved = false
      this.error = ''
      try {
        await settingsApi.update(this.values)
        this.saved = true
        setTimeout(() => (this.saved = false), 2000)
      } catch (e) {
        this.error = e.response?.data?.error || 'Enregistrement impossible'
      } finally {
        this.saving = false
      }
    },
    async relaunch() {
      if (!window.confirm("Relancer l'assistant de configuration ?")) return
      await settingsApi.resetOnboarding()
      this.$router.push({ name: 'onboarding' })
    },
  },
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <PageHeader title="Paramètres" subtitle="Informations de l'émetteur et préférences">
      <button class="btn-secondary" title="Relancer l'assistant" @click="relaunch">
        <i data-lucide="refresh-cw" width="14" height="14"></i>
        Relancer l'assistant
      </button>
      <button class="btn-primary" :disabled="saving" @click="save">
        {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
      </button>
    </PageHeader>

    <div class="flex-1 overflow-auto p-6 bg-zinc-50">
      <div v-if="loading" class="text-[13px] text-zinc-400">Chargement…</div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        <!-- Form sections -->
        <div class="space-y-4">
          <div v-if="saved" class="bg-success-bg text-success-fg text-[13px] px-4 py-2 rounded border border-green-200 font-semibold">
            Paramètres enregistrés.
          </div>
          <div v-if="error" class="bg-error-bg text-error-fg text-[13px] px-4 py-2 rounded border border-red-200">{{ error }}</div>

          <section v-for="group in orderedGroups" :key="group.key" class="bg-white border border-zinc-200 rounded p-5">
            <h3 class="text-[13px] font-bold text-zinc-900 mb-4">{{ group.label }}</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div v-for="f in group.fields" :key="f.cle" :class="isTextarea(f.cle) ? 'sm:col-span-2' : ''">
                <label class="field-label">{{ f.label }} <span v-if="f.requis" class="text-error-fg">*</span></label>
                <textarea v-if="isTextarea(f.cle)" v-model="values[f.cle]" rows="3" class="field-textarea"></textarea>
                <input v-else v-model="values[f.cle]" class="field-input" />
              </div>
            </div>
          </section>
        </div>

        <!-- Emitter preview card -->
        <div>
          <div class="bg-white border border-zinc-200 rounded p-4 sticky top-0">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-3">Aperçu en-tête</p>
            <div class="border border-zinc-100 rounded p-4 text-[12px]">
              <div class="w-10 h-[3px] bg-blue-600 rounded mb-3"></div>
              <p class="font-bold text-zinc-900 text-[14px]">{{ preview.nom }}</p>
              <p class="text-zinc-500 mt-0.5">{{ [preview.entreprise, preview.statut].filter(Boolean).join(' · ') }}</p>
              <div class="mt-3 text-zinc-500 space-y-0.5">
                <p>{{ preview.adresse1 }}</p>
                <p>{{ preview.cpville }}</p>
                <p class="font-mono mt-2">SIRET {{ preview.siret }}</p>
                <p class="font-mono">APE {{ preview.ape }}</p>
                <p v-if="preview.email" class="font-mono">{{ preview.email }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

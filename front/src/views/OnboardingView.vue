<script>
// First-run onboarding wizard (PLAN.md §5.7.2). Seven steps:
//   1 Welcome · 2 Identité · 3 Coordonnées · 4 Bancaire · 5 Facturation
//   6 Alertes · 7 Confirmation
// Field steps (2..6) are driven by the settings catalogue returned by the API
// (grouped by onboarding step). Each step is saved before advancing so a reload
// never loses data. The wizard is non-skippable until required fields are set.
import { settingsApi } from '@/api'
import { useSettingsStore } from '@/stores/settings'

const STEP_META = {
  1: { title: 'Bienvenue', subtitle: 'Configurons votre espace de facturation en quelques étapes.' },
  2: { title: 'Identité professionnelle', subtitle: 'Ces informations apparaîtront sur vos documents.' },
  3: { title: 'Coordonnées', subtitle: 'Adresse et contact de votre entreprise.' },
  4: { title: 'Coordonnées bancaires', subtitle: 'Utilisées pour le règlement de vos factures.' },
  5: { title: 'Préférences de facturation', subtitle: 'Valeurs par défaut et mentions légales.' },
  6: { title: 'Alertes', subtitle: 'Où recevoir les alertes système (Drive, sauvegardes).' },
  7: { title: 'Confirmation', subtitle: "Tout est prêt — vérifiez et lancez l'application." },
}

export default {
  name: 'OnboardingView',
  data() {
    return {
      current: 1,
      totalSteps: 7,
      stepsData: {}, // { [step]: AppSetting[] }
      values: {}, // { [cle]: value }
      loading: true,
      saving: false,
      error: '',
    }
  },
  computed: {
    meta() {
      return STEP_META[this.current]
    },
    progress() {
      return Math.round(((this.current - 1) / (this.totalSteps - 1)) * 100)
    },
    currentFields() {
      return this.stepsData[this.current] || []
    },
    // Required fields missing across the whole wizard (gates completion).
    missingRequired() {
      const missing = []
      for (const fields of Object.values(this.stepsData)) {
        for (const f of fields) {
          if (f.requis && !(this.values[f.cle] || '').trim()) missing.push(f)
        }
      }
      return missing
    },
    currentStepValid() {
      return this.currentFields.every((f) => !f.requis || (this.values[f.cle] || '').trim())
    },
  },
  async created() {
    const data = await settingsApi.getOnboarding()
    this.totalSteps = data.totalSteps
    this.stepsData = data.steps
    for (const fields of Object.values(data.steps)) {
      for (const f of fields) this.values[f.cle] = f.valeur || ''
    }
    this.loading = false
  },
  methods: {
    isTextarea(cle) {
      return cle === 'emetteur.penalites' || cle === 'emetteur.mention_tva'
    },
    async saveCurrentStep() {
      const fields = this.currentFields
      if (fields.length === 0) return
      const payload = {}
      for (const f of fields) payload[f.cle] = this.values[f.cle] ?? ''
      await settingsApi.saveStep(this.current, payload)
    },
    async next() {
      this.error = ''
      if (!this.currentStepValid) {
        this.error = 'Merci de remplir les champs obligatoires (*).'
        return
      }
      this.saving = true
      try {
        await this.saveCurrentStep()
        if (this.current < this.totalSteps) this.current += 1
      } catch (e) {
        this.error = e.response?.data?.error || 'Sauvegarde impossible'
      } finally {
        this.saving = false
      }
    },
    back() {
      this.error = ''
      if (this.current > 1) this.current -= 1
    },
    async finish() {
      this.saving = true
      this.error = ''
      try {
        await settingsApi.completeOnboarding()
        const settings = useSettingsStore()
        settings.onboardingComplete = true
        this.$router.push({ name: 'dashboard' })
      } catch (e) {
        this.error = e.response?.data?.error || 'Validation impossible'
        // Jump back so the user can fix missing fields.
        if (this.missingRequired.length) this.current = this.missingRequired[0].onboardingStep
      } finally {
        this.saving = false
      }
    },
  },
}
</script>

<template>
  <div class="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-10">
    <div class="w-full max-w-xl">
      <!-- Progress bar -->
      <div class="mb-6">
        <div class="flex justify-between text-[12px] text-zinc-400 mb-2">
          <span>Étape {{ current }} / {{ totalSteps }}</span>
          <span>{{ progress }} %</span>
        </div>
        <div class="h-[3px] rounded-full bg-zinc-200 overflow-hidden">
          <div class="h-full bg-blue-600 rounded-full transition-all" :style="{ width: progress + '%' }"></div>
        </div>
      </div>

      <div class="bg-white border border-zinc-200 rounded p-8">
        <h2 class="text-[20px] font-bold text-zinc-900 mb-1">{{ meta.title }}</h2>
        <p class="text-[13.5px] text-zinc-500 mb-6">{{ meta.subtitle }}</p>

        <div v-if="loading" class="text-[13px] text-zinc-400">Chargement…</div>

        <!-- Step 1: Welcome -->
        <div v-else-if="current === 1" class="space-y-3">
          <p class="text-[14px] text-zinc-700 leading-relaxed">
            Bienvenue. Cet assistant configure l'identité de votre entreprise, vos coordonnées bancaires et
            vos préférences de facturation. Ces informations alimentent automatiquement vos devis et factures.
          </p>
          <p class="text-[13px] text-zinc-400">Vous pourrez tout modifier plus tard depuis les Paramètres.</p>
        </div>

        <!-- Step 7: Confirmation -->
        <div v-else-if="current === totalSteps" class="space-y-3">
          <p class="text-[14px] font-semibold text-zinc-900">Tout est prêt.</p>
          <div v-if="missingRequired.length" class="bg-error-bg text-error-fg text-[13px] p-3 rounded border border-red-200">
            Champs obligatoires manquants :
            <ul class="list-disc list-inside mt-1">
              <li v-for="f in missingRequired" :key="f.cle">{{ f.label }}</li>
            </ul>
          </div>
          <p v-else class="text-[13px] text-zinc-500">
            Cliquez sur « Lancer l'application » pour accéder à votre tableau de bord.
          </p>
        </div>

        <!-- Field steps (2..6) -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div v-for="f in currentFields" :key="f.cle" :class="isTextarea(f.cle) ? 'sm:col-span-2' : ''">
            <label class="field-label">{{ f.label }} <span v-if="f.requis" class="text-error-fg">*</span></label>
            <textarea v-if="isTextarea(f.cle)" v-model="values[f.cle]" rows="3" class="field-textarea"></textarea>
            <input v-else v-model="values[f.cle]" class="field-input" />
          </div>
        </div>

        <p v-if="error" class="text-[13px] text-error-fg mt-4">{{ error }}</p>

        <!-- Navigation -->
        <div class="flex justify-between mt-8">
          <button class="btn-secondary" :disabled="current === 1 || saving" @click="back">Retour</button>
          <button v-if="current < totalSteps" class="btn-primary" :disabled="saving" @click="next">
            {{ saving ? '…' : 'Continuer' }}
          </button>
          <button v-else class="btn-primary" :disabled="saving || missingRequired.length > 0" @click="finish">
            {{ saving ? '…' : "Lancer l'application" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

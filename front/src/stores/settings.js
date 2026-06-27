// Settings & onboarding store. Caches whether onboarding is complete so the
// router guard can redirect first-run users to the wizard.
import { defineStore } from 'pinia'
import { settingsApi } from '@/api'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    onboardingComplete: null, // null = unknown yet
    groups: {},
  }),
  actions: {
    async fetchOnboardingState() {
      const data = await settingsApi.getOnboarding()
      this.onboardingComplete = data.complete
      return data
    },
    async fetchSettings() {
      const data = await settingsApi.getAll()
      this.groups = data.groups
      return data.groups
    },
    async save(values) {
      await settingsApi.update(values)
      await this.fetchSettings()
    },
  },
})

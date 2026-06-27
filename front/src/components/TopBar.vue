<script>
// Top app bar: product name, quick "Backup" action and the logout control.
import { useAuthStore } from '@/stores/auth'
import { adminApi } from '@/api'

export default {
  name: 'TopBar',
  data() {
    return { backingUp: false }
  },
  computed: {
    auth() {
      return useAuthStore()
    },
  },
  methods: {
    async runBackup() {
      this.backingUp = true
      try {
        await adminApi.backup()
        window.alert('Sauvegarde lancée et envoyée vers Drive (ou mise en file).')
      } catch (e) {
        window.alert('Échec de la sauvegarde : ' + (e.response?.data?.error || e.message))
      } finally {
        this.backingUp = false
      }
    },
    logout() {
      this.auth.logout()
      this.$router.push({ name: 'login' })
    },
  },
}
</script>

<template>
  <header
    class="flex justify-between items-center h-16 px-gutter border-b border-outline-variant bg-surface sticky top-0 z-40 w-full"
  >
    <span class="text-headline-sm font-black text-primary">Gestion de Facturation</span>

    <div class="flex items-center gap-4">
      <button
        class="text-body-md text-on-surface-variant hover:text-primary transition-colors disabled:opacity-50"
        :disabled="backingUp"
        @click="runBackup"
      >
        {{ backingUp ? 'Sauvegarde…' : 'Backup' }}
      </button>
      <div class="w-px h-6 bg-outline-variant"></div>
      <span class="text-body-sm text-on-surface-variant hidden md:inline">{{ auth.user?.email }}</span>
      <button class="btn-secondary py-2" @click="logout">
        <span class="material-symbols-outlined text-[18px]">logout</span>
        Déconnexion
      </button>
    </div>
  </header>
</template>

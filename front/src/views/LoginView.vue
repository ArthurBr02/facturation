<script>
// Login screen for the single user. On success, the router guard takes over
// (onboarding wizard on first run, dashboard otherwise).
import { useAuthStore } from '@/stores/auth'

export default {
  name: 'LoginView',
  data() {
    return { email: '', password: '', error: '', loading: false }
  },
  methods: {
    async submit() {
      this.error = ''
      this.loading = true
      try {
        const auth = useAuthStore()
        await auth.login(this.email, this.password)
        const redirect = this.$route.query.redirect || '/'
        this.$router.push(redirect)
      } catch (e) {
        this.error = e.response?.data?.error || 'Connexion impossible'
      } finally {
        this.loading = false
      }
    },
  },
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
    <div class="w-full max-w-[340px]">
      <!-- Brand -->
      <div class="flex items-center gap-3 mb-8 justify-center">
        <div class="w-9 h-9 rounded bg-zinc-900 flex items-center justify-center text-white text-[13px] font-bold tracking-tight">AB</div>
        <div>
          <h1 class="text-[17px] font-bold text-zinc-900 leading-none">Facturation</h1>
          <p class="text-[12px] text-zinc-400 mt-0.5">AB Corp</p>
        </div>
      </div>

      <form class="bg-white border border-zinc-200 rounded p-6 space-y-4" @submit.prevent="submit">
        <h2 class="text-[16px] font-bold text-zinc-900 mb-1">Connexion</h2>

        <div>
          <label class="field-label" for="email">E-mail</label>
          <input id="email" v-model="email" type="email" class="field-input" autocomplete="username" required />
        </div>
        <div>
          <label class="field-label" for="password">Mot de passe</label>
          <input id="password" v-model="password" type="password" class="field-input" autocomplete="current-password" required />
        </div>

        <p v-if="error" class="text-[13px] text-error-fg">{{ error }}</p>

        <button type="submit" class="btn-primary w-full justify-center" :disabled="loading">
          {{ loading ? 'Connexion…' : 'Se connecter' }}
        </button>
      </form>
    </div>
  </div>
</template>

// Authentication store. Holds the token + current user and exposes login/logout.
import { defineStore } from 'pinia'
import { authApi } from '@/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('auth_token') || null,
    user: null,
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
  },
  actions: {
    async login(email, password) {
      const { token, user } = await authApi.login(email, password)
      this.token = token
      this.user = user
      localStorage.setItem('auth_token', token)
    },
    // Validate a stored token by fetching the current user. Returns true if valid.
    async fetchMe() {
      if (!this.token) return false
      try {
        const { user } = await authApi.me()
        this.user = user
        return true
      } catch {
        this.logout()
        return false
      }
    },
    logout() {
      this.token = null
      this.user = null
      localStorage.removeItem('auth_token')
    },
  },
})

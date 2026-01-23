import { defineStore } from 'pinia'
import { api } from '@/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    loading: false,
    error: null,
    remember: false,
  }),
  actions: {
    async init() {
      this.loading = true
      this.error = null
      try {
        this.user = await api.me()
      } catch (e) {
        this.user = null
        this.error = e
      } finally {
        this.loading = false
      }
      try { this.remember = localStorage.getItem('rememberMe') === '1' } catch (_) { this.remember = false }
    },
    async refresh() {
      try {
        const me = await api.me()
        this.user = me
      } catch (_) { /* no-op */ }
    },
    setRemember(flag) {
      try {
        localStorage.setItem('rememberMe', flag ? '1' : '0')
        this.remember = !!flag
        api.migrateTokens(!!flag)
      } catch (_) { /* no-op */ }
    },
    logoutLocal() {
      try { api.clearTokens() } catch (_) { /* no-op */ }
      this.user = null
      this.remember = false
    }
  }
})

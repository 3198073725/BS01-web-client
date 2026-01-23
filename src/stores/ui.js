import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({ meLastTab: 'me-works', meBulkManage: false }),
  actions: {
    init() {
      try { const v = localStorage.getItem('me:last-tab'); if (v) this.meLastTab = v } catch (_) { /* no-op */ }
    },
    setMeLastTab(name) {
      try { this.meLastTab = name; localStorage.setItem('me:last-tab', String(name)) } catch (_) { /* no-op */ }
    },
    toggleMeBulkManage() { this.meBulkManage = !this.meBulkManage }
  }
})

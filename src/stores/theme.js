import { defineStore } from 'pinia'
import { loadTheme, saveTheme, applyTheme, toggleThemeValue } from '@/utils/theme'

export const useThemeStore = defineStore('theme', {
  state: () => ({ theme: loadTheme() }),
  actions: {
    set(v) {
      this.theme = v
      try { applyTheme(v); saveTheme(v) } catch (_) { /* no-op */ }
    },
    toggle() {
      const next = toggleThemeValue(this.theme)
      this.set(next)
    }
  }
})

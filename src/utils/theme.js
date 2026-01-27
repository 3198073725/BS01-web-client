// Theme helpers: apply data-theme to <html>, load/save from localStorage
export function loadTheme() {
  try { return localStorage.getItem('theme') || 'dark' } catch (_) { return 'dark' }
}
export function saveTheme(theme) {
  try { localStorage.setItem('theme', theme) } catch (_) { /* no-op */ }
}
export function applyTheme(theme) {
  try {
    if (theme === 'system') {
      const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
      const dark = !!(mq && mq.matches)
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }
  } catch (_) { /* no-op */ }
}
export function toggleThemeValue(cur) {
  return cur === 'dark' ? 'light' : 'dark'
}

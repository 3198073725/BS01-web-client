// Theme helpers: apply data-theme to <html>, load/save from localStorage
export function loadTheme() {
  try { return localStorage.getItem('theme') || 'dark' } catch (_) { return 'dark' }
}
export function saveTheme(theme) {
  try { localStorage.setItem('theme', theme) } catch (_) { /* no-op */ }
}
export function applyTheme(theme) {
  try { document.documentElement.setAttribute('data-theme', theme) } catch (_) { /* no-op */ }
}
export function toggleThemeValue(cur) {
  return cur === 'dark' ? 'light' : 'dark'
}

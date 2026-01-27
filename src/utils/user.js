// User-related helpers
export function displayName(user) {
  return (user && (user.display_name || user.nickname || user.username)) || ''
}

export function initialFromUser(user) {
  const name = displayName(user)
  return name ? String(name).charAt(0).toUpperCase() : '?'
}

export function buildAvatarUrl(apiBase, rel) {
  if (!rel) return ''
  const v = String(rel).trim()
  if (/^https?:\/\//i.test(v)) return v
  const base = (apiBase || '').replace(/\/$/, '')
  if (v.startsWith('/')) return `${base}${v}`
  const path = v.startsWith('media/') ? v : `media/${v}`
  return `${base}/${path}`
}

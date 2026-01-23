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
  const v = String(rel)
  return v.startsWith('http') ? v : `${apiBase.replace(/\/$/, '')}/media/${v}`
}

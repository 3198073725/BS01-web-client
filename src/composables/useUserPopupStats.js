// Composable: user popup stats with local cache (2 minutes TTL)
import { ref } from 'vue'
import { api } from '@/api'

const TTL_MS = 2 * 60 * 1000

function cacheKey(uid) { return `popup:stats:${uid}` }

function readCache(uid) {
  try {
    const raw = localStorage.getItem(cacheKey(uid))
    if (!raw) return null
    const o = JSON.parse(raw)
    if (o && o.expires && o.expires > Date.now()) return o.data
  } catch (e) { void e }
  return null
}

function writeCache(uid, data) {
  try {
    localStorage.setItem(cacheKey(uid), JSON.stringify({ data, expires: Date.now() + TTL_MS }))
  } catch (e) { void e }
}

export function useUserPopupStats() {
  const data = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function load(uid, force = false) {
    error.value = null
    const cached = readCache(uid)
    if (cached) data.value = cached
    loading.value = true
    try {
      const fresh = await api.popupStats(force)
      data.value = fresh
      writeCache(uid, fresh)
    } catch (e) {
      error.value = e
    } finally {
      loading.value = false
    }
  }

  function bump(field, delta = 1) {
    if (!data.value || !(field in data.value)) return
    const v = Number(data.value[field] || 0) + delta
    data.value[field] = v < 0 ? 0 : v
  }

  return { data, loading, error, load, bump }
}

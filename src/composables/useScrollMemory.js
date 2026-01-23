// 记忆 HomePage 内容区(.feed)的滚动位置，在切换 /me/* 标签时恢复
import { onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'

export function useScrollMemory() {
  const route = useRoute()
  function getFeedEl() {
    try { return document.querySelector('.feed') } catch { return null }
  }
  function keyOf() { return `scroll:${route.name || route.path}` }

  function restore() {
    const el = getFeedEl()
    if (!el) return
    try {
      const v = Number(sessionStorage.getItem(keyOf()) || '0')
      if (v > 0) el.scrollTop = v
    } catch (_) { /* no-op */ }
  }
  function save() {
    const el = getFeedEl()
    if (!el) return
    try { sessionStorage.setItem(keyOf(), String(el.scrollTop || 0)) } catch (_) { /* no-op */ }
  }

  onMounted(() => { restore() })
  onBeforeUnmount(() => { save() })

  return { restore, save }
}

import { ref, watchEffect, onMounted, onBeforeUnmount, onBeforeUpdate, nextTick, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '../api'
import { useUiStore } from '@/stores/ui'
import { buildAvatarUrl, initialFromUser } from '../utils/user'
import { loadTheme, saveTheme, applyTheme, toggleThemeValue } from '../utils/theme'

export function useHomePage() {
  const ui = useUiStore()
  const kw = ref('')
  const placeholder = '搜索你感兴趣的内容'
  const items = ref([])
  // 懒加载展示用的 src 数组（仅在接近视口时赋值）
  const displaySrc = ref([])
  const loaded = new Set()
  let io // IntersectionObserver
  let isHidden = false

  const router = useRouter()
  const route = useRoute()

  // 用户信息（用于头像显示）
  const user = ref(null)
  const showLogin = ref(false)
  function fullUrl(rel) {
    return buildAvatarUrl(api.getBase(), rel)
  }
  const avatarUrl = computed(() => {
    const u = user.value
    const rel = (u && (u.profile_picture_thumb || u.profile_picture)) || ''
    return fullUrl(rel)
  })

  // 当进入 /search 路由时，将输入框与路由 q 保持同步（受 syncKw 控制）
  const syncKw = ref(true)
  watch(() => route.fullPath, () => {
    try { if (route.path.startsWith('/search') && syncKw.value) { kw.value = String(route.query.q || '') } } catch (_) { /* no-op */ }
  }, { immediate: true })
  const userInitial = computed(() => initialFromUser(user.value))
  const avatarError = ref(false)
  function goLogin() { showLogin.value = true }
  function onLoggedIn(me) { user.value = me; showLogin.value = false }

  watch(avatarUrl, () => { avatarError.value = false })

  const theme = ref(loadTheme())
  watchEffect(() => { applyTheme(theme.value); saveTheme(theme.value) })
  function toggleTheme() { theme.value = toggleThemeValue(theme.value) }

  const logoSrc = computed(() => theme.value === 'light' ? '/img/logo-dark.svg' : '/img/vidsprout-logo.svg')

  // 搜索历史（本地存储）
  const searchRef = ref(null)
  const showHistory = ref(false)
  const historyArr = ref([])
  // 交互状态与清理定时器
  const lastDownInside = ref(false)
  let clearTimer = null
  function onSearchMouseDown() { lastDownInside.value = true; setTimeout(() => { lastDownInside.value = false }, 0) }
  function loadSearchHistory() {
    try {
      const raw = localStorage.getItem('search_history') || '[]'
      const arr = JSON.parse(raw)
      historyArr.value = Array.isArray(arr) ? arr.filter(s => typeof s === 'string' && s.trim()).slice(0, 20) : []
    } catch (_) { historyArr.value = [] }
  }
  function saveSearchHistory() { try { localStorage.setItem('search_history', JSON.stringify(historyArr.value || [])) } catch (_) { /* no-op */ } }
  function addHistoryTerm(s) {
    try {
      const q = String(s || '').trim(); if (!q) return
      const arr = (historyArr.value || []).filter(x => String(x) !== q)
      arr.unshift(q)
      historyArr.value = arr.slice(0, 10)
      saveSearchHistory()
    } catch (_) { /* no-op */ }
  }
  const historyItems = computed(() => {
    try {
      const q = String(kw.value || '').trim().toLowerCase()
      const list = Array.isArray(historyArr.value) ? historyArr.value : []
      if (!q) return list
      return list.filter(s => String(s).toLowerCase().includes(q)).slice(0, 10)
    } catch (_) { return [] }
  })
  function onFocusSearch() { loadSearchHistory(); showHistory.value = true; syncKw.value = true }
  function onBlurSearch() {
    // 若点击发生在搜索区域内部（含下拉/按钮），不安排清空
    if (clearTimer) { try { clearTimeout(clearTimer) } catch (_) { /* no-op */ } clearTimer = null }
    if (lastDownInside.value) return
    // 否则异步清空，保证点击事件先处理
    clearTimer = setTimeout(() => {
      kw.value = ''
      showHistory.value = false
      syncKw.value = false
      clearTimer = null
    }, 0)
  }
  function pickHistory(s) {
    // 标记这次交互发生在搜索区域内部，避免 onBlur 清空
    lastDownInside.value = true
    setTimeout(() => { lastDownInside.value = false }, 0)
    try { kw.value = String(s || '') } catch (_) { /* no-op */ }
    showHistory.value = false
    if (clearTimer) { try { clearTimeout(clearTimer) } catch (_) { /* no-op */ } clearTimer = null }
    // 确保路由回填允许
    syncKw.value = true
    doSearch()
  }
  function removeHistoryItem(s) { try { historyArr.value = (historyArr.value || []).filter(x => String(x) !== String(s)) } catch (_) { /* no-op */ } saveSearchHistory() }
  function clearSearchHistory() { historyArr.value = []; saveSearchHistory(); showHistory.value = false }
  function onDocClick(e) { try { const el = searchRef.value; if (el && !el.contains(e.target)) { showHistory.value = false; kw.value = ''; syncKw.value = false } } catch (_) { /* no-op */ } }

  function doSearch() {
    const q = String(kw.value || '').trim()
    if (!q) { ui.showDialog('请输入关键词', 'warn'); return }
    addHistoryTerm(q)
    showHistory.value = false
    try { router.push({ name: 'search', query: { q } }) } catch (_) { /* no-op */ }
  }

  // Douyin-like step scroll
  const feedRef = ref(null)
  const currentIndex = ref(0)
  const isAnimating = ref(false)
  const GAP = 0
  let animTimer = null
  let queuedDir = 0

  // 推荐流分页状态
  const curPage = ref(1)
  const hasNext = ref(true)
  const loadingFeed = ref(false)

  function mapFeedToItems(list) {
    try {
      return (Array.isArray(list) ? list : []).map(v => ({
        type: 'video',
        id: v.id,
        src: v.src || '',
        cover: v.cover || '',
        title: v.title,
        views: v.views,
        likes: v.likes,
        favorites: v.favorites ?? 0,
        comments: v.comments ?? 0,
        author: v.author || null,
        publishedAt: v.publishedAt || null,
        liked: !!(v.liked ?? false),
        favorited: !!(v.favorited ?? false),
        thumbVtt: v.thumbVtt || null,
      }))
    } catch (_) { return [] }
  }
  async function loadFeed(page = 1) {
    if (loadingFeed.value) return
    loadingFeed.value = true
    try {
      const res = await api.recommendationFeed({ page, pageSize: 12 })
      const mapped = mapFeedToItems(res.items)
      if (page === 1) {
        items.value = mapped
        try { loaded.clear() } catch (_) { /* no-op */ }
        displaySrc.value = []
        // 兜底：立即填充第一个播放源，避免 IO 未触发时首屏空白
        nextTick(() => { setupIO(); updatePreload(currentIndex.value) })
      } else {
        items.value = items.value.concat(mapped)
        nextTick(() => { setupIO(); updatePreload(currentIndex.value) })
      }
      curPage.value = Number(res.page || page || 1)
      hasNext.value = !!res.hasNext
      // 已在上面 nextTick 中执行了 setupIO 与预加载
    } catch (_) { /* 忽略错误，保持占位 */ }
    finally { loadingFeed.value = false }
  }

  const itemRefs = ref([])
  function setItemRef(el) { if (el) itemRefs.value.push(el) }
  onBeforeUpdate(() => { itemRefs.value = [] })

  function stride() {
    const el = feedRef.value
    if (!el) return 0
    return Math.max(1, el.clientHeight - GAP)
  }
  function clamp(i) {
    const max = Math.max(0, (itemRefs.value.length || 1) - 1)
    if (i < 0) return 0
    if (i > max) return max
    return i
  }
  function goTo(i, opts = {}) {
    const push = !!(opts && opts.push)
    const el = feedRef.value
    if (!el) return
    const target = clamp(i)
    currentIndex.value = target
    try {
      const nav = { query: { ...route.query, i: String(target) } }
      const p = push ? router.push(nav) : router.replace(nav)
      if (p && typeof p.catch === 'function') p.catch(() => {})
    } catch (_) { /* no-op */ }
    isAnimating.value = true
    el.scrollTo({ top: target * stride(), behavior: 'smooth' })
    if (animTimer) window.clearTimeout(animTimer)
    animTimer = window.setTimeout(() => {
      isAnimating.value = false
      if (queuedDir) { const dir = queuedDir; queuedDir = 0; goTo(currentIndex.value + dir) }
    }, 360)
    updatePreload(target)
    maybeLoadMore(target)
  }

  function onWheel(e) {
    if (!feedRef.value) return
    if (!feedRef.value.contains(e.target)) return
    const t = e.target
    if (t && t.closest && t.closest('.vp')) return
    if (isAnimating.value) { e.preventDefault(); const dySign = Math.sign(e.deltaY); if (dySign !== 0) queuedDir = dySign; return }
    const dy = e.deltaY
    if (Math.abs(dy) < 8) return
    e.preventDefault(); goTo(currentIndex.value + (dy > 0 ? 1 : -1))
  }
  function onKey(e) {
    if (isAnimating.value) return
    const t = e.target
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t.closest && t.closest('.vp')))) return
    try { const ae = document.activeElement; if (ae && ae.closest && ae.closest('.vp')) return } catch (_) { /* no-op */ }
    const down = () => goTo(currentIndex.value + 1)
    const up = () => goTo(currentIndex.value - 1)
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); down(); break
      case 'ArrowUp': e.preventDefault(); up(); break
      case 'PageDown': e.preventDefault(); goTo(currentIndex.value + 5); break
      case 'PageUp': e.preventDefault(); goTo(currentIndex.value - 5); break
      case 'Home': e.preventDefault(); goTo(0); break
      case 'End': e.preventDefault(); goTo(items.value.length - 1); break
    }
  }
  function onScroll() {
    if (!feedRef.value || isAnimating.value) return
    const s = stride(); if (!s) return
    const idx = Math.round(feedRef.value.scrollTop / s)
    if (idx !== currentIndex.value) currentIndex.value = clamp(idx)
  }
  function onResize() { nextTick(() => goTo(currentIndex.value)) }

  // 触摸滑动（移动端）
  let touchStartY = 0
  let touchDeltaY = 0
  function onTouchStart(ev) { const t = ev.touches && ev.touches[0]; if (!t) return; touchStartY = t.clientY; touchDeltaY = 0 }
  function onTouchMove(ev) { const t = ev.touches && ev.touches[0]; if (!t) return; touchDeltaY = t.clientY - touchStartY }
  function onTouchEnd() { const THRESH = 60; if (Math.abs(touchDeltaY) > THRESH) goTo(currentIndex.value + (touchDeltaY < 0 ? 1 : -1)); touchStartY = 0; touchDeltaY = 0 }

  // 懒加载与预加载
  function effectivePrefetchCount() {
    try {
      const et = navigator.connection && navigator.connection.effectiveType
      if (!et) return 2
      if (et.includes('2g')) return 0
      if (et === '3g') return 1
      return 2
    } catch (_) { return 2 }
  }
  async function ensureItemSrc(i) {
    const idx = clamp(i)
    if (loaded.has(idx)) return
    const it = items.value[idx]
    if (!it) return
    let src = it.src || ''
    try {
      // 尝试获取更优源（HLS master 优先）
      const d = await api.videoDetail(it.id)
      if (d && (d.hls_master_url || d.video_url)) src = d.hls_master_url || d.video_url
    } catch (_) { /* no-op */ }
    displaySrc.value[idx] = src
    loaded.add(idx)
  }
  function updatePreload(centerIdx) {
    if (isHidden) return
    ensureItemSrc(centerIdx)
    const count = effectivePrefetchCount()
    for (let k = 1; k <= count; k++) ensureItemSrc(centerIdx + k)
  }
  function setupIO() {
    if (!feedRef.value) return
    if (io) { try { io.disconnect() } catch (_) { /* no-op */ } }
    io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting || e.intersectionRatio > 0) {
          const idx = Number(e.target.dataset.idx || '0')
          ensureItemSrc(idx)
        }
      })
    }, { root: feedRef.value, rootMargin: '500px 0px', threshold: 0.01 })
    itemRefs.value.forEach(el => io.observe(el))
  }

  function maybeLoadMore(idx) {
    if (idx >= items.value.length - 2 && hasNext.value && !loadingFeed.value) {
      loadFeed(curPage.value + 1).then(() => { nextTick(() => { setupIO(); updatePreload(currentIndex.value) }) })
    }
  }

  onMounted(() => {
    const el = feedRef.value
    if (!el) return
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey, { passive: false })
    window.addEventListener('resize', onResize)
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    document.addEventListener('visibilitychange', () => { isHidden = document.hidden })
    try { document.addEventListener('click', onDocClick) } catch (_) { /* no-op */ }

    setupIO()

    const initIdx = Number(route.query.i || '0')
    // 先加载第一页推荐流，再滚动到指定位置
    loadFeed(1).finally(() => { nextTick(() => goTo(isNaN(initIdx) ? 0 : initIdx)) })

    try { api.me().then(u => { user.value = u }).catch(() => { user.value = null }) } catch (_) { /* no-op */ }
    try {
      window.addEventListener('storage', (e) => {
        if (e.key === 'auth_sync' && e.newValue) {
          try {
            const msg = JSON.parse(e.newValue)
            if (msg && msg.type === 'tokens_set') {
              api.me().then(u => { user.value = u }).catch(() => { user.value = null })
              // 登录后立刻重载推荐流
              loadFeed(1)
            }
          } catch (_) { /* no-op */ }
        }
      })
      // 自定义事件同样处理
      window.addEventListener('auth:sync', () => { loadFeed(1) })
    } catch (_) { /* no-op */ }
  })

  onBeforeUnmount(() => {
    const el = feedRef.value
    if (el) el.removeEventListener('scroll', onScroll)
    window.removeEventListener('wheel', onWheel)
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('resize', onResize)
    if (el) {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
    if (io) { try { io.disconnect() } catch (_) { /* no-op */ } }
    try { document.removeEventListener('click', onDocClick) } catch (_) { /* no-op */ }
  })

  return {
    kw, placeholder, items, displaySrc,
    user, showLogin, goLogin, onLoggedIn,
    avatarUrl, userInitial, avatarError,
    theme, toggleTheme, logoSrc,
    feedRef, setItemRef, doSearch,
    goTo, currentIndex,
    reloadFeed: () => loadFeed(1),
    openVideo: (x) => { try { const id = (x && typeof x === 'object') ? x.id : x; if (id) router.push({ name: 'video', params: { id } }) } catch (_) { /* no-op */ } },
    searchRef, showHistory, historyItems, onFocusSearch, onBlurSearch, onSearchMouseDown, pickHistory, removeHistoryItem, clearSearchHistory,
  }
}

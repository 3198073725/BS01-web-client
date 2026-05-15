<template>
  <div class="feed" ref="feedRef">
    <div class="feed-item" v-for="(item, idx) in items" :key="item.id || idx" :ref="setItemRef" :data-idx="idx">
      <div class="player-card">
        <VideoPlayer
          v-if="item"
          :src="displaySrc[idx] || ''"
          :poster="item.cover || ''"
          :thumb-vtt="item.thumbVtt || ''"
          :autoplay="idx === currentIndex"
          :muted="true"
          :next-src="items[idx+1] ? (displaySrc[idx+1] || '') : ''"
          :video-id="item.id"
          :meta-author="item.author || null"
          :meta-title="item.title || ''"
          :meta-published-at="item.publishedAt || null"
          :meta-likes="item.likes || 0"
          :meta-comments="item.comments || 0"
          :meta-favorites="item.favorites || 0"
          :meta-liked="item.liked || false"
          :meta-favorited="item.favorited || false"
          :comments-open="commentsOpen"
          @request-next="onRequestNext"
          @request-prev="onRequestPrev"
          @toggle-comments="commentsOpen = $event.open"
        />
        <div v-else class="placeholder"><div class="box" /></div>
      </div>
    </div>
    <div v-if="!items.length && !loading" class="empty">暂无内容</div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount, onBeforeUpdate, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api'
import { useUiStore } from '@/stores/ui'
import VideoPlayer from '@/components/VideoPlayer.vue'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const source = computed(() => route.params.source || 'likes') // likes | favorites | history | watch-later | featured
const targetId = ref(String(route.query.id || ''))
let lastSource = source.value
let lastId = targetId.value

const items = ref([])
const displaySrc = ref([])
const loaded = new Set()
const loading = ref(false)
const feedRef = ref(null)
const itemRefs = ref([])
const currentIndex = ref(0)
const commentsOpen = ref(false)
const page = ref(1)
const hasNext = ref(true)
let aborted = false
let io

function setItemRef(el) { if (el) itemRefs.value.push(el) }
onBeforeUpdate(() => { itemRefs.value = [] })
onBeforeUnmount(() => { aborted = true; itemRefs.value = []; if (io) { try { io.disconnect() } catch(_) { void 0 } } })

function stride() { const el = feedRef.value; return el ? el.clientHeight : 0 }
function clamp(i) { const max = Math.max(0, items.value.length - 1); return Math.max(0, Math.min(max, i)) }
function goTo(i, opts = {}) {
  const el = feedRef.value; if (!el) return
  const t = clamp(i); currentIndex.value = t
  try {
    const it = items.value[t]
    const nav = { query: { ...route.query, i: String(t), id: it ? it.id : route.query.id } }
    const push = !!(opts && opts.push)
    const p = push ? router.push(nav) : router.replace(nav)
    if (p && typeof p.catch === 'function') p.catch(() => {})
  } catch (_) { /* no-op */ }
  el.scrollTo({ top: t * Math.max(1, stride()), behavior: 'smooth' })
  updatePreload(t)
  maybeLoadMore(t)
}

function mapItem(v = {}) {
  return {
    id: v.id || v.video_id || v.videoId || '',
    cover: v.cover || v.thumbnail_url || v.thumbnail || v.thumb || '',
    title: v.title || v.name || '',
    views: v.views ?? v.view_count ?? null,
    likes: v.likes ?? v.like_count ?? null,
    favorites: v.favorites ?? v.favorite_count ?? null,
    comments: v.comments ?? v.comment_count ?? null,
    author: v.author || v.user || v.owner || null,
    publishedAt: v.published_at || v.publishedAt || v.created_at || null,
    thumbVtt: v.thumbVtt || v.thumb_vtt || null,
    liked: !!(v.liked ?? false),
    favorited: !!(v.favorited ?? false),
    src: v.src || v.hls_master_url || v.video_url || '',
  }
}

function apiForSource() {
  const s = source.value
  if (s === 'preview') return null // 预览模式不走列表API，直接取单条详情
  if (s === 'favorites') return api.favoritesList
  if (s === 'history') return api.historyList
  if (s === 'watch-later') return api.watchLaterList
  if (s === 'featured') return api.featuredFeed
  return api.likesList
}

async function loadPreview() {
  // 预览模式：直接拉取单条视频详情
  if (!targetId.value) return
  try {
    loading.value = true
    const d = await api.videoDetail(String(targetId.value))
    if (d && d.id) {
      items.value = [{
        id: d.id,
        cover: d.thumbnail_url || '',
        title: d.title || '',
        views: d.view_count ?? null,
        likes: d.like_count ?? null,
        favorites: d.favorite_count ?? null,
        comments: d.comment_count ?? null,
        author: d.author || null,
        publishedAt: d.published_at || d.created_at || null,
        thumbVtt: d.thumb_vtt || null,
        liked: !!d.liked,
        favorited: !!d.favorited,
        src: d.hls_master_url || d.video_url || '',
      }]
      displaySrc.value = []
      try { loaded.clear() } catch (_) { /* no-op */ }
      hasNext.value = false
      nextTick(() => {
        currentIndex.value = 0
        updatePreload(0)
      })
    }
  } catch (_) { /* no-op */ }
  finally { loading.value = false }
}

async function load(p = 1) {
  if (loading.value) return; loading.value = true
  // 预览模式单独处理
  if (source.value === 'preview') {
    await loadPreview()
    return
  }
  try {
    const fn = apiForSource()
    // 与“我的”列表保持一致，使用 page_size 12，避免接口缓存策略差异
    const res = await fn({ page: p, pageSize: 12 })
    // favorites/history/watch-later 返回字段不同：可能是 results/items
    const rows = Array.isArray(res?.results) ? res.results : (res?.items || [])
    let mapped = rows.map(mapItem)
    // 若列表为空但有目标 ID，则兜底拉取单条详情
    if ((!mapped || mapped.length === 0) && targetId.value) {
      try {
        const d = await api.videoDetail(String(targetId.value))
        if (d && d.id) {
          mapped = [{
            id: d.id,
            cover: d.thumbnail_url || '',
            title: d.title || '',
            views: d.view_count ?? null,
            likes: d.like_count ?? null,
            favorites: d.favorite_count ?? null,
            comments: d.comment_count ?? null,
            author: d.author || null,
            publishedAt: d.published_at || d.created_at || null,
            thumbVtt: d.thumb_vtt || null,
            liked: !!d.liked,
            favorited: !!d.favorited,
            src: d.hls_master_url || d.video_url || '',
          }]
        }
      } catch (_) { /* no-op */ }
      // 兜底：即便详情失败，也构造占位项，后续 ensureItemSrc 会再次尝试拉详情
      if (!mapped || mapped.length === 0) {
        mapped = [{ id: targetId.value, cover: '', title: '', src: '' }]
      }
    }
    // 若列表有数据但不包含当前目标，则将目标置顶，确保能播到点击的视频
    if (targetId.value && mapped.length) {
      const idx = mapped.findIndex(x => String(x.id) === targetId.value)
      if (idx === -1) mapped.unshift({ id: targetId.value, cover: '', title: '', src: '' })
    }
    if (aborted) return
    if (p === 1) { items.value = mapped; displaySrc.value = []; try { loaded.clear() } catch (_) { void 0 } }
    else { items.value = items.value.concat(mapped) }
    hasNext.value = !!(res.hasNext ?? res.has_next ?? res.has_next_page)
    page.value = p
    nextTick(() => {
      setupIO()
      // 定位到目标视频（不再触发路由跳转，避免循环）
      if (targetId.value) {
        const idx = items.value.findIndex(x => String(x.id) === targetId.value)
        if (idx >= 0) currentIndex.value = idx
      } else {
        currentIndex.value = 0
      }
      updatePreload(currentIndex.value)
      // 若路由未携带 i，补充当前索引
      if (!route.query.i || String(route.query.i) !== String(currentIndex.value)) {
        try { router.replace({ query: { ...route.query, i: String(currentIndex.value), id: targetId.value || (items.value[0]?.id || '') } }).catch(() => {}) } catch (_) { /* no-op */ }
      }
    })
  } catch (e) {
    // 未登录或凭证过期时，给出提示并跳回主页登录
    try {
      const st = Number(e && e.status)
      if (st === 401) {
        try { api.clearTokens() } catch (_) { /* no-op */ }
        try { ui.showDialog('登录已过期，请重新登录', 'warn') } catch (_) { /* no-op */ }
        router.push({ path: '/' }).catch(() => {})
      }
    } catch (_) { /* no-op */ }
  }
  finally { loading.value = false }

  // 兜底：若本次加载后依然没有数据且有 targetId，构造占位项
  if (p === 1 && (!items.value || items.value.length === 0) && targetId.value) {
    items.value = [{ id: targetId.value, cover: '', title: '', src: '' }]
    displaySrc.value = []
    try { loaded.clear() } catch (_) { /* no-op */ }
    nextTick(() => { updatePreload(0) })
  }
}

function effectivePrefetchCount(){ return 2 }
async function ensureItemSrc(i){
  const idx = clamp(i); if (loaded.has(idx)) return
  const it = items.value[idx]; if (!it) return
  const existing = it.src
  if (existing) { displaySrc.value[idx] = existing; loaded.add(idx); return }
  try {
    const d = await api.videoDetail(String(it.id))
    const s = d?.hls_master_url || d?.video_url || ''
    if (s) displaySrc.value[idx] = s
  } catch (_) { /* no-op */ }
  loaded.add(idx)
}
function updatePreload(center){ ensureItemSrc(center); for(let k=1;k<=effectivePrefetchCount();k++) ensureItemSrc(center+k) }
function setupIO(){ if(!feedRef.value) return; if(io){try{io.disconnect()}catch(_){ void 0 }} io=new IntersectionObserver((entries)=>{ entries.forEach(e=>{ if(e.isIntersecting||e.intersectionRatio>0){ const idx=Number(e.target.dataset.idx||'0'); ensureItemSrc(idx) } }) }, { root: feedRef.value, rootMargin: '500px 0px', threshold: 0.01 }); itemRefs.value.forEach(el=>io.observe(el)) }
async function maybeLoadMore(idx){ if (hasNext.value && idx >= items.value.length - 2) { await load(page.value + 1) } }

function onRequestNext(payload) {
  try {
    goTo(currentIndex.value + 1, { push: !!(payload && payload.auto) })
  } catch (_) { /* no-op */ }
}
function onRequestPrev() { try { goTo(currentIndex.value - 1) } catch (_) { /* no-op */ } }

// 支持响应式路由变更（source/id 变化时重新加载；i 变化不触发重载）
onMounted(() => {
  const initIdx = Number(route.query.i || '0')
  currentIndex.value = Number.isNaN(initIdx) ? 0 : initIdx
  // 预览模式特殊处理
  if (source.value === 'preview') {
    loadPreview()
  } else {
    load(1)
  }
})
watch(() => route.query.i, (i) => {
  const idx = Number(i || 0)
  if (Number.isNaN(idx)) return
  currentIndex.value = idx
})
watch(() => [source.value, route.query.id], ([s, id]) => {
  const sid = String(s || '')
  const tid = String(id || '')
  if (sid === lastSource && tid === lastId) return
  lastSource = sid; lastId = tid;
  targetId.value = tid
  currentIndex.value = 0
  try { loaded.clear() } catch (_) { /* no-op */ }
  displaySrc.value = []
  items.value = []
  // 预览模式单独处理
  if (source.value === 'preview') {
    loadPreview()
  } else {
    load(1)
  }
})
</script>

<style scoped>
.feed { width:100%; height:100%; overflow-y:auto; }
.feed-item { height:100%; display:flex; align-items:center; justify-content:center; }
.player-card { height:100%; width:100%; border-radius:12px; overflow:hidden; border:1px solid var(--border); background:var(--bg); }
.placeholder .box { width:100%; height:100%; background: var(--bg-elev); border:1px dashed var(--btn-border); border-radius:12px; }
.empty{ color:var(--muted); text-align:center; padding:32px 0; }
</style>

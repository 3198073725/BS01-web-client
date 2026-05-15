<template>
  <div class="feed" ref="feedRef">
    <div class="feed-item" v-for="(item, idx) in items" :key="item.id || idx" :ref="setItemRef" :data-idx="idx">
      <div class="player-card">
        <VideoPlayer v-if="item.type==='video'"
                     :src="displaySrc[idx] || item.src"
                     :poster="item.cover || ''"
                     :thumb-vtt="item.thumbVtt || ''"
                     :autoplay="idx === currentIndex"
                     :muted="true"
                     :next-src="(items[idx+1] && (displaySrc[idx+1] || items[idx+1].src)) || ''"
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
    <div v-if="needLogin && !loading" class="empty">请先登录后查看你的关注视频</div>
    <div v-else-if="!items.length && !loading" class="empty">暂无关注用户的视频</div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount, onBeforeUpdate } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api'
import VideoPlayer from '@/components/VideoPlayer.vue'

const items = ref([])
const displaySrc = ref([])
const loaded = new Set()
const loading = ref(false)
const needLogin = ref(false)
const feedRef = ref(null)
const itemRefs = ref([])
const currentIndex = ref(0)
const commentsOpen = ref(false)
const router = useRouter()
const route = useRoute()
let aborted = false
let io

function setItemRef(el) { if (el) itemRefs.value.push(el) }
onBeforeUpdate(() => { itemRefs.value = [] })
onBeforeUnmount(() => {
  aborted = true
  itemRefs.value = []
  if (io) { try { io.disconnect() } catch(_) { void 0 } }
  try { window.removeEventListener('auth:sync', onAuthSync) } catch (_) { /* no-op */ }
})

function stride() { const el = feedRef.value; return el ? el.clientHeight : 0 }
function clamp(i) { const max = Math.max(0, items.value.length - 1); return Math.max(0, Math.min(max, i)) }
function goTo(i, opts = {}) {
  const el = feedRef.value; if (!el) return
  const t = clamp(i); currentIndex.value = t
  try {
    const nav = { query: { ...route.query, i: String(t) } }
    const push = !!(opts && opts.push)
    const p = push ? router.push(nav) : router.replace(nav)
    if (p && typeof p.catch === 'function') p.catch(() => {})
  } catch (_) { /* no-op */ }
  el.scrollTo({ top: t * Math.max(1, stride()), behavior: 'smooth' })
  updatePreload(t)
  maybeLoadMore(t)
}

async function load(page=1) {
  if (loading.value) return; loading.value = true
  try {
    const res = await api.followingFeed({ page, pageSize: 12 })
    if (aborted) return
    const mapped = (res.items||[]).map(v => ({
      type:'video', id:v.id, src:v.src||'', cover:v.cover||'', title:v.title,
      views:v.views, likes:v.likes, favorites:v.favorites??0, comments:v.comments??0,
      author:v.author||null, publishedAt:v.publishedAt||null, liked:!!(v.liked??false), favorited:!!(v.favorited??false), thumbVtt:v.thumbVtt||null,
    }))
    if (aborted) return
    if (page===1) { items.value = mapped; displaySrc.value = []; try{loaded.clear()}catch(_) { void 0 } }
    else { items.value = items.value.concat(mapped) }
    if (aborted) return
    nextTick(() => { setupIO(); updatePreload(currentIndex.value) })
    if (aborted) return
    hasNext.value = !!res.hasNext
    curPage.value = Number(res.page||page||1)
  } catch (e) {
    // 若未登录：提示登录
    if (Number(e?.status) === 401) {
      if (aborted) return
      needLogin.value = true
      items.value = []
      displaySrc.value = []
      try { loaded.clear() } catch (_) { void 0 }
      return
    }
    // 后端未更新 following 接口时的兜底方案：按关注用户聚合其视频列表
    try {
      const ures = await api.followingQuery({ page })
      const users = Array.isArray(ures?.results) ? ures.results : []
      // 控制请求量：最多取前 6 个关注用户，每个取 4 条
      const promises = users.slice(0, 6).map(u => api.videosList({ userId: u.id, pageSize: 4, order: 'latest' }).catch(() => ({ items: [] })))
      const lists = await Promise.all(promises)
      const vids = lists.flatMap(l => Array.isArray(l?.items) ? l.items : [])
      vids.sort((a,b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
      if (aborted) return
      const mapped = vids.map(v => ({
        type:'video', id:v.id, src:v.src||'', cover:v.cover||'', title:v.title,
        views:v.views, likes:v.likes, favorites:v.favorites??0, comments:v.comments??0,
        author:v.author||null, publishedAt:v.publishedAt||null, liked:!!(v.liked??false), favorited:!!(v.favorited??false), thumbVtt:v.thumbVtt||null,
      }))
      if (aborted) return
      if (page===1) { items.value = mapped; displaySrc.value = []; try{loaded.clear()}catch(_) { void 0 } }
      else { items.value = items.value.concat(mapped) }
      if (aborted) return
      nextTick(() => { setupIO(); updatePreload(currentIndex.value) })
      if (aborted) return
      hasNext.value = Boolean(ures?.has_next || (users.length >= 6))
      curPage.value = Number(ures?.page || page || 1)
    } catch (_) {
      // 保持静默，显示空态
      items.value = []
    }
  } finally { loading.value = false }
}

function effectivePrefetchCount(){ return 2 }
async function ensureItemSrc(i){ const idx=clamp(i); if(loaded.has(idx)) return; const it=items.value[idx]; if(!it) return; displaySrc.value[idx]=it.src; loaded.add(idx) }
function updatePreload(center){ ensureItemSrc(center); for(let k=1;k<=effectivePrefetchCount();k++) ensureItemSrc(center+k) }
function setupIO(){ if(!feedRef.value) return; if(io){try{io.disconnect()}catch(_){ void 0 }} io=new IntersectionObserver((entries)=>{ entries.forEach(e=>{ if(e.isIntersecting||e.intersectionRatio>0){ const idx=Number(e.target.dataset.idx||'0'); ensureItemSrc(idx) } }) }, { root: feedRef.value, rootMargin: '500px 0px', threshold: 0.01 }); itemRefs.value.forEach(el=>io.observe(el)) }
function maybeLoadMore(idx){ if(idx>=items.value.length-2 && hasNext.value && !loading.value) load(curPage.value+1).then(()=>nextTick(()=>{setupIO();updatePreload(currentIndex.value)})) }

const curPage = ref(1)
const hasNext = ref(true)

function onRequestNext(payload) {
  try {
    const auto = !!(payload && payload.auto)
    goTo(currentIndex.value + 1, { push: auto })
  } catch (_) { /* no-op */ }
}
function onRequestPrev() {
  try { goTo(currentIndex.value - 1) } catch (_) { /* no-op */ }
}

onMounted(() => {
  const initIdx = Number(route.query.i || '0')
  load(1).then(()=> nextTick(()=> goTo(isNaN(initIdx) ? 0 : initIdx)))
  try { window.addEventListener('auth:sync', onAuthSync) } catch (_) { /* no-op */ }
})

function onAuthSync() {
  if (aborted) return
  needLogin.value = false
  load(1).then(() => nextTick(() => goTo(0)))
}
</script>

<style scoped>
.feed { width:100%; height:100%; overflow-y:auto; }
.feed-item { height:100%; display:flex; align-items:center; justify-content:center; }
.player-card { height:100%; width:100%; border-radius:12px; overflow:hidden; border:1px solid var(--border); background:var(--bg); }
.placeholder .box { width:100%; height:100%; background: var(--bg-elev); border:1px dashed var(--btn-border); border-radius:12px; }
.empty{ color:var(--muted); text-align:center; padding:32px 0; }
</style>

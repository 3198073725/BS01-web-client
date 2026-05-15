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
    <div v-if="!items.length && !loading" class="empty">暂无搜索结果</div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount, onBeforeUpdate, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api'
import VideoPlayer from '@/components/VideoPlayer.vue'

const items = ref([])
const displaySrc = ref([])
const loaded = new Set()
const loading = ref(false)
const feedRef = ref(null)
const itemRefs = ref([])
const currentIndex = ref(0)
const commentsOpen = ref(false)
const pageNo = ref(1)
const hasNext = ref(true)
const router = useRouter()
const route = useRoute()
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
    const q = String(route.query.q || '').trim()
    const res = await api.searchVideos({ page, pageSize: 12, q, order: 'relevance' })
    if (aborted) return
    const mapped = (res.items||[]).map(v => ({ type:'video', id:v.id, src:v.src||'', cover:v.cover||'', title:v.title,
      views:v.views, likes:v.likes, favorites:v.favorites??0, comments:v.comments??0,
      author:v.author||null, publishedAt:v.publishedAt||null, liked:!!(v.liked??false), favorited:!!(v.favorited??false), thumbVtt:v.thumbVtt||null,
    }))
    if (aborted) return
    if (page===1) { items.value = mapped; displaySrc.value = []; try{loaded.clear()}catch(_) { void 0 } }
    else { items.value = items.value.concat(mapped) }
    if (aborted) return
    nextTick(() => { setupIO(); updatePreload(currentIndex.value) })
    if (aborted) return
    pageNo.value = Number(res.page || page || 1)
    hasNext.value = !!res.hasNext
  } catch (e) { /* no-op */ }
  finally { loading.value = false }
}

function effectivePrefetchCount(){ return 2 }
async function ensureItemSrc(i){ const idx=clamp(i); if(loaded.has(idx)) return; const it=items.value[idx]; if(!it) return; displaySrc.value[idx]=it.src; loaded.add(idx) }
function updatePreload(center){ ensureItemSrc(center); for(let k=1;k<=effectivePrefetchCount();k++) ensureItemSrc(center+k) }
function setupIO(){ if(!feedRef.value) return; if(io){try{io.disconnect()}catch(_){ void 0 }} io=new IntersectionObserver((entries)=>{ entries.forEach(e=>{ if(e.isIntersecting||e.intersectionRatio>0){ const idx=Number(e.target.dataset.idx||'0'); ensureItemSrc(idx) } }) }, { root: feedRef.value, rootMargin: '500px 0px', threshold: 0.01 }); itemRefs.value.forEach(el=>io.observe(el)) }
function maybeLoadMore(idx){ if(idx>=items.value.length-2 && hasNext.value && !loading.value) load(pageNo.value+1).then(()=>nextTick(()=>{setupIO();updatePreload(currentIndex.value)})) }

async function resolveRouteTarget() {
  const targetId = String(route.query.id || '').trim()
  const targetIndex = Number(route.query.i || '0')
  while (!aborted) {
    if (targetId) {
      const found = items.value.findIndex(x => String(x.id) === targetId)
      if (found >= 0) return found
    }
    if (!Number.isNaN(targetIndex) && targetIndex < items.value.length) return targetIndex
    if (!hasNext.value || loading.value) break
    await load(pageNo.value + 1)
  }
  if (targetId) {
    const found = items.value.findIndex(x => String(x.id) === targetId)
    if (found >= 0) return found
  }
  return Number.isNaN(targetIndex) ? 0 : targetIndex
}

function onRequestNext(payload) {
  try {
    goTo(currentIndex.value + 1, { push: !!(payload && payload.auto) })
  } catch (_) { /* no-op */ }
}
function onRequestPrev() { try { goTo(currentIndex.value - 1) } catch (_) { /* no-op */ } }

onMounted(() => {
  load(1).then(async () => {
    const target = await resolveRouteTarget()
    nextTick(() => goTo(target))
  })
})

watch(() => route.query.q, () => {
  currentIndex.value = 0
  load(1).then(async () => {
    const target = await resolveRouteTarget()
    nextTick(() => goTo(target))
  })
})

watch(() => route.query.i, (nv) => {
  const idx = Number(nv || '0')
  nextTick(() => goTo(isNaN(idx) ? 0 : idx))
})
</script>

<style scoped>
.feed { width:100%; height:100%; overflow-y:auto; }
.feed-item { height:100%; display:flex; align-items:center; justify-content:center; }
.player-card { height:100%; width:100%; border-radius:12px; overflow:hidden; border:1px solid var(--border); background:var(--bg); }
.placeholder .box { width:100%; height:100%; background: var(--bg-elev); border:1px dashed var(--btn-border); border-radius:12px; }
.empty{ color:var(--muted); text-align:center; padding:32px 0; }
</style>

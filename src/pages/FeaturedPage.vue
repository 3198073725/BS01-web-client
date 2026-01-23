<template>
  <div class="feed" ref="feedRef">
    <div class="feed-item" v-for="(item, idx) in items" :key="idx" :ref="setItemRef" :data-idx="idx">
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
                     @request-next="goTo(currentIndex + 1)"
                     @request-prev="goTo(currentIndex - 1)"
        />
        <div v-else class="placeholder"><div class="box" /></div>
      </div>
    </div>
    <div v-if="!items.length && !loading" class="empty">暂无符合“精选”标准（点赞>20或收藏>10）的视频</div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { api } from '@/api'
import VideoPlayer from '@/components/VideoPlayer.vue'

const items = ref([])
const displaySrc = ref([])
const loaded = new Set()
const loading = ref(false)
const feedRef = ref(null)
const itemRefs = ref([])
const currentIndex = ref(0)
let aborted = false
let io

function setItemRef(el) { if (el) itemRefs.value.push(el) }
onBeforeUnmount(() => { aborted = true; itemRefs.value = []; if (io) { try { io.disconnect() } catch(_) { void 0 } } })

function stride() { const el = feedRef.value; return el ? el.clientHeight : 0 }
function clamp(i) { const max = Math.max(0, (itemRefs.value.length||1)-1); return Math.max(0, Math.min(max, i)) }
function goTo(i) {
  const el = feedRef.value; if (!el) return
  const t = clamp(i); currentIndex.value = t
  el.scrollTo({ top: t * Math.max(1, stride()), behavior: 'smooth' })
  updatePreload(t)
  maybeLoadMore(t)
}

async function load(page=1) {
  if (loading.value) return; loading.value = true
  try {
    const res = await api.featuredFeed({ page, pageSize: 12 })
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
    // 兜底：后端 500 时，改为拉取热门视频并在前端按阈值过滤
    try {
      const alt = await api.videosList({ page, pageSize: 24, order: 'hot' })
      if (aborted) return
      const filtered = (alt.items||[]).filter(v => (Number(v.likes||0) > 20) || (Number(v.favorites||0) > 10))
      const mapped = filtered.map(v => ({
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
      hasNext.value = Boolean(alt?.hasNext)
      curPage.value = Number(alt?.page || page || 1)
    } catch (_) { /* 前端兜底失败则保持空态 */ }
  } finally { loading.value = false }
}

function effectivePrefetchCount(){ return 2 }
async function ensureItemSrc(i){ const idx=clamp(i); if(loaded.has(idx)) return; const it=items.value[idx]; if(!it) return; displaySrc.value[idx]=it.src; loaded.add(idx) }
function updatePreload(center){ ensureItemSrc(center); for(let k=1;k<=effectivePrefetchCount();k++) ensureItemSrc(center+k) }
function setupIO(){ if(!feedRef.value) return; if(io){try{io.disconnect()}catch(_){ void 0 }} io=new IntersectionObserver((entries)=>{ entries.forEach(e=>{ if(e.isIntersecting||e.intersectionRatio>0){ const idx=Number(e.target.dataset.idx||'0'); ensureItemSrc(idx) } }) }, { root: feedRef.value, rootMargin: '500px 0px', threshold: 0.01 }); itemRefs.value.forEach(el=>io.observe(el)) }
function maybeLoadMore(idx){ if(idx>=items.value.length-2 && hasNext.value && !loading.value) load(curPage.value+1).then(()=>nextTick(()=>{setupIO();updatePreload(currentIndex.value)})) }

const curPage = ref(1)
const hasNext = ref(true)

onMounted(() => {
  load(1).then(()=> nextTick(()=> goTo(0)))
})
</script>

<style scoped>
.feed { width:100%; height:100%; overflow-y:auto; }
.feed-item { height:100%; display:flex; align-items:center; justify-content:center; }
.player-card { height:100%; width:100%; border-radius:12px; overflow:hidden; border:1px solid var(--border); background:var(--bg); }
.placeholder .box { width:100%; height:100%; background: var(--bg-elev); border:1px dashed var(--btn-border); border-radius:12px; }
.empty{ color:var(--muted); text-align:center; padding:32px 0; }
</style>

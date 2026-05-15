<template>
  <div class="search-page">
    <div class="head">
      <h2 v-if="q">搜索：{{ q }}</h2>
      <h2 v-else>搜索</h2>
    </div>
    <div>
      <div v-if="loading" class="grid">
        <div v-for="n in 12" :key="n" class="card skeleton">
          <div class="thumb" />
          <div class="line w-80" />
          <div class="line w-50" />
        </div>
      </div>
      <div v-else>
        <div v-if="err" class="error">
          <span>{{ err.detail || '加载失败' }}</span>
          <button class="btn" @click="reload">重试</button>
        </div>
        <div v-else-if="items.length === 0" class="empty">暂无结果</div>
        <div v-else class="grid">
          <div v-for="(it, idx) in items" :key="it.id || idx" class="card" @click="openAt(idx)">
            <div class="thumb">
              <img v-if="it.cover" :src="it.cover" alt="thumb" />
              <div v-else class="ph" />
            </div>
            <div class="title" :title="it.title || ' '">{{ it.title || ' ' }}</div>
            <div class="tags" v-if="it && Array.isArray(it.tags) && it.tags.length">
              <span class="tag" v-for="(t,i) in it.tags.slice(0,3)" :key="t.id || i">{{ t.name }}</span>
            </div>
            <div class="meta">
              <span v-if="it.views != null">👁️ {{ fmt(it.views) }}</span>
              <span v-if="it.likes != null">❤️ {{ fmt(it.likes) }}</span>
            </div>
          </div>
        </div>
        <div class="pager" v-if="hasNext && !loadingMore">
          <button class="btn" @click="loadMore">加载更多</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api'

export default {
  name: 'SearchPage',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const q = computed(() => String(route.query.q || ''))
    const items = ref([])
    const page = ref(1)
    const hasNext = ref(false)
    const loading = ref(true)
    const loadingMore = ref(false)
    const err = ref(null)

    function fmt(n) {
      const v = Number(n || 0)
      if (v >= 1000000) return (v/1000000).toFixed(1).replace(/\.0$/,'')+'m'
      if (v >= 1000) return (v/1000).toFixed(1).replace(/\.0$/,'')+'k'
      return String(v)
    }

    async function fetchPage(p = 1) {
      const kw = q.value.trim()
      if (!kw) { items.value = []; page.value = 1; hasNext.value = false; err.value = null; return }
      try {
        const res = await api.searchVideos({ page: p, pageSize: 12, q: kw, order: 'relevance' })
        if (p === 1) items.value = res.items
        else items.value = items.value.concat(res.items)
        page.value = res.page
        hasNext.value = !!res.hasNext
        err.value = null
      } catch (e) { err.value = e }
    }

    async function reload() {
      try { loading.value = true; await fetchPage(1) } finally { loading.value = false }
    }
    async function loadMore() { if (loadingMore.value) return; try { loadingMore.value = true; await fetchPage(page.value + 1) } finally { loadingMore.value = false } }
    function openAt(idx) {
      try {
        const i = Number(idx)
        const kw = String(q.value || '').trim()
        const item = items.value[isNaN(i) ? 0 : i] || null
        router.push({
          name: 'search-feed',
          query: {
            q: kw,
            i: String(isNaN(i) ? 0 : i),
            id: item && item.id ? String(item.id) : '',
          }
        })
      } catch (_) { /* no-op */ }
    }

    onMounted(async () => { await reload() })
    watch(() => route.query.q, async () => { await reload() })

    return { q, items, loading, loadingMore, hasNext, loadMore, reload, openAt, err, fmt }
  }
}
</script>

<style scoped>
.search-page { padding: 12px 16px; }
.head { margin-bottom: 8px; }
.grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.card { background: var(--bg); border:1px solid var(--border); border-radius:12px; overflow:hidden; cursor:pointer; }
.thumb { width:100%; aspect-ratio: 16/9; background: var(--bg-elev); display:block; position: relative; }
.thumb img { width:100%; height:100%; object-fit: cover; display:block; }
.title { padding:8px 10px 0; font-weight:600; color: var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.meta { padding:6px 10px 10px; display:flex; gap:12px; color: var(--muted); font-size:12px; }
.pager { display:flex; justify-content:center; padding: 16px 0; }
.btn { padding:8px 16px; border-radius:8px; border:1px solid var(--btn-border); background: var(--btn-bg); color: var(--text); cursor:pointer; }
.empty { color: var(--muted); padding: 24px 0; text-align:center; }
.error { display:flex; gap:12px; align-items:center; justify-content:center; color: var(--danger); padding: 12px 0; }

/* skeleton */
.skeleton .thumb { background: linear-gradient(90deg, rgba(0,0,0,.12), rgba(255,255,255,.06), rgba(0,0,0,.12)); background-size: 200% 100%; animation: sh 1.2s infinite; }
.skeleton .line { height: 12px; margin: 8px 10px; border-radius:6px; background: linear-gradient(90deg, rgba(0,0,0,.12), rgba(255,255,255,.06), rgba(0,0,0,.12)); background-size:200% 100%; animation: sh 1.2s infinite; }
.w-80 { width: 80%; }
.w-50 { width: 50%; }
@keyframes sh { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
</style>

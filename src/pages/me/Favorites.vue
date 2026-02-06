<template>
  <div>
    <div v-if="needLogin" class="empty">请先登录后查看我的收藏</div>
    <template v-else>
      <div v-if="bulkManage" class="bulkbar">
        <span>已选 {{ selectedIds.length }} 项</span>
        <button class="btn danger" :disabled="!selectedIds.length || acting" @click="doBulk">移除收藏</button>
      </div>
      <CardGrid :items="items" :loading="loading" :selectable="bulkManage" :selected-ids="selectedIds" @toggle="toggleSelect" @open="open" />
      <div v-if="!loading && err" class="error">
        <span>{{ err.detail || '加载失败' }}</span>
        <button class="btn" @click="retry">重试</button>
      </div>
      <div class="pager" v-if="!loading && !err && hasNext">
        <button class="btn" @click="loadMore" :disabled="loadingMore">加载更多</button>
      </div>
    </template>
  </div>
</template>
<script>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import CardGrid from '@/components/CardGrid.vue'
import { api } from '@/api'
import { useScrollMemory } from '@/composables/useScrollMemory'
import { useUiStore } from '@/stores/ui'

export default {
  name: 'MeFavorites',
  components: { CardGrid },
  setup() {
    const router = useRouter()
    const route = useRoute()
    const items = ref([])
    const page = ref(1)
    const hasNext = ref(false)
    const loading = ref(true)
    const loadingMore = ref(false)
    const needLogin = ref(false)
    useScrollMemory()
    const err = ref(null)
    const ui = useUiStore()
    const bulkManage = computed(() => ui.meBulkManage)
    const selectedIds = ref([])
    const acting = ref(false)

    async function ensureLogin() {
      try { const me = await api.me(); needLogin.value = !me?.id } catch { needLogin.value = true }
    }

    async function fetchPage(p = 1) {
      try {
        const res = await api.favoritesList({ page: p, pageSize: 12 })
        if (p === 1) items.value = res.items
        else items.value = items.value.concat(res.items)
        page.value = res.page
        hasNext.value = !!res.hasNext
        err.value = null
      } catch (e) {
        err.value = e
      }
    }

    async function init() {
      await ensureLogin()
      try { loading.value = true; if (!needLogin.value) await fetchPage(1) } finally { loading.value = false }
    }

    async function loadMore() { if (loadingMore.value) return; try { loadingMore.value = true; await fetchPage(page.value + 1) } finally { loadingMore.value = false } }
    function toggleSelect(id) {
      const i = selectedIds.value.indexOf(id)
      if (i >= 0) selectedIds.value.splice(i,1); else selectedIds.value.push(id)
    }
    async function doBulk() {
      if (!selectedIds.value.length) return
      if (!confirm(`确认移除收藏 ${selectedIds.value.length} 项？`)) return
      try { acting.value = true; await api.bulkFavoritesRemove(selectedIds.value); selectedIds.value = []; await fetchPage(1) } finally { acting.value = false }
    }
    function open(id) {
      if (!id) return
      const q = { id }
      if (route.query.user_id) q.user_id = route.query.user_id
      router.push({ name: 'feed-player', params: { source: 'favorites' }, query: q })
    }
    async function retry() { await init() }

    onMounted(init)
    return { items, loading, hasNext, loadMore, loadingMore, needLogin, err, retry,
             bulkManage, selectedIds, toggleSelect, acting, doBulk, open }
  }
}
</script>
<style scoped>
.pager { display:flex; justify-content:center; padding: 16px 0; }
.btn { padding:8px 16px; border-radius:8px; border:1px solid var(--btn-border); background: var(--btn-bg); color: var(--text); cursor:pointer; }
.empty { color: var(--muted); padding: 24px 0; text-align:center; }
.error { display:flex; gap:12px; align-items:center; justify-content:center; color: var(--danger); padding: 12px 0; }
.bulkbar { display:flex; gap:12px; align-items:center; padding:8px 0; }
.btn.danger { border-color: var(--danger); color: var(--danger); }
</style>

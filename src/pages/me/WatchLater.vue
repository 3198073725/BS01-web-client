<template>
  <div>
    <div v-if="needLogin" class="empty">请先登录后查看稍后再看</div>
    <template v-else>
      <div v-if="bulkManage" class="bulkbar">
        <span>已选 {{ selectedIds.length }} 项</span>
        <button class="btn danger" :disabled="!selectedIds.length || acting" @click="doBulk">移除稍后再看</button>
      </div>
      <CardGrid :items="items" :loading="loading" :selectable="bulkManage" :selected-ids="selectedIds" @toggle="toggleSelect" @open="open" />
      <div class="pager" v-if="!loading && hasNext">
        <button class="btn" @click="loadMore" :disabled="loadingMore">加载更多</button>
      </div>
    </template>
  </div>
</template>
<script>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import CardGrid from '@/components/CardGrid.vue'
import { api } from '@/api'
import { useScrollMemory } from '@/composables/useScrollMemory'
import { useUiStore } from '@/stores/ui'

export default {
  name: 'MeWatchLater',
  components: { CardGrid },
  setup() {
    const router = useRouter()
    const items = ref([])
    const page = ref(1)
    const hasNext = ref(false)
    const loading = ref(true)
    const loadingMore = ref(false)
    const needLogin = ref(false)
    const ui = useUiStore()
    const bulkManage = computed(() => ui.meBulkManage)
    const selectedIds = ref([])
    const acting = ref(false)
    useScrollMemory()

    async function ensureLogin() {
      try { const me = await api.me(); needLogin.value = !me?.id } catch { needLogin.value = true }
    }

    async function fetchPage(p = 1) {
      const res = await api.watchLaterList({ page: p, pageSize: 12 })
      if (p === 1) items.value = res.items
      else items.value = items.value.concat(res.items)
      page.value = res.page
      hasNext.value = !!res.hasNext
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
    function open(id) {
      if (!id) return
      router.push({ name: 'feed-player', params: { source: 'watch-later' }, query: { id } })
    }
    async function doBulk() {
      if (!selectedIds.value.length) return
      if (!confirm(`确认移除 ${selectedIds.value.length} 项？`)) return
      try { acting.value = true; await api.bulkWatchLaterRemove(selectedIds.value); selectedIds.value = []; await fetchPage(1) } finally { acting.value = false }
    }

    onMounted(init)
    return { items, loading, hasNext, loadMore, loadingMore, needLogin,
             bulkManage, selectedIds, toggleSelect, acting, doBulk, open }
  }
}
</script>
<style scoped>
.pager { display:flex; justify-content:center; padding: 16px 0; }
.btn { padding:8px 16px; border-radius:8px; border:1px solid var(--btn-border); background: var(--btn-bg); color: var(--text); cursor:pointer; }
.empty { color: var(--muted); padding: 24px 0; text-align:center; }
.bulkbar { display:flex; gap:12px; align-items:center; padding:8px 0; }
.btn.danger { border-color: var(--danger); color: var(--danger); }
</style>

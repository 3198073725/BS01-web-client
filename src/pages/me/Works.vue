<template>
  <div>
    <div v-if="needLogin" class="empty">请先登录后查看我的作品</div>
    <template v-else>
      <div v-if="bulkManage" class="bulkbar">
        <span>已选 {{ selectedIds.length }} 项</span>
        <button class="btn danger" :disabled="!selectedIds.length || acting" @click="doBulkDelete">删除作品</button>
      </div>
      <CardGrid :items="items" :loading="loading" :selectable="bulkManage" :selected-ids="selectedIds" @toggle="toggleSelect" />
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
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import CardGrid from '@/components/CardGrid.vue'
import { api } from '@/api'
import { useScrollMemory } from '@/composables/useScrollMemory'
import { useUiStore } from '@/stores/ui'

export default {
  name: 'MeWorks',
  components: { CardGrid },
  setup() {
    const items = ref([])
    const page = ref(1)
    const hasNext = ref(false)
    const loading = ref(true)
    const loadingMore = ref(false)
    const needLogin = ref(false)
    const userId = ref('') // 当前要查看的用户ID（可能是自己或他人）
    const myId = ref('')   // 自己的用户ID（用于判断是否可批量管理）
    const err = ref(null)
    const ui = useUiStore()
    const bulkManage = computed(() => ui.meBulkManage && myId.value && String(userId.value) === String(myId.value))
    const selectedIds = ref([])
    const acting = ref(false)
    useScrollMemory()
    const route = useRoute()

    async function ensureUser() {
      // 优先使用路由上的 user_id（查看他人作品时）
      const rid = String(route.query.user_id || '')
      if (rid) {
        userId.value = rid
        needLogin.value = false
        // 同时尝试拿到自己的ID，用于判断是否展示批量管理
        try { const me = await api.me(); myId.value = me?.id || '' } catch (_) { myId.value = '' }
        return
      }
      // 否则查看“我的作品”（需要登录）
      try {
        const me = await api.me()
        myId.value = me?.id || ''
        userId.value = myId.value
        needLogin.value = !userId.value
      } catch (_) {
        myId.value = ''
        needLogin.value = true
      }
    }

    async function fetchPage(p = 1) {
      try {
        const res = await api.videosList({ page: p, pageSize: 12, userId: userId.value, order: 'latest' })
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
      await ensureUser()
      try { loading.value = true; if (!needLogin.value) await fetchPage(1) } finally { loading.value = false }
    }

    async function loadMore() { if (loadingMore.value) return; try { loadingMore.value = true; await fetchPage(page.value + 1) } finally { loadingMore.value = false } }
    function toggleSelect(id) {
      const i = selectedIds.value.indexOf(id)
      if (i >= 0) selectedIds.value.splice(i,1); else selectedIds.value.push(id)
    }
    async function doBulkDelete() {
      if (!selectedIds.value.length) return
      if (!confirm(`确认删除所选 ${selectedIds.value.length} 个作品？此操作不可恢复`)) return
      try { acting.value = true; await api.videosBulkDelete(selectedIds.value); selectedIds.value = []; await fetchPage(1) } finally { acting.value = false }
    }
    async function retry() { await init() }

    onMounted(init)
    watch(() => route.query.user_id, async () => { await init() })
    return { items, loading, hasNext, loadMore, loadingMore, needLogin, err, retry,
             bulkManage, selectedIds, toggleSelect, acting, doBulkDelete }
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

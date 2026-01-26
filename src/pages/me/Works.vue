<template>
  <div>
    <div v-if="needLogin" class="empty">请先登录后查看我的作品</div>
    <template v-else>
      <div v-if="bulkManage" class="bulkbar">
        <span>已选 {{ selectedIds.length }} 项</span>
        <button class="btn" :disabled="!selectedIds.length || acting" @click="openBulkManage">批量设置</button>
        <button class="btn danger" :disabled="!selectedIds.length || acting" @click="openBulkManageForDelete">删除作品</button>
      </div>
      <CardGrid :items="items" :loading="loading" :selectable="bulkManage" :selected-ids="selectedIds" @toggle="toggleSelect" @open="openEdit" />
      <div v-if="!loading && err" class="error">
        <span>{{ err.detail || '加载失败' }}</span>
        <button class="btn" @click="retry">重试</button>
      </div>
      <div class="pager" v-if="!loading && !err && hasNext">
        <button class="btn" @click="loadMore" :disabled="loadingMore">加载更多</button>
      </div>
      <BulkManageDialog :open="dialogOpen" :selected-count="selectedIds.length" :pending="acting"
                        @close="dialogOpen=false"
                        @apply="applyBulkSettings"
                        @delete="confirmBulkDelete" />
    </template>
  </div>
</template>

<script>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CardGrid from '@/components/CardGrid.vue'
import BulkManageDialog from '@/components/BulkManageDialog.vue'
import { api } from '@/api'
import { useScrollMemory } from '@/composables/useScrollMemory'
import { useUiStore } from '@/stores/ui'

export default {
  name: 'MeWorks',
  components: { CardGrid, BulkManageDialog },
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
    // 选择持久化：使用 ui store
    const selectedIds = computed(() => ui.meSelectedIds)
    const acting = ref(false)
    const dialogOpen = ref(false)
    useScrollMemory()
    const route = useRoute()
    const router = useRouter()

    async function ensureUser() {
      // 优先使用路由上的 user_id（查看他人作品时）
      const rid = String(route.query.user_id || '')
      if (rid) {
        userId.value = rid
        needLogin.value = false
        // 同时尝试拿到自己的ID，用于判断是否展示批量管理
        try { const me = await api.me(); myId.value = me?.id || '' } catch (_) { myId.value = '' }
        // 设置批量选择作用域，切换用户时清空旧选择
        ui.setMeSelectedScope(userId.value)
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
      // 设置批量选择作用域
      ui.setMeSelectedScope(userId.value)
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
    function toggleSelect(id) { ui.toggleMeSelected(id) }
    function openBulkManage() { if (selectedIds.value.length) dialogOpen.value = true }
    function openBulkManageForDelete() {
      if (!selectedIds.value.length || acting.value) return
      const n = selectedIds.value.length
      ui.confirm(`确定删除选中的 ${n} 个作品？此操作不可恢复。`, async () => {
        try { acting.value = true; await api.videosBulkDelete([...selectedIds.value]); ui.clearMeSelected(); await fetchPage(1); ui.showDialog('删除成功', 'success') }
        catch (e) { ui.showDialog((e && (e.detail || e.message)) || '删除失败', 'error') }
        finally { acting.value = false }
      }, () => {})
    }
    function openEdit(id) { try { router.push({ name: 'video-edit', params: { id } }) } catch (_) { /* no-op */ } }
    async function applyBulkSettings(partial) {
      if (!selectedIds.value.length) return
      const n = selectedIds.value.length
      ui.confirm(`将对 ${n} 个作品应用设置，确定？`, async () => {
        try { acting.value = true; await api.videosBulkUpdate([...selectedIds.value], partial); dialogOpen.value = false; ui.showDialog('已应用设置', 'success'); await fetchPage(1) }
        catch (e) { ui.showDialog((e && (e.detail || e.message)) || '操作失败', 'error') }
        finally { acting.value = false }
      }, () => {})
    }
    async function confirmBulkDelete() { openBulkManageForDelete() }
    async function retry() { await init() }

    onMounted(init)
    // 不在切换模式时清空选择；只在作用域变化时由 ui.setMeSelectedScope 自动清空
    watch(() => route.query.user_id, async () => { await init() })
    return { items, loading, hasNext, loadMore, loadingMore, needLogin, err, retry,
             bulkManage, selectedIds, toggleSelect, acting, dialogOpen,
             openBulkManage, openBulkManageForDelete, applyBulkSettings, confirmBulkDelete, openEdit }
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

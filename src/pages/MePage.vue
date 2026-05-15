<template>
  <div class="me-page">
    <div class="header glass">
      <div class="left">
        <img v-if="avatarUrl && !avatarError" :src="avatarUrl" class="avatar lg" :alt="displayName" @error="avatarError=true"/>
        <div v-else class="avatar-fallback lg">{{ userInitial }}</div>
        <div class="info">
          <div class="name">{{ displayName }}</div>
          <div class="meta">
            <button class="link" @click="openFollow('following')">关注 {{ fmtNumber(pageUser?.following_count) }}</button>
            <i>|</i>
            <button class="link" @click="openFollow('followers')">粉丝 {{ fmtNumber(pageUser?.followers_count) }}</button>
          </div>
          <div v-if="profileBio" class="bio">{{ profileBio }}</div>
        </div>
      </div>
      <div class="actions">
        <button class="btn" v-if="isSelf" @click="editProfile">编辑资料</button>
        <button class="btn" v-if="isSelf" :class="{ active: remember }" @click="toggleRemember">保存登录状态</button>
      </div>
    </div>

    <nav class="tabs sticky">
      <div class="tab-group">
        <router-link :to="{ name: 'me-works', query: tabQuery() }" class="tab" :class="{ active: $route.name==='me-works' }">作品</router-link>
        <router-link v-if="canSeeAll" :to="{ name: 'me-likes', query: tabQuery() }" class="tab" :class="{ active: $route.name==='me-likes' }">喜欢</router-link>
        <router-link v-if="canSeeAll" :to="{ name: 'me-favorites', query: tabQuery() }" class="tab" :class="{ active: $route.name==='me-favorites' }">收藏</router-link>
        <router-link v-if="canSeeAll" :to="{ name: 'me-history', query: tabQuery() }" class="tab" :class="{ active: $route.name==='me-history' }">观看历史</router-link>
        <router-link v-if="canSeeAll" :to="{ name: 'me-watch-later', query: tabQuery() }" class="tab" :class="{ active: $route.name==='me-watch-later' }">稍后再看</router-link>
      </div>
      <div class="tab-actions">
        <button v-if="isSelf" class="btn small" :class="{ active: bulkManage }" @click="toggleBulkManage">批量管理</button>
      </div>
    </nav>

    <section class="content">
      <router-view />
    </section>
    <!-- 关注/粉丝弹窗，与顶部一致 -->
    <FollowDialog :open="followOpen" :initial-tab="followTab" :user-id="uid"
                  @close="followOpen=false" @changed="onFollowChanged"
                  :following-count="pageUser?.following_count || 0"
                  :followers-count="pageUser?.followers_count || 0" />
    <EditProfileDialog :open="editOpen" :user="user" @close="editOpen=false" @saved="onProfileSaved" />
  </div>
 </template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api'
import FollowDialog from '@/components/FollowDialog.vue'
import EditProfileDialog from '@/components/EditProfileDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

export default {
  name: 'MePage',
  components: { FollowDialog, EditProfileDialog },
  setup() {
    const auth = useAuthStore()
    const ui = useUiStore()
    const user = computed(() => auth.user)
    const stats = ref(null)
    const avatarError = ref(false)
    const reloadTick = ref(0)
    const route = useRoute()
    const router = useRouter()

    // 当前正在查看的用户（可能是自己或他人）
    const pageUser = ref(null)
    const isSelf = computed(() => {
      try { return pageUser.value && user.value && String(pageUser.value.id) === String(user.value.id) } catch { return false }
    })

    async function ensurePageUser() {
      const rid = String(route.query.user_id || '')
      if (rid) {
        try { pageUser.value = await api.userDetail(rid) } catch { pageUser.value = null }
      } else {
        pageUser.value = user.value || null
      }
    }

	    const displayName = computed(() => (pageUser.value?.nickname || pageUser.value?.display_name || pageUser.value?.username || '用户'))
	    const profileBio = computed(() => String(pageUser.value?.bio || '').trim())
	    const userInitial = computed(() => String(displayName.value).trim().charAt(0).toUpperCase() || 'U')
    const avatarUrl = computed(() => {
      const pp = pageUser.value?.profile_picture
      if (!pp) return ''
      const base = (api.getBase && api.getBase()) ? api.getBase().replace(/\/$/, '') : ''
      const qs = []
      if (pageUser.value?.updated_at) qs.push(`t=${encodeURIComponent(pageUser.value.updated_at)}`)
      if (reloadTick.value) qs.push(`r=${reloadTick.value}`)
      const suffix = qs.length ? `?${qs.join('&')}` : ''
      if (/^https?:\/\//i.test(pp)) return `${pp}${suffix}`
      const rel = String(pp).replace(/^\/+/, '')
      const path = rel.startsWith('media/') ? rel : `media/${rel}`
      return `${base}/${path}${suffix}`
    })

    const likesCount = computed(() => Number(stats.value?.likes_count || 0))
    const favoritesCount = computed(() => Number(stats.value?.favorites_count || 0))
    const watchLaterCount = computed(() => Number(stats.value?.watch_later_count || 0))
    const myWorksCount = computed(() => Number(stats.value?.my_works_count || (pageUser.value?.video_count || 0)))

    function fmtNumber(n) {
      const v = Number(n || 0)
      if (v >= 1_000_000) return (v/1_000_000).toFixed(1).replace(/\.0$/,'')+'m'
      if (v >= 1_000) return (v/1_000).toFixed(1).replace(/\.0$/,'')+'k'
      return String(v)
    }

    async function loadStats() {
      // popupStats 仅返回当前登录用户的统计；他人页面仅使用 userDetail 自带的计数
      if (isSelf.value) { try { stats.value = await api.popupStats(true) } catch { stats.value = null } }
      else stats.value = null
    }

    const editOpen = ref(false)
    function editProfile() { editOpen.value = true }
    // 保存登录状态（与头像弹窗一致）
    const remember = computed(() => auth.remember)
    function toggleRemember() { try { auth.setRemember(!auth.remember) } catch (_) { /* no-op */ } }

    // Follow/Fans dialog
    const followOpen = ref(false)
    const followTab = ref('following')
    const uid = computed(() => pageUser.value?.id || null)
    function openFollow(kind) { followTab.value = kind; followOpen.value = true }

    // 记录最近访问的标签（使用 Pinia ui store 持久化）
    watch(() => route.name, (nv) => {
      const allowed = ['me-works','me-likes','me-favorites','me-history','me-watch-later']
      if (allowed.includes(String(nv))) {
        try { ui.setMeLastTab(String(nv)) } catch (e) { void e }
      }
    }, { immediate: true })

    // 隐私控制：public / private / friends_only
    const relation = ref({ mutual: false })
    const privacy = computed(() => String(pageUser.value?.privacy_mode || 'public'))
    const canSeeAll = computed(() => isSelf.value || privacy.value === 'public' || (privacy.value === 'friends_only' && relation.value?.mutual))
    function tabQuery() { return pageUser.value && (!isSelf.value) ? { user_id: String(pageUser.value.id) } : {} }

    async function ensureRelationship() {
      if (!pageUser.value || isSelf.value) { relation.value = { mutual: false }; return }
      try { relation.value = await api.relationship(pageUser.value.id) } catch { relation.value = { mutual: false } }
    }

    function guardRoute() {
      const name = String(route.name || '')
      const protectedTabs = new Set(['me-likes','me-favorites','me-history','me-watch-later'])
      if (protectedTabs.has(name) && !canSeeAll.value) {
        router.replace({ name: 'me-works', query: tabQuery() })
      }
    }

    function onProfileSaved(updated) { try { auth.user = updated } catch (_) { /* no-op */ } loadStats() }
    async function onFollowChanged() {
      if (!pageUser.value || !pageUser.value.id) return
      try { pageUser.value = await api.userDetail(pageUser.value.id) } catch (_) { /* no-op */ }
      await ensureRelationship();
      guardRoute()
    }
    onMounted(async () => {
      try { ui.init() } catch (_) { /* no-op */ }
      await ensurePageUser(); await ensureRelationship(); await loadStats(); guardRoute()
    })
    // 监听路由与用户变化
    watch(() => route.query.user_id, async () => { await ensurePageUser(); await ensureRelationship(); guardRoute() })
    watch(() => user.value, async () => { await ensurePageUser(); await ensureRelationship(); await loadStats(); guardRoute() })
    watch(() => user.value?.profile_picture, () => { avatarError.value = false; reloadTick.value = Date.now() })
    watch(() => user.value?.updated_at, () => { avatarError.value = false; reloadTick.value = Date.now() })

	    return { user, pageUser, isSelf, stats, displayName, profileBio, userInitial, avatarUrl, avatarError,
	             likesCount, favoritesCount, watchLaterCount, myWorksCount,
	             fmtNumber, editProfile, remember, toggleRemember, followOpen, followTab, uid, openFollow,
	             bulkManage: computed(() => ui.meBulkManage && isSelf.value), toggleBulkManage: () => ui.toggleMeBulkManage(),
	             editOpen, onProfileSaved, canSeeAll, tabQuery, onFollowChanged }
  }
}
</script>

<style scoped>
.me-page { color: var(--text); }
.header { display:flex; align-items:center; justify-content:space-between; padding: 22px 16px; min-height: 108px; border-bottom: 1px solid var(--border); }
.header.glass { background: rgba(255,255,255,0.06); -webkit-backdrop-filter: blur(10px) saturate(160%); backdrop-filter: blur(10px) saturate(160%); border: 1px solid var(--border); border-radius: 16px; }
.left { display:flex; align-items:center; gap:18px; min-width: 0; }
.avatar { width:64px; height:64px; border-radius:50%; object-fit:cover; border:1px solid var(--btn-border); }
.avatar.lg { width:72px; height:72px; }
.avatar-fallback { width:64px; height:64px; border-radius:50%; background: var(--btn-border); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:20px; }
.avatar-fallback.lg { width:72px; height:72px; font-size:22px; }
.info { display:flex; flex-direction:column; align-items:flex-start; justify-content:center; min-width:0; max-width: min(820px, 55vw); }
.info .name { font-weight:800; font-size:20px; line-height: 1.2; }
.info .meta { color: var(--muted); font-size:13px; display:flex; gap:10px; align-items:center; margin-top:8px; }
.info .bio { max-width: 100%; color: var(--muted); font-size: 13px; line-height: 1.5; margin-top: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.info .meta .link { background: transparent; border:none; color: var(--text); cursor:pointer; padding: 2px 6px; border-radius: 8px; }
.info .meta .link:hover { background: var(--hover-bg); }
.actions { display:flex; gap:8px; }
.btn { padding:8px 12px; border-radius:10px; border:1px solid var(--btn-border); background: var(--btn-bg); color: var(--text); cursor:pointer; }
.tabs { display:flex; align-items:center; justify-content:space-between; gap:8px; padding: 12px 10px; border-bottom: 1px solid var(--border); background: var(--bg); }
.tabs.sticky { position: sticky; top: 0; z-index: 5; }
.tab-group { display:flex; gap:8px; flex-wrap: wrap; }
.tab { padding:8px 20px; border-radius:8px; border:1px solid var(--btn-border); color: var(--text); text-decoration:none; background: var(--btn-bg); display:inline-flex; gap:4px; align-items:center; }
.tab em { font-style: normal; color: var(--muted); }
.tab.active, .tab.router-link-active { background: var(--accent); color: var(--bg); border-color: var(--accent); }
.content { padding: 16px 0; }
.btn.active { background: var(--accent); border-color: var(--accent); color: var(--bg); }
.btn.small { padding:6px 12px; font-size: 12px; }
@media (max-width: 900px) {
  .header { align-items: flex-start; }
  .left { align-items: flex-start; }
  .info { max-width: 100%; }
  .info .bio { white-space: normal; overflow: visible; text-overflow: clip; }
}
</style>

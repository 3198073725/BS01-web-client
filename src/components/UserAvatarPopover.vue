<template>
  <div class="avatar-wrap" ref="wrap" @mouseenter="onEnter" @mouseleave="onLeave" @click="onClickAvatar">
    <img v-if="avatarUrl && !avatarError" :src="avatarUrl" class="avatar-img" :alt="displayName" @error="avatarError=true"/>
    <div v-else class="avatar-fallback">{{ userInitial }}</div>

    <transition name="fade-pop">
      <div v-show="visible" class="popover" ref="pop" role="dialog" aria-label="用户菜单"
           @mouseenter="cancelHide" @mouseleave="delayHide">
        <header class="top">
          <img v-if="avatarUrl && !avatarError" :src="avatarUrl" class="avatar-lg" :alt="displayName" @click="go('/me/works')" @error="avatarError=true"/>
          <div v-else class="avatar-fallback-lg" @click="go('/me/works')">{{ userInitial }}</div>
          <div class="name" @click="go('/me/works')">{{ displayName }}</div>
          <div class="stats">
            <span class="clickable" @click="openModal('following')">关注 {{ fmtNumber(topStats.following_count) }}</span>
            <i>|</i>
            <span class="clickable" @click="openModal('followers')">粉丝 {{ fmtNumber(topStats.followers_count) }}</span>
          </div>
        </header>
        <section class="list">
          <Item icon="❤️" variant="heart" text="我的喜欢" :num="fmtNumber(stats?.likes_count)" @click="go('/me/likes')" />
          <Item icon="⭐" variant="star" text="我的收藏" :num="fmtNumber(stats?.favorites_count)" @click="go('/me/favorites')" />
          <Item icon="🕒" variant="clock" text="观看历史" :num="historyText" @click="go('/me/history')" />
          <Item icon="📌" variant="later" text="稍后再看" :num="fmtNumber(stats?.watch_later_count)" @click="go('/me/watch-later')" />
          <Item icon="🎬" variant="video" text="我的作品" :num="fmtNumber(stats?.my_works_count)" @click="go('/me/works')" />
        </section>
        <footer class="foot">
          <button class="logout" @click="confirmLogout">退出登录</button>
          <button class="remember-btn" :class="{ active: remember }" :aria-pressed="remember ? 'true' : 'false'" @click="toggleRemember">保存登录信息</button>
        </footer>
      </div>
    </transition>

    <!-- 自定义退出登录确认弹窗 -->
    <div v-if="showLogoutConfirm" class="confirm-overlay" @click.self="closeLogoutConfirm">
      <div class="confirm-modal" role="dialog" aria-label="确认退出登录">
        <div class="confirm-title">确认退出登录？</div>
        <div class="confirm-actions split">
          <button class="btn" @click="closeLogoutConfirm">取消</button>
          <button class="btn primary" @click="doLogout">退出登录</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, h, watch } from 'vue'
import { useUserPopupStats } from '@/composables/useUserPopupStats'
import { api } from '@/api'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'

// 内联条目子组件，避免多个 <script> 导致编译错误
const Item = {
  name: 'Item',
  props: { icon: String, text: String, num: [String, Number], variant: String },
  emits: ['click'],
  render() {
    return h('div', {
      class: 'item',
      onClick: () => this.$emit('click')
    }, [
      h('span', { class: ['item-badge', 'v-' + (this.variant || 'default')] }, this.icon),
      h('span', { class: 'text' }, this.text),
      h('span', { class: 'num' }, String(this.num ?? '')),
      h('span', { class: 'arrow' }, '›')
    ])
  }
}

export default {
  name: 'UserAvatarPopover',
  components: { Item },
  emits: ['open-follow'],
  props: {
    user: { type: Object, required: true }
  },
  setup(props, { emit }) {
    const wrap = ref(null)
    const pop = ref(null)
    const visible = ref(false)
    const showTimer = ref(null)
    const hideTimer = ref(null)
    const avatarError = ref(false)

    const { data, load } = useUserPopupStats()
    const auth = useAuthStore()

    const displayName = computed(() => props.user?.nickname || props.user?.display_name || props.user?.username || '用户')
    const userInitial = computed(() => String(displayName.value).trim().charAt(0).toUpperCase() || 'U')
    const avatarUrl = computed(() => {
      const pp = props.user?.profile_picture
      if (!pp) return ''
      const base = (api.getBase && api.getBase()) ? api.getBase().replace(/\/$/, '') : ''
      const bust = props.user?.updated_at ? `?t=${encodeURIComponent(props.user.updated_at)}` : ''
      if (/^https?:\/\//i.test(pp)) return `${pp}${bust}`
      const rel = String(pp).replace(/^\/+/, '')
      const path = rel.startsWith('media/') ? rel : `media/${rel}`
      return `${base}/${path}${bust}`
    })
    const stats = computed(() => data.value)
    const topStats = computed(() => ({
      following_count: Number(stats.value?.following_count ?? props.user?.following_count ?? 0),
      followers_count: Number(stats.value?.followers_count ?? props.user?.followers_count ?? 0),
    }))
    const historyText = computed(() => {
      if (stats.value && stats.value.history_count != null) return fmtNumber(stats.value.history_count)
      return '30天内'
    })

    function onEnter() {
      clearTimeout(hideTimer.value)
      showTimer.value = setTimeout(async () => {
        visible.value = true
        if (props.user?.id) await load(props.user.id, true)
      }, 300)
    }
    function onLeave() { delayHide() }
    function delayHide() {
      clearTimeout(showTimer.value)
      hideTimer.value = setTimeout(() => { visible.value = false }, 500)
    }
    function cancelHide() { clearTimeout(hideTimer.value) }
    function onClickAvatar() {
      if (window.matchMedia('(pointer: coarse)').matches) {
        visible.value ? (visible.value = false) : onEnter()
      }
    }
    function onEsc(e) { if (e.key === 'Escape') visible.value = false }
    function onClickOutside(e) {
      if (!wrap.value) return
      if (!wrap.value.contains(e.target)) visible.value = false
    }
    function fmtNumber(n) {
      const v = Number(n || 0)
      if (v >= 1_000_000) return (v/1_000_000).toFixed(1).replace(/\.0$/,'')+'m'
      if (v >= 1_000) return (v/1_000).toFixed(1).replace(/\.0$/,'')+'k'
      return String(v)
    }
    async function go(path) {
      visible.value = false
      try {
        await router.push(path)
      } catch (e) {
        // 忽略重复导航等路由失败，避免 dev overlay 抛出 [object Object]
        try { if (window && window.location && window.location.hash !== '#' + path) window.location.hash = '#' + path } catch (_) { /* no-op */ }
      }
    }
    function openModal(kind) { visible.value = false; emit('open-follow', kind) }
    const remember = computed(() => auth.remember)
    function toggleRemember() {
      try { auth.setRemember(!auth.remember) } catch (e) { void e }
    }
    const showLogoutConfirm = ref(false)
    function confirmLogout() { showLogoutConfirm.value = true }
    function closeLogoutConfirm() { showLogoutConfirm.value = false }
    async function doLogout() {
      try { auth.logoutLocal() } catch (_) { /* no-op */ }
      try { localStorage.removeItem('popup:stats:' + (props.user?.id || '')) } catch (_) { /* no-op */ }
      visible.value = false
      showLogoutConfirm.value = false
      window.location.hash = '#/'
    }

    onMounted(() => {
      document.addEventListener('keydown', onEsc)
      document.addEventListener('click', onClickOutside)
    })
    // 当头像路径或缓存戳变化时，重置错误状态，触发重新加载
    watch(avatarUrl, () => { avatarError.value = false })
    watch(() => props.user?.profile_picture, () => { avatarError.value = false })
    onBeforeUnmount(() => {
      document.removeEventListener('keydown', onEsc)
      document.removeEventListener('click', onClickOutside)
      clearTimeout(showTimer.value); clearTimeout(hideTimer.value)
    })

    return { wrap, pop, visible, onEnter, onLeave, delayHide, cancelHide, onClickAvatar,
             avatarUrl, avatarError, userInitial, displayName, stats, topStats, historyText, remember,
             fmtNumber, go, confirmLogout, toggleRemember, openModal,
             showLogoutConfirm, closeLogoutConfirm, doLogout }
  }
}
</script>

<style scoped>
.avatar-wrap { position: relative; display: inline-block; }
.avatar-img { width:32px; height:32px; border-radius:50%; object-fit: cover; border:1px solid var(--btn-border); display:block; }
.avatar-fallback { width:32px; height:32px; border-radius:50%; background: var(--btn-border); color: var(--text); display:flex; align-items:center; justify-content:center; font-weight:700; font-size: 14px; }
.popover { position: absolute; top: calc(100% + 8px); right: 0; width: 320px; z-index: 9999;
  background: var(--bg-elev); color: var(--text); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.2); overflow:hidden; }
.fade-pop-enter-from, .fade-pop-leave-to { opacity: 0; transform: translateY(-4px); }
.fade-pop-enter-active, .fade-pop-leave-active { transition: all .2s ease; }
.top { padding: 16px; border-bottom: 1px solid var(--border); text-align:left; }
.avatar-lg { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border:1px solid var(--btn-border); display:block; cursor: pointer; }
.avatar-fallback-lg { width:48px; height:48px; border-radius:50%; background: var(--btn-border); color: var(--text); display:flex; align-items:center; justify-content:center; font-weight:700; cursor: pointer; }
.name { margin-top: 8px; font-weight: 600; cursor: pointer; }
.stats { margin-top: 6px; font-size: 12px; color: var(--muted); display: flex; gap: 8px; align-items: center; }
.stats .clickable { cursor: pointer; }
.list { padding: 8px; display: grid; gap: 8px; }
.item { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:12px; background: var(--bg-elev); border:1px solid var(--border); cursor:pointer; box-shadow: 0 2px 10px rgba(0,0,0,.08); }
.item:hover { background: var(--hover-bg); }
.item-badge { width:28px; height:28px; border-radius:999px; display:inline-flex; align-items:center; justify-content:center; font-size:16px; }
.item-badge.v-heart { background:#3f1d29; color:#f43f5e; }
.item-badge.v-star { background:#3a2d1a; color:#f59e0b; }
.item-badge.v-clock { background:#203626; color:#22c55e; }
.item-badge.v-later { background:#2d2240; color:#a78bfa; }
.item-badge.v-video { background:#1b2b44; color:#3b82f6; }
.item .text { flex:1; text-align:left; color: var(--text); }
.item .num { color: var(--text); font-weight:700; }
.item .arrow { color: var(--muted); margin-left:6px; }
.foot { padding: 12px 16px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
.logout { color: var(--danger); background: transparent; border: none; cursor: pointer; }
.remember-btn { font-size:12px; padding:6px 10px; border-radius:999px; border:1px solid var(--btn-border); background: var(--btn-bg); color: var(--text); cursor:pointer; }
.remember-btn.active { background: var(--accent); border-color: var(--accent); color: var(--bg); }

/* 退出登录确认弹窗 */
.confirm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display:flex; align-items:center; justify-content:center; z-index: 10000; }
.confirm-modal { width: 360px; background: var(--bg-elev); color: var(--text); border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,.35); overflow: hidden; border:1px solid var(--border); }
.confirm-title { padding: 16px; font-weight: 700; border-bottom:1px solid var(--border); }
.confirm-actions { display:flex; gap:10px; justify-content:flex-end; padding: 12px 16px; }
.confirm-actions.split { justify-content: space-between; }
.btn { padding:8px 12px; border-radius:10px; border:1px solid var(--btn-border); background: var(--btn-bg); color: var(--text); cursor:pointer; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: var(--bg); }
</style>

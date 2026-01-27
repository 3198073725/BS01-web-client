<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="logo">
        <span class="dot">
          <img :src="logoSrc" alt="Vid Sprout" class="co" />
        </span>
      </div>
      <nav>
        <router-link to="/featured" class="nav-item">精选</router-link>
        <router-link to="/" class="nav-item">推荐</router-link>
        <div class="sep" />
        <router-link to="/following" class="nav-item">关注</router-link>
        <router-link to="/friends" class="nav-item">朋友</router-link>
        <router-link to="/me/works" class="nav-item">我的</router-link>
        <div class="sep" />
        <router-link to="/me/history" class="nav-item">历史</router-link>
        <router-link to="/me/likes" class="nav-item">喜欢</router-link>
      </nav>
      <div class="sidebar-bottom">
        <div class="footer-links">
          <router-link to="/about" class="footer-link">关于</router-link>
          <router-link to="/terms" class="footer-link">条款</router-link>
          <router-link to="/contact" class="footer-link">联系</router-link>
          <router-link to="/settings" class="footer-link">设置</router-link>
        </div>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div class="search" ref="searchRef" @mousedown="onSearchMouseDown">
          <input v-model.trim="kw" :placeholder="placeholder" @focus="onFocusSearch" @blur="onBlurSearch" @keyup.enter="doSearch" />
          <button @click="doSearch">搜索</button>
          <div class="shist" v-if="showHistory">
            <div v-if="historyItems.length===0" class="sh-empty">无历史</div>
            <template v-else>
              <div class="sh-item" v-for="(s,i) in historyItems" :key="i" @mousedown.prevent.stop="pickHistory(s)">
                <span class="txt">{{ s }}</span>
                <button class="rm" @click.stop="removeHistoryItem(s)" title="删除">×</button>
              </div>
              <div class="sh-actions">
                <button class="btn small" @click.stop="clearSearchHistory">清空历史</button>
              </div>
            </template>
          </div>
        </div>
        <div class="actions">
          <button class="btn" @click="onUpload">上传</button>
          <div class="notif-wrap" @mouseleave="showNotif=false">
            <button class="btn bell" @click="toggleNotif" title="通知">通知
              <span v-if="unread>0" class="badge">{{ unread>99 ? '99+' : unread }}</span>
            </button>
            <NotificationsPanel v-if="showNotif" @close="showNotif=false" @updated="refreshUnread" />
          </div>
          <button class="btn" @click="toggleTheme" :title="`切换为${theme === 'dark' ? '浅色' : '深色'}模式`">
            {{ theme === 'dark' ? '浅色' : '深色' }}模式
          </button>
          <button v-if="!user" class="btn" @click="goLogin">登录</button>
          <UserAvatarPopover v-else :user="user" @open-follow="onOpenFollow" />
        </div>
      </header>

      <section class="content">
        <div v-if="showChild" class="feed"><router-view /></div>
        <div v-else class="feed" ref="feedRef">
          <div class="feed-item" v-for="(item, idx) in items" :key="idx" :ref="setItemRef" :data-idx="idx">
            <div class="player-card">
              <VideoPlayer v-if="item.type === 'video'"
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
                           @request-next="onRequestNext"
                           @request-prev="onRequestPrev"
                           @update-like="onUpdateLike"
                           @update-favorite="onUpdateFavorite"
              />
              <div v-else class="placeholder"><div class="box" /></div>
            </div>
          </div>
        </div>
      </section>
    </main>
    <!-- 登录弹窗 -->
    <LoginModal v-if="showLogin" @close="showLogin=false" @logged-in="onLoggedIn" />
    <!-- 关注/粉丝弹窗 -->
    <FollowDialog :open="followOpen" :initial-tab="followTab" :user-id="uid" @close="followOpen=false"
                  :following-count="user?.following_count || 0" :followers-count="user?.followers_count || 0" />
    <!-- 上传对话框 -->
    <UploadDialog v-if="uploadOpen" @close="uploadOpen=false" @uploaded="onUploaded" />
  </div>
</template>

<script setup>
import LoginModal from '../components/LoginModal.vue'
import VideoPlayer from '../components/VideoPlayer.vue'
import UserAvatarPopover from '../components/UserAvatarPopover.vue'
import FollowDialog from '../components/FollowDialog.vue'
import UploadDialog from '../components/UploadDialog.vue'
import NotificationsPanel from '../components/NotificationsPanel.vue'
import { api } from '@/api'
import { useHomePage } from './HomePage.logic.js'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ref, computed, nextTick, watch, onMounted } from 'vue'

const {
  kw, placeholder, items, displaySrc,
  theme, toggleTheme, logoSrc,
  feedRef, setItemRef, doSearch,
  goTo, currentIndex,
  reloadFeed,
  // 搜索历史相关
  searchRef, showHistory, historyItems, onFocusSearch, onBlurSearch, onSearchMouseDown, pickHistory, removeHistoryItem, clearSearchHistory,
} = useHomePage()

// auth store
const router = useRouter()
const auth = useAuthStore()
const user = computed(() => auth.user)
function goLogin() { /* 沿用现有登录弹窗 */ showLogin.value = true }

// 通知
const showNotif = ref(false)
const unread = ref(0)
function toggleNotif() { showNotif.value = !showNotif.value; if (showNotif.value) refreshUnread() }
async function refreshUnread() { try { const d = await api.notificationsUnreadCount(); unread.value = Number(d?.unread || 0) } catch (_) { /* no-op */ } }
onMounted(() => { refreshUnread(); try { window.addEventListener('auth:sync', refreshUnread) } catch (_) { /* no-op */ } })
function onLoggedIn(me) {
  auth.user = me
  showLogin.value = false
  try { refreshUnread() } catch (_) { /* no-op */ }
  try { reloadFeed() } catch (_) { /* no-op */ }
}
const showLogin = ref(false)
const uploadOpen = ref(false)
function onUpload() {
  if (!user.value) { showLogin.value = true; return }
  uploadOpen.value = true
}
function onUploaded(res) {
  uploadOpen.value = false
  try {
    if (res && res.id) {
      router.push({ name: 'video-edit', params: { id: res.id } })
      return
    }
  } catch (_) { /* no-op */ }
  reloadFeed()
}

// 来自播放器的互动事件：就地更新当前 feed 列表项，避免切页后状态丢失
function onUpdateLike({ videoId, liked, likeCount }) {
  try {
    const i = items.value.findIndex(x => String(x.id) === String(videoId))
    if (i !== -1) {
      const it = items.value[i]
      const next = { ...it, liked: !!liked }
      if (typeof likeCount === 'number') next.likes = likeCount
      items.value[i] = next
    }
  } catch (_) { /* no-op */ }
}
function onUpdateFavorite({ videoId, favorited, favoriteCount }) {
  try {
    const i = items.value.findIndex(x => String(x.id) === String(videoId))
    if (i !== -1) {
      const it = items.value[i]
      const next = { ...it, favorited: !!favorited }
      if (typeof favoriteCount === 'number') next.favorites = favoriteCount
      items.value[i] = next
    }
  } catch (_) { /* no-op */ }
}

// 连播自动切换：自动切换使用 push 入栈，手动切换使用 replace
function onRequestNext(payload) {
  try {
    const auto = !!(payload && payload.auto)
    goTo(currentIndex.value + 1, { push: auto })
  } catch (_) { /* no-op */ }
}
function onRequestPrev() {
  try { goTo(currentIndex.value - 1) } catch (_) { /* no-op */ }
}

// follow dialog
const followOpen = ref(false)
const followTab = ref('following')
const uid = computed(() => user?.value?.id || null)
function onOpenFollow(kind) { followTab.value = kind; followOpen.value = true }

// 当前是否在 /me 子路由下，用于在内容区渲染“我的”组件
const route = useRoute()
const inMe = computed(() => route.path.startsWith('/me'))
const showChild = computed(() => inMe.value
  || route.path.startsWith('/featured')
  || route.path.startsWith('/following')
  || route.path.startsWith('/friends')
  || route.path.startsWith('/about')
  || route.path.startsWith('/terms')
  || route.path.startsWith('/contact')
  || route.path.startsWith('/video')
  || route.path.startsWith('/search')
  || route.path.startsWith('/settings')
)

// 当从子页面返回到推荐流时，重新加载并定位到首条，避免空白
watch(showChild, (v) => {
  if (!v) {
    try { reloadFeed() } catch (_) { /* no-op */ }
    nextTick(() => goTo(0))
  }
})

// 启动默认页偏好：首次进入 '/' 时按偏好跳转
function applyStartTab() {
  try {
    if (route.path !== '/') return
    const pref = localStorage.getItem('home_default_tab') || 'recommend'
    const map = { featured: '/featured', following: '/following', friends: '/friends', recommend: '/' }
    const target = map[pref] || '/'
    if (target !== route.path) router.replace(target).catch(() => {})
  } catch (_) { /* no-op */ }
}
onMounted(() => { applyStartTab() })
</script>

<style>
html, body, #app { height: 100%; overflow: hidden; }
body { margin: 0; background: var(--bg); color: var(--text); }
</style>

<style scoped>
* { box-sizing: border-box; }

.layout {
  display: grid;
  grid-template-columns: var(--sidebar-w) 1fr;
  height: 100vh;
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
}
.sidebar {
  background: var(--bg-elev);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
}
.logo { display:flex; align-items:center; justify-content:center; gap:8px; padding:12px 8px; font-weight:700; text-align:center; }
.logo .dot { color: var(--accent); display:flex; align-items:center; justify-content:center; width: 100%; }
.logo .brand { color: var(--text); letter-spacing:.5px; }
.logo .co { width: 100px; height: 30px; display:block; margin: 0 auto; }
.nav-item { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:10px; margin:2px 4px; color:var(--text); text-decoration:none; cursor:pointer; }
.nav-item:hover { background: var(--hover-bg); }
.nav-item.active, .nav-item.router-link-exact-active { background: var(--active-bg); border:1px solid var(--btn-border); }
.sep { height:8px; }
.sidebar-bottom { margin-top:auto; }
.small { font-size:12px; }
.muted { color: var(--muted); }
.footer-links { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 8px; padding: 8px 6px; }
.footer-link { color: var(--muted); text-decoration:none; font-size:12px; padding:6px 8px; border-radius:8px; display:block; }
.footer-link:hover { background: var(--hover-bg); color: var(--text); }
.footer-link.router-link-active { background: var(--active-bg); border:1px solid var(--btn-border); color: var(--text); }

.main { display:flex; flex-direction:column; height: 100vh; }
.topbar {
  display:grid; align-items:center; gap:16px;
  grid-template-columns: 1fr auto 1fr;
  padding:12px 16px; border-bottom:1px solid var(--border); background: var(--bg-elev);
  flex: 0 0 var(--topbar-h);
}
.search { display:flex; gap:8px; align-items:center; width: clamp(360px, 42vw, 640px); grid-column: 2; margin: 0 auto; }
.search input { flex:1; padding:10px 14px; border:1px solid var(--border); border-radius:999px; background: var(--bg); color: var(--text); outline:none; }
.search button { padding:8px 16px; border-radius:999px; border:1px solid var(--btn-border); background: var(--btn-bg); color: var(--text); cursor:pointer; }
.search { position: relative; }
.shist { position:absolute; top: 44px; left:0; right:0; background: var(--bg-elev); border:1px solid var(--border); border-radius:12px; padding:6px; box-shadow: 0 6px 16px rgba(0,0,0,.12); z-index: 20; }
.sh-item { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 8px; border-radius:8px; cursor:pointer; }
.sh-item:hover { background: var(--hover-bg); }
.sh-item .txt { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color: var(--text); }
.sh-item .rm { background: transparent; border: none; color: var(--muted); cursor: pointer; font-size: 16px; }
.sh-actions { display:flex; justify-content:flex-end; padding:4px 2px 2px; }
.btn.small { padding:4px 8px; font-size:12px; }
.actions { display:flex; align-items:center; gap:12px; grid-column: 3; justify-self: end; white-space: nowrap; }
.btn { background: var(--btn-bg); border:1px solid var(--btn-border); color: var(--text); border-radius:10px; padding:8px 12px; cursor:pointer; }
.notif-wrap{ position: relative; display:inline-block; }
.notif-wrap .badge{ display:inline-block; margin-left:6px; padding:0 6px; border-radius:999px; background: var(--accent); color:#fff; font-size:12px; line-height:18px; height:18px; vertical-align:middle }
.avatar { width:32px; height:32px; background: var(--btn-border); border-radius:50%; }
.avatar-img { width:32px; height:32px; border-radius:50%; object-fit: cover; border:1px solid var(--btn-border); display:block; }
.avatar-fallback { width:32px; height:32px; border-radius:50%; background: var(--btn-border); color: var(--text); display:flex; align-items:center; justify-content:center; font-weight:700; font-size: 14px; }

.content { flex: 1; display:flex; justify-content:center; padding: 0; overflow: hidden; }
.feed { width: 100%; height: 100%; overflow-y: scroll; overflow-x: hidden; scrollbar-gutter: stable both-edges; }
.feed::-webkit-scrollbar { width: 8px; }
.feed::-webkit-scrollbar-thumb { background-color: var(--btn-border); border-radius: 8px; }
.feed-item { height: 100%; padding: 0; display:flex; align-items:center; justify-content:center; }

.player-card {
  background: var(--bg);
  border:1px solid var(--border);
  border-radius:12px;
  margin: 0 auto;
  overflow: hidden;
  /* 充满内容区域 */
  height: 100%;
  max-height: 100%;
  width: 100%;
  max-width: 100%;
  /* 维持内视频按比例显示，由 VideoPlayer 内部 object-fit 控制黑边 */
  aspect-ratio: var(--aspect);
  contain: layout paint;
  transform: translateZ(0);
  isolation: isolate;
}
.media { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }
.loading { text-align:center; }
.spinner { display:flex; gap:12px; justify-content:center; margin-bottom:12px; }
.spinner .dot { width:10px; height:10px; border-radius:50%; display:inline-block; animation:blink 1s infinite alternate; }
.spinner .dot.red { background: var(--danger); }
.spinner .dot.cyan { background: var(--accent); animation-delay:.5s; }
.text { color: var(--muted); }
.placeholder .box { width: 100%; height: 100%; background: var(--bg-elev); border:1px dashed var(--btn-border); border-radius:12px; }

@keyframes blink { from { opacity:.4 } to { opacity:1 } }
</style>

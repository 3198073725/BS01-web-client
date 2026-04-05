<template>
  <div class="overlay" @click.stop>
    <div class="left">
      <div class="author" @click.stop="goAuthor">
        <div class="names">
          <div class="name">@{{ authorName }}</div>
          <div class="time" v-if="publishedAt">{{ timeText }}</div>
        </div>
      </div>
      <div class="title" v-if="title">{{ title }}</div>
      <div class="tags" v-if="tags && tags.length">
        <span class="tag" v-for="(t,i) in tags.slice(0,3)" :key="t.id || i">{{ t.name }}</span>
      </div>
    </div>
    <div class="right">
      <div v-if="canEdit && statusText" class="badge-status">{{ statusText }}</div>
      <div v-if="transcodeError" class="fail-tip">转码失败：{{ transcodeError }}</div>
      <button class="retry-btn" v-if="canRetryTranscode" @click.stop="retryTranscode" :disabled="retryBusy">
        {{ retryBusy ? '重试中…' : '重试转码' }}
      </button>
      <button class="avatar-btn" @click.stop="onAvatarClick" title="作者主页">
        <img v-if="authorAvatar" :src="authorAvatar" class="avatar round" />
        <div v-else class="avatar round fallback">{{ avatarLetter }}</div>
      </button>
      <button class="btn follow" v-if="canFollow && !following" @click.stop="toggleFollow" :disabled="busyFollow" title="关注">关注</button>
      <button class="icon" :class="{ on: liked }" @click.stop="toggleLike" :disabled="busyLike" title="点赞">
        <svg class="svg-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
        <span class="cnt">{{ likeCount }}</span>
      </button>
      <button class="icon" @click.stop="openComments" title="评论">
        <svg class="svg-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span class="cnt">{{ comments }}</span>
      </button>
      <button class="icon" :class="{ on: favorited }" @click.stop="toggleFavorite" :disabled="busyFav" title="收藏">
        <svg class="svg-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
        <span class="cnt">{{ favoriteCount }}</span>
      </button>
      <button class="icon" @click.stop="share" title="分享">
        <svg class="svg-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { api } from '@/api'

const props = defineProps({
  videoId: { type: [String, Number], required: true },
  author: { type: Object, default: () => ({}) },
  title: { type: String, default: '' },
  publishedAt: { type: [String, Date], default: '' },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  favorites: { type: Number, default: 0 },
  // 初始态（父组件可选择传入）
  initialLiked: { type: Boolean, default: false },
  initialFavorited: { type: Boolean, default: false },
})

const emit = defineEmits(['update-like', 'update-favorite', 'share', 'open-comments'])

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()
const user = computed(() => auth.user)

const likeCount = ref(props.likes)
const liked = ref(!!props.initialLiked)
const favorited = ref(!!props.initialFavorited)
const favoriteCount = ref(props.favorites)
const following = ref(false)
const busyFollow = ref(false)
const busyLike = ref(false)
const busyFav = ref(false)
const tags = ref([])
const status = ref('')
const transcodeError = ref('')
const canEdit = ref(false)
const retryBusy = ref(false)


// 若外部未提供 author，自动从视频详情补齐
const authorLoaded = ref(null)
async function ensureAuthor() {
  if (!props.videoId) return
  try {
    const d = await api.videoDetail(props.videoId)
    if (d && d.author) authorLoaded.value = d.author
    if (typeof d?.status === 'string') status.value = d.status
    if (typeof d?.transcode_error === 'string') transcodeError.value = d.transcode_error
    canEdit.value = !!d?.can_edit
    if (typeof d?.liked === 'boolean') liked.value = !!d.liked
    if (typeof d?.favorited === 'boolean') favorited.value = !!d.favorited
    if (typeof d?.like_count === 'number') likeCount.value = d.like_count
    if (typeof d?.favorite_count === 'number') favoriteCount.value = d.favorite_count
    try { tags.value = Array.isArray(d?.tags) ? d.tags : [] } catch (_) { tags.value = [] }
  } catch (_) { /* no-op */ }
}

async function retryTranscode() {
  if (!canRetryTranscode.value || retryBusy.value) return
  if (!user.value) { try { ui.showDialog('请先登录', 'warn') } catch (e) { void e } return }
  retryBusy.value = true
  try {
    await api.retryTranscode(props.videoId)
    try { ui.showDialog('已重新提交转码，稍后刷新状态', 'success') } catch (_) { /* no-op */ }
    status.value = 'processing'
    transcodeError.value = ''
  } catch (e) {
    try { ui.showDialog((e && (e.detail || e.message)) || '重试失败', 'error') } catch (_) { /* no-op */ }
  } finally {
    retryBusy.value = false
  }
}

// 初始化关注状态：用于决定是否显示“关注”按钮
async function ensureFollowStatus() {
  try {
    const aid = curAuthor.value && curAuthor.value.id
    const uid = user.value && user.value.id
    if (!aid || !uid || String(aid) === String(uid)) { following.value = false; return }
    const rel = await api.relationship(aid)
    following.value = !!(rel && rel.following)
  } catch (_) {
    // 未登录或接口不可用时，保持默认未关注
  }
}
watch(() => authorLoaded.value, () => { ensureFollowStatus() })
onMounted(() => { ensureFollowStatus() })
// 登录状态变更后，重新探测关注关系
watch(user, () => { ensureFollowStatus() })
try { onMounted(() => { window.addEventListener('auth:sync', ensureFollowStatus) }) } catch (_) { /* no-op */ }
onBeforeUnmount(() => { try { window.removeEventListener('auth:sync', ensureFollowStatus) } catch (_) { /* no-op */ } })

onMounted(ensureAuthor)
watch(() => props.videoId, ensureAuthor)

const curAuthor = computed(() => {
  const pa = (props.author && typeof props.author === 'object') ? props.author : {}
  const la = (authorLoaded.value && typeof authorLoaded.value === 'object') ? authorLoaded.value : {}
  const id = pa.id || la.id || ''
  const name = pa.name || pa.display_name || pa.displayName || pa.nickname || pa.username || la.name || la.display_name || la.displayName || la.nickname || la.username || ''
  const username = pa.username || la.username || ''
  const avatar = pa.avatar_url || pa.avatar || pa.profile_picture || la.avatar_url || la.avatar || la.profile_picture || ''
  return { id, name, username, avatar_url: avatar }
})

const canFollow = computed(() => {
  const uid = user.value && user.value.id
  const aid = curAuthor.value && curAuthor.value.id
  if (!uid || !aid) return false
  return String(uid) !== String(aid)
})
const canRetryTranscode = computed(() => {
  if (!canEdit.value) return false
  const s = (status.value || '').toLowerCase()
  return s === 'processing' || s === 'banned' || !!transcodeError.value
})
const statusText = computed(() => {
  const s = (status.value || '').toLowerCase()
  const map = { published: '已发布', processing: '转码中', draft: '草稿', banned: '转码失败' }
  return map[s] || status.value || ''
})

// 名称与头像的回退处理，避免出现“@用户”或头像不显示
const authorAvatar = computed(() => {
  const a = curAuthor.value || {}
  const u = a.avatar_url || a.avatar || a.profile_picture || ''
  if (!u) return ''
  if (typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://'))) return u
  try {
    const base = (api.getBase && api.getBase()) ? api.getBase().replace(/\/$/, '') : ''
    if (!base) return u
    return u.startsWith('/') ? `${base}${u}` : `${base}/${u}`
  } catch (_) { return u }
})
const authorName = computed(() => {
  const a = curAuthor.value || {}
  const n = a.name || a.username || a.display_name || a.displayName || a.nickname || ''
  return (n && String(n).trim()) || '用户'
})
const avatarLetter = computed(() => (String(authorName.value).trim().charAt(0) || '@').toUpperCase())

function since(date) {
  try { const d = new Date(date); const s = (Date.now() - d.getTime())/1000; if (s < 60) return `${Math.floor(s)}秒前`; if (s < 3600) return `${Math.floor(s/60)}分钟前`; if (s < 86400) return `${Math.floor(s/3600)}小时前`; return `${Math.floor(s/86400)}天前`; } catch { return '' }
}
const timeText = computed(() => props.publishedAt ? since(props.publishedAt) : '')

async function toggleLike() {
  if (!user.value) { try { ui.showDialog('请先登录', 'warn') } catch (e) { void e } return }
  if (busyLike.value) return; busyLike.value = true
  try {
    const res = await api.requestLikeToggle?.(props.videoId)
    if (res && typeof res.like_count === 'number') likeCount.value = res.like_count
    if (res && typeof res.liked === 'boolean') liked.value = !!res.liked
    emit('update-like', { videoId: props.videoId, liked: liked.value, likeCount: likeCount.value })
  } catch (e) { /* no-op */ }
  finally { busyLike.value = false }
}
async function toggleFavorite() {
  if (!user.value) { try { ui.showDialog('请先登录', 'warn') } catch (e) { void e } return }
  if (busyFav.value) return; busyFav.value = true
  try {
    const res = await api.requestFavoriteToggle?.(props.videoId)
    if (res && typeof res.favorited === 'boolean') favorited.value = !!res.favorited
    if (res && typeof res.favorite_count === 'number') favoriteCount.value = res.favorite_count
    emit('update-favorite', { videoId: props.videoId, favorited: favorited.value, favoriteCount: favoriteCount.value })
  } catch (e) { /* no-op */ }
  finally { busyFav.value = false }
}
async function toggleFollow() {
  if (!user.value) { try { ui.showDialog('请先登录', 'warn') } catch (e) { void e } return }
  if (busyFollow.value) return; busyFollow.value = true
  try {
    const aid = curAuthor.value && curAuthor.value.id
    if (!aid) return
    if (following.value) await api.unfollow(aid)
    else await api.follow(aid)
    following.value = !following.value
  } catch (e) { /* no-op */ }
  finally { busyFollow.value = false }
}
function onAvatarClick() { goAuthor() }
function goAuthor() {
  try {
    const aid = curAuthor.value && curAuthor.value.id
    if (!aid) return
    router.push({ name: 'me-works', query: { user_id: String(aid) } })
  } catch (_) { /* no-op */ }
}
function openComments() { try { emit('open-comments', { videoId: props.videoId }) } catch (_) { /* no-op */ } }
function share() {
  // 统一交由父组件弹出分享弹窗，避免因浏览器权限/HTTPS 限制导致无响应
  try { emit('share', { videoId: props.videoId }) } catch (_) { /* no-op */ }
}
</script>

<style scoped>
.overlay{position:absolute;inset:0;pointer-events:none;z-index:3}
.left{position:absolute;left:16px;bottom:50px;display:flex;flex-direction:column;gap:8px;max-width:40%;pointer-events:auto}
.right{position:absolute;right:16px;bottom:130px;top:auto;transform:none;display:flex;flex-direction:column;gap:24px;align-items:center;pointer-events:auto}
.retry-btn{background:rgba(0,0,0,.55);color:#fff;border:1px solid rgba(255,255,255,.35);padding:8px 12px;border-radius:10px;cursor:pointer}
.badge-status{background:rgba(0,0,0,.35);color:#fff;padding:4px 8px;border-radius:999px;font-size:12px;margin-top:4px}
.author{display:flex;align-items:center;gap:10px;background:rgba(0,0,0,.35);color:#fff;padding:6px 8px;border-radius:999px}
.avatar{width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,.35)}
.avatar.round{width:48px;height:48px}
.avatar-btn{background:rgba(0,0,0,.35);border:none;border-radius:50%;width:56px;height:56px;display:flex;align-items:center;justify-content:center;cursor:pointer}
.avatar.fallback{display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.2);color:#111;font-weight:700}
.avatar.fallback.small{width:36px;height:36px;border-radius:50%;font-size:14px}
.names{display:flex;flex-direction:column;gap:2px}
.name{font-weight:700;font-size:14px}
.time{font-size:12px;opacity:.9}
.title{background:rgba(0,0,0,.35);color:#fff;padding:6px 10px;border-radius:8px;max-width:100%;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;line-clamp:2;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
.tag{font-size:12px;color:#f3f4f6;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:2px 8px}
.icon{background:rgba(0,0,0,.35);border:none;color:#fff;border-radius:12px;width:48px;height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;gap:2px}
.icon .svg-icon{width:22px;height:22px}
.icon .cnt{font-size:12px;line-height:1}
.btn.follow{margin-left:6px;background:#ff2e63;border:none;color:#fff;border-radius:999px;padding:6px 10px;cursor:pointer}
</style>

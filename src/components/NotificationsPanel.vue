<template>
  <div ref="root" class="notif" @click.stop @mouseleave="scheduleClose" @mouseenter="cancelClose">
    <div class="head">
      <div class="ttl">通知</div>
      <div class="ops">
        <button class="link" @click="clearAll" :disabled="busy">清空</button>
        <button class="link" @click="markAllRead" :disabled="busy">全部标记为已读</button>
        <button class="close" @click="$emit('close')">×</button>
      </div>
    </div>
    <div class="body">
      <div v-if="loading" class="loading">加载中…</div>
      <div v-else-if="err" class="error">{{ err.detail || '加载失败' }}</div>
      <div v-else>
        <div v-if="items.length===0" class="empty">暂无通知</div>
        <div v-for="n in items" :key="n.id" class="item" :class="{ unread: !n.read }">
          <div class="avatarbox">
            <img v-if="avatarUrl(n.actor) && !n._badAvatar" :src="avatarUrl(n.actor)" class="avatar" @error="n._badAvatar = true" />
            <div v-else class="avatar fallback">{{ userName(n.actor).charAt(0).toUpperCase() }}</div>
          </div>
          <div class="content">
            <div class="line">
              <span class="user">{{ userName(n.actor) }}</span>
              <span class="verb">{{ verbText(n) }}</span>
              <span v-if="n.video" class="video">《{{ n.video.title }}》</span>
            </div>
            <div v-if="n.comment && n.comment.content" class="excerpt">“{{ n.comment.content }}”</div>
            <div class="meta">
              <span class="time">{{ since(n.created_at) }}</span>
              <button v-if="!n.read" class="link" :disabled="busy" @click="markRead(n)">标记已读</button>
            </div>
          </div>
        </div>
        <div v-if="hasNext" class="more"><button class="btn" :disabled="loading" @click="loadMore">加载更多</button></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { api } from '@/api'

const emit = defineEmits(['close', 'updated'])

const root = ref(null)
let hideTimer = null
const items = ref([])
const page = ref(1)
const hasNext = ref(false)
const loading = ref(false)
const err = ref(null)
const busy = ref(false)

function userName(u) {
  try { return (u?.display_name || u?.username || '用户') } catch { return '用户' }
}
function avatarUrl(u) {
  try {
    const raw0 = (u?.avatar_url || u?.avatar || u?.profile_picture || '')
    const raw = typeof raw0 === 'string' ? raw0.trim() : ''
    if (!raw) return ''
    if (/^(null|none|undefined)$/i.test(raw)) return ''
    if (/^https?:\/\//i.test(raw)) return raw
    const base = (api.getBase && api.getBase()) ? api.getBase().replace(/\/$/, '') : ''
    if (!base) return raw
    let path = raw.startsWith('/') ? raw : `/${raw}`
    if (!/^\/media\//.test(path)) path = `/media${path}`
    return `${base}${path}`
  } catch { return '' }
}
function since(date) {
  try { const d = new Date(date); const s = (Date.now() - d.getTime())/1000; if (s < 60) return `${Math.floor(s)}秒前`; if (s < 3600) return `${Math.floor(s/60)}分钟前`; if (s < 86400) return `${Math.floor(s/3600)}小时前`; return `${Math.floor(s/86400)}天前`; } catch { return '' }
}
function verbText(n) {
  const v = (n?.verb || '').toLowerCase()
  if (v === 'follow') return '关注了你'
  if (v === 'like') return '点赞了你的作品'
  if (v === 'favorite') return '收藏了你的作品'
  if (v === 'comment') return '评论了你的作品'
  if (v === 'reply') return '回复了你的评论'
  return v
}

async function fetchList(p = 1) {
  if (loading.value) return
  loading.value = true; err.value = null
  try {
    const data = await api.notificationsList({ page: p, pageSize: 20 })
    const rows = Array.isArray(data?.results) ? data.results : []
    items.value = (p === 1) ? rows : items.value.concat(rows)
    page.value = Number(data?.page || p || 1)
    hasNext.value = !!(data?.has_next ?? data?.hasNext)
  } catch (e) { err.value = e }
  finally { loading.value = false }
}
function loadMore() { if (hasNext.value) fetchList(page.value + 1) }

async function markRead(n) {
  if (!n || n.read) return
  busy.value = true
  try { await api.notificationsMarkRead([n.id]); n.read = true; emit('updated') } catch (_) { /* no-op */ }
  finally { busy.value = false }
}
async function markAllRead() {
  busy.value = true
  try { await api.notificationsMarkAllRead(); items.value.forEach(i => i.read = true); emit('updated') } catch (_) { /* no-op */ }
  finally { busy.value = false }
}
async function clearAll() {
  busy.value = true
  try { await api.notificationsClear(); items.value = []; page.value = 1; hasNext.value = false; emit('updated') } catch (_) { /* no-op */ }
  finally { busy.value = false }
}

onMounted(() => { fetchList(1) })

function onDocDown(e) {
  try { if (root.value && !root.value.contains(e.target)) emit('close') } catch (_) { /* no-op */ }
}
onMounted(() => { document.addEventListener('mousedown', onDocDown, true) })
onBeforeUnmount(() => { try { document.removeEventListener('mousedown', onDocDown, true); if (hideTimer) { clearTimeout(hideTimer); hideTimer = null } } catch (_) { /* no-op */ } })

function scheduleClose() { try { if (hideTimer) clearTimeout(hideTimer); hideTimer = setTimeout(() => emit('close'), 500) } catch (_) { /* no-op */ } }
function cancelClose() { try { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null } } catch (_) { /* no-op */ } }

// 暴露方法给父组件
function reload() { fetchList(1) }
defineExpose({ reload })
</script>

<style scoped>
.notif{position:absolute;top:calc(100% + 0px);right:-50px;width:400px;max-height:60vh;display:flex;flex-direction:column;background:var(--bg-elev);border:1px solid var(--border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.25);overflow:hidden;z-index:20}
.head{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid var(--border)}
.ttl{font-weight:800}
.ops{display:flex;align-items:center;gap:8px}
.close{background:transparent;border:none;color:var(--text);font-size:18px;cursor:pointer}
.body{overflow:auto}
.item{display:flex;gap:10px;padding:10px;border-bottom:1px solid var(--border)}
.item.unread{background:var(--bg)}
.avatarbox{flex:0 0 36px}
.avatar{width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid var(--btn-border)}
.avatar.fallback{display:flex;align-items:center;justify-content:center;background:var(--btn-border);color:var(--text);font-weight:800;border-radius:50%;width:36px;height:36px}
.content{flex:1;min-width:0;text-align:left}
.user{font-weight:800;color:var(--text)}
.verb{margin-left:6px}
.video{margin-left:4px;color:var(--muted)}
.excerpt{margin-top:4px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.meta{display:flex;align-items:center;gap:10px;margin-top:6px;color:var(--muted);font-size:12px}
.link{background:transparent;border:none;color:var(--accent);cursor:pointer;padding:0}
.loading,.error,.empty{text-align:center;color:var(--muted);padding:12px}
.more{padding:8px}
.btn{background:var(--btn-bg);border:1px solid var(--btn-border);color:var(--text);border-radius:8px;padding:6px 10px;cursor:pointer}
</style>

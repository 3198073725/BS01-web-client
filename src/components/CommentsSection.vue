<template>
  <div class="comments">
    <!-- composer moved to bottom -->

    <div class="header" v-if="total>0">共 {{ total }} 条评论</div>
    <div class="list">
      <div v-for="c in items" :key="c.id" class="item">
        <div class="row">
          <div class="avatarbox">
            <img v-if="avatarUrl(c.user)" :src="avatarUrl(c.user)" class="avatar" />
            <div v-else class="avatar fallback">{{ userName(c.user).charAt(0).toUpperCase() }}</div>
          </div>
          <div class="contentbox">
            <div class="meta">
              <div class="user">{{ userName(c.user) }}</div>
              <div class="time">{{ since(c.created_at) }}</div>
              <button v-if="canDelete(c)" class="link" @click="remove(c)">删除</button>
            </div>
            <div class="bubble" @click="activateReply(c)">{{ c.content }}</div>
            <div class="actions">
              <button class="link" @click="activateReply(c)">回复</button>
              <button v-if="c.replies_count>0 && !c._showReplies" class="link" @click="openReplies(c)">展开 {{ c.replies_count }} 条回复</button>
              <button v-if="c._showReplies" class="link" @click="collapseReplies(c)">收起回复</button>
            </div>
            <div v-if="c._showReplies" class="replies">
              <div v-if="c._replying" class="write small">
                <input v-model.trim="c._replyText" :placeholder="'回复 ' + userName(c.user)" @keydown.enter.exact.prevent="submitReplyTo(c, c)" />
                <button class="btn" :disabled="busy || !c._replyText || !user" @click="submitReplyTo(c, c)">回复</button>
              </div>
              <div v-for="r in (c._replies || [])" :key="r.id" class="reply">
                <div class="row">
                  <div class="avatarbox">
                    <img v-if="avatarUrl(r.user)" :src="avatarUrl(r.user)" class="avatar small" />
                    <div v-else class="avatar small fallback">{{ userName(r.user).charAt(0).toUpperCase() }}</div>
                  </div>
                  <div class="contentbox">
                    <div class="meta">
                      <div class="user">{{ userName(r.user) }}</div>
                      <div class="replyto">回复 {{ replyToName(r, c) }}</div>
                      <div class="time">{{ since(r.created_at) }}</div>
                      <button v-if="canDelete(r)" class="link" @click="remove(r, c)">删除</button>
                    </div>
                    <div class="bubble light">{{ r.content }}</div>
                    <div class="actions">
                      <button class="link" @click="activateReplyTo(r, c)">回复</button>
                    </div>
                    <div v-if="r._replying" class="write small">
                      <input v-model.trim="r._replyText" :placeholder="'回复 ' + replyToName(r, c)" @keydown.enter.exact.prevent="submitReplyTo(r, c)" />
                      <button class="btn" :disabled="busy || !r._replyText || !user" @click="submitReplyTo(r, c)">回复</button>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="c._repliesHasNext" class="more"><button class="link" @click="loadMoreReplies(c)">更多回复</button></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!loading && !err && items.length===0" class="empty">还没有评论，来当第一个吧～</div>

    <div v-if="hasNext" class="more"><button class="btn" :disabled="loading" @click="loadMore">加载更多</button></div>
    <div v-if="loading" class="loading">加载中…</div>
    <div v-if="err" class="error small">{{ err.detail || '加载失败' }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/api'

const props = defineProps({
  videoId: { type: [String, Number], required: true },
})

const auth = useAuthStore()
const user = computed(() => auth.user)

const items = ref([])
const page = ref(1)
const hasNext = ref(false)
const loading = ref(false)
const err = ref(null)
const total = ref(0)

const busy = ref(false)

function userName(u) {
  try { return (u?.display_name || u?.username || '用户') } catch { return '用户' }
}
function avatarUrl(u) {
  try {
    const raw = (u?.avatar_url || u?.avatar || u?.profile_picture || '').trim()
    if (!raw) return ''
    if (/^https?:\/\//i.test(raw)) return raw
    const base = (api.getBase && api.getBase()) ? api.getBase().replace(/\/$/, '') : ''
    return base ? (raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`) : raw
  } catch { return '' }
}
function since(date) {
  try { const d = new Date(date); const s = (Date.now() - d.getTime())/1000; if (s < 60) return `${Math.floor(s)}秒前`; if (s < 3600) return `${Math.floor(s/60)}分钟前`; if (s < 86400) return `${Math.floor(s/3600)}小时前`; return `${Math.floor(s/86400)}天前`; } catch { return '' }
}

async function fetchList(p = 1) {
  if (loading.value) return
  loading.value = true; err.value = null
  try {
    const res = await api.commentsList({ videoId: String(props.videoId), page: p, pageSize: 10 })
    const rows = Array.isArray(res?.results) ? res.results : []
    items.value = (p === 1) ? rows : items.value.concat(rows)
    page.value = Number(res?.page || p || 1)
    hasNext.value = !!(res?.has_next ?? res?.hasNext)
    total.value = Number(res?.total || (items.value?.length || 0))
  } catch (e) {
    try { if (Number(e?.status) === 404) { items.value = []; total.value = 0; hasNext.value = false; err.value = null; return } } catch (_) { /* no-op */ }
    err.value = e
  }
  finally { loading.value = false }
}

function loadMore() { if (hasNext.value) fetchList(page.value + 1) }

// 评论创建逻辑已迁移至父组件（评论抽屉底部输入区）

function canDelete(c) { try { return !!(user.value && c && c.user && String(user.value.id) === String(c.user.id)) } catch { return false } }

async function remove(c, parent = null) {
  if (!c || !c.id) return
  try { await api.commentDelete(c.id) } catch { return }
  if (parent) {
    parent._replies = (parent._replies || []).filter(x => String(x.id) !== String(c.id))
  } else {
    items.value = items.value.filter(x => String(x.id) !== String(c.id))
  }
}

function activateReply(c) {
  c._showReplies = true
  c._replying = true
  if (!Array.isArray(c._replies) || c._replies.length === 0) openReplies(c)
}

function collapseReplies(c) {
  c._showReplies = false
  c._replying = false
}

function activateReplyTo(r, root) {
  try {
    root._showReplies = true
    r._replying = true
  } catch (_) { /* no-op */ }
}

async function openReplies(c) {
  c._showReplies = true
  if (Array.isArray(c._replies) && c._replies.length) return
  await loadReplies(c, 1)
}

async function loadReplies(c, p = 1) {
  try {
    const res = await api.commentsReplies({ parentId: c.id, page: p, pageSize: 10 })
    const rows = Array.isArray(res?.results) ? res.results : []
    c._replies = (p === 1) ? rows : (c._replies || []).concat(rows)
    c._repliesPage = Number(res?.page || p || 1)
    c._repliesHasNext = !!(res?.has_next ?? res?.hasNext)
  } catch { /* no-op */ }
}

function loadMoreReplies(c) { if (c._repliesHasNext) loadReplies(c, (c._repliesPage || 1) + 1) }

async function submitReplyTo(parent, root) {
  if (!user.value) { try { alert('请先登录'); } catch (e) { void e } return }
  const content = String(parent._replyText || '').trim(); if (!content) return
  if (busy.value) return; busy.value = true
  try {
    const r = await api.commentCreate({ videoId: String(props.videoId), content, parentId: parent.id })
    // 插入到根评论下的列表，便于连续阅读；服务端仅返回本条的 parent id
    root._replies = [r, ...(root._replies || [])]
    parent._replyText = ''
    parent._replying = false
  } catch (e) { /* no-op */ }
  finally { busy.value = false }
}

function replyToName(r, root) {
  try {
    if (String(r.parent) === String(root.id)) return userName(root.user)
    const p = (root._replies || []).find(x => String(x.id) === String(r.parent))
    return p ? userName(p.user) : userName(root.user)
  } catch (_) { return '用户' }
}

onMounted(() => { fetchList(1) })

// 供父组件调用：插入新评论到顶部 / 重新加载
function prepend(c) {
  try {
    items.value.unshift({ ...c, _showReplies: false, _replying: false, _replies: [], _repliesPage: 1, _repliesHasNext: false, _replyText: '' })
    total.value = Number(total.value || 0) + 1
  } catch (_) { /* no-op */ }
}
function reload() { fetchList(1) }
defineExpose({ prepend, reload })
</script>

<style scoped>
.comments{margin-top:8px;color:var(--text);display:flex;flex-direction:column;gap:12px}
.write{display:flex;gap:10px;align-items:center;background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:10px}
.write input{flex:1;height:40px;padding:0 12px;border:1px solid var(--btn-border);border-radius:10px;background:var(--bg-elev);color:var(--text)}
.write.small{margin-top:8px;background:transparent;border:none;padding:0}
.write.small input{flex:1;padding:8px 10px;border:1px solid var(--btn-border);border-radius:999px;background:var(--bg);color:var(--text)}
.btn{background:var(--btn-bg);border:1px solid var(--btn-border);color:var(--text);border-radius:10px;padding:8px 12px;cursor:pointer;height:40px}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn:disabled{opacity:.6;cursor:not-allowed}
.header{font-size:12px;color:var(--muted);padding:0 4px}
.list{display:flex;flex-direction:column;gap:12px}
.item{border:1px solid var(--border);border-radius:12px;padding:12px;background:var(--bg-elev);box-shadow:0 1px 2px rgba(0,0,0,.05)}
.row{display:flex;gap:10px}
.avatarbox{flex:0 0 40px}
.avatar{width:40px;height:40px;border-radius:50%;object-fit:cover;border:1px solid var(--btn-border);display:block}
.avatar.small{width:32px;height:32px}
.avatar.fallback{display:flex;align-items:center;justify-content:center;background:var(--btn-border);color:var(--text);font-weight:800}
.contentbox{flex:1;min-width:0;text-align:left}
.meta{display:flex;gap:8px;align-items:center;color:var(--muted);font-size:12px}
.user{font-weight:800;color:var(--text)}
.bubble{margin-top:6px;white-space:pre-wrap;background:var(--bg);border:1px solid var(--btn-border);border-radius:12px;padding:10px;color:var(--text);text-align:left}
.bubble.light{background:var(--bg-elev)}
.actions{display:flex;gap:12px;align-items:center;margin-top:6px}
.link{background:transparent;border:none;color:var(--accent);cursor:pointer;padding:0}
.replies{margin-top:10px;padding-left:10px;border-left:2px solid var(--border);display:flex;flex-direction:column;gap:12px}
.reply{padding:4px 0}
.more{margin-top:6px}
.loading{color:var(--muted);margin-top:6px;text-align:center}
.empty{color:var(--muted);text-align:center;padding:12px}
.error{color:var(--danger);margin-top:6px;text-align:center}
</style>

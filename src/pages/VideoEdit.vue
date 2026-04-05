<template>
  <div class="video-edit">
    <h1 class="title">编辑媒体</h1>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="err" class="error">{{ err.detail || '加载失败' }}</div>
    <div v-else class="card">
      <div class="left">
        <video v-if="detail.video_url" :src="detail.video_url" :poster="detail.thumbnail_url || undefined" controls class="preview"></video>
      </div>
      <div class="right">
        <label class="lab">标题</label>
        <input v-model.trim="title" type="text" maxlength="200" placeholder="输入标题" />

        <label class="lab">描述</label>
        <textarea v-model.trim="description" rows="5" maxlength="500" placeholder="输入描述（可选）"></textarea>

        <label class="lab">允许评论</label>
        <select v-model="allowComments">
          <option :value="true">启用</option>
          <option :value="false">禁用</option>
        </select>

        <label class="lab">允许下载</label>
        <select v-model="allowDownload">
          <option :value="false">禁用</option>
          <option :value="true">启用</option>
        </select>

        <label class="lab">可见性</label>
        <select v-model="visibility">
          <option value="public">公开</option>
          <option value="unlisted">未列出</option>
          <option value="private">私密</option>
        </select>

        <label class="lab">分类</label>
        <select v-model="categoryId">
          <option value="">未选择</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>

        <label class="lab">标签</label>
        <div class="tag-editor">
          <div class="tag-list">
            <span class="tag-chip" v-for="t in selectedTags" :key="t.id">
              {{ t.name }}
              <button class="x" @click="removeTag(t)">×</button>
            </span>
          </div>
          <input
            v-model.trim="tagInput"
            type="text"
            placeholder="输入以搜索标签，回车新增"
            @input="onTagInput"
            @keydown.enter.prevent="onTagEnter"
            :disabled="selectedTags.length >= 3"
          />
          <ul v-if="showTagSuggest && tagOptions.length" class="tag-suggest">
            <li v-for="opt in tagOptions" :key="opt.id" @click="addTag(opt)">{{ opt.name }}</li>
          </ul>
          <div class="tag-hint">最多选择 3 个标签</div>
        </div>

        <label class="lab">封面</label>
        <div class="cover-tools">
          <div class="row">
            <input class="ts" v-model.trim="thumbTs" type="number" min="0" step="1" placeholder="时间点(秒)" />
            <button class="btn" :disabled="thumbPicking" @click="pickThumb">{{ thumbPicking ? '生成中...' : '从视频截取' }}</button>
          </div>
          <div class="row">
            <input type="file" accept="image/png,image/jpeg,image/webp" @change="onCoverFileChange" />
          </div>
          <div class="hint">建议 16:9 比例，至少 480×270 像素</div>
          <div v-if="coverMsg" class="ok">{{ coverMsg }}</div>
        </div>

        <div class="actions">
          <button class="btn" @click="goPreview">预览</button>
          <button class="btn primary" :disabled="saving" @click="save">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
        <div v-if="msg" class="ok">{{ msg }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api'

const route = useRoute()
const router = useRouter()
const vid = computed(() => String(route.params.id || ''))

const loading = ref(true)
const saving = ref(false)
const err = ref(null)
const msg = ref('')
const detail = ref({})
const title = ref('')
const description = ref('')
const allowComments = ref(true)
const allowDownload = ref(false)
const visibility = ref('public')
const categoryId = ref('')
const categories = ref([])
const selectedTags = ref([]) // [{id,name}]
const tagInput = ref('')
const tagOptions = ref([])
const showTagSuggest = ref(false)
let tagTimer = null
const thumbTs = ref('')
const thumbPicking = ref(false)
const coverMsg = ref('')

async function load() {
  loading.value = true
  err.value = null
  try {
    const d = await api.videoDetail(vid.value)
    detail.value = d || {}
    title.value = d?.title || ''
    description.value = d?.description || ''
    allowComments.value = (d?.allow_comments !== undefined) ? !!d.allow_comments : true
    allowDownload.value = (d?.allow_download !== undefined) ? !!d.allow_download : false
    visibility.value = (typeof d?.visibility === 'string' && d.visibility) ? d.visibility : 'public'
    categoryId.value = (d?.category && d.category.id) ? String(d.category.id) : ''
    selectedTags.value = Array.isArray(d?.tags) ? d.tags.map(t => ({ id: String(t.id), name: t.name })) : []
  } catch (e) {
    err.value = e
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  try {
    const r = await api.contentCategories({ pageSize: 100 })
    categories.value = Array.isArray(r?.results) ? r.results : []
  } catch { categories.value = [] }
}

function onTagInput() {
  const q = tagInput.value
  if (selectedTags.value.length >= 3) { showTagSuggest.value = false; tagOptions.value = []; return }
  if (tagTimer) clearTimeout(tagTimer)
  tagTimer = setTimeout(async () => {
    if (!q) { tagOptions.value = []; showTagSuggest.value = false; return }
    try {
      const r = await api.contentTags({ q, pageSize: 10 })
      const opts = Array.isArray(r?.results) ? r.results : []
      // 过滤掉已选择的
      const chosen = new Set(selectedTags.value.map(t => t.id))
      tagOptions.value = opts.filter(o => !chosen.has(String(o.id))).map(o => ({ id: String(o.id), name: o.name }))
      showTagSuggest.value = tagOptions.value.length > 0
    } catch { showTagSuggest.value = false; tagOptions.value = [] }
  }, 200)
}

function addTag(opt) {
  if (selectedTags.value.length >= 3) return
  const exists = selectedTags.value.some(t => t.id === String(opt.id))
  if (!exists) selectedTags.value.push({ id: String(opt.id), name: opt.name })
  tagInput.value = ''
  tagOptions.value = []
  showTagSuggest.value = false
}

function removeTag(t) {
  selectedTags.value = selectedTags.value.filter(x => x.id !== t.id)
}

function onTagEnter() {
  const name = tagInput.value.trim()
  if (!name || selectedTags.value.length >= 3) return
  if (tagOptions.value.length) { addTag(tagOptions.value[0]); return }
  // 无候选则创建新标签
  (async () => {
    try {
      const t = await api.contentTagCreate(name)
      if (t && t.id) addTag({ id: String(t.id), name: t.name })
    } catch (_) { /* ignore */ }
  })()
}

async function pickThumb() {
  coverMsg.value = ''
  const ts = Math.max(0, Number(thumbTs.value || 0))
  try {
    thumbPicking.value = true
    const r = await api.videoThumbnailPick(vid.value, ts)
    if (r && r.thumbnail_url) {
      detail.value.thumbnail_url = r.thumbnail_url
      coverMsg.value = '封面已更新'
    }
  } catch (e) {
    err.value = e
  } finally { thumbPicking.value = false }
}

async function onCoverFileChange(ev) {
  coverMsg.value = ''
  try {
    const file = ev && ev.target && ev.target.files && ev.target.files[0]
    if (!file) return
    const r = await api.videoThumbnailUpload(vid.value, file)
    if (r && r.thumbnail_url) {
      detail.value.thumbnail_url = r.thumbnail_url
      coverMsg.value = '封面已更新'
    }
    // reset input
    try { ev.target.value = '' } catch (_) { /* no-op */ }
  } catch (e) {
    err.value = e
  }
}

async function save() {
  saving.value = true
  msg.value = ''
  try {
    await api.videoUpdate(vid.value, {
      title: title.value,
      description: description.value,
      allow_comments: !!allowComments.value,
      allow_download: !!allowDownload.value,
      visibility: visibility.value,
      category_id: categoryId.value || '',
      tag_ids: selectedTags.value.map(t => t.id),
    })
    // 保存成功后返回推荐页
    router.push('/')
    return
  } catch (e) {
    err.value = e
  } finally {
    saving.value = false
  }
}

function goPreview() {
  // 使用 FeedPlayer 样式预览，与历史/喜欢/收藏一致
  router.push({ name: 'feed-player', params: { source: 'preview' }, query: { id: vid.value } })
}

onMounted(load)
onMounted(loadCategories)
</script>

<style scoped>
.video-edit { max-width: 980px; margin: 16px auto; padding: 0 12px; color: var(--text); }
.title { font-size: 20px; font-weight: 800; margin: 8px 0 16px; text-align: center; }
.card { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; border: 1px solid var(--border); background: var(--bg-elev); border-radius: 12px; padding: 12px; }
.preview { width: 100%; border-radius: 8px; background: #000; }
.right { display: flex; flex-direction: column; gap: 8px; }
.lab { font-size: 13px; color: var(--muted); }
input, textarea, select { padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); outline: none; }
input[type="file"] { padding: 8px 10px; width: 100%; max-width: 100%; box-sizing: border-box; }
input[type="file"]::-webkit-file-upload-button { background: var(--btn-bg); border: 1px solid var(--btn-border); color: var(--text); border-radius: 6px; padding: 6px 12px; cursor: pointer; margin-right: 10px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px; }
.btn { background: var(--btn-bg); border: 1px solid var(--btn-border); color: var(--text); border-radius: 10px; padding: 8px 14px; cursor: pointer; }
.btn.primary { background: var(--accent-bg, #2563eb); border-color: transparent; color: #fff; }
.ok { color: var(--accent, #2563eb); font-size: 12px; }
.loading { color: var(--muted); }
.error { color: var(--danger); }
@media (max-width: 860px) { .card { grid-template-columns: 1fr; } }

.tag-editor { position: relative; display: flex; flex-direction: column; gap: 8px; }
.tag-list { display: flex; gap: 6px; flex-wrap: wrap; }
.tag-chip { display: inline-flex; align-items: center; gap: 6px; background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 2px 8px; font-size: 12px; }
.tag-chip .x { background: transparent; border: none; cursor: pointer; color: var(--muted); }
.tag-suggest { position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-elev); border: 1px solid var(--border); border-radius: 8px; margin-top: 4px; list-style: none; padding: 4px; z-index: 10; max-height: 180px; overflow: auto; }
.tag-suggest li { padding: 6px 8px; cursor: pointer; }
.tag-suggest li:hover { background: rgba(0,0,0,0.05); }
.tag-hint { color: var(--muted); font-size: 12px; }

.cover-tools { display:flex; flex-direction:column; gap:8px; }
.cover-tools .row { display:flex; gap:8px; align-items:center; }
.cover-tools .ts { width: 120px; }
.cover-tools .ts::-webkit-outer-spin-button,
.cover-tools .ts::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.cover-tools .ts[type=number] { -moz-appearance: textfield; appearance: textfield; }
.cover-tools .hint { color: var(--muted); font-size:12px; }
</style>

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

async function load() {
  loading.value = true
  err.value = null
  try {
    const d = await api.videoDetail(vid.value)
    detail.value = d || {}
    title.value = d?.title || ''
    description.value = d?.description || ''
  } catch (e) {
    err.value = e
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  msg.value = ''
  try {
    await api.videoUpdate(vid.value, { title: title.value, description: description.value })
    msg.value = '已保存'
    // 重新加载以同步服务端
    await load()
  } catch (e) {
    err.value = e
  } finally {
    saving.value = false
  }
}

function goPreview() {
  router.push({ name: 'video', params: { id: vid.value } })
}

onMounted(load)
</script>

<style scoped>
.video-edit { max-width: 980px; margin: 16px auto; padding: 0 12px; color: var(--text); }
.title { font-size: 20px; font-weight: 800; margin: 8px 0 16px; text-align: center; }
.card { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; border: 1px solid var(--border); background: var(--bg-elev); border-radius: 12px; padding: 12px; }
.preview { width: 100%; border-radius: 8px; background: #000; }
.right { display: flex; flex-direction: column; gap: 8px; }
.lab { font-size: 13px; color: var(--muted); }
input, textarea { padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); outline: none; }
.actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px; }
.btn { background: var(--btn-bg); border: 1px solid var(--btn-border); color: var(--text); border-radius: 10px; padding: 8px 14px; cursor: pointer; }
.btn.primary { background: var(--accent-bg, #2563eb); border-color: transparent; color: #fff; }
.ok { color: var(--accent, #2563eb); font-size: 12px; }
.loading { color: var(--muted); }
.error { color: var(--danger); }
@media (max-width: 860px) { .card { grid-template-columns: 1fr; } }
</style>

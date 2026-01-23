<template>
  <div class="overlay" @click.self="onClose">
    <div class="panel">
      <h2 class="title">上传视频</h2>
      <form @submit.prevent="onSubmit">
        <div class="row">
          <label>选择文件</label>
          <input type="file" accept="video/*" @change="onPick" />
          <div v-if="file" class="hint">{{ file.name }}（{{ prettySize(file.size) }}）</div>
        </div>
        <div class="row">
          <label>标题</label>
          <input v-model.trim="title" type="text" maxlength="200" placeholder="可选，不填默认文件名" />
        </div>
        <div class="row">
          <label>描述</label>
          <textarea v-model.trim="description" rows="3" maxlength="500" placeholder="可选"></textarea>
        </div>
        <div v-if="loading" class="row">
          <div class="progress">
            <div class="bar" :style="{ width: percent + '%' }"></div>
          </div>
          <div class="meta">{{ percent.toFixed(1) }}% · {{ speedText }} · {{ etaText }}</div>
        </div>
        <div v-if="err" class="error">{{ err }}</div>
        <div class="actions">
          <button type="button" class="btn" @click="onClose" :disabled="loading">取消</button>
          <button type="submit" class="btn primary" :disabled="!file || loading">{{ loading ? '上传中...' : '开始上传' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { api } from '@/api'

const emit = defineEmits(['close', 'uploaded'])

const file = ref(null)
const title = ref('')
const description = ref('')
const loading = ref(false)
const err = ref('')
const percent = ref(0)
const speedText = ref('')
const etaText = ref('')

function onClose() { if (!loading.value) emit('close') }
function onPick(e) {
  const f = e.target && e.target.files && e.target.files[0]
  file.value = f || null
}
function prettySize(n) {
  try { if (!n && n !== 0) return ''; const u=['B','KB','MB','GB']; let i=0; let s=n; while(s>=1024&&i<u.length-1){s/=1024;i++} return `${s.toFixed(1)}${u[i]}` } catch { return '' }
}

async function onSubmit() {
  err.value = ''
  if (!file.value) { err.value = '请选择文件'; return }
  loading.value = true
  percent.value = 0; speedText.value = ''; etaText.value = ''
  try {
    const res = await api.uploadSmart(file.value, {
      title: title.value,
      description: description.value,
      onProgress: (p) => {
        percent.value = Number(p.percent || 0)
        const sp = Number(p.speed || 0)
        const eta = Number(p.eta || 0)
        if (sp > 0) {
          const units = ['B/s','KB/s','MB/s','GB/s']
          let i=0; let v=sp; while(v>=1024&&i<units.length-1){v/=1024;i++}
          speedText.value = `${v.toFixed(1)}${units[i]}`
        } else speedText.value = ''
        if (eta > 0) {
          const mm = Math.floor(eta/60); const ss = Math.max(0, Math.round(eta%60))
          etaText.value = `剩余${mm>0?mm+'分':''}${ss}秒`
        } else etaText.value = ''
      }
    })
    emit('uploaded', res)
  } catch (e) {
    err.value = e?.detail || '上传失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000}
.panel{width:min(560px,92vw);background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:16px}
.title{margin:0 0 12px;font-size:18px;font-weight:800}
.row{display:flex;flex-direction:column;gap:6px;margin:10px 0}
.row label{font-size:13px;color:var(--muted)}
.row input[type="text"], .row textarea{padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-elev);color:var(--text);outline:none}
.hint{font-size:12px;color:var(--muted)}
.actions{display:flex;gap:10px;justify-content:flex-end;margin-top:12px}
.btn{background:var(--btn-bg);border:1px solid var(--btn-border);color:var(--text);border-radius:10px;padding:8px 14px;cursor:pointer}
.btn.primary{background:var(--accent-bg,#2563eb);border-color:transparent;color:#fff}
.error{color:var(--danger,#f43f5e);font-size:12px}
.progress{position:relative;height:10px;background:var(--bg-elev);border:1px solid var(--border);border-radius:999px;overflow:hidden}
.progress .bar{position:absolute;left:0;top:0;bottom:0;background:var(--accent-bg,#2563eb)}
.meta{font-size:12px;color:var(--muted)}
</style>

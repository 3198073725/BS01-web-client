<template>
  <div class="page">
    <h1>API 地址</h1>

    <section class="card">
      <h2>接口地址</h2>
      <div class="row">
        <label>Base URL</label>
        <input v-model.trim="apiBaseRaw" placeholder="例如：http://api.bs01.local:8000" />
      </div>
      <div class="row">
        <label>当前生效</label>
        <div class="mono">{{ effectiveApiBase }}</div>
      </div>
      <div class="tips">
        <div class="tip">- 需要以 http:// 或 https:// 开头</div>
        <div class="tip">- 不要以 / 结尾（会自动处理）</div>
      </div>
      <div class="actions">
        <button class="btn" :disabled="saving" @click="save">保存</button>
        <button class="btn" :disabled="saving" @click="reset">恢复默认</button>
        <button class="btn" :disabled="testing" @click="testHealth">{{ testing ? '测试中...' : '测试连通性' }}</button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '@/api'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

const DEFAULT_API_BASE = 'http://api.bs01.local:8000'
const apiBaseRaw = ref('')
const saving = ref(false)
const testing = ref(false)

const effectiveApiBase = computed(() => {
  try { return api.getBase() } catch (_) { return '' }
})

function normalize(v) {
  return String(v || '').trim().replace(/\/+$/, '')
}

function load() {
  try {
    const saved = localStorage.getItem('api_base')
    apiBaseRaw.value = normalize(saved || api.getBase() || DEFAULT_API_BASE)
  } catch (_) {
    apiBaseRaw.value = DEFAULT_API_BASE
  }
}

function save() {
  if (saving.value) return
  const v = normalize(apiBaseRaw.value)
  if (!v) {
    try { ui.showDialog('请输入 API 地址', 'warn') } catch (_) { /* no-op */ }
    return
  }
  if (!/^https?:\/\//i.test(v)) {
    try { ui.showDialog('必须以 http:// 或 https:// 开头', 'warn') } catch (_) { /* no-op */ }
    return
  }
  saving.value = true
  try {
    api.setBase(v)
    try { localStorage.setItem('api_base', v) } catch (_) { /* no-op */ }
    apiBaseRaw.value = v
    try { ui.showDialog('已保存', 'success') } catch (_) { /* no-op */ }
  } catch (_) {
    try { ui.showDialog('保存失败', 'error') } catch (e) { void e }
  } finally {
    saving.value = false
  }
}

function reset() {
  if (saving.value) return
  saving.value = true
  try {
    try { localStorage.removeItem('api_base') } catch (_) { /* no-op */ }
    api.setBase(DEFAULT_API_BASE)
    apiBaseRaw.value = DEFAULT_API_BASE
    try { ui.showDialog('已恢复默认', 'success') } catch (_) { /* no-op */ }
  } catch (_) {
    try { ui.showDialog('操作失败', 'error') } catch (e) { void e }
  } finally {
    saving.value = false
  }
}

async function testHealth() {
  if (testing.value) return
  testing.value = true
  try {
    const v = normalize(apiBaseRaw.value) || effectiveApiBase.value || DEFAULT_API_BASE
    const base = /^https?:\/\//i.test(v) ? v : DEFAULT_API_BASE
    const res = await fetch(`${base}/api/health/`, { method: 'GET' })
    if (res.ok) {
      try { ui.showDialog('连接成功', 'success') } catch (_) { /* no-op */ }
    } else {
      try { ui.showDialog(`连接失败：HTTP ${res.status}`, 'error') } catch (_) { /* no-op */ }
    }
  } catch (_) {
    try { ui.showDialog('网络异常或服务器不可达', 'error') } catch (e) { void e }
  } finally {
    testing.value = false
  }
}

onMounted(() => { load() })
</script>

<style scoped>
.page { max-width: 880px; margin: 24px auto; padding: 16px; color: var(--text); }
.card { background: var(--bg); border:1px solid var(--border); border-radius: 12px; padding: 16px; }
h1 { font-size: 28px; margin: 0 0 12px; }
h2 { font-size: 18px; margin: 0 0 12px; }
.row { display:grid; grid-template-columns: 160px 1fr; gap: 12px; align-items: center; margin: 10px 0; }
label { color: var(--muted); }
input { width: 100%; padding: 10px 12px; border:1px solid var(--border); border-radius: 10px; background: var(--bg); color: var(--text); }
.actions { display:flex; gap: 10px; justify-content:flex-end; margin-top: 12px; flex-wrap: wrap; }
.btn { padding:8px 16px; border-radius:10px; border:1px solid var(--btn-border); background: var(--btn-bg); color: var(--text); cursor:pointer; }
.btn:disabled { opacity: .6; cursor: not-allowed; }
.tips { margin-top: 10px; color: var(--muted); font-size: 12px; }
.tip { margin: 4px 0; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
</style>

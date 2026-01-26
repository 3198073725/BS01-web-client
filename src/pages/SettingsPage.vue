<template>
  <div class="settings">
    <h1>设置</h1>
    <section class="card">
      <h2>账户资料</h2>
      <div class="row">
        <label>昵称</label>
        <input v-model.trim="nickname" placeholder="输入昵称" />
      </div>
      <div class="row">
        <label>简介</label>
        <textarea v-model.trim="bio" rows="3" placeholder="一句话介绍自己" />
      </div>
      <div class="actions">
        <button class="btn" :disabled="savingProfile" @click="saveProfile">保存</button>
      </div>
    </section>

    <section class="card">
      <h2>隐私</h2>
      <div class="row">
        <label>主页可见性</label>
        <select v-model="privacyMode">
          <option value="public">公开</option>
          <option value="friends_only">仅好友可见</option>
          <option value="private">私密</option>
        </select>
      </div>
      <div class="actions">
        <button class="btn" :disabled="savingPrivacy" @click="savePrivacy">保存</button>
      </div>
    </section>

    <section class="card">
      <h2>显示与主题</h2>
      <div class="row">
        <label>主题</label>
        <div class="seg">
          <button class="seg-btn" :class="{ active: themeStore.theme==='light' }" @click="setTheme('light')">浅色</button>
          <button class="seg-btn" :class="{ active: themeStore.theme==='dark' }" @click="setTheme('dark')">深色</button>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>登录与安全</h2>
      <div class="row">
        <label>保存登录状态</label>
        <button class="btn" :class="{ active: auth.remember }" @click="toggleRemember">{{ auth.remember ? '已开启' : '已关闭' }}</button>
      </div>
    </section>
  </div>
  
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useUiStore } from '@/stores/ui'
import { api } from '@/api'

const auth = useAuthStore()
const themeStore = useThemeStore()
const ui = useUiStore()

const me = computed(() => auth.user)
const nickname = ref('')
const bio = ref('')
const privacyMode = ref('public')
const savingProfile = ref(false)
const savingPrivacy = ref(false)

async function ensureMe() {
  if (!me.value) {
    try { auth.user = await api.me() } catch { auth.user = null }
  }
  try {
    nickname.value = String(me.value?.nickname || me.value?.display_name || me.value?.username || '')
    bio.value = String(me.value?.bio || '')
    privacyMode.value = String(me.value?.privacy_mode || 'public')
  } catch {}
}

async function saveProfile() {
  if (savingProfile.value) return
  savingProfile.value = true
  try {
    const payload = { nickname: nickname.value, bio: bio.value }
    const res = await api.updateMe(payload)
    try { auth.user = res } catch {}
    try { ui.showDialog('资料已保存', 'success') } catch {}
  } catch (e) {
    try { ui.showDialog((e && (e.detail || e.message)) || '保存失败', 'error') } catch {}
  } finally { savingProfile.value = false }
}

async function savePrivacy() {
  if (savingPrivacy.value) return
  savingPrivacy.value = true
  try {
    const res = await api.updateMe({ privacy_mode: privacyMode.value })
    try { auth.user = res } catch {}
    try { ui.showDialog('隐私设置已更新', 'success') } catch {}
  } catch (e) {
    try { ui.showDialog((e && (e.detail || e.message)) || '更新失败', 'error') } catch {}
  } finally { savingPrivacy.value = false }
}

function setTheme(v) { try { themeStore.set(v) } catch {} }
function toggleRemember() { try { auth.setRemember(!auth.remember) } catch {} }

onMounted(() => { ensureMe() })
</script>

<style scoped>
.settings { max-width: 880px; margin: 24px auto; padding: 16px; color: var(--text); }
h1 { font-size: 28px; margin: 0 0 12px; }
.card { background: var(--bg); border:1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
h2 { font-size: 18px; margin: 0 0 12px; }
.row { display:grid; grid-template-columns: 160px 1fr; gap: 12px; align-items: center; margin: 10px 0; }
label { color: var(--muted); }
input, textarea, select { width: 100%; padding: 10px 12px; border:1px solid var(--border); border-radius: 10px; background: var(--bg); color: var(--text); }
.actions { display:flex; justify-content:flex-end; }
.btn { padding:8px 16px; border-radius:10px; border:1px solid var(--btn-border); background: var(--btn-bg); color: var(--text); cursor:pointer; }
.btn.active { background: var(--accent); border-color: var(--accent); color: var(--bg); }
.seg { display:inline-flex; border:1px solid var(--btn-border); border-radius:10px; overflow:hidden; }
.seg-btn { padding:8px 16px; background: var(--btn-bg); color: var(--text); border:none; border-right:1px solid var(--btn-border); cursor:pointer; }
.seg-btn:last-child { border-right:none }
.seg-btn.active { background: var(--accent); color: var(--bg); }
</style>

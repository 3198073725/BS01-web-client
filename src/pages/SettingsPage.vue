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
        <textarea v-model.trim="bio" rows="3" placeholder="一句话介绍自己" maxlength="20"></textarea>
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
          <button class="seg-btn" :class="{ active: themeStore.theme==='system' }" @click="setTheme('system')">系统</button>
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

    <section class="card">
      <h2>播放偏好</h2>
      <div class="row">
        <label>默认开启连播</label>
        <button class="btn" :class="{ active: autoplayDefault }" @click="autoplayDefault=!autoplayDefault">{{ autoplayDefault ? '已开启' : '已关闭' }}</button>
      </div>
      <div class="row">
        <label>默认播放速度</label>
        <select v-model.number="defaultRate">
          <option :value="0.5">0.5x</option>
          <option :value="0.75">0.75x</option>
          <option :value="1">1x</option>
          <option :value="1.25">1.25x</option>
          <option :value="1.5">1.5x</option>
          <option :value="2">2x</option>
        </select>
      </div>
      <div class="row">
        <label>默认静音</label>
        <button class="btn" :class="{ active: mutedDefault }" @click="mutedDefault=!mutedDefault">{{ mutedDefault ? '已开启' : '已关闭' }}</button>
      </div>
      <div class="row">
        <label>默认音量</label>
        <input type="range" min="0" max="1" step="0.01" v-model.number="volumeDefault" />
      </div>
      <div class="row">
        <label>断点续播</label>
        <button class="btn" :class="{ active: resumeEnabled }" @click="resumeEnabled=!resumeEnabled">{{ resumeEnabled ? '已开启' : '已关闭' }}</button>
      </div>
      <div class="actions">
        <button class="btn" data-testid="save-playback" @click="savePlaybackPrefs">保存</button>
      </div>
    </section>

    <section class="card">
      <h2>数据与隐私</h2>
      <div class="row">
        <label>搜索历史</label>
        <button class="btn" data-testid="clear-search-history" @click="clearSearchHistoryLocal">清空</button>
      </div>
      <div class="row">
        <label>本地观看进度</label>
        <button class="btn" data-testid="clear-local-resume" @click="clearLocalResume">清空</button>
      </div>
      <div class="row">
        <label>通知</label>
        <div style="display:flex; gap:8px;">
          <button class="btn" data-testid="notif-markall" @click="markAllNotiRead">全部已读</button>
          <button class="btn" data-testid="notif-clear" @click="clearAllNoti">清空</button>
        </div>
      </div>
      <div class="row">
        <label>观看历史</label>
        <button class="btn" data-testid="clear-watch-history" :disabled="clearingHistory" @click="clearServerHistory">{{ clearingHistory ? '清理中...' : '清空' }}</button>
      </div>
    </section>

    <section class="card">
      <h2>起始页偏好</h2>
      <div class="row">
        <label>启动默认页</label>
        <select v-model="startTab" @change="saveStartTab">
          <option value="recommend">推荐</option>
          <option value="featured">精选</option>
          <option value="following">关注</option>
          <option value="friends">朋友</option>
        </select>
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

const autoplayDefault = ref(false)
const defaultRate = ref(1)
const mutedDefault = ref(false)
const volumeDefault = ref(0.6)
const resumeEnabled = ref(true)
const startTab = ref('recommend')
const clearingHistory = ref(false)

async function ensureMe() {
  if (!me.value) {
    try { auth.user = await api.me() } catch { auth.user = null }
  }
  try {
    nickname.value = String(me.value?.nickname || me.value?.display_name || me.value?.username || '')
    bio.value = String(me.value?.bio || '')
    privacyMode.value = String(me.value?.privacy_mode || 'public')
  } catch (e) { void e }
}

async function saveProfile() {
  if (savingProfile.value) return
  savingProfile.value = true
  try {
    const payload = { nickname: nickname.value, bio: bio.value }
    const res = await api.updateMe(payload)
    try { auth.user = res } catch (e) { void e }
    try { ui.showDialog('资料已保存', 'success') } catch (e) { void e }
  } catch (e) {
    try { ui.showDialog((e && (e.detail || e.message)) || '保存失败', 'error') } catch (e2) { void e2 }
  } finally { savingProfile.value = false }
}

async function savePrivacy() {
  if (savingPrivacy.value) return
  savingPrivacy.value = true
  try {
    const res = await api.updateMe({ privacy_mode: privacyMode.value })
    try { auth.user = res } catch (e) { void e }
    try { ui.showDialog('隐私设置已更新', 'success') } catch (e) { void e }
  } catch (e) {
    try { ui.showDialog((e && (e.detail || e.message)) || '更新失败', 'error') } catch (e2) { void e2 }
  } finally { savingPrivacy.value = false }
}

function setTheme(v) { try { themeStore.set(v) } catch (e) { void e } }
function toggleRemember() { try { auth.setRemember(!auth.remember) } catch (e) { void e } }

onMounted(() => { ensureMe() })

function loadPlaybackPrefs() {
  try { autoplayDefault.value = (localStorage.getItem('vp_autonext') === '1') } catch (_) { autoplayDefault.value = false }
  try {
    const r = parseFloat(localStorage.getItem('vp_rate') || 'NaN')
    defaultRate.value = (!Number.isNaN(r) && r > 0) ? r : 1
  } catch (_) { defaultRate.value = 1 }
  try { mutedDefault.value = (localStorage.getItem('vp_muted') === '1') } catch (_) { mutedDefault.value = false }
  try {
    const v = parseFloat(localStorage.getItem('vp_vol') || '0.6')
    volumeDefault.value = Number.isNaN(v) ? 0.6 : Math.min(1, Math.max(0, v))
  } catch (_) { volumeDefault.value = 0.6 }
  try { resumeEnabled.value = localStorage.getItem('vp_resume') !== '0' } catch (_) { resumeEnabled.value = true }
}
function savePlaybackPrefs() {
  try { localStorage.setItem('vp_autonext', autoplayDefault.value ? '1' : '0') } catch (_) { void 0 }
  try { localStorage.setItem('vp_rate', String(defaultRate.value || 1)) } catch (_) { void 0 }
  try { localStorage.setItem('vp_muted', mutedDefault.value ? '1' : '0') } catch (_) { void 0 }
  try { localStorage.setItem('vp_vol', String(volumeDefault.value || 0.6)) } catch (_) { void 0 }
  try { localStorage.setItem('vp_resume', resumeEnabled.value ? '1' : '0') } catch (_) { void 0 }
  try { ui.showDialog('播放偏好已保存', 'success') } catch (_) { void 0 }
}
function clearSearchHistoryLocal() {
  try { localStorage.removeItem('search_history'); ui.showDialog('已清空搜索历史', 'success') } catch (_) { void 0 }
}
function clearLocalResume() {
  try {
    // localStorage: 循环直到没有 vp_pos:*
    for (;;) {
      let removed = false
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('vp_pos:')) { try { localStorage.removeItem(k) } catch (_) { void 0 } removed = true; break }
      }
      if (!removed) break
    }
    // sessionStorage 里也清一次，保持一致
    try {
      for (;;) {
        let removed = false
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i)
          if (k && k.startsWith('vp_pos:')) { try { sessionStorage.removeItem(k) } catch (_) { void 0 } removed = true; break }
        }
        if (!removed) break
      }
    } catch (_) { void 0 }
    // 兼容性兜底：再按属性枚举方式清理一次
    try { Object.keys(localStorage).forEach(k => { if (k && k.startsWith('vp_pos:')) try { localStorage.removeItem(k) } catch (_) { void 0 } }) } catch (_) { void 0 }
    try { Object.keys(sessionStorage).forEach(k => { if (k && k.startsWith('vp_pos:')) try { sessionStorage.removeItem(k) } catch (_) { void 0 } }) } catch (_) { void 0 }
    ui.showDialog('已清空本地观看进度', 'success')
  } catch (_) { void 0 }
}
async function markAllNotiRead() { try { await api.notificationsMarkAllRead(); ui.showDialog('已全部标为已读', 'success') } catch (e) { try { ui.showDialog((e && (e.detail || e.message)) || '操作失败', 'error') } catch (_) { void 0 } } }
async function clearAllNoti() { try { await api.notificationsClear(); ui.showDialog('通知已清空', 'success') } catch (e) { try { ui.showDialog((e && (e.detail || e.message)) || '操作失败', 'error') } catch (_) { void 0 } } }
async function clearServerHistory() {
  if (clearingHistory.value) return
  clearingHistory.value = true
  try {
    let page = 1
    for (;;) {
      const res = await api.historyList({ page, pageSize: 50 })
      const ids = (res && Array.isArray(res.items)) ? res.items.map(x => x.id) : []
      if (ids.length) { try { await api.bulkHistoryRemove(ids) } catch (_) { void 0 } }
      if (!res || !res.hasNext) break
      page = (res.page || page) + 1
    }
    ui.showDialog('观看历史已清空', 'success')
  } catch (e) { try { ui.showDialog((e && (e.detail || e.message)) || '操作失败', 'error') } catch (_) { void 0 } }
  finally { clearingHistory.value = false }
}
function saveStartTab() { try { localStorage.setItem('home_default_tab', startTab.value || 'recommend'); ui.showDialog('已保存启动页偏好', 'success') } catch (_) { void 0 } }

onMounted(() => { loadPlaybackPrefs(); try { startTab.value = localStorage.getItem('home_default_tab') || 'recommend' } catch (_) { startTab.value = 'recommend' } })
</script>

<style scoped>
.settings { max-width: 880px; margin: 24px auto; padding: 16px; color: var(--text); }
h1 { font-size: 28px; margin: 0 0 12px; }
.card { background: var(--bg); border:1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
h2 { font-size: 18px; margin: 0 0 12px; }
.row { display:grid; grid-template-columns: 160px 1fr; gap: 12px; align-items: center; margin: 10px 0; }
.row > *:nth-child(2) { min-width: 0; }
label { color: var(--muted); }
input, textarea, select { width: 100%; padding: 10px 12px; border:1px solid var(--border); border-radius: 10px; background: var(--bg); color: var(--text); box-sizing: border-box; }
textarea { resize: none; }
.actions { display:flex; justify-content:flex-end; }
.btn { padding:8px 16px; border-radius:10px; border:1px solid var(--btn-border); background: var(--btn-bg); color: var(--text); cursor:pointer; }
.btn.active { background: var(--accent); border-color: var(--accent); color: var(--bg); }
.seg { display:inline-flex; border:1px solid var(--btn-border); border-radius:10px; overflow:hidden; }
.seg-btn { padding:8px 16px; background: var(--btn-bg); color: var(--text); border:none; border-right:1px solid var(--btn-border); cursor:pointer; }
.seg-btn:last-child { border-right:none }
.seg-btn.active { background: var(--accent); color: var(--bg); }
</style>

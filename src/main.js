import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { api } from './api'
import router from './router'
import { useAuthStore } from './stores/auth'
import { useUiStore } from './stores/ui'

// 初始化 API 基址（优先使用持久化配置；但避免在非 localhost 环境误用 localhost）
try {
  const saved = localStorage.getItem('api_base')
  const curHost = typeof window !== 'undefined' ? window.location.hostname : ''
  const isSavedLocalhost = saved && /:\/\/localhost(?::\d+)?\b/.test(saved)
  if (saved && !(isSavedLocalhost && curHost && curHost !== 'localhost')) {
    api.setBase(saved)
  }
} catch (_) { void 0 }

// 多标签页同步：收到登出广播时，清 token 并刷新
try {
  window.addEventListener('storage', (e) => {
    if (e.key === 'auth_sync' && e.newValue) {
      try {
        const msg = JSON.parse(e.newValue)
        if (msg && msg.type === 'logout') {
          api.clearTokens()
          window.location.reload()
        }
      } catch (_) { /* no-op */ }
    }
  })
} catch (_) { /* no-op */ }

const app = createApp(App)
const pinia = createPinia()
app.use(pinia).use(router)

// 尽早初始化登录态，减少 /me 刷新时的状态闪断
try {
  const auth = useAuthStore(pinia)
  const ui = useUiStore(pinia)
  auth.init().then(async () => {
    try {
      if (!auth.user) return
      let lastShownId = ''
      let pollTimer = null

      const showOnce = async () => {
        const r = await api.announcementsLatestUnread()
        const a = r && r.announcement
        if (!a || !a.id) return
        if (String(a.id) === String(lastShownId)) return
        lastShownId = String(a.id)

        const title = (a.title || '系统通知')
        const content = (a.content || '').trim()
        const msg = `${title}${content ? `\n\n${content}` : ''}`
        ui.confirm(msg, async () => {
          try { await api.announcementMarkRead(a.id) } catch (_) { /* no-op */ }
        }, null, 'system')
      }

      // 立即检查一次
      try { await showOnce() } catch (_) { /* no-op */ }

      // 2分钟内轮询（每10秒），捕获管理员刚发布的通知
      const startedAt = Date.now()
      pollTimer = setInterval(async () => {
        try {
          if (!auth.user) return
          if (Date.now() - startedAt > 2 * 60 * 1000) {
            clearInterval(pollTimer)
            pollTimer = null
            return
          }
          await showOnce()
        } catch (_) { /* no-op */ }
      }, 10 * 1000)
    } catch (_) { /* no-op */ }
  }).catch(() => { /* no-op */ })
} catch (_) { /* no-op */ }

try {
  document.addEventListener('contextmenu', (e) => { e.preventDefault() })
  document.addEventListener('selectstart', (e) => { e.preventDefault() })
  document.addEventListener('dragstart', (e) => { e.preventDefault() })
} catch (_) { /* no-op */ }

app.mount('#app')

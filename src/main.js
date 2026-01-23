import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { api } from './api'
import router from './router'
import { useAuthStore } from './stores/auth'

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
try { const auth = useAuthStore(pinia); auth.init() } catch (_) { /* no-op */ }

try {
  document.addEventListener('contextmenu', (e) => { e.preventDefault() })
  document.addEventListener('selectstart', (e) => { e.preventDefault() })
  document.addEventListener('dragstart', (e) => { e.preventDefault() })
} catch (_) { /* no-op */ }

app.mount('#app')

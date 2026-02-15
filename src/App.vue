<template>
  <router-view />
  <transition name="fade">
    <div v-if="ui.dialogOpen" class="sysdlg-mask" @click="ui.hideDialog()"></div>
  </transition>
  <transition name="pop">
    <div v-if="ui.dialogOpen" class="sysdlg" role="dialog" @click.stop>
      <div class="sysdlg-title">{{ dlgTitle }}</div>
      <div class="sysdlg-body">{{ ui.dialogMessage }}</div>
      <div class="sysdlg-actions">
        <template v-if="ui.dialogConfirm">
          <button class="btn ghost" @click="ui.cancelDialog()">取消</button>
          <button class="btn" @click="ui.okDialog()">确定</button>
        </template>
        <template v-else>
          <button class="btn" @click="ui.hideDialog()">好的</button>
        </template>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
const ui = useUiStore()
const dlgTitle = computed(() => {
  const t = String(ui.dialogType || 'info')
  if (t === 'error') return '错误'
  if (t === 'success') return '成功'
  if (t === 'system') return '系统通知'
  if (t === 'warn') return '注意'
  return '提示'
})
</script>

<style>
/* Theme variables */
:root, [data-theme="dark"] {
  --bg: #0b0e12;
  --bg-elev: #0f141a;
  --text: #e5e7eb;
  --muted: #9ca3af;
  --border: #1f2937;
  --btn-bg: #1f2937;
  --btn-border: #374151;
  --hover-bg: #1f2937;
  --active-bg: #111827;
  --accent: #22d3ee;
  --danger: #f43f5e;
  --sidebar-w: 180px;
  --topbar-h: 56px;
  --player-max-w: 1400px;
  --aspect: 16/9;
  --overlay: rgba(0,0,0,.55);
}
[data-theme="light"] {
  --bg: #f8fafc;
  --bg-elev: #ffffff;
  --text: #111827;
  --muted: #6b7280;
  --border: #e5e7eb;
  --btn-bg: #f3f4f6;
  --btn-border: #e5e7eb;
  --hover-bg: #f3f4f6;
  --active-bg: #e5e7eb;
  --accent: #0ea5e9;
  --danger: #ef4444;
  --sidebar-w: 180px;
  --topbar-h: 56px;
  --player-max-w: 1400px;
  --aspect: 16/9;
  --overlay: rgba(0,0,0,.35);
}
html, body, #app { height: 100%; overflow: hidden; }
body { margin: 0; background: var(--bg); color: var(--text); }
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
}
* {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

/* system dialog */
.sysdlg-mask{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000}
.sysdlg{position:fixed;left:50%;top:16%;transform:translateX(-50%);width:min(92%,420px);background:var(--bg-elev);border:1px solid var(--border);border-radius:12px;z-index:1001;box-shadow:0 20px 60px rgba(0,0,0,.35);text-align:left}
.sysdlg-title{font-weight:800;padding:12px 16px;border-bottom:1px solid var(--border)}
.sysdlg-body{padding:16px;color:var(--text)}
.sysdlg-actions{display:flex;justify-content:flex-end;gap:10px;padding:12px 16px;border-top:1px solid var(--border)}
.sysdlg .btn{background:var(--accent);border:1px solid var(--accent);color:#fff;border-radius:10px;padding:8px 12px;cursor:pointer}
.sysdlg .btn.ghost{background:transparent;border:1px solid var(--btn-border);color:var(--text)}

.pop-enter-active,.pop-leave-active{transition:transform .16s ease, opacity .16s ease}
.pop-enter-from,.pop-leave-to{transform:translate(-50%, -8px);opacity:0}
.fade-enter-active,.fade-leave-active{transition:opacity .12s ease}
.fade-enter-from,.fade-leave-to{opacity:0}
</style>

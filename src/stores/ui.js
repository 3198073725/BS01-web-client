import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    meLastTab: 'me-works',
    meBulkManage: false,
    // 系统对话框
    dialogOpen: false,
    dialogMessage: '',
    dialogType: 'info', // info | warn | error | success
    dialogConfirm: false,
    dialogOnOk: null,
    dialogOnCancel: null,
    // 批量管理选择持久化
    meSelectedIds: [],
    meSelectedScope: '', // 使用 user_id 作为作用域
  }),
  actions: {
    init() {
      try { const v = localStorage.getItem('me:last-tab'); if (v) this.meLastTab = v } catch (_) { /* no-op */ }
      // 恢复批量选择
      try {
        const scope = localStorage.getItem('me:selected:scope') || ''
        const ids = JSON.parse(localStorage.getItem('me:selected:ids') || '[]')
        this.meSelectedScope = scope
        this.meSelectedIds = Array.isArray(ids) ? ids.map(String) : []
      } catch (_) { this.meSelectedIds = [] }
    },
    setMeLastTab(name) {
      try { this.meLastTab = name; localStorage.setItem('me:last-tab', String(name)) } catch (_) { /* no-op */ }
    },
    toggleMeBulkManage() { this.meBulkManage = !this.meBulkManage },
    // 系统对话框
    showDialog(message, type = 'info') {
      try { this.dialogMessage = String(message || ''); this.dialogType = String(type || 'info') } catch (_) { /* no-op */ }
      this.dialogConfirm = false; this.dialogOnOk = null; this.dialogOnCancel = null; this.dialogOpen = true
    },
    confirm(message, onOk, onCancel = null, type = 'info') {
      try { this.dialogMessage = String(message || ''); this.dialogType = String(type || 'info') } catch (_) { /* no-op */ }
      this.dialogConfirm = true; this.dialogOnOk = (typeof onOk === 'function') ? onOk : null; this.dialogOnCancel = (typeof onCancel === 'function') ? onCancel : null; this.dialogOpen = true
    },
    hideDialog() { this.dialogOpen = false },
    okDialog() { try { if (this.dialogOnOk) this.dialogOnOk() } finally { this.dialogOpen = false; this.dialogOnOk = null; this.dialogOnCancel = null; this.dialogConfirm = false } },
    cancelDialog() { try { if (this.dialogOnCancel) this.dialogOnCancel() } finally { this.dialogOpen = false; this.dialogOnOk = null; this.dialogOnCancel = null; this.dialogConfirm = false } },
    // 批量管理：作用域与选择持久化
    setMeSelectedScope(scope) {
      const s = String(scope || '')
      if (s !== this.meSelectedScope) {
        this.meSelectedScope = s
        this.meSelectedIds = []
        try { localStorage.setItem('me:selected:scope', s); localStorage.setItem('me:selected:ids', '[]') } catch (_) { /* no-op */ }
      }
    },
    toggleMeSelected(id) {
      const sid = String(id || '')
      if (!sid) return
      const i = this.meSelectedIds.indexOf(sid)
      if (i >= 0) this.meSelectedIds.splice(i,1); else this.meSelectedIds.push(sid)
      try { localStorage.setItem('me:selected:ids', JSON.stringify(this.meSelectedIds)) } catch (_) { /* no-op */ }
    },
    clearMeSelected() { this.meSelectedIds = []; try { localStorage.setItem('me:selected:ids', '[]') } catch (_) { /* no-op */ } },
  }
})

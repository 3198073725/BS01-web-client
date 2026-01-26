<template>
  <div v-if="open" class="modal-overlay" @click.self="close">
    <div class="modal">
      <header class="modal-header">
        <h3>批量管理</h3>
        <button class="close" @click="close">✕</button>
      </header>
      <div class="body">
        <div class="summary">已选 {{ selectedCount }} 项</div>
        <div class="grid">
          <div class="field">
            <label>允许评论</label>
            <select v-model="form.allow_comments_mode">
              <option value="keep">不更改</option>
              <option value="enable">启用</option>
              <option value="disable">禁用</option>
            </select>
          </div>
          <div class="field">
            <label>允许下载</label>
            <select v-model="form.allow_download_mode">
              <option value="keep">不更改</option>
              <option value="enable">启用</option>
              <option value="disable">禁用</option>
            </select>
          </div>
          <div class="field">
            <label>可见性</label>
            <select v-model="form.visibility">
              <option value="">不更改</option>
              <option value="public">公开</option>
              <option value="unlisted">未列出</option>
              <option value="private">私密</option>
            </select>
          </div>
        </div>
        <div v-if="err" class="error">{{ err.detail || '操作失败' }}</div>
      </div>
      <footer class="foot">
        <button class="btn" @click="close">取消</button>
        <button class="btn danger" :disabled="pending || selectedCount<=0" @click="onDelete">删除所选</button>
        <button class="btn primary" :disabled="pending || selectedCount<=0" @click="onApply">应用设置</button>
      </footer>
    </div>
  </div>
</template>

<script>
import { reactive, ref, watch } from 'vue'

export default {
  name: 'BulkManageDialog',
  props: {
    open: { type: Boolean, default: false },
    selectedCount: { type: Number, default: 0 },
    pending: { type: Boolean, default: false },
  },
  emits: ['close', 'apply', 'delete'],
  setup(props, { emit }) {
    const err = ref(null)
    const form = reactive({ allow_comments_mode: 'keep', allow_download_mode: 'keep', visibility: '' })
    watch(() => props.open, (v) => { if (v) { err.value = null; form.allow_comments_mode='keep'; form.allow_download_mode='keep'; form.visibility=''; } })
    function close() { emit('close') }
    function onApply() {
      const payload = {}
      if (form.allow_comments_mode !== 'keep') payload.allow_comments = (form.allow_comments_mode === 'enable')
      if (form.allow_download_mode !== 'keep') payload.allow_download = (form.allow_download_mode === 'enable')
      if (form.visibility) payload.visibility = form.visibility
      emit('apply', payload)
    }
    function onDelete() { emit('delete') }
    return { form, err, close, onApply, onDelete }
  }
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: var(--overlay); display:flex; align-items:center; justify-content:center; z-index: 10000; }
.modal { width: min(720px, calc(100vw - 32px)); background: var(--bg-elev); color: var(--text); border-radius:16px; box-shadow: 0 20px 60px rgba(0,0,0,.35); display:flex; flex-direction:column; overflow:hidden; }
.modal-header { display:flex; align-items:center; justify-content:space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); }
.close { background:transparent; border:none; color: var(--muted); font-size:18px; cursor:pointer; }
.body { padding: 12px 16px; }
.summary { color: var(--muted); margin-bottom: 8px; }
.grid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 16px; }
.field { display:flex; flex-direction:column; gap:6px; }
.field label { font-size: 12px; color: var(--muted); }
.field select { padding:10px 12px; border:1px solid var(--border); border-radius:10px; background: var(--bg); color: var(--text); outline:none; }
.foot { display:flex; gap:12px; justify-content:flex-end; padding: 12px 16px 16px; border-top: 1px solid var(--border); }
.btn { padding:8px 12px; border-radius:10px; border:1px solid var(--btn-border); background: var(--btn-bg); color: var(--text); cursor:pointer; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: var(--bg); }
.btn.danger { border-color: var(--danger); color: var(--danger); }
.error { color: var(--danger); padding: 8px 0; }
</style>

<template>
  <div v-if="open" class="modal-overlay" @click.self="close">
    <div class="modal">
      <header class="modal-header">
        <h3>编辑资料</h3>
        <button class="close" @click="close">✕</button>
      </header>
      <div class="body">
        <div class="avatar-row">
          <div class="avatar-wrap">
            <img v-if="avatarPreview" :src="avatarPreview" class="avatar" alt="avatar" />
            <div v-else class="avatar-fallback">{{ initial }}</div>
          </div>
          <button class="btn" type="button" @click="triggerPick">更换头像</button>
          <input ref="fileEl" id="avatarInput" type="file" accept="image/*" @change="onPickAvatar" style="display:none" />
        </div>
        <div class="grid">
          <div class="field">
            <label>昵称</label>
            <input v-model.trim="form.nickname" type="text" maxlength="64" />
          </div>
          <div class="field">
            <label>性别</label>
            <select v-model="form.gender">
              <option value="private">保密</option>
              <option value="male">男</option>
              <option value="female">女</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div class="field">
            <label>生日</label>
            <input v-model="form.birth_date" type="date" />
          </div>
          <div class="field">
            <label>所在地</label>
            <input v-model.trim="form.location" type="text" maxlength="100" />
          </div>
          <div class="field">
            <label>个人网站</label>
            <input v-model.trim="form.website" type="url" placeholder="https://" />
          </div>
          <div class="field">
            <label>手机号</label>
            <input v-model.trim="form.phone_number" type="tel" placeholder="+8613800000000" />
          </div>
          <div class="field full">
            <label>签名/简介</label>
            <textarea v-model.trim="form.bio" rows="3"></textarea>
          </div>
          <div class="field">
            <label>隐私</label>
            <select v-model="form.privacy_mode">
              <option value="public">公开</option>
              <option value="private">私密</option>
              <option value="friends_only">仅好友可见</option>
            </select>
          </div>
        </div>
        <div v-if="err" class="error">{{ err.detail || '保存失败' }}</div>
      </div>
      <footer class="foot">
        <button class="btn" @click="close">取消</button>
        <button class="btn primary" :disabled="saving" @click="save">{{ saving ? '保存中...' : '保存' }}</button>
      </footer>
    </div>
  </div>
  <!-- 裁剪弹层 -->
  <div v-if="cropOpen" class="crop-modal-overlay" @click.self="closeCrop">
    <div class="crop-modal">
      <header class="crop-header">
        <h4>调整头像</h4>
        <button class="close" @click="closeCrop">✕</button>
      </header>
      <div class="crop-body">
        <div class="crop-stage" :style="{ width: crop.boxSize + 'px', height: crop.boxSize + 'px' }" @mousedown="onCropDown" @touchstart.prevent="onCropDown">
          <img v-if="cropUrl" :src="cropUrl" class="crop-img" :style="cropImgStyle" draggable="false" />
          <div class="crop-mask"></div>
        </div>
        <div class="crop-controls">
          <label>缩放</label>
          <input type="range" min="1" max="3" step="0.01" v-model.number="crop.zoom" />
        </div>
      </div>
      <footer class="crop-foot">
        <button class="btn" @click="closeCrop">取消</button>
        <button class="btn primary" @click="confirmCrop">确定</button>
      </footer>
    </div>
  </div>
</template>

<script>
import { computed, reactive, watch, ref } from 'vue'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'

export default {
  name: 'EditProfileDialog',
  props: {
    open: { type: Boolean, default: false },
    user: { type: Object, default: () => ({}) },
  },
  emits: ['close', 'saved'],
  setup(props, { emit }) {
    const auth = useAuthStore()
    const form = reactive({
      nickname: '', bio: '', gender: 'private', birth_date: '', location: '', website: '', phone_number: '', privacy_mode: 'public', profile_picture: ''
    })
    const err = ref(null)
    const saving = ref(false)
    const baseRef = ref({})

    function normalizeUser(u) {
      const nickname = (u?.nickname || '').trim()
      const bio = (u?.bio || '').trim()
      const gender = u?.gender || 'private'
      const birth_date = u && u.birth_date ? String(u.birth_date).slice(0,10) : null
      const location = (u?.location || '').trim()
      const wraw = (u?.website || '')
      const w = typeof wraw === 'string' ? wraw.trim() : ''
      const website = (w && w !== 'http://' && w !== 'https://') ? w : null
      const ph = (u?.phone_number || '').trim()
      const phone_number = ph || null
      const privacy_mode = u?.privacy_mode || 'public'
      const profile_picture = u?.profile_picture || ''
      return { nickname, bio, gender, birth_date, location, website, phone_number, privacy_mode, profile_picture }
    }

    function initFromUser(u) {
      form.nickname = u?.nickname || ''
      form.bio = u?.bio || ''
      form.gender = u?.gender || 'private'
      form.birth_date = u && u.birth_date ? String(u.birth_date).slice(0,10) : ''
      form.location = u?.location || ''
      form.website = u?.website || ''
      form.phone_number = u?.phone_number || ''
      form.privacy_mode = u?.privacy_mode || 'public'
      form.profile_picture = u?.profile_picture || ''
      err.value = null
      baseRef.value = normalizeUser(u || {})
    }

    watch(() => props.open, (ov) => { if (ov) initFromUser(props.user || {}) })
    watch(() => props.user, (u) => { if (props.open) initFromUser(u || {}) })

    const base = computed(() => (api.getBase && api.getBase()) ? api.getBase().replace(/\/$/, '') : '')
    const cacheBust = ref(0)
    const avatarPreview = computed(() => {
      if (!form.profile_picture) return ''
      const q = cacheBust.value ? `?t=${cacheBust.value}` : ''
      return `${base.value}/media/${form.profile_picture}${q}`
    })
    const fileEl = ref(null)
    const initial = computed(() => {
      const fallback = () => {
        const u = props.user || {}
        return u.nickname || u.display_name || u.username || 'U'
      }
      const name = form.nickname || fallback()
      return String(name || 'U').trim().charAt(0).toUpperCase() || 'U'
    })

    // 裁剪相关状态
    const cropOpen = ref(false)
    const cropUrl = ref('')
    const cropFile = ref(null)
    const crop = reactive({ W: 0, H: 0, baseScale: 1, zoom: 1, panX: 0, panY: 0, boxSize: 320 })
    const dragging = ref(false)
    const lastPt = ref({ x: 0, y: 0 })

    function openCropper(file) {
      cropFile.value = file
      try { if (cropUrl.value) URL.revokeObjectURL(cropUrl.value) } catch (_) { /* no-op */ }
      cropUrl.value = URL.createObjectURL(file)
      cropOpen.value = true
      const img = new Image()
      img.onload = () => {
        crop.W = img.naturalWidth || img.width
        crop.H = img.naturalHeight || img.height
        const bs = Math.max(crop.boxSize / Math.max(1, crop.W), crop.boxSize / Math.max(1, crop.H))
        crop.baseScale = bs
        crop.zoom = 1
        crop.panX = 0
        crop.panY = 0
      }
      img.src = cropUrl.value
    }

    const cropImgStyle = computed(() => {
      const s = crop.baseScale * crop.zoom
      const w = Math.max(1, crop.W * s)
      const h = Math.max(1, crop.H * s)
      const left = (crop.boxSize - w) / 2 + crop.panX
      const top = (crop.boxSize - h) / 2 + crop.panY
      return { width: w + 'px', height: h + 'px', left: left + 'px', top: top + 'px' }
    })

    function clampPan() {
      const s = crop.baseScale * crop.zoom
      const w = crop.W * s
      const h = crop.H * s
      const limX = Math.max(0, (w - crop.boxSize) / 2)
      const limY = Math.max(0, (h - crop.boxSize) / 2)
      crop.panX = Math.max(-limX, Math.min(limX, crop.panX))
      crop.panY = Math.max(-limY, Math.min(limY, crop.panY))
    }

    watch(() => crop.zoom, () => { clampPan() })

    function getPoint(e) {
      if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY }
      return { x: e.clientX, y: e.clientY }
    }
    function onCropDown(e) {
      dragging.value = true
      lastPt.value = getPoint(e)
      const move = (ev) => { onCropMove(ev) }
      const up = () => { onCropUp(move, up) }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
      window.addEventListener('touchmove', move, { passive: false })
      window.addEventListener('touchend', up)
    }
    function onCropMove(e) {
      if (!dragging.value) return
      const p = getPoint(e)
      const dx = p.x - lastPt.value.x
      const dy = p.y - lastPt.value.y
      crop.panX += dx
      crop.panY += dy
      lastPt.value = p
      clampPan()
    }
    function onCropUp(move, up) {
      dragging.value = false
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', up)
    }

    function getCropRect() {
      const s = crop.baseScale * crop.zoom
      const imgW = crop.W * s
      const imgH = crop.H * s
      const left = (crop.boxSize - imgW) / 2 + crop.panX
      const top = (crop.boxSize - imgH) / 2 + crop.panY
      let x = Math.max(0, Math.round((-left) / s))
      let y = Math.max(0, Math.round((-top) / s))
      let w = Math.round(Math.min(crop.W - x, crop.boxSize / s))
      let h = Math.round(Math.min(crop.H - y, crop.boxSize / s))
      w = Math.max(1, w)
      h = Math.max(1, h)
      return { x, y, w, h }
    }

    async function confirmCrop() {
      try {
        if (!cropFile.value) return
        err.value = null
        const rect = getCropRect()
        const res = await api.avatarUpload(cropFile.value, rect)
        if (res && res.profile_picture) {
          form.profile_picture = res.profile_picture
          cacheBust.value = Date.now()
          try {
            if (auth && auth.user) {
              const now = new Date().toISOString()
              auth.user = { ...(auth.user || {}), profile_picture: res.profile_picture, updated_at: now }
            }
            if (auth && typeof auth.refresh === 'function') {
              await auth.refresh()
            }
          } catch (_) { /* no-op */ }
        }
      } catch (e3) {
        err.value = e3
      } finally {
        closeCrop()
      }
    }

    function closeCrop() {
      cropOpen.value = false
      try { if (cropUrl.value) URL.revokeObjectURL(cropUrl.value) } catch (_) { /* no-op */ }
      cropUrl.value = ''
      cropFile.value = null
    }

    async function onPickAvatar(e) {
      try {
        const file = e.target.files && e.target.files[0]
        if (!file) return
        err.value = null
        openCropper(file)
      } finally {
        try { e.target.value = '' } catch (_) { /* no-op */ }
      }
    }
    function triggerPick() { try { if (fileEl.value) fileEl.value.click() } catch (_) { /* no-op */ } }

    function close() { emit('close') }

    function buildPatch() {
      const cur = {}
      const keys = ['nickname','bio','gender','birth_date','location','website','phone_number','privacy_mode','profile_picture']
      keys.forEach(k => { if (form[k] !== undefined) cur[k] = form[k] })
      // 规范化当前值
      if (typeof cur.nickname === 'string') cur.nickname = cur.nickname.trim()
      if (typeof cur.bio === 'string') cur.bio = cur.bio.trim()
      if (!cur.birth_date) cur.birth_date = null
      if (typeof cur.location === 'string') cur.location = cur.location.trim()
      if (typeof cur.website === 'string') {
        const w = cur.website.trim()
        cur.website = (w && w !== 'https://' && w !== 'http://') ? w : null
      }
      if (typeof cur.phone_number === 'string') {
        const ph = cur.phone_number.trim()
        cur.phone_number = ph ? ph : null
      }
      if (!cur.gender) cur.gender = 'private'
      if (!cur.privacy_mode) cur.privacy_mode = 'public'

      const base = baseRef.value || {}
      const patch = {}
      for (const k of keys) {
        const lhs = (cur[k] === undefined ? null : cur[k])
        const rhs = (base[k] === undefined ? null : base[k])
        if (JSON.stringify(lhs) !== JSON.stringify(rhs)) patch[k] = lhs
      }
      return patch
    }

    async function save() {
      if (saving.value) return
      try {
        saving.value = true
        err.value = null
        const p = buildPatch()
        if (Object.keys(p).length === 0) { emit('close'); return }
        const updated = await api.updateMe(p)
        emit('saved', updated)
        emit('close')
      } catch (e) {
        err.value = e
      } finally {
        saving.value = false
      }
    }

    return { form, err, saving, close, save, onPickAvatar, avatarPreview, initial, triggerPick, fileEl,
             cropOpen, cropUrl, crop, cropImgStyle, onCropDown, confirmCrop, closeCrop }
  }
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: var(--overlay); display:flex; align-items:center; justify-content:center; z-index: 10000; }
.modal { width: min(720px, calc(100vw - 32px)); background: var(--bg-elev); color: var(--text); border-radius:16px; box-shadow: 0 20px 60px rgba(0,0,0,.35); display:flex; flex-direction:column; overflow:hidden; }
.modal-header { display:flex; align-items:center; justify-content:space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); }
.close { background:transparent; border:none; color: var(--muted); font-size:18px; cursor:pointer; }
.body { padding: 12px 16px; }
.grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; }
.field { display:flex; flex-direction:column; gap:6px; }
.field.full { grid-column: 1 / -1; }
.field label { font-size: 12px; color: var(--muted); }
.field input, .field select, .field textarea { padding:10px 12px; border:1px solid var(--border); border-radius:10px; background: var(--bg); color: var(--text); outline:none; }
.foot { display:flex; gap:12px; justify-content:flex-end; padding: 12px 16px 16px; border-top: 1px solid var(--border); }
.btn { padding:8px 12px; border-radius:10px; border:1px solid var(--btn-border); background: var(--btn-bg); color: var(--text); cursor:pointer; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: var(--bg); }
.error { color: var(--danger); padding: 8px 0; }
.avatar-row { display:flex; align-items:center; gap:12px; margin-bottom: 12px; }
.avatar-wrap { width:64px; height:64px; border-radius:999px; overflow:hidden; background: var(--btn-border); display:flex; align-items:center; justify-content:center; }
.avatar { width:100%; height:100%; object-fit: cover; display:block; }
.avatar-fallback { color: var(--text); font-weight:700; }

.crop-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; z-index: 11000; }
.crop-modal { width: min(560px, calc(100vw - 32px)); background: var(--bg-elev); color: var(--text); border-radius:16px; box-shadow: 0 20px 60px rgba(0,0,0,.35); display:flex; flex-direction:column; overflow:hidden; }
.crop-header { display:flex; align-items:center; justify-content:space-between; padding: 12px 16px; border-bottom:1px solid var(--border); }
.crop-body { padding: 12px 16px; display:flex; flex-direction:column; gap:12px; align-items:center; }
.crop-stage { position: relative; overflow: hidden; border-radius: 12px; border:1px solid var(--border); background: #000; touch-action: none; }
.crop-img { position:absolute; user-select:none; -webkit-user-drag:none; }
.crop-mask { position:absolute; inset:0; box-shadow: 0 0 0 2000px rgba(0,0,0,.35) inset; pointer-events:none; }
.crop-controls { width: 100%; display:flex; align-items:center; gap:10px; }
.crop-foot { display:flex; gap:12px; justify-content:flex-end; padding: 12px 16px 16px; border-top:1px solid var(--border); }
</style>

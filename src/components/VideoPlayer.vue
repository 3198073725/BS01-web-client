<template>
  <div class="vp" ref="wrap" @mousemove="onMouseMove" @wheel.prevent="onWheel" @click="onToggleClick" @dblclick.stop.prevent="onDblClick">
    <video ref="video" class="vd" :poster="poster || undefined" :muted="mutedState" playsinline preload="metadata"
      @timeupdate="onTime" @durationchange="onDur" @progress="onProgress" @ended="onEnded" @play="onPlay"
      @pause="onPause" @error="onError" @waiting="onWaiting" @canplay="onCanPlay"></video>
    <video v-if="nextSrc" ref="preload" :src="nextSrc" preload="metadata" style="display:none"></video>
    <!-- 信息与操作叠加层（左下：作者/标题/时间；右侧：点赞/评论/收藏/分享） -->
    <PlayerOverlay
      v-if="videoId"
      :video-id="videoId"
      :author="metaAuthor"
      :title="metaTitle"
      :published-at="metaPublishedAt"
      :likes="metaLikes"
      :comments="metaComments"
      :favorites="metaFavorites"
      :initial-liked="metaLiked"
      :initial-favorited="metaFavorited"
      @update-like="(p) => emit('update-like', p)"
      @update-favorite="(p) => emit('update-favorite', p)"
      @share="openShareModal"
      @open-comments="openCommentsPanel"
    />
    <!-- 评论抽屉与遮罩 -->
    <transition name="fade"><div class="comments-mask" v-show="commentsOpen" @click="closeCommentsPanel"></div></transition>
    <transition name="slide-right">
      <div class="comments-drawer" v-show="commentsOpen" @click.stop>
        <div class="c-head">
          <div class="ttl">评论</div>
          <button class="close" @click.stop="closeCommentsPanel" title="关闭">×</button>
        </div>
        <div class="c-body">
          <CommentsSection ref="commentsRef" v-if="videoId" :video-id="videoId" :comments-allowed="allowed" />
        </div>
        <div class="c-foot">
          <input ref="drawerComposer" v-model.trim="newComment" :placeholder="user ? (allowed ? '发表你的评论…' : '作者已关闭评论') : '登录后发表评论'" @keydown.enter.exact.prevent="submitDrawerComment" />
          <button class="btn send" :disabled="submitBusy || !newComment || !user || !allowed" @click="submitDrawerComment">发表评论</button>
        </div>
      </div>
    </transition>
    <div class="hud" v-show="controlsVisible">
      <div class="left">
        <button class="btn" @click.stop="togglePlay">{{ isPlaying ? '❚❚' : '►' }}</button>
        <div class="time">{{ curText }} / {{ durText }}</div>
      </div>
      <div class="middle" @mousedown.prevent="onSeekStart" @mousemove="onSeekMove" @mouseleave="hoverTime=null">
        <div class="bar">
          <div class="buf" :style="{width: bufPct + '%'}"></div>
          <div class="cur" :style="{width: curPct + '%'}"></div>
        </div>
        <div v-if="hoverTime!==null && !hoverThumb" class="tip" :style="{left: hoverPct + '%'}">{{ formatTime(hoverTime) }}</div>
        <div v-if="hoverThumb" class="thumbbox" :style="{left: hoverPct + '%'}">
          <div class="thumbimg" :style="thumbBoxStyle">
            <img :src="hoverThumb.src" :style="thumbImgStyle" />
          </div>
          <div class="tt">{{ formatTime(hoverTime) }}</div>
        </div>
      </div>
      <div class="right">
        <!-- 音量按钮 + 悬停弹出的纵向音量条 -->
        <div class="vol-pop" @wheel.prevent="onWheelVolume">
          <div class="vol-menu">
            <input class="vrange" type="range" min="0" max="1" step="0.01" v-model.number="volume" @input.stop="applyVolume" />
          </div>
          <button class="btn" @click.stop="toggleMute">{{ mutedState ? '🔇' : '🔊' }}</button>
        </div>

        <!-- 清晰度（分辨率）选择：按钮 + 悬停菜单 -->
        <div class="quality" v-if="showQuality">
          <button class="btn small" title="清晰度">{{ qualityLabel }}</button>
          <div class="qmenu">
            <button class="qitem" :disabled="!canSwitchQuality" :class="{active: level === -1}" @click="canSwitchQuality && setLevel(-1)">自动</button>
            <template v-if="canSwitchQuality">
              <button class="qitem" v-for="(lv,i) in levels" :key="i" :class="{active: level === lv.index}" @click="setLevel(lv.index)">{{ lv.label }}</button>
            </template>
          </div>
        </div>
        <div class="rate-menu">
          <button class="btn small" title="播放速度">{{ rateLabel }}</button>
          <div class="rmenu">
            <button class="ritem" v-for="r in rateOptions" :key="r" :class="{active: rate === r}" @click="setRate(r)">{{ r }}x</button>
          </div>
        </div>
        <button class="btn" @click.stop="enterPiP">PiP</button>
        <button class="btn" :class="{ on: autonext }" @click.stop="toggleAutoNext">{{ autonext ? '连播:开' : '连播:关' }}</button>
      </div>
    </div>
    <!-- 底部常驻迷你进度条（不受 HUD 显隐影响） -->
    <div class="mini-progress"><div class="mini-cur" :style="{ width: curPct + '%' }"></div></div>
  </div>

  <transition name="fade">
    <div v-if="shareOpen" class="share-mask" @click.self="closeShare">
      <div class="share-modal">
        <header>
          <div class="ttl">分享</div>
          <button class="close" @click="closeShare">✕</button>
        </header>
        <div class="body">
          <div class="row">
            <label>链接</label>
            <div class="link">
              <input :value="shareLink" readonly />
              <div class="actions">
                <button class="btn small ghost" @click="copyLink">复制</button>
                <button class="btn small ghost" v-if="canSystemShare" @click="systemShare">系统分享</button>
              </div>
            </div>
          </div>
          <div class="row dual">
            <div class="cell">
              <label>稍后看</label>
              <button class="btn small" :class="{on: watchLaterSaved}" :disabled="shareBusy" @click="toggleWatchLater">
                {{ watchLaterSaved ? '已加入' : '加入' }}
              </button>
            </div>
            <div class="cell">
              <label>下载</label>
              <template v-if="downloadUrl">
                <a class="btn small ghost" :href="downloadUrl" download target="_blank" rel="noreferrer">下载视频</a>
              </template>
              <span v-else class="muted">作者未开启下载</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import PlayerOverlay from './PlayerOverlay.vue'
import CommentsSection from './CommentsSection.vue'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

const props = defineProps({
  src: { type: String, default: '' },
  poster: { type: String, default: '' },
  autoplay: { type: Boolean, default: true },
  muted: { type: Boolean, default: true },
  nextSrc: { type: String, default: '' },
  thumbVtt: { type: String, default: '' },
  // 叠加层元信息
  videoId: { type: [String, Number], default: '' },
  metaAuthor: { type: Object, default: () => ({}) },
  metaTitle: { type: String, default: '' },
  metaPublishedAt: { type: [String, Date], default: '' },
  metaLikes: { type: Number, default: 0 },
  metaComments: { type: Number, default: 0 },
  metaFavorites: { type: Number, default: 0 },
  metaLiked: { type: Boolean, default: false },
  metaFavorited: { type: Boolean, default: false },
  commentsAllowed: { type: Boolean, default: true },
})
const emit = defineEmits(['request-next', 'request-prev', 'error', 'update-like', 'update-favorite', 'update-comments', 'share'])

const wrap = ref(null)
const video = ref(null)
const preload = ref(null)
const commentsRef = ref(null)
const drawerComposer = ref(null)
const newComment = ref('')
const submitBusy = ref(false)
const auth = useAuthStore()
const ui = useUiStore()
const user = computed(() => auth.user)

// 本地允许评论标记（与父组件 props 同步），用于在 403 后本地禁用
const allowed = ref(!!props.commentsAllowed)
watch(() => props.commentsAllowed, (nv) => { allowed.value = !!nv })

const isPlaying = ref(false)
const duration = ref(0)
const current = ref(0)
const bufferedEnd = ref(0)
// 路由切换时的停止标记：一旦为 true，本实例不再自动播放
const navStop = ref(false)
const curPct = computed(() => duration.value ? Math.min(100, Math.max(0, (current.value / duration.value) * 100)) : 0)
const bufPct = computed(() => duration.value ? Math.min(100, Math.max(0, (bufferedEnd.value / duration.value) * 100)) : 0)
const curText = computed(() => formatTime(current.value))
const durText = computed(() => formatTime(duration.value))

const controlsVisible = ref(true)
let hideTimer = null

const volume = ref(0.6)
const mutedState = ref(!!props.muted)
const rate = ref(1)
const rateOptions = [0.5, 0.75, 1, 1.25, 1.5, 2]
const rateLabel = computed(() => `${rate.value}x`)
// HLS levels
const levels = ref([])
const level = ref(-1) // -1 自动，其它为 level index
const isHls = ref(false)
const triedFallback = ref(false)

// --- 分享弹窗 ---
const shareOpen = ref(false)
const shareBusy = ref(false)
const watchLaterSaved = ref(false)
const downloadUrl = ref('')
const shareLink = computed(() => {
  try {
    const origin = window?.location?.origin || ''
    return props.videoId ? `${origin}/video/${props.videoId}` : origin
  } catch (_) { return '' }
})
const canSystemShare = computed(() => typeof navigator !== 'undefined' && !!navigator.share)

function watchLaterKey() { return props.videoId ? `watchlater:${props.videoId}` : '' }
function loadWatchLaterLocal() {
  try {
    const k = watchLaterKey(); if (!k) return null
    const v = localStorage.getItem(k)
    if (v === '1') return true
    if (v === '0') return false
    return null
  } catch (_) { return null }
}
function saveWatchLaterLocal(v) {
  try {
    const k = watchLaterKey(); if (!k) return
    localStorage.setItem(k, v ? '1' : '0')
  } catch (_) { /* no-op */ }
}

async function openShareModal() {
  shareOpen.value = true
  await ensureShareData()
}
function closeShare() { shareOpen.value = false }

async function ensureShareData() {
  if (!props.videoId) return
  try {
    const d = await api.videoDetail(props.videoId)
    downloadUrl.value = d?.allow_download ? (d?.video_url || d?.hls_master_url || '') : ''
    if (typeof d?.watch_later === 'boolean') {
      watchLaterSaved.value = !!d.watch_later
      saveWatchLaterLocal(watchLaterSaved.value)
    } else {
      const local = loadWatchLaterLocal()
      if (local !== null) watchLaterSaved.value = local
    }
  } catch (_) {
    downloadUrl.value = ''
    const local = loadWatchLaterLocal()
    if (local !== null) watchLaterSaved.value = local
  }
}

async function copyLink() {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareLink.value)
    } else {
      // 兼容 http、本地文件或禁用 Clipboard API 的环境
      const ta = document.createElement('textarea')
      ta.value = shareLink.value
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    ui.showDialog('链接已复制', 'success')
  } catch (_) {
    ui.showDialog('复制失败，请手动复制上方链接', 'error')
  }
}

async function systemShare() {
  if (!canSystemShare.value) return
  try {
    await navigator.share({ title: props.metaTitle || '分享视频', url: shareLink.value })
  } catch (_) { /* no-op */ }
}

async function toggleWatchLater() {
  if (!props.videoId || shareBusy.value) return
  shareBusy.value = true
  try {
    const res = await api.watchLaterToggle(props.videoId)
    // 若后端未返回 saved，前端取反以体现状态
    if (typeof res?.saved === 'boolean') watchLaterSaved.value = !!res.saved
    else watchLaterSaved.value = !watchLaterSaved.value
    saveWatchLaterLocal(watchLaterSaved.value)
  } catch (e) {
    ui.showDialog((e && (e.detail || e.message)) || '操作失败', 'error')
  } finally {
    shareBusy.value = false
  }
}

// 评论面板开关
const commentsOpen = ref(false)
function lockWrap() {
  try {
    const el = wrap.value
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.width = `${Math.round(r.width)}px`
    el.style.height = `${Math.round(r.height)}px`
  } catch (_) { /* no-op */ }
}
function unlockWrap() {
  try {
    const el = wrap.value
    if (!el) return
    el.style.width = ''
    el.style.height = ''
  } catch (_) { /* no-op */ }
}
function openCommentsPanel() {
  lockWrap()
  commentsOpen.value = true
  nextTick(() => {
    try {
      const el = drawerComposer.value
      if (el && typeof el.focus === 'function') {
        try { el.focus({ preventScroll: true }) } catch (_) { el.focus() }
      }
    } catch (_) { /* no-op */ }
  })
}
function closeCommentsPanel() {
  commentsOpen.value = false
  setTimeout(() => { unlockWrap() }, 220)
}

const hoverTime = ref(null)
const hoverPct = ref(0)
// 拖动中标记（用于无 VTT 时仅在拖动时显示封面作为预览）
const dragging = ref(false)
// 缩略图 cues
const thumbCues = ref([])
const hoverThumb = computed(() => {
  if (hoverTime.value === null) return null
  const t = hoverTime.value
  const cues = thumbCues.value
  if (Array.isArray(cues) && cues.length) {
    const c = cues.find(x => t >= x.start && t < x.end) || cues[cues.length - 1]
    return c || null
  }
  // 无 VTT：仅在拖动时使用封面作为预览，避免“每个位置都是同一张图”的悬停体验
  if (dragging.value && props.poster) return { src: props.poster, x: 0, y: 0, w: 160, h: 90 }
  return null
})
const thumbBoxStyle = computed(() => {
  const c = hoverThumb.value
  if (!c) return { width: '160px', height: '90px' }
  const w = Math.max(1, c.w || 160)
  const h = Math.max(1, c.h || 90)
  return { width: `${w}px`, height: `${h}px` }
})
const thumbImgStyle = computed(() => {
  const c = hoverThumb.value
  if (!c) return {}
  const x = Number(c.x || 0)
  const y = Number(c.y || 0)
  return { position: 'relative', left: `${-x}px`, top: `${-y}px`, display: 'block' }
})

let wheelAcc = 0
let wheelAt = 0

// --- 断点续播（本地缓存） ---
let lastSaveTs = 0
const resumeAt = ref(null)
function resumeKey() { return props.videoId ? `vp_pos:${props.videoId}` : '' }
function loadResume() {
  try {
    // respect global resume toggle
    try { if (localStorage.getItem('vp_resume') === '0') { resumeAt.value = null; return } } catch (_) { /* no-op */ }
    const k = resumeKey(); if (!k) { resumeAt.value = null; return }
    const v = parseFloat(localStorage.getItem(k) || 'NaN')
    resumeAt.value = (Number.isFinite(v) && v > 0) ? v : null
  } catch (_) { resumeAt.value = null }
}
function saveResume() {
  try {
    try { if (localStorage.getItem('vp_resume') === '0') return } catch (_) { /* no-op */ }
    const k = resumeKey(); if (!k) return
    const now = Date.now(); if (now - lastSaveTs < 1000) return
    lastSaveTs = now
    const t = Math.floor((video.value?.currentTime || current.value || 0))
    if (t > 0) localStorage.setItem(k, String(t))
  } catch (_) { /* no-op */ }
}
function applyResumeIfNeeded() {
  try {
    const d = Number(duration.value || 0)
    const t = Math.min(d, Math.max(0, Number(resumeAt.value || 0)))
    if (d > 0 && t > 0) { video.value.currentTime = t }
    resumeAt.value = null
  } catch (_) { /* no-op */ }
}

function formatTime(s) {
  s = Math.max(0, Math.floor(s || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${m}:${String(sec).padStart(2,'0')}`
}

// --- 观看历史记录（周期上报 + 关键节点刷新） ---
let recordTimer = null
const historyOff = ref(false)
async function sendHistoryRecord() {
  try {
    if (historyOff.value) return
    const vid = props.videoId
    if (!vid) return
    const cur = Math.floor(current.value || 0)
    const dur = Math.floor(duration.value || 0)
    const prog = dur > 0 ? Math.min(1, Math.max(0, (current.value || 0) / (duration.value || 0))) : 0
    await api.historyRecord({ videoId: vid, current: cur, duration: dur, progress: prog, watchDuration: cur })
  } catch (e) {
    try {
      const st = Number((e && e.status) || 0)
      // 仅在 404（端点不存在）时停用；5xx 暂时跳过，等待后端恢复后继续重试
      if (st === 404) { historyOff.value = true; stopRecord(false) }
    } catch (_) { /* no-op */ }
  }
}
function startRecord() {
  if (historyOff.value) return
  if (recordTimer) return
  // 立即上报一次，随后每 10 秒上报
  sendHistoryRecord()
  recordTimer = setInterval(() => { sendHistoryRecord() }, 10000)
}
function stopRecord(flush = false) {
  if (recordTimer) { try { clearInterval(recordTimer) } catch (_) { void 0 } recordTimer = null }
  if (flush) sendHistoryRecord()
}

function onTime() { current.value = video.value?.currentTime || 0 }
function onDur() { duration.value = video.value?.duration || 0 }
function onProgress() {
  try {
    const b = video.value.buffered
    if (b && b.length) bufferedEnd.value = b.end(b.length - 1)
  } catch (_) { void 0 }
}
function onPlay() { isPlaying.value = true; scheduleHide(); startRecord() }
function onPause() { isPlaying.value = false; controlsVisible.value = true; clearHide(); stopRecord(true) }
function onEnded() {
  isPlaying.value = false;
  stopRecord(true);
  if (autonext.value) {
    emit('request-next', { auto: true })
  } else {
    try { if (video.value) video.value.currentTime = 0 } catch (_) { /* no-op */ }
    current.value = 0
    controlsVisible.value = true
  }
}
async function onError() {
  emit('error'); isPlaying.value = false
  try {
    // 若当前源是 m3u8 且尚未尝试过回退，则尝试回退到 MP4
    if (!triedFallback.value) {
      const cur = (video.value && (video.value.currentSrc || video.value.src)) || ''
      if (isM3U8(cur) || (/\.m3u8(\?|$)/i.test(String(cur)))) {
        triedFallback.value = true
        if (props.videoId) {
          try {
            const d = await api.videoDetail(String(props.videoId))
            const mp4 = d && d.video_url
            video.value.src = mp4 || ''
            await video.value.load?.()
            if (mp4) { try { await play() } catch (_) { /* no-op */ } }
          } catch (_) { /* no-op */ }
        }
      }
    }
  } catch (_) { /* no-op */ }
}
function onWaiting() { void 0 }
function onCanPlay() { applyResumeIfNeeded(); if (navStop.value) return; if (props.autoplay) { try { play() } catch (_) { /* no-op */ } } }

function play() {
  try {
    const p = video.value.play()
    // 避免未处理的 Promise 拒绝在控制台报错（如被随即的 pause() 中断）
    if (p && typeof p.catch === 'function') p.catch(() => {})
    return p
  } catch (_) { return Promise.resolve() }
}
function pause() { try { video.value.pause() } catch (_) { void 0 } }
async function togglePlay() {
  if (isPlaying.value) { pause() }
  else {
    try {
      const d = Number(duration.value || 0)
      const t = Number((video.value && video.value.currentTime) || current.value || 0)
      if (d > 0 && (t >= d - 0.2)) { try { video.value.currentTime = 0 } catch (_) { /* no-op */ } }
      await play()
    } catch (_) { /* no-op */ }
  }
}
function onToggleClick(e) {
  if (e.target.closest('.hud')) return
  // 首次交互时若静音，先取消静音并应用音量
  if (mutedState.value) { mutedState.value = false; applyVolume() }
  togglePlay()
}

function onDblClick() { togglePlay() }

function applyVolume() {
  try {
    video.value.volume = Math.min(1, Math.max(0, volume.value));
    video.value.muted = mutedState.value;
    try { localStorage.setItem('vp_vol', String(volume.value)); localStorage.setItem('vp_muted', mutedState.value ? '1' : '0') } catch (_) { void 0 }
  } catch (_) { void 0 }
}
function toggleMute() { mutedState.value = !mutedState.value; applyVolume() }
function onWheelVolume(e) { const d = e.deltaY; volume.value = Math.min(1, Math.max(0, volume.value - d/1000)); if (volume.value>0) mutedState.value=false; applyVolume() }

function applyRate() { try { video.value.playbackRate = rate.value } catch (_) { void 0 } }
function setRate(v) { rate.value = v; applyRate() }

const seeking = ref(false)
let seekRect = null
function seekTo(clientX) {
  if (!seekRect || !duration.value) return
  const pct = (clientX - seekRect.left) / seekRect.width
  const t = Math.min(duration.value, Math.max(0, pct * duration.value))
  hoverPct.value = Math.min(100, Math.max(0, pct * 100))
  hoverTime.value = t
  try { video.value.currentTime = t } catch (_) { void 0 }
}
function onSeekStart(e) {
  controlsVisible.value = true; clearHide()
  seekRect = e.currentTarget.getBoundingClientRect()
  seeking.value = true
  dragging.value = true
  seekTo(e.clientX)
  document.addEventListener('mousemove', onDocSeekMove)
  document.addEventListener('mouseup', onDocSeekEnd)
}
function onSeekMove(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const pct = (e.clientX - rect.left) / rect.width
  hoverPct.value = Math.min(100, Math.max(0, pct * 100))
  const t = Math.min(duration.value, Math.max(0, pct * duration.value))
  hoverTime.value = t
  if (seeking.value) { seekRect = rect; seekTo(e.clientX) }
}
function onDocSeekMove(e) { if (seeking.value) { seekTo(e.clientX) } }
function onDocSeekEnd() {
  seeking.value = false
  seekRect = null
  dragging.value = false
  document.removeEventListener('mousemove', onDocSeekMove)
  document.removeEventListener('mouseup', onDocSeekEnd)
  scheduleHide()
}

function onMouseMove() { controlsVisible.value = true; scheduleHide() }
function scheduleHide() { if (!isPlaying.value) return; clearHide(); hideTimer = setTimeout(()=>{ controlsVisible.value=false }, 2000) }
function clearHide() { if (hideTimer) { clearTimeout(hideTimer); hideTimer=null } }

function onWheel(e) {
  const now = Date.now()
  if (now - wheelAt > 600) wheelAcc = 0
  wheelAt = now
  wheelAcc += e.deltaY
  const thr = 160
  if (wheelAcc > thr) { wheelAcc = 0; emit('request-next') }
  else if (wheelAcc < -thr) { wheelAcc = 0; emit('request-prev') }
}

// 连续播放开关
const autonext = ref(false)
function toggleAutoNext() { autonext.value = !autonext.value; try { localStorage.setItem('vp_autonext', autonext.value ? '1' : '0') } catch (_) { /* no-op */ } }

function onKey(e) {
  // 仅当前激活的播放器响应键盘事件，避免多个实例同时处理
  if (!props.autoplay) return
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return
  if (e.code === 'Escape' && commentsOpen.value) { e.preventDefault(); closeCommentsPanel(); return }
  if (e.code === 'Space') { e.preventDefault(); togglePlay() }
  else if (e.code === 'ArrowLeft') { e.preventDefault(); try { video.value.currentTime = Math.max(0, (video.value.currentTime||0) - 5) } catch(_) { void 0 } }
  else if (e.code === 'ArrowRight') { e.preventDefault(); try { video.value.currentTime = Math.min(duration.value||0, (video.value.currentTime||0) + 5) } catch(_) { void 0 } }
  else if (e.code === 'KeyM') { e.preventDefault(); toggleMute() }
  else if (e.code === 'ArrowUp') { e.preventDefault(); volume.value = Math.min(1, volume.value + 0.05); if (volume.value>0) mutedState.value=false; applyVolume() }
  else if (e.code === 'ArrowDown') { e.preventDefault(); volume.value = Math.max(0, volume.value - 0.05); if (volume.value===0) mutedState.value=true; applyVolume() }
  else if (e.code === 'PageDown') { e.preventDefault(); emit('request-next') }
  else if (e.code === 'PageUp') { e.preventDefault(); emit('request-prev') }
  else if (e.code === 'KeyC') { e.preventDefault(); openCommentsPanel() }
}

async function submitDrawerComment() {
  if (!user.value) { try { ui.showDialog('请先登录', 'warn') } catch (e) { void e } return }
  if (!allowed.value) { try { ui.showDialog('作者已关闭评论', 'warn') } catch (e) { void e } return }
  const content = String(newComment.value || '').trim(); if (!content) return
  if (submitBusy.value) return; submitBusy.value = true
  try {
    const c = await api.commentCreate({ videoId: String(props.videoId), content })
    try { commentsRef.value && commentsRef.value.prepend && commentsRef.value.prepend(c) } catch (_) { /* no-op */ }
    newComment.value = ''
    try { emit('update-comments', { videoId: props.videoId, delta: 1 }) } catch (_) { /* no-op */ }
  } catch (e) {
    try {
      const st = Number((e && e.status) || 0)
      if (st === 401) { ui.showDialog('请先登录', 'warn') }
      else if (st === 403) { ui.showDialog('作者已关闭评论', 'warn'); allowed.value = false }
      else { ui.showDialog(((e && (e.detail || e.message)) || '发表评论失败'), 'error') }
    } catch (_) { /* no-op */ }
  }
  finally { submitBusy.value = false }
}


// --- 动态预连接，降低首包延迟 ---
function addPreconnect(url) {
  try {
    if (!url) return
    const u = new URL(url, window.location.href)
    const href = u.origin
    const exist = Array.from(document.head.querySelectorAll('link[rel="preconnect"],link[rel="dns-prefetch"]'))
      .some(l => l.href === href || l.getAttribute('href') === href)
    if (!exist) {
      const a = document.createElement('link')
      a.rel = 'preconnect'; a.href = href; a.crossOrigin = ''
      document.head.appendChild(a)
      const b = document.createElement('link')
      b.rel = 'dns-prefetch'; b.href = href
      document.head.appendChild(b)
    }
  } catch (_) { void 0 }
}

// --- HLS 支持（按需加载 hls.js） ---
let hls = null
function cleanupHls() {
  try { hls && hls.destroy && hls.destroy() } catch (_) { void 0 }
  hls = null
}
function isM3U8(u) { return typeof u === 'string' && /\.m3u8(\?|$)/i.test(u) }
function isSafari() {
  try {
    const ua = navigator.userAgent || ''
    // Safari (exclude Chrome/Android)
    return /safari/i.test(ua) && !/chrome|crios|android/i.test(ua)
  } catch (_) { return false }
}
function nativeHlsSupported() {
  try {
    const v = document.createElement('video')
    const can = v && typeof v.canPlayType === 'function' ? v.canPlayType('application/vnd.apple.mpegURL') : ''
    // 仅在 Safari 上认为原生支持 HLS，其它浏览器统一用 hls.js
    return isSafari() && !!can
  } catch (_) { return false }
}
// 优先使用本地依赖（动态导入，避免构建时全量引入）
let LocalHls = null
async function getLocalHls() {
  if (LocalHls) return LocalHls
  try {
    const mod = await import(/* webpackChunkName: "hlsjs" */ 'hls.js/dist/hls.min.js')
    LocalHls = (mod && (mod.default || mod)) || null
  } catch (_) { LocalHls = null }
  return LocalHls
}
let _hlsLoading = null
async function loadHlsMulti() {
  if (window.Hls) return window.Hls
  if (_hlsLoading) return _hlsLoading
  _hlsLoading = (async () => {
    // 仅尝试本地依赖，不再走外网 CDN
    try { const lib = await getLocalHls(); if (lib) return lib } catch (_) { /* no-op */ }
    return null
  })()
  return _hlsLoading
}
async function setSource(url) {
  try {
    triedFallback.value = false
    cleanupHls()
    if (!video.value) return
    if (isM3U8(url) && !nativeHlsSupported()) {
      const HlsLib = await loadHlsMulti()
      if (HlsLib && HlsLib.isSupported && HlsLib.isSupported()) {
        hls = new HlsLib({ enableWorker: true, lowLatencyMode: true })
        hls.attachMedia(video.value)
        hls.loadSource(url)
        const Events = HlsLib.Events
        isHls.value = true
        hls.on(Events.MANIFEST_PARSED, () => {
          try {
            const arr = (hls.levels || []).map((L, idx) => ({ index: idx, label: L.height ? `${L.height}p` : `${Math.round((L.bitrate||0)/1000)}kbps` }))
            levels.value = arr
            level.value = -1
          } catch (_) { void 0 }
        })
        hls.on(Events.LEVEL_SWITCHED, (e, data) => { try { level.value = (data && typeof data.level === 'number') ? data.level : level.value } catch (_) { void 0 } })
      } else {
        // 兜底：尝试回退到 MP4 源
        try {
          if (props.videoId) {
            const d = await api.videoDetail(String(props.videoId))
            const mp4 = d && d.video_url
            if (mp4) {
              video.value.src = mp4
            } else {
              video.value.src = ''
            }
            triedFallback.value = true
          } else {
            video.value.src = ''
          }
        } catch (_) {
          video.value.src = ''
        }
        isHls.value = false; levels.value = []; level.value = -1
      }
    } else {
      video.value.src = url || ''
      isHls.value = false; levels.value = []; level.value = -1
    }
    await video.value.load?.()
  } catch (_) { void 0 }
}
function applyLevel() { try { if (hls && typeof level.value === 'number') hls.currentLevel = level.value } catch (_) { void 0 } }
function setLevel(idx) { try { level.value = Number(idx) } catch (_) { level.value = -1 } applyLevel() }
function autoPlayIfActive() { try { if (!navStop.value && props.autoplay) play() } catch (_) { /* no-op */ } }
const qualityLabel = computed(() => {
  try {
    // HLS 源：显示“自动”或具体分辨率；非 HLS 源：显示占位“清晰度”
    if (!isHls.value && !(typeof props.src === 'string' && /\.m3u8(\?|$)/i.test(props.src))) return '清晰度'
    if (!levels.value || !levels.value.length) return '自动'
    if (level.value === -1) return '自动'
    const m = levels.value.find(l => l.index === level.value)
    return (m && m.label) || '清晰度'
  } catch (_) { return '清晰度' }
})
const showQuality = computed(() => !!(isHls.value || (typeof props.src === 'string' && /\.m3u8(\?|$)/i.test(props.src))))
const canSwitchQuality = computed(() => !!(isHls.value && levels.value && levels.value.length > 1))

watch(() => props.src, async (nv) => {
  // 切换视频源前刷新一次历史
  stopRecord(true)
  addPreconnect(nv)
  loadResume()
  await setSource(nv)
  current.value = 0; duration.value = 0; bufferedEnd.value = 0; isPlaying.value = false
  triedFallback.value = false
  // 新源加载后解除导航停止标记（仅当组件仍在使用）
  navStop.value = false
  autoPlayIfActive()
})

watch(() => props.nextSrc, (nv) => { addPreconnect(nv) })

// 当该实例不再处于“当前播放”时，立即暂停；若被导航停止标记阻止，则不触发自动播放
watch(() => props.autoplay, (nv) => { if (nv && !navStop.value) { try { play() } catch (_) { /* no-op */ } } else { pause() } })

// --- 缩略图 VTT 加载 ---
function toSeconds(str) {
  try {
    const s = String(str).trim()
    const a = s.split(':')
    if (a.length === 3) return (+a[0])*3600 + (+a[1])*60 + parseFloat(a[2])
    if (a.length === 2) return (+a[0])*60 + parseFloat(a[1])
    return parseFloat(s)
  } catch (_) { return 0 }
}
function parseVtt(text) {
  const out = []
  const lines = String(text || '').split(/\r?\n/)
  for (let i=0; i<lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('WEBVTT')) continue
    if (line.includes('-->')) {
      const [st, en] = line.split('-->').map(s => s.trim())
      let url = ''
      let x=0,y=0,w=160,h=90
      let j = i+1
      while (j<lines.length && !lines[j].trim()) j++
      if (j<lines.length) {
        url = lines[j].trim()
        const m = url.match(/#xywh=(\d+),(\d+),(\d+),(\d+)/)
        if (m) { x=+m[1]; y=+m[2]; w=+m[3]; h=+m[4] }
        i = j
      }
      out.push({ start: toSeconds(st), end: toSeconds(en), src: url.split('#')[0], x, y, w, h })
    }
  }
  return out
}
async function loadThumbVtt(url) {
  try {
    if (!url) { thumbCues.value = []; return }
    const res = await fetch(url)
    const txt = await res.text()
    const cues = parseVtt(txt) || []
    // 以 VTT 文件 URL 为基址解析相对路径，确保不同 Host 下也能正确加载
    try {
      const base = new URL(url, window.location.href)
      cues.forEach(c => { try { if (c && c.src) c.src = new URL(c.src, base.href).href } catch (_) { /* no-op */ } })
    } catch (_) { /* no-op */ }
    thumbCues.value = cues
  } catch (_) { thumbCues.value = [] }
}
watch(() => props.thumbVtt, (nv) => { if (nv) loadThumbVtt(nv); else thumbCues.value = [] }, { immediate: true })

function onVis() { if (document.hidden) pause() }

async function enterPiP() {
  try { if (document.pictureInPictureElement) { await document.exitPictureInPicture() } else { await video.value.requestPictureInPicture() } } catch (_) { void 0 }
}

function onNavStart() {
  try { pause() } catch (_) { /* no-op */ }
  try { cleanupHls() } catch (_) { /* no-op */ }
  isPlaying.value = false
  navStop.value = true
}

async function onNavEnd() {
  // 仅当当前实例为激活播放器时，恢复媒体管线
  try {
    if (!props.autoplay) return
    navStop.value = false
    // 若 src 已被移除，重新设置播放源
    const needsSrc = !video.value || !video.value.getAttribute || !video.value.getAttribute('src')
    if (needsSrc) {
      await setSource(props.src)
      applyVolume(); applyRate();
    }
    // 恢复自动播放
    try { await play() } catch (_) { /* no-op */ }
  } catch (_) { /* no-op */ }
}

let keyBound = false
function bindKeys(shouldBind) {
  try {
    if (shouldBind && !keyBound) { window.addEventListener('keydown', onKey, { passive: false }); keyBound = true }
    else if (!shouldBind && keyBound) { window.removeEventListener('keydown', onKey); keyBound = false }
  } catch (_) { /* no-op */ }
}

onMounted(async () => {
  bindKeys(!!props.autoplay)
  try { window.addEventListener('app:navigate-start', onNavStart) } catch (_) { /* no-op */ }
  try { window.addEventListener('app:navigate-end', onNavEnd) } catch (_) { /* no-op */ }
  document.addEventListener('visibilitychange', onVis)
  // 恢复音量/静音设置
  try {
    const v = parseFloat(localStorage.getItem('vp_vol') || '0.6'); if (!Number.isNaN(v)) volume.value = Math.min(1, Math.max(0, v))
    const m = localStorage.getItem('vp_muted'); if (m === '0' || m === '1') mutedState.value = (m === '1')
    const an = localStorage.getItem('vp_autonext'); if (an === '1') autonext.value = true
    const r = parseFloat(localStorage.getItem('vp_rate') || 'NaN'); if (!Number.isNaN(r) && r > 0) rate.value = r
  } catch (_) { void 0 }
  addPreconnect(props.src); addPreconnect(props.nextSrc)
  await setSource(props.src)
  applyVolume(); applyRate(); loadResume()
  autoPlayIfActive()
})

// 根据 autoplay 切换全局键盘监听，仅当前激活播放器绑定
watch(() => props.autoplay, (nv) => { bindKeys(!!nv) })

// Persist default playback rate when user changes it
watch(() => rate.value, (nv) => { try { if (Number.isFinite(nv)) localStorage.setItem('vp_rate', String(nv)) } catch (_) { /* no-op */ } })

onBeforeUnmount(() => {
  bindKeys(false)
  try { window.removeEventListener('app:navigate-start', onNavStart) } catch (_) { /* no-op */ }
  try { window.removeEventListener('app:navigate-end', onNavEnd) } catch (_) { /* no-op */ }
  document.removeEventListener('visibilitychange', onVis)
  clearHide()
  cleanupHls()
  stopRecord(true)
  saveResume()
  try {
    document.removeEventListener('mousemove', onDocSeekMove)
    document.removeEventListener('mouseup', onDocSeekEnd)
  } catch (_) { void 0 }
})
</script>

<style scoped>
.vp{position:relative;width:100%;height:100%;background:#000;border-radius:12px;overflow:hidden;contain:layout paint;overflow-anchor:none;overscroll-behavior:contain}
.vd{position:absolute;inset:0;width:100%;height:100%;display:block;background:#000;object-fit:contain;transform:translateZ(0);backface-visibility:hidden}
.hud{position:absolute;left:0;right:0;bottom:5px;display:flex;align-items:center;gap:8px;padding:8px;background:linear-gradient(transparent,rgba(0,0,0,.6));color:#fff}
.left{display:flex;align-items:center;gap:8px}
.middle{position:relative;flex:1;height:28px;display:flex;align-items:center;cursor:pointer}
.bar{position:absolute;left:0;right:0;height:4px;background:rgba(255,255,255,.2);border-radius:2px}
.buf{position:absolute;left:0;top:0;height:4px;background:rgba(255,255,255,.35);border-radius:2px}
.cur{position:absolute;left:0;top:0;height:4px;background:#fff;border-radius:2px}
.tip{position:absolute;bottom:14px;transform:translateX(-50%);background:rgba(0,0,0,.7);color:#fff;padding:2px 6px;border-radius:4px;font-size:12px;white-space:nowrap}
.thumbbox{position:absolute;bottom:48px;transform:translateX(-50%);z-index:2;pointer-events:none}
.thumbimg{background:#000;border:1px solid rgba(255,255,255,.2);border-radius:6px;overflow:hidden}
.thumbimg img{display:block;}
.thumbbox .tt{margin-top:4px;color:#fff;font-size:12px;text-align:center;background:rgba(0,0,0,.5);padding:2px 6px;border-radius:4px}
.right{display:flex;align-items:center;gap:8px}
.btn{background:rgba(255,255,255,.12);border:none;color:#fff;border-radius:5px;padding:3px 6px;cursor:pointer;font-size:12px}
.btn.on{background:var(--accent);color:#000}
.btn.small{padding:2px 5px;font-size:11px}
.range{width:70px}
.sel{background:rgba(255,255,255,.12);border:none;color:#fff;border-radius:5px;padding:4px 6px;font-size:12px}
.time{font-size:12px;color:#eee}
.vol{display:flex;align-items:center;gap:6px}
.vol-pop{position:relative;display:flex;align-items:center}
.vol-pop .vol-menu{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);opacity:0;pointer-events:none;transition:opacity .1s ease; transition-delay: .05s; width:34px;height:110px;display:flex;align-items:center;justify-content:center; background:transparent; border:none; padding:0; z-index:50}
.vol-pop:hover .vol-menu{opacity:1;pointer-events:auto;transition-delay: 0s}
.vrange{width:110px;height:20px;transform:rotate(-90deg);transform-origin:center;}

.quality{position:relative;}
.quality .qmenu{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:3px;align-items:stretch;min-width:88px;background:rgba(0,0,0,.78);border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:4px;opacity:0;pointer-events:none;transition:opacity .06s ease; transition-delay: .02s; z-index:50;box-shadow:0 6px 18px rgba(0,0,0,.3)}
.quality:hover .qmenu{opacity:1;pointer-events:auto;transition-delay: 0s}
.qitem{background:transparent;border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:5px;padding:4px 6px;cursor:pointer;text-align:center;font-size:12px}
.qitem.active{background:#38bdf8;color:#0b1220;border-color:#38bdf8}
.rate-menu{position:relative;}
.rate-menu .rmenu{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:3px;align-items:stretch;min-width:88px;background:rgba(0,0,0,.78);border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:4px;opacity:0;pointer-events:none;transition:opacity .06s ease; transition-delay: .02s; z-index:50;box-shadow:0 6px 18px rgba(0,0,0,.3)}
.rate-menu:hover .rmenu{opacity:1;pointer-events:auto;transition-delay:0s}
.ritem{background:transparent;border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:5px;padding:4px 6px;cursor:pointer;text-align:center;font-size:12px}
.ritem.active{background:#38bdf8;color:#0b1220;border-color:#38bdf8}
.mini-progress{position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(255,255,255,.18)}
.mini-cur{height:100%;background:#fff}

/* 分享弹窗 */
.share-mask{position:absolute;inset:0;background:var(--overlay,rgba(0,0,0,.55));z-index:8;display:flex;align-items:center;justify-content:center;pointer-events:auto}
.share-modal{
  width:min(520px,92%);
  background:linear-gradient(135deg,
    color-mix(in srgb, var(--bg-elev) 92%, var(--text) 8%),
    color-mix(in srgb, var(--bg-elev) 88%, #000 12%));
  color:var(--text);
  border-radius:18px;
  padding:18px 20px;
  box-shadow:0 18px 52px rgba(0,0,0,.32);
  border:1px solid color-mix(in srgb, var(--border) 70%, var(--text) 30%);
  backdrop-filter:blur(12px);
}
.share-modal header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.share-modal .ttl{font-weight:800;font-size:17px;letter-spacing:.3px}
.share-modal .close{background:var(--btn-bg);border:1px solid var(--btn-border);color:inherit;font-size:16px;cursor:pointer;border-radius:10px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;transition:background .12s ease}
.share-modal .close:hover{background:var(--hover-bg)}
.share-modal .body{display:flex;flex-direction:column;gap:16px}
.share-modal .row{display:flex;align-items:center;gap:12px}
.share-modal .row.dual{align-items:stretch}
.share-modal .row.dual .cell{flex:1;display:flex;flex-direction:column;gap:8px;background:color-mix(in srgb, var(--bg-elev) 94%, var(--text) 6%);border:1px solid var(--border);border-radius:12px;padding:10px}
.share-modal label{width:72px;color:var(--muted);font-size:13px;text-align:right;opacity:.9}
.share-modal .row.dual label{width:auto;text-align:left;font-weight:700;letter-spacing:.1px;color:var(--text)}
.share-modal .link{flex:1;display:flex;align-items:center;gap:10px;background:color-mix(in srgb, var(--bg-elev) 96%, var(--text) 4%);border:1px solid var(--border);border-radius:12px;padding:8px 10px}
.share-modal .link input{flex:1;height:38px;border:none;background:transparent;border-radius:10px;padding:0 4px;color:var(--text);font-weight:600;user-select:text}
.share-modal .link input:focus{outline:none}
.share-modal .actions{display:flex;gap:8px}
.share-modal .btn{background:var(--accent,#38bdf8);border:1px solid var(--accent,#38bdf8);color:#0b1220;font-weight:700;border-radius:10px;padding:8px 12px;cursor:pointer;transition:transform .08s ease,box-shadow .12s ease, background .12s ease}
.share-modal .btn:hover{transform:translateY(-1px);box-shadow:0 10px 26px color-mix(in srgb, var(--accent) 28%, transparent)}
.share-modal .btn.small{padding:6px 10px;font-size:12px}
.share-modal .btn.ghost{background:var(--btn-bg);border:1px solid var(--btn-border);color:var(--text)}
.share-modal .btn.ghost:hover{background:var(--hover-bg)}
.share-modal .btn.on{background:var(--accent);border-color:var(--accent);color:#0b1220}
.share-modal .muted{color:var(--muted);font-size:13px}
.share-modal a.btn{display:inline-flex;align-items:center;justify-content:center;text-decoration:none}

/* 评论抽屉样式 */
.comments-mask{position:absolute;inset:0;background:rgba(0,0,0,.35);z-index:5}
.comments-drawer{position:absolute;top:0;right:0;bottom:0;width:420px;max-width:92%;background:var(--bg-elev);border-left:1px solid var(--border);z-index:6;display:flex;flex-direction:column;pointer-events:auto;border-top-left-radius:12px;border-bottom-left-radius:12px;box-shadow:-8px 0 24px rgba(0,0,0,.25);will-change:transform}
.comments-drawer .c-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--border)}
.comments-drawer .c-head .ttl{font-weight:800}
.comments-drawer .c-head .close{background:transparent;border:none;color:var(--text);font-size:18px;cursor:pointer}
.comments-drawer .c-body{flex:1;overflow:auto;padding:8px}
.comments-drawer .c-foot{display:flex;align-items:center;gap:10px;padding:10px 12px;border-top:1px solid var(--border);background:var(--bg-elev)}
.comments-drawer .c-foot input{flex:1;height:40px;padding:0 12px;border:1px solid var(--btn-border);border-radius:10px;background:var(--bg);color:var(--text)}
.comments-drawer .c-foot .btn.send{height:40px;background:var(--accent);border:1px solid var(--accent);color:#fff;border-radius:10px;padding:8px 12px;cursor:pointer}
.comments-drawer .c-foot .btn.send:disabled{opacity:.6;cursor:not-allowed}

/* 过渡动画 */
.slide-right-enter-active,.slide-right-leave-active{transition:transform .18s ease}
.slide-right-enter-from,.slide-right-leave-to{transform:translate3d(100%,0,0)}
.fade-enter-active,.fade-leave-active{transition:opacity .18s ease}
.fade-enter-from,.fade-leave-to{opacity:0}
</style>

<template>
  <div class="vp" ref="wrap" @mousemove="onMouseMove" @wheel.prevent="onWheel" @dblclick="toggleFull" @click="onToggleClick">
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
      @share="(p) => emit('share', p)"
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
          <CommentsSection ref="commentsRef" v-if="videoId" :video-id="videoId" />
        </div>
        <div class="c-foot">
          <input ref="drawerComposer" v-model.trim="newComment" :placeholder="user ? '发表你的评论…' : '登录后发表评论'" @keydown.enter.exact.prevent="submitDrawerComment" />
          <button class="btn send" :disabled="submitBusy || !newComment || !user" @click="submitDrawerComment">发表评论</button>
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

        <select class="sel" v-model.number="rate" @change="applyRate">
          <option :value="0.5">0.5x</option>
          <option :value="0.75">0.75x</option>
          <option :value="1">1x</option>
          <option :value="1.25">1.25x</option>
          <option :value="1.5">1.5x</option>
          <option :value="2">2x</option>
        </select>
        <button class="btn" @click.stop="enterPiP">PiP</button>
        <button class="btn" @click.stop="toggleFull">{{ isFull ? '⤢' : '⤡' }}</button>
      </div>
    </div>
    <!-- 底部常驻迷你进度条（不受 HUD 显隐影响） -->
    <div class="mini-progress"><div class="mini-cur" :style="{ width: curPct + '%' }"></div></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import PlayerOverlay from './PlayerOverlay.vue'
import CommentsSection from './CommentsSection.vue'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'

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
})
const emit = defineEmits(['request-next', 'request-prev', 'error', 'update-like', 'update-favorite', 'share'])

const wrap = ref(null)
const video = ref(null)
const preload = ref(null)
const commentsRef = ref(null)
const drawerComposer = ref(null)
const newComment = ref('')
const submitBusy = ref(false)
const auth = useAuthStore()
const user = computed(() => auth.user)

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
// HLS levels
const levels = ref([])
const level = ref(-1) // -1 自动，其它为 level index
const isHls = ref(false)
const triedFallback = ref(false)

// 评论面板开关
const commentsOpen = ref(false)
function openCommentsPanel() { commentsOpen.value = true }
function closeCommentsPanel() { commentsOpen.value = false }

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
    const k = resumeKey(); if (!k) { resumeAt.value = null; return }
    const v = parseFloat(localStorage.getItem(k) || 'NaN')
    resumeAt.value = (Number.isFinite(v) && v > 0) ? v : null
  } catch (_) { resumeAt.value = null }
}
function saveResume() {
  try {
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
function onEnded() { isPlaying.value = false; stopRecord(true) }
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
async function togglePlay() { if (isPlaying.value) pause(); else { try { await play() } catch (_) { /* no-op */ } } }
function onToggleClick(e) {
  if (e.target.closest('.hud')) return
  // 首次交互时若静音，先取消静音并应用音量
  if (mutedState.value) { mutedState.value = false; applyVolume() }
  togglePlay()
}

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
function scheduleHide() { if (!isPlaying.value) return; clearHide(); hideTimer = setTimeout(()=>{ controlsVisible.value=false }, 2500) }
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

const isFull = ref(false)
function toggleFull() {
  const el = wrap.value
  if (!document.fullscreenElement) { try { el.requestFullscreen && el.requestFullscreen() } catch (_) { void 0 } }
  else { try { document.exitFullscreen && document.exitFullscreen() } catch (_) { void 0 } }
}
function onFullChange() { isFull.value = !!document.fullscreenElement }

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
  else if (e.code === 'KeyF') { e.preventDefault(); toggleFull() }
  else if (e.code === 'PageDown') { e.preventDefault(); emit('request-next') }
  else if (e.code === 'PageUp') { e.preventDefault(); emit('request-prev') }
}

async function submitDrawerComment() {
  if (!user.value) { try { alert('请先登录'); } catch (e) { void e } return }
  const content = String(newComment.value || '').trim(); if (!content) return
  if (submitBusy.value) return; submitBusy.value = true
  try {
    const c = await api.commentCreate({ videoId: String(props.videoId), content })
    try { commentsRef.value && commentsRef.value.prepend && commentsRef.value.prepend(c) } catch (_) { /* no-op */ }
    newComment.value = ''
  } catch (_) { /* no-op */ }
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
    thumbCues.value = parseVtt(txt)
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
  document.addEventListener('fullscreenchange', onFullChange)
  // 恢复音量/静音设置
  try {
    const v = parseFloat(localStorage.getItem('vp_vol') || '0.6'); if (!Number.isNaN(v)) volume.value = Math.min(1, Math.max(0, v))
    const m = localStorage.getItem('vp_muted'); if (m === '0' || m === '1') mutedState.value = (m === '1')
  } catch (_) { void 0 }
  addPreconnect(props.src); addPreconnect(props.nextSrc)
  await setSource(props.src)
  applyVolume(); applyRate(); loadResume()
  autoPlayIfActive()
})

// 根据 autoplay 切换全局键盘监听，仅当前激活播放器绑定
watch(() => props.autoplay, (nv) => { bindKeys(!!nv) })

onBeforeUnmount(() => {
  bindKeys(false)
  try { window.removeEventListener('app:navigate-start', onNavStart) } catch (_) { /* no-op */ }
  try { window.removeEventListener('app:navigate-end', onNavEnd) } catch (_) { /* no-op */ }
  document.removeEventListener('visibilitychange', onVis)
  document.removeEventListener('fullscreenchange', onFullChange)
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
.vp{position:relative;width:100%;height:100%;background:#000;border-radius:12px;overflow:hidden}
.vd{width:100%;height:100%;display:block;background:#000;object-fit:contain}
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
.btn{background:rgba(255,255,255,.12);border:none;color:#fff;border-radius:6px;padding:6px 10px;cursor:pointer}
.btn.small{padding:4px 8px;font-size:12px}
.range{width:80px}
.sel{background:rgba(255,255,255,.12);border:none;color:#fff;border-radius:6px;padding:6px 8px}
.time{font-size:12px;color:#eee}
.vol{display:flex;align-items:center;gap:6px}
.vol-pop{position:relative;display:flex;align-items:center}
.vol-pop .vol-menu{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);opacity:0;pointer-events:none;transition:opacity .12s ease; transition-delay: 1s; width:36px;height:110px;display:flex;align-items:center;justify-content:center; background:transparent; border:none; padding:0; z-index:50}
.vol-pop:hover .vol-menu{opacity:1;pointer-events:auto;transition-delay: 0s}
.vrange{width:110px;height:20px;transform:rotate(-90deg);transform-origin:center;}

.quality{position:relative;}
.quality .qmenu{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:6px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.25);border-radius:10px;padding:8px;opacity:0;pointer-events:none;transition:opacity .12s ease; transition-delay: 1s; z-index:50}
.quality:hover .qmenu{opacity:1;pointer-events:auto;transition-delay: 0s}
.qitem{background:transparent;border:1px solid rgba(255,255,255,.25);color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer;text-align:left}
.qitem.active{background:#fff;color:#000;border-color:#fff}
.mini-progress{position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(255,255,255,.18)}
.mini-cur{height:100%;background:#fff}

/* 评论抽屉样式 */
.comments-mask{position:absolute;inset:0;background:rgba(0,0,0,.35);z-index:5}
.comments-drawer{position:absolute;top:0;right:0;bottom:0;width:420px;max-width:92%;background:var(--bg-elev);border-left:1px solid var(--border);z-index:6;display:flex;flex-direction:column;pointer-events:auto;border-top-left-radius:12px;border-bottom-left-radius:12px;box-shadow:-8px 0 24px rgba(0,0,0,.25)}
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
.slide-right-enter-from,.slide-right-leave-to{transform:translateX(100%)}
.fade-enter-active,.fade-leave-active{transition:opacity .18s ease}
.fade-enter-from,.fade-leave-to{opacity:0}
</style>

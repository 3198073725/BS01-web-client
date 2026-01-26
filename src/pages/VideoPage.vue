<template>
  <div class="video-page">
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="err" class="error">{{ err.detail || '加载失败' }}</div>
    <div v-else class="content">
      <h1 class="title">{{ currentTitle }}</h1>
      <div class="player">
        <VideoPlayer
          :src="currentSrc"
          :poster="currentPoster"
          :next-src="nextSrc"
          :thumb-vtt="detail.thumbnail_vtt_url || ''"
          :autoplay="true"
          :muted="true"
          :video-id="vid"
          :meta-author="detail.author || null"
          :meta-title="currentTitle"
          :meta-published-at="detail.published_at || detail.created_at || null"
          :meta-likes="detail.like_count || 0"
          :meta-comments="detail.comment_count || 0"
          :meta-favorites="detail.favorite_count || 0"
          :meta-liked="!!detail.liked"
          :meta-favorited="!!detail.favorited"
          :comments-allowed="commentsAllowed"
          @request-next="goNext"
          @request-prev="goPrev"
          @error="onPlayerError"
          @update-like="onUpdateLike"
          @update-favorite="onUpdateFavorite"
        />
      </div>
      <div class="meta">
        <span>播放：{{ currentViews }}</span>
      </div>
      <div id="comments" style="margin-top:16px">
        <CommentsSection :video-id="vid" :comments-allowed="commentsAllowed" />
      </div>
    </div>
  </div>
  </template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api'
import VideoPlayer from '@/components/VideoPlayer.vue'
import CommentsSection from '@/components/CommentsSection.vue'

const router = useRouter()
const route = useRoute()
const vid = computed(() => String(route.params.id || ''))

// 播放源/元信息缓存
const detail = ref({})
const srcById = ref(Object.create(null))

// 推荐流有序列表（不包含 src）
const items = ref([]) // {id, cover, title, views}
const page = ref(1)
const hasNext = ref(true)
const feedLoading = ref(false)

const loading = ref(true)
const err = ref(null)

const curIndex = computed(() => items.value.findIndex(x => String(x.id) === vid.value))
const current = computed(() => items.value[curIndex.value] || null)
const currentSrc = computed(() => srcById.value[vid.value] || detail.value.video_url || '')
const currentPoster = computed(() => (current.value && current.value.cover) || detail.value.thumbnail_url || '')
const currentTitle = computed(() => (current.value && current.value.title) || detail.value.title || '')
const currentViews = computed(() => (current.value && current.value.views) || detail.value.view_count || 0)
const commentsAllowed = computed(() => {
  try {
    const d = detail.value || {}
    return !(d && d.allow_comments === false)
  } catch (_) { return true }
})

const nextItem = computed(() => items.value[curIndex.value + 1] || null)
const prevItem = computed(() => items.value[curIndex.value - 1] || null)
const nextSrc = ref('')

function mapFeed(list) {
  return (Array.isArray(list) ? list : []).map(v => ({ id: v.id, cover: v.thumbnail_url || '', title: v.title || '', views: v.view_count ?? 0 }))
}

async function loadFeed(p = 1) {
  if (feedLoading.value || !hasNext.value) return
  feedLoading.value = true
  try {
    const res = await api.recommendationFeed({ page: p, pageSize: 12 })
    const mapped = mapFeed(res?.results || res?.items || [])
    if (p === 1) items.value = mapped; else items.value = items.value.concat(mapped)
    page.value = Number(res?.page || p || 1)
    hasNext.value = !!(res?.has_next ?? res?.hasNext)
  } catch (_) { /* no-op */ }
  finally { feedLoading.value = false }
}

async function ensureSrc(id) {
  if (!id) return ''
  const key = String(id)
  if (srcById.value[key]) return srcById.value[key]
  try {
    const d = await api.videoDetail(key)
    if (d && (d.hls_master_url || d.video_url)) {
      const src = d.hls_master_url || d.video_url
      srcById.value[key] = src
      // 同步部分元信息以便展示
      if (!detail.value || String(detail.value.id) !== key) detail.value = d
      return src
    }
  } catch (_) { /* no-op */ }
  return ''
}

async function prefetchNext() {
  nextSrc.value = ''
  if (nextItem.value) {
    const s = await ensureSrc(nextItem.value.id)
    nextSrc.value = s || ''
  }
}

async function init() {
  loading.value = true
  err.value = null
  try {
    if (!vid.value) throw new Error('缺少视频ID')
    // 确保当前视频可播放
    await ensureSrc(vid.value)
    // 准备推荐流
    if (!items.value.length) {
      await loadFeed(1)
      // 若推荐流中没有当前视频，则将当前视频插入列表首位
      if (curIndex.value === -1) {
        const fallback = { id: vid.value, cover: detail.value.thumbnail_url || '', title: detail.value.title || '', views: detail.value.view_count || 0 }
        items.value.unshift(fallback)
      }
    }
    try { await api.analyticsEvents({ type: 'video_view', video_id: vid.value, ts: Date.now() }) } catch (_) { /* no-op */ }
    await prefetchNext()
  } catch (e) {
    err.value = e
  } finally {
    loading.value = false
  }
}

async function goNext() {
  if (nextItem.value) {
    router.push({ name: 'video', params: { id: nextItem.value.id } })
    return
  }
  if (hasNext.value && !feedLoading.value) {
    await loadFeed(page.value + 1)
    if (nextItem.value) router.push({ name: 'video', params: { id: nextItem.value.id } })
  }
}

function goPrev() {
  if (prevItem.value) router.push({ name: 'video', params: { id: prevItem.value.id } })
}

function onPlayerError() { /* 预留：可在此尝试降清晰度或切备用源 */ }

function onUpdateLike({ videoId, liked, likeCount }) {
  try {
    if (String(videoId) === String(vid.value)) {
      const d = detail.value || {}
      const next = { ...d, liked: !!liked }
      if (typeof likeCount === 'number') next.like_count = likeCount
      detail.value = next
    }
  } catch (_) { /* no-op */ }
}
function onUpdateFavorite({ videoId, favorited, favoriteCount }) {
  try {
    if (String(videoId) === String(vid.value)) {
      const d = detail.value || {}
      const next = { ...d, favorited: !!favorited }
      if (typeof favoriteCount === 'number') next.favorite_count = favoriteCount
      detail.value = next
    }
  } catch (_) { /* no-op */ }
}

onMounted(init)
watch(() => route.params.id, async () => {
  // 路由切换后，仅补齐当前播放源与下一条缓存
  await ensureSrc(vid.value)
  try { await api.analyticsEvents({ type: 'video_view', video_id: vid.value, ts: Date.now() }) } catch (_) { /* no-op */ }
  await prefetchNext()
})
</script>

<style scoped>
.video-page { max-width: 960px; margin: 16px auto; padding: 0 12px; color: var(--text); }
.title { font-size: 20px; font-weight: 800; margin: 8px 0 12px; }
.player { background: var(--bg-elev); border:1px solid var(--border); border-radius: 12px; overflow: hidden; }
.placeholder { padding: 40px 0; text-align:center; color: var(--muted); }
.meta { color: var(--muted); margin-top: 8px; }
.loading { color: var(--muted); }
.error { color: var(--danger); }
</style>

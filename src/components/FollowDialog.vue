<template>
  <div v-if="open" class="modal-overlay" @click.self="close">
    <div class="modal">
      <header class="modal-header">
        <nav class="tabs">
          <button :class="['tab', tab==='following' && 'active']" @click="switchTab('following')">
            关注 <span class="count">{{ followingCountDisplay }}</span>
          </button>
          <button :class="['tab', tab==='followers' && 'active']" @click="switchTab('followers')">
            粉丝 <span class="count">{{ followersCountDisplay }}</span>
          </button>
        </nav>
        <button class="close" @click="close">✕</button>
      </header>

      <div class="toolbar">
        <div class="search">
          <input v-model.trim="q" type="text" placeholder="搜索用户名或昵称" @keyup.enter="onSearch" />
          <button class="search-btn" @click="onSearch">搜索</button>
        </div>
        <div class="sort">
          <select v-model="order" @change="onSearch">
            <option value="comprehensive">综合排序</option>
            <option value="latest">最新</option>
            <option value="earliest">最早</option>
          </select>
        </div>
      </div>

      <section class="list" v-if="!loading && items.length">
        <div v-for="u in items" :key="u.id" class="row">
          <img v-if="u.avatar_url" :src="u.avatar_url" class="avatar" alt="avatar" />
          <div v-else class="avatar-fallback">{{ initial(u) }}</div>
          <div class="meta">
            <div class="name">{{ display(u) }} <span v-if="u.is_mutual" class="mutual">互相关注</span></div>
            <div class="bio" v-if="u.bio">{{ u.bio }}</div>
            <div class="sub" v-else><span>{{ u.video_count }} 个作品</span></div>
          </div>
          <button class="follow-btn" :class="u.is_following ? 'following' : ''" @click="toggleFollow(u)">
            {{ u.is_following ? '已关注' : '关注' }}
          </button>
        </div>
      </section>
      <div class="empty" v-else-if="!loading && error">{{ errorMessage }}</div>
      <div class="empty" v-else-if="!loading">暂无数据</div>
      <div class="loading" v-if="loading">加载中...</div>

      <footer class="foot">
        <button v-if="hasNext && !loading" class="more" @click="loadMore">加载更多</button>
      </footer>
    </div>
  </div>
</template>

<script>
import { watch, computed } from 'vue'
import { useFollowList } from '@/composables/useFollowList'
import { displayName, initialFromUser } from '@/utils/user'

export default {
  name: 'FollowDialog',
  props: {
    open: { type: Boolean, default: false },
    initialTab: { type: String, default: 'following' },
    userId: { type: [String, Number], default: null },
    followingCount: { type: Number, default: 0 },
    followersCount: { type: Number, default: 0 },
  },
  emits: ['close', 'changed'],
  setup(props, { emit }) {
    const { tab, q, order, loading, error, items, hasNext, load, loadMore, toggleFollow } = useFollowList({ initialTab: props.initialTab, userId: props.userId })

    // keep reactive with prop
    watch(() => props.initialTab, (v) => { tab.value = v })

    // auto load when open
    watch(() => props.open, (ov) => { if (ov) load(true) })

    function close() { emit('close') }
    function switchTab(kind) { if (tab.value !== kind) { tab.value = kind; load(true) } }
    function onSearch() { load(true) }
    function display(u) { return displayName(u) }
    function initial(u) { return initialFromUser(u) }
    async function onToggleFollow(u) { await toggleFollow(u); emit('changed', { tab: tab.value }); await load(true) }
    const errorMessage = computed(() => String(error.value?.detail || error.value?.message || '加载失败，请稍后重试'))

    return {
      tab, q, order, loading, error, errorMessage, items, hasNext,
      close, switchTab, onSearch, display, initial, loadMore, toggleFollow: onToggleFollow,
      followingCountDisplay: computed(() => props.followingCount),
      followersCountDisplay: computed(() => props.followersCount),
    }
  }
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: var(--overlay); display:flex; align-items:center; justify-content:center; z-index: 10000; }
.modal { width: min(680px, calc(100vw - 32px)); height: min(600px, calc(100vh - 32px)); background: var(--bg-elev); color: var(--text); border-radius:16px; box-shadow: 0 20px 60px rgba(0,0,0,.35); display:flex; flex-direction:column; overflow:hidden; }
.modal-header { display:flex; align-items:center; justify-content:space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); }
.tabs { display:flex; gap: 12px; }
.tab { background:transparent; border:none; color: var(--muted); padding:8px 6px; border-bottom:2px solid transparent; cursor:pointer; font-weight:600; }
.tab.active { color: var(--text); border-color: var(--accent); }
.tab .count { opacity:.7; margin-left:4px; font-weight:500; }
.close { background:transparent; border:none; color: var(--muted); font-size:18px; cursor:pointer; }
.toolbar { display:flex; justify-content:space-between; align-items:center; gap:12px; padding: 10px 16px; }
.search { display:flex; gap:8px; align-items:center; width: 100%; }
.search input,
.search-btn,
.sort select { height:44px; box-sizing:border-box; }
.search input { flex:1; padding:0 14px; border:1px solid var(--border); border-radius:10px; background: var(--bg); color: var(--text); outline:none; }
.search-btn { flex:0 0 auto; padding:0 18px; border-radius:10px; border:1px solid var(--btn-border); background: var(--btn-bg); color: var(--text); cursor:pointer; white-space:nowrap; }
.sort select { min-width:140px; padding:0 14px; border-radius:10px; border:1px solid var(--btn-border); background: var(--bg); color: var(--text); cursor:pointer; }
.list { padding: 6px 8px 10px 8px; overflow:auto; flex: 1; }
.row { display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:12px; background: var(--bg-elev); border:1px solid var(--border); margin:8px; }
.avatar { width:40px; height:40px; border-radius:999px; object-fit:cover; }
.avatar-fallback { width:40px; height:40px; border-radius:999px; background: var(--btn-border); color: var(--text); display:flex; align-items:center; justify-content:center; font-weight:700; }
.meta { flex:1; text-align:left; }
.name { font-weight:700; }
.name .mutual { margin-left:8px; font-size:11px; color: var(--accent); background: transparent; border:1px solid var(--accent); padding:2px 6px; border-radius:999px; vertical-align:middle; }
.bio, .sub { font-size:12px; color: var(--muted); margin-top:2px; }
.follow-btn { border-radius:999px; padding:6px 12px; border:1px solid var(--btn-border); background:transparent; color: var(--text); cursor:pointer; }
.follow-btn.following { background: var(--text); color: var(--bg); border-color: var(--text); }
.empty, .loading { padding: 24px; text-align:center; color: var(--muted); }
.foot { padding: 8px 16px 14px; }
.more { padding:8px 12px; border-radius:10px; border:1px solid var(--btn-border); background: var(--btn-bg); color: var(--text); cursor:pointer; }

/* removed light overrides in favor of CSS variables */
</style>

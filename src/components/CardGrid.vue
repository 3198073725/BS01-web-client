<template>
  <div class="grid">
    <template v-if="loading">
      <div v-for="n in skeletonCount" :key="'s'+n" class="card skeleton">
        <div class="thumb" />
        <div class="line w-80" />
        <div class="line w-50" />
      </div>
    </template>
    <template v-else-if="!items || items.length === 0">
      <div class="empty">{{ emptyText || '暂无内容' }}</div>
    </template>
    <template v-else>
      <div v-for="(it, idx) in items" :key="it.id || idx" class="card" :class="{ selectable, selected: selectable && isSelected(it) }" @click="onCardClick(it)">
        <div class="thumb">
          <img v-if="it.cover" :src="it.cover" alt="thumb" />
          <div v-else class="ph" />
          <label v-if="selectable" class="chk">
            <input type="checkbox" :checked="isSelected(it)" @click.stop="toggle(it)" />
            <span class="box" />
          </label>
        </div>
        <div class="title" :title="it.title || ' '">{{ it.title || ' ' }}</div>
        <div class="meta">
          <span v-if="it.views != null">👁️ {{ format(it.views) }}</span>
          <span v-if="it.likes != null">❤️ {{ format(it.likes) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
export default {
  name: 'CardGrid',
  props: {
    items: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    skeletonCount: { type: Number, default: 12 },
    emptyText: { type: String, default: '暂无内容' },
    selectable: { type: Boolean, default: false },
    selectedIds: { type: Array, default: () => [] },
  },
  emits: ['toggle','open'],
  methods: {
    format(n) {
      const v = Number(n || 0)
      if (v >= 1_000_000) return (v/1_000_000).toFixed(1).replace(/\.0$/,'')+'m'
      if (v >= 1_000) return (v/1_000).toFixed(1).replace(/\.0$/,'')+'k'
      return String(v)
    },
    getId(it) {
      return String((it && (it.id || it.video_id)) || '')
    },
    isSelected(it) {
      const id = it && (it.id || it.video_id)
      return !!(this.selectedIds && id && this.selectedIds.includes(String(id)))
    },
    toggle(it) {
      const id = it && (it.id || it.video_id)
      if (!id) return
      this.$emit('toggle', String(id))
    },
    onCardClick(it) {
      if (this.selectable) { this.toggle(it) }
      else {
        const id = this.getId(it)
        if (id) this.$emit('open', id)
      }
    }
  }
}
</script>

<style scoped>
.grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.card { background: var(--bg); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
.thumb { width:100%; aspect-ratio: 16/9; background: var(--bg-elev); display:block; position: relative; }
.thumb img { width:100%; height:100%; object-fit: cover; display:block; }
.card.selectable { cursor: pointer; }
.card.selected { outline: 2px solid var(--accent); }
.chk { position:absolute; top:8px; left:8px; display:flex; align-items:center; gap:6px; }
.chk input { display:none; }
.chk .box { width:18px; height:18px; border-radius:4px; border:1px solid var(--btn-border); background: var(--bg); display:inline-block; box-shadow: 0 1px 4px rgba(0,0,0,.2) }
.card.selected .chk .box { background: var(--accent); border-color: var(--accent); }
.title { padding:8px 10px 0; font-weight:600; color: var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.meta { padding:6px 10px 10px; display:flex; gap:12px; color: var(--muted); font-size:12px; }

/* skeleton */
.skeleton .thumb { background: linear-gradient(90deg, rgba(0,0,0,.12), rgba(255,255,255,.06), rgba(0,0,0,.12)); background-size: 200% 100%; animation: sh 1.2s infinite; }
.skeleton .line { height: 12px; margin: 8px 10px; border-radius:6px; background: linear-gradient(90deg, rgba(0,0,0,.12), rgba(255,255,255,.06), rgba(0,0,0,.12)); background-size:200% 100%; animation: sh 1.2s infinite; }
.w-80 { width: 80%; }
.w-50 { width: 50%; }
.empty { color: var(--muted); padding: 24px; text-align:center; grid-column: 1 / -1; }
@keyframes sh { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
</style>

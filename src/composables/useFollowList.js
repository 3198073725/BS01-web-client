import { ref, computed } from 'vue'
import { api } from '@/api'
import { buildAvatarUrl } from '@/utils/user'

export function useFollowList({ initialTab = 'following', userId = null } = {}) {
  const tab = ref(initialTab) // 'following' | 'followers'
  const q = ref('')
  const order = ref('comprehensive') // comprehensive | latest | earliest
  const loading = ref(false)
  const page = ref(1)
  const hasNext = ref(false)
  const items = ref([])

  const title = computed(() => (tab.value === 'following' ? '关注' : '粉丝'))

  async function load(reset = true) {
    if (reset) { page.value = 1; items.value = [] }
    loading.value = true
    try {
      const fn = tab.value === 'following' ? api.followingQuery : api.followersQuery
      const data = await fn({ userId, page: page.value, q: q.value.trim(), order: order.value })
      // DRF PageNumberPagination shape: {count, next, previous, results}
      const results = Array.isArray(data) ? data : (data.results || [])
      const nextUrl = data && data.next
      hasNext.value = Boolean(nextUrl)
      const mapped = results.map(u => ({
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        display_name: u.display_name,
        bio: u.bio,
        profile_picture: u.profile_picture,
        is_following: Boolean(u.is_following),
        is_mutual: Boolean(u.is_mutual),
        followers_count: u.followers_count,
        following_count: u.following_count,
        video_count: u.video_count,
        avatar_url: buildAvatarUrl(api.getBase(), u.profile_picture),
      }))
      items.value = reset ? mapped : items.value.concat(mapped)
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (!hasNext.value || loading.value) return
    page.value += 1
    await load(false)
  }

  async function toggleFollow(user) {
    if (!user) return
    const isFollowing = Boolean(user.is_following)
    try {
      if (isFollowing) {
        await api.unfollow(user.id)
        user.is_following = false
      } else {
        await api.follow(user.id)
        user.is_following = true
      }
    } catch (_) {
      // no-op: optimistic UI could be reverted if needed
    }
  }

  return { tab, q, order, loading, items, hasNext, title, load, loadMore, toggleFollow }
}

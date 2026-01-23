import { createRouter, createWebHashHistory } from 'vue-router'
import HomePage from '../pages/HomePage.vue'
import TestApi from '../components/TestApi.vue'
import MePage from '../pages/MePage.vue'
import MeWorks from '../pages/me/Works.vue'
import MeLikes from '../pages/me/Likes.vue'
import MeFavorites from '../pages/me/Favorites.vue'
import MeHistory from '../pages/me/History.vue'
import MeWatchLater from '../pages/me/WatchLater.vue'
import AboutPage from '../pages/AboutPage.vue'
import TermsPage from '../pages/TermsPage.vue'
import ContactPage from '../pages/ContactPage.vue'
import SettingsPage from '../pages/SettingsPage.vue'
import VideoPage from '../pages/VideoPage.vue'
import VideoEdit from '../pages/VideoEdit.vue'
import FollowingPage from '../pages/FollowingPage.vue'
import FriendsPage from '../pages/FriendsPage.vue'
import FeaturedPage from '../pages/FeaturedPage.vue'
import SearchPage from '../pages/SearchPage.vue'

const routes = [
  {
    path: '/',
    component: HomePage,
    children: [
      // 主页仍使用父组件自身内容；当进入 /me/* 时，在 HomePage 的 <router-view/> 中显示子组件
      {
        path: 'me',
        component: MePage,
        children: [
          { path: '', name: 'me-default', redirect: { name: 'me-works' } },
          { path: 'works', name: 'me-works', component: MeWorks },
          { path: 'likes', name: 'me-likes', component: MeLikes },
          { path: 'favorites', name: 'me-favorites', component: MeFavorites },
          { path: 'history', name: 'me-history', component: MeHistory },
          { path: 'watch-later', name: 'me-watch-later', component: MeWatchLater },
        ],
      },
      { path: 'about', name: 'about', component: AboutPage },
      { path: 'featured', name: 'featured', component: FeaturedPage },
      { path: 'following', name: 'following', component: FollowingPage },
      { path: 'friends', name: 'friends', component: FriendsPage },
      { path: 'search', name: 'search', component: SearchPage },
      { path: 'terms', name: 'terms', component: TermsPage },
      { path: 'contact', name: 'contact', component: ContactPage },
      { path: 'settings', name: 'settings', component: SettingsPage },
      { path: 'video/:id', name: 'video', component: VideoPage },
      { path: 'video/:id/edit', name: 'video-edit', component: VideoEdit },
    ],
  },
  { path: '/test', name: 'test', component: TestApi },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (to.hash) {
      return { el: to.hash }
    }
    if (savedPosition) return savedPosition
    return { top: 0 }
  }
})

// 在路由切换开始时：
// 1) 向所有播放器广播事件，以执行组件级清理
// 2) 直接暂停当前文档中的所有 <video>，避免播放残留
router.beforeEach((to, from, next) => {
  if (to.path !== from.path) {
    try { window.dispatchEvent(new Event('app:navigate-start')) } catch (_) { /* no-op */ }
    try {
      const vids = document.querySelectorAll('video')
      vids && vids.forEach(v => { try { v.pause() } catch (_) { /* no-op */ } })
    } catch (_) { /* no-op */ }
  }
  next()
})

router.afterEach((to, from) => {
  if (to.path !== from.path) {
    try { window.dispatchEvent(new Event('app:navigate-end')) } catch (_) { /* no-op */ }
  }
})

export default router

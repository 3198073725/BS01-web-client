import { test, expect } from '@playwright/test'

// Helper: set localStorage before page load
async function withAutoNext(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('vp_autonext', '1') } catch {}
  })
}

// Hide dev overlay that may intercept pointer events in CI
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      const style = document.createElement('style')
      style.innerHTML = 'iframe#webpack-dev-server-client-overlay, #webpack-dev-server-client-overlay { display:none !important; pointer-events:none !important; }'
      document.head.appendChild(style)
      const hide = () => {
        const el = document.getElementById('webpack-dev-server-client-overlay') as any
        if (el) { el.style.display = 'none'; el.style.pointerEvents = 'none' }
        const ifr = document.querySelector('iframe#webpack-dev-server-client-overlay') as any
        if (ifr) { ifr.style.display = 'none'; ifr.style.pointerEvents = 'none' }
      }
      hide(); setInterval(hide, 300)
    } catch {}
  })
})

test.describe('Feed auto-next push history + refresh-resume', () => {
  test('featured feed updates ?i when auto-next triggers and persists after reload', async ({ page }) => {
    // Mock featured feed
    await page.route('**/api/recommendation/featured/**', async (route) => {
      const body = {
        results: [
          { id: 'v1', title: 'Video 1', view_count: 1, thumbnail_url: '', video_url: 'https://example.com/v1.mp4', author: { id: 'u1', username: 'alice' }, published_at: new Date().toISOString(), like_count: 0, favorite_count: 0, comment_count: 0 },
          { id: 'v2', title: 'Video 2', view_count: 2, thumbnail_url: '', video_url: 'https://example.com/v2.mp4', author: { id: 'u1', username: 'alice' }, published_at: new Date().toISOString(), like_count: 0, favorite_count: 0, comment_count: 0 },
        ],
        page: 1,
        has_next: false,
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
    // Mock video detail (overlay may request it)
    await page.route('**/api/videos/**', async (route) => {
      const body = { id: 'v1', author: { id: 'u1', username: 'alice' }, liked: false, favorited: false, like_count: 0, favorite_count: 0, video_url: 'https://example.com/v1.mp4' }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
    await withAutoNext(page)
    await page.goto('/#/featured?i=0')
    await page.waitForSelector('.feed .vp video')

    // Trigger ended event to simulate video end
    await page.evaluate(() => {
      const v = document.querySelector('.feed .vp video') as HTMLVideoElement | null
      if (v) v.dispatchEvent(new Event('ended'))
    })

    // URL should update to i=1 (push history)
    await expect.poll(() => page.url()).toContain('i=1')

    // Reload should preserve index and auto-scroll
    await page.reload()
    await expect.poll(() => page.url()).toContain('i=1')
  })
})

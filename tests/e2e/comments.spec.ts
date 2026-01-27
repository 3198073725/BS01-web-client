import { test, expect } from '@playwright/test'

// Common network mocks for VideoPage requirements
async function mockCommonRoutes(page) {
  // Analytics events
  await page.route('**/api/analytics/events/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })
  // Recommendation feed to include current video id in list
  await page.route('**/api/recommendation/feed/**', async (route) => {
    const url = new URL(route.request().url())
    // Try to infer the current video id from hash (Playwright doesn't expose hash to route).
    // Provide a small list; VideoPage will insert current if not present.
    const body = {
      results: [
        { id: 'v0', title: 'Video 0', view_count: 0, thumbnail_url: '', video_url: 'https://example.com/v0.mp4', author: { id: 'u1', username: 'alice' } },
        { id: 'v1', title: 'Video 1', view_count: 1, thumbnail_url: '', video_url: 'https://example.com/v1.mp4', author: { id: 'u1', username: 'alice' } },
      ],
      page: Number(url.searchParams.get('page') || '1'),
      has_next: false,
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

test.describe('Comments banners', () => {
  test('shows banner when comments are disabled by author', async ({ page }) => {
    await mockCommonRoutes(page)
    // Video detail with comments disabled
    await page.route('**/api/videos/**', async (route) => {
      const body = {
        id: 'v0',
        title: 'No comments',
        video_url: 'https://example.com/v0.mp4',
        author: { id: 'u1', username: 'alice' },
        allow_comments: false,
        like_count: 0,
        favorite_count: 0,
        comment_count: 0,
        published_at: new Date().toISOString(),
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
    // Comments list still requested; return empty list (not 404)
    await page.route('**/api/interactions/comments/**', async (route) => {
      const body = { results: [], page: 1, has_next: false, total: 0 }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
    await page.goto('/#/video/v0')
    await page.waitForSelector('#comments .comments')
    const closed = page.locator('#comments .info').filter({ hasText: '作者已关闭评论' }).first()
    await expect(closed).toBeVisible()
  })

  test('shows privacy/hidden banner when comments API returns 404', async ({ page }) => {
    await mockCommonRoutes(page)
    // Video detail with comments allowed
    await page.route('**/api/videos/**', async (route) => {
      const body = {
        id: 'v1',
        title: 'Hidden comments',
        video_url: 'https://example.com/v1.mp4',
        author: { id: 'u1', username: 'alice' },
        allow_comments: true,
        like_count: 0,
        favorite_count: 0,
        comment_count: 0,
        published_at: new Date().toISOString(),
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
    // Make comments list return 404 to trigger privacy hidden state
    await page.route('**/api/interactions/comments/**', async (route) => {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) })
    })
    await page.goto('/#/video/v1')
    await page.waitForSelector('#comments .comments')
    const hidden = page.locator('#comments .info').filter({ hasText: '评论不可见（视频未发布或为私密）' }).first()
    await expect(hidden).toBeVisible()
  })
})

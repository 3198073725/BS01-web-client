import { test, expect } from '@playwright/test'

async function mockVideoPageDeps(page, id: string) {
  // Analytics
  await page.route('**/api/analytics/events/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }))
  // Recommendation feed used by VideoPage to build list context
  await page.route('**/api/recommendation/feed/**', async (route) => {
    const body = {
      results: [
        { id, title: 'Test', view_count: 0, thumbnail_url: '', video_url: `https://example.com/${id}.mp4`, author: { id: 'u1', username: 'alice' }, published_at: new Date().toISOString(), like_count: 0, favorite_count: 0, comment_count: 0 },
      ],
      page: 1,
      has_next: false,
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  // Video detail
  await page.route('**/api/videos/**', async (route) => {
    const body = { id, title: 'Test', video_url: `https://example.com/${id}.mp4`, author: { id: 'u1', username: 'alice' }, allow_comments: true, like_count: 0, favorite_count: 0, comment_count: 0, published_at: new Date().toISOString() }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

test.describe('Player layout stability when toggling comments', () => {
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
  test('opening/closing drawer does not change player width > 1px', async ({ page }) => {
    await mockVideoPageDeps(page, 'stable')
    await page.goto('/#/video/stable')
    await page.waitForSelector('.vp', { state: 'attached' })

    // Helper to read width of the player wrapper (.vp)
    const getWidth = async () => await page.evaluate(() => {
      const el = document.querySelector('.vp') as HTMLElement | null
      if (!el) return 0
      const r = el.getBoundingClientRect()
      return Math.round(r.width)
    })

    // wait up to 2s for width to become non-zero
    let w0 = 0
    for (let i = 0; i < 20; i++) {
      w0 = await getWidth()
      if (w0 > 0) break
      await page.waitForTimeout(100)
    }
    expect(w0).toBeGreaterThan(0)

    // Open comments via keyboard shortcut 'KeyC' (VideoPlayer binds global keydown)
    await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' })) })
    await page.waitForSelector('.comments-drawer', { state: 'visible', timeout: 1500 }).catch(async () => {
      // Fallback: click comment icon
      const locator = page.locator('.overlay .right button[title="评论"]').first()
      await locator.click({ force: true })
      await page.waitForSelector('.comments-drawer', { state: 'visible' })
    })

    const w1 = await getWidth()
    expect(Math.abs(w1 - w0)).toBeLessThanOrEqual(1)

    // Close drawer via close button
    await page.locator('.comments-drawer .close').click({ force: true })
    await page.waitForSelector('.comments-drawer', { state: 'hidden' })

    const w2 = await getWidth()
    expect(Math.abs(w2 - w0)).toBeLessThanOrEqual(1)
  })
})

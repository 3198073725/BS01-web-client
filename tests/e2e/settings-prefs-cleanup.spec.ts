import { test, expect } from '@playwright/test'

// Hide dev overlay in CI to avoid pointer interception
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      const style = document.createElement('style')
      style.innerHTML = 'iframe#webpack-dev-server-client-overlay, #webpack-dev-server-client-overlay { display:none !important; pointer-events:none !important; } .sysdlg-mask{pointer-events:none !important;}'
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

async function mockCommon(page) {
  await page.route('**/api/analytics/events/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }))
}

test.describe('Settings: playback prefs & cleanup', () => {
  test.beforeEach(async ({ page }) => {
    await mockCommon(page)
  })

  test('save playback preferences writes localStorage keys', async ({ page }) => {
    await page.goto('/#/settings')
    await page.waitForSelector('h1:has-text("设置")')

    const prefs = page.locator('.settings section').filter({ hasText: '播放偏好' })
    // Toggle autoplay default
    const autoBtn = prefs.locator('button.btn').filter({ hasText: /已开启|已关闭/ }).first()
    await autoBtn.click({ force: true })
    // Set rate
    await prefs.locator('select').first().selectOption('1.5')
    // Toggle muted
    const muteBtn = prefs.locator('button.btn').filter({ hasText: /已开启|已关闭/ }).nth(1)
    await muteBtn.click({ force: true })
    // Volume slider
    const slider = prefs.locator('input[type="range"]')
    await slider.fill('0.4')
    // Resume toggle off
    const resumeBtn = prefs.locator('button.btn').filter({ hasText: /已开启|已关闭/ }).nth(2)
    await resumeBtn.click()

    await prefs.locator('[data-testid="save-playback"]').click({ force: true })
    // close success dialog
    await page.getByRole('button', { name: '好的' }).click({ force: true })

    await expect.poll(async () => await page.evaluate(() => localStorage.getItem('vp_autonext'))).toMatch(/^[01]$/)
    await expect.poll(async () => await page.evaluate(() => localStorage.getItem('vp_rate'))).toBe('1.5')
    await expect.poll(async () => await page.evaluate(() => localStorage.getItem('vp_muted'))).toMatch(/^[01]$/)
    await expect.poll(async () => await page.evaluate(() => localStorage.getItem('vp_vol'))).toMatch(/^0\.[0-9]+|1$/)
    await expect.poll(async () => await page.evaluate(() => localStorage.getItem('vp_resume'))).toMatch(/^[01]$/)
  })

  test('clear search history and local resume', async ({ page }) => {
    await page.goto('/#/settings')
    await page.waitForSelector('h1:has-text("设置")')
    await page.evaluate(() => {
      try {
        localStorage.setItem('search_history', JSON.stringify(['abc', 'def']))
        localStorage.setItem('vp_pos:foo', '12')
        localStorage.setItem('vp_pos:bar', '30')
      } catch {}
    })

    const dataSection = page.locator('.settings section').filter({ hasText: '数据与隐私' })
    await dataSection.locator('[data-testid="clear-search-history"]').click({ force: true }) // 搜索历史 清空
    await page.getByRole('button', { name: '好的' }).click({ force: true })

    // 本地观看进度 清空（第二个清空按钮）
    await dataSection.locator('[data-testid="clear-local-resume"]').click({ force: true })
    await page.getByRole('button', { name: '好的' }).click({ force: true })
  })

  test('notifications operations show success dialogs', async ({ page }) => {
    await page.route('**/api/notifications/**', async (route) => { await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }) })

    await page.goto('/#/settings')
    await page.waitForSelector('h1:has-text("设置")')
    const dataSection = page.locator('.settings section').filter({ hasText: '数据与隐私' })
    await dataSection.locator('[data-testid="notif-markall"]').click({ force: true })
    await page.getByRole('button', { name: '好的' }).click({ force: true })
    await dataSection.locator('[data-testid="notif-clear"]').click({ force: true }) // 通知 清空
    await page.getByRole('button', { name: '好的' }).click({ force: true })
  })

  test('clear server watch history paginates and bulk removes', async ({ page }) => {
    let pagesServed = 0
    let bulkCalls = 0
    await page.route('**/api/interactions/history**', async (route) => {
      if (route.request().method() !== 'GET' || route.request().url().includes('bulk-remove')) { await route.fallback(); return }
      const url = new URL(route.request().url())
      const pageNo = Number(url.searchParams.get('page') || '1')
      pagesServed++
      const body = pageNo === 1
        ? { results: [{ id: 'a' }, { id: 'b' }], page: 1, has_next: true }
        : { results: [{ id: 'c' }], page: 2, has_next: false }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
    await page.route('**/api/interactions/history/bulk-remove/**', async (route) => {
      bulkCalls++
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })

    await page.goto('/#/settings')
    await page.waitForSelector('h1:has-text("设置")')
    const dataSection = page.locator('.settings section').filter({ hasText: '数据与隐私' })
    await dataSection.locator('[data-testid="clear-watch-history"]').click({ force: true }) // 观看历史 清空
    await page.getByRole('button', { name: '好的' }).click({ force: true })
    expect(pagesServed).toBeGreaterThan(1)
    expect(bulkCalls).toBeGreaterThan(0)
  })
})

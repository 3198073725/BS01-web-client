import { test, expect } from '@playwright/test'

async function mockMeRoutes(page, me = {}) {
  let current = {
    id: 'u1',
    username: 'alice',
    display_name: 'Alice',
    nickname: 'Alice',
    bio: 'hi',
    privacy_mode: 'public',
    ...me,
  }
  await page.route('**/api/users/me/**', async (route) => {
    const req = route.request()
    if (req.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(current) })
      return
    }
    if (req.method() === 'PATCH') {
      const bodyRaw = req.postData() || '{}'
      let patch: any
      try { patch = JSON.parse(bodyRaw) } catch { patch = {} }
      current = { ...current, ...patch }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(current) })
      return
    }
    await route.continue()
  })
}

// Some pages call analytics; stub it out to avoid network
async function mockMisc(page) {
  await page.route('**/api/analytics/events/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
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

test.describe('Settings flows', () => {
  test.beforeEach(async ({ page }) => {
    await mockMisc(page)
    await mockMeRoutes(page, { privacy_mode: 'public' })
  })

  test('theme toggle applies data-theme and persists', async ({ page }) => {
    await page.goto('/#/settings')
    await page.waitForSelector('h1:has-text("设置")')
    const themeSection = page.locator('.settings section').filter({ hasText: '显示与主题' })
    await themeSection.getByRole('button', { name: '浅色' }).click({ force: true })
    await expect.poll(async () => await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light')
    await themeSection.getByRole('button', { name: '深色' }).click({ force: true })
    await expect.poll(async () => await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark')
    await expect.poll(async () => await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark')
  })

  test('remember me toggle updates button and localStorage', async ({ page }) => {
    await page.goto('/#/settings')
    await page.waitForSelector('h1:has-text("设置")')
    const securitySection = page.locator('.settings section').filter({ hasText: '登录与安全' })
    const btn = securitySection.locator('button.btn')
    await expect(btn).toHaveText(/已关闭|已开启/)
    const initial = await btn.textContent()
    await btn.click({ force: true })
    const after = await btn.textContent()
    expect(after?.trim()).not.toBe(initial?.trim())
    await expect.poll(async () => await page.evaluate(() => localStorage.getItem('rememberMe'))).toBe('1')
  })

  test('saving privacy sends PATCH with privacy_mode', async ({ page }) => {
    await page.goto('/#/settings')
    await page.waitForSelector('h1:has-text("设置")')
    const privacySection = page.locator('.settings section').filter({ hasText: '隐私' })
    const select = privacySection.locator('select')
    await select.selectOption('friends_only')
    await privacySection.getByRole('button', { name: '保存' }).click({ force: true })
    await page.reload()
    await page.waitForSelector('h1:has-text("设置")')
    await expect(privacySection.locator('select')).toHaveValue('friends_only')
  })

  test('saving profile sends PATCH with nickname and bio', async ({ page }) => {
    await page.goto('/#/settings')
    await page.waitForSelector('h1:has-text("设置")')
    const profileSection = page.locator('.settings section').filter({ hasText: '账户资料' })
    await profileSection.locator('input[placeholder="输入昵称"]').fill('NewNick')
    await profileSection.locator('textarea[placeholder="一句话介绍自己"]').fill('New bio')
    await profileSection.getByRole('button', { name: '保存' }).click({ force: true })
    await page.reload()
    await page.waitForSelector('h1:has-text("设置")')
    await expect(profileSection.locator('input[placeholder="输入昵称"]')).toHaveValue('NewNick')
    await expect(profileSection.locator('textarea[placeholder="一句话介绍自己"]')).toHaveValue('New bio')
  })
})

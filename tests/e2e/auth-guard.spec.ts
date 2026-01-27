import { test, expect } from '@playwright/test'

// Minimal E2E to verify auth guard redirects and records post_login_redirect

test('requiresAuth routes redirect to home and record post_login_redirect', async ({ page }) => {
  // ensure no token
  await page.addInitScript(() => {
    try { localStorage.removeItem('access_token') } catch {}
    try { localStorage.removeItem('refresh_token') } catch {}
  })

  await page.goto('/#/me')

  // should be redirected to home
  await expect(page).toHaveURL(/#\/$/)

  // guard writes post_login_redirect
  const redir = await page.evaluate(() => localStorage.getItem('post_login_redirect'))
  expect(redir).toBe('/me')
})

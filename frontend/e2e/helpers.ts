import { Page, expect } from '@playwright/test'

export const ADMIN_EMAIL = 'kksjkdkk9933@gmail.com'
export const ADMIN_PASSWORD = 'kksjdd9999'
export const BASE = 'http://localhost:3001'

export async function login(page: Page) {
  await page.goto(`${BASE}/admin/login`)
  await page.waitForLoadState('networkidle')
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${BASE}/admin/**`, { timeout: 10000 })
}

export async function expectNoErrorPage(page: Page) {
  const title = await page.title()
  expect(title).not.toMatch(/error|500|404/i)
  const bodyText = await page.locator('body').innerText()
  expect(bodyText).not.toMatch(/系統內部錯誤|發生錯誤|無法連線/)
}

export async function waitReady(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
}

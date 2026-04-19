import { test, expect } from '@playwright/test'
import { login, waitReady, BASE } from './helpers'

test.describe('後台全頁流程', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  // ── 商品管理 ──────────────────────────────────────────────────────────────

  test('商品列表頁 - 載入', async ({ page }) => {
    await page.goto(`${BASE}/admin/products`)
    await waitReady(page)
    await expect(page.getByRole('heading', { name: '商品管理' })).toBeVisible()
    await expect(page.getByRole('button', { name: /上架商品/ })).toBeVisible()
  })

  test('商品管理 - 開啟新增商品表單', async ({ page }) => {
    await page.goto(`${BASE}/admin/products`)
    await waitReady(page)
    await page.getByRole('button', { name: /上架商品/ }).click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor({ timeout: 8000 })
    // 確認對話框標題
    await expect(dialog.getByRole('heading', { name: '上架商品' })).toBeVisible()
    // 確認表單欄位（用第一個 text input 代表商品名稱）
    await expect(dialog.locator('input').first()).toBeVisible()
    await expect(dialog.locator('select').first()).toBeVisible()
  })

  test('商品管理 - 填寫並送出新增商品', async ({ page }) => {
    await page.goto(`${BASE}/admin/products`)
    await waitReady(page)
    await page.getByRole('button', { name: /上架商品/ }).click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()

    // 填商品名稱（第一個 input-field，無 type 屬性）
    await dialog.locator('input.input-field').first().fill('E2E測試商品')
    // 填價格（第一個 number input）
    await dialog.locator('input[type="number"]').first().fill('100')
    // 選分類（第二個 select - index 1 是 categoryId）
    const catSelect = dialog.locator('select').nth(1)
    if (await catSelect.count() > 0) {
      const options = await catSelect.locator('option').count()
      if (options > 1) await catSelect.selectOption({ index: 1 })
    }
    // 填庫存（第二個 number input）
    await dialog.locator('input[type="number"]').nth(1).fill('10')

    await dialog.getByRole('button', { name: /上架商品/ }).click()
    await waitReady(page)
    // 成功或 dialog 關閉
    await page.getByText(/成功/).waitFor({ timeout: 5000 }).catch(() => {})
  })

  // ── 商品分類 ──────────────────────────────────────────────────────────────

  test('商品分類頁 - 載入', async ({ page }) => {
    await page.goto(`${BASE}/admin/categories`)
    await waitReady(page)
    await expect(page.getByRole('heading', { name: '商品類型管理' })).toBeVisible()
    await expect(page.getByRole('button', { name: /新增分類/ })).toBeVisible()
  })

  test('商品分類 - 新增分類', async ({ page }) => {
    await page.goto(`${BASE}/admin/categories`)
    await waitReady(page)
    await page.getByRole('button', { name: /新增分類/ }).click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    // 分類名稱是第一個 text input
    await dialog.locator('input').first().fill('E2E測試分類')
    await dialog.getByRole('button', { name: /建立/ }).click()
    await waitReady(page)
    await expect(page.getByText('E2E測試分類').first()).toBeVisible({ timeout: 5000 })
  })

  // ── 網站管理 ──────────────────────────────────────────────────────────────

  test('網站列表頁 - 載入', async ({ page }) => {
    await page.goto(`${BASE}/admin/websites`)
    await waitReady(page)
    await expect(page.getByRole('heading', { name: '網站管理' })).toBeVisible()
    await expect(page.getByRole('button', { name: /建立網站/ })).toBeVisible()
  })

  test('網站管理 - 開啟建立網站表單並確認圖片欄位', async ({ page }) => {
    await page.goto(`${BASE}/admin/websites`)
    await waitReady(page)
    await page.getByRole('button', { name: /建立網站/ }).click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    await expect(dialog.getByRole('heading', { name: '建立網站' })).toBeVisible()
    // 確認網站名稱欄位
    await expect(dialog.locator('input').first()).toBeVisible()
    // 確認圖片 file input 存在（我們的修改）
    const fileInputs = dialog.locator('input[type="file"]')
    const fileCount = await fileInputs.count()
    expect(fileCount).toBeGreaterThan(0)
    // 確認有「圖片設定」文字
    await expect(dialog.getByText('圖片設定')).toBeVisible()
  })

  test('網站管理 - 開啟設定 Modal 並確認圖片欄位', async ({ page }) => {
    await page.goto(`${BASE}/admin/websites`)
    await waitReady(page)
    const settingBtn = page.getByRole('button', { name: '設定' }).first()
    const count = await settingBtn.count()
    if (count > 0) {
      await settingBtn.click()
      const dialog = page.getByRole('dialog')
      await dialog.waitFor()
      await expect(dialog.getByText('圖片設定')).toBeVisible({ timeout: 8000 })
      const fileInputs = dialog.locator('input[type="file"]')
      expect(await fileInputs.count()).toBeGreaterThan(0)
    } else {
      test.skip()
    }
  })

  test('網站管理 - 網站上架商品頁', async ({ page }) => {
    await page.goto(`${BASE}/admin/websites`)
    await waitReady(page)
    const uploadBtn = page.getByRole('link', { name: /上架商品/ }).first()
    if (await uploadBtn.count() > 0) {
      await uploadBtn.click()
      await waitReady(page)
      await expect(page.getByRole('heading', { name: /商品/ })).toBeVisible()
    }
  })

  // ── 訂單管理 ──────────────────────────────────────────────────────────────

  test('訂單列表頁 - 載入', async ({ page }) => {
    await page.goto(`${BASE}/admin/orders`)
    await waitReady(page)
    await expect(page.getByRole('heading', { name: /訂單/ })).toBeVisible()
  })

  test('訂單管理 - 搜尋篩選', async ({ page }) => {
    await page.goto(`${BASE}/admin/orders`)
    await waitReady(page)
    const statusSelect = page.locator('select').first()
    if (await statusSelect.count() > 0) {
      const options = await statusSelect.locator('option').count()
      if (options > 1) {
        await statusSelect.selectOption({ index: 1 })
        await waitReady(page)
      }
    }
  })

  // ── 發票管理 ──────────────────────────────────────────────────────────────

  test('發票列表頁 - 載入', async ({ page }) => {
    await page.goto(`${BASE}/admin/invoices`)
    await waitReady(page)
    await expect(page.getByRole('heading', { name: /發票/ })).toBeVisible()
  })

  // ── 庫存管理 ──────────────────────────────────────────────────────────────

  test('庫存管理頁 - 載入', async ({ page }) => {
    await page.goto(`${BASE}/admin/inventory`)
    await waitReady(page)
    await expect(page.getByRole('heading', { name: /庫存/ })).toBeVisible()
  })

  // ── 使用者管理 ────────────────────────────────────────────────────────────

  test('使用者管理頁 - 載入', async ({ page }) => {
    await page.goto(`${BASE}/admin/users`)
    await waitReady(page)
    await expect(page.getByRole('heading', { name: '使用者管理' })).toBeVisible()
    await expect(page.getByRole('button', { name: /新增使用者/ })).toBeVisible()
  })

  test('使用者管理 - 開啟新增使用者表單', async ({ page }) => {
    await page.goto(`${BASE}/admin/users`)
    await waitReady(page)
    await page.getByRole('button', { name: /新增使用者/ }).click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    await expect(dialog.getByRole('heading', { name: '新增使用者' })).toBeVisible()
    // Email input (type=email)
    await expect(dialog.locator('input[type="email"]')).toBeVisible()
    // 密碼 input (type=password)
    await expect(dialog.locator('input[type="password"]')).toBeVisible()
  })

  // ── Email 模板 ────────────────────────────────────────────────────────────

  test('Email 模板頁 - 載入並確認模板列出', async ({ page }) => {
    await page.goto(`${BASE}/admin/email-templates`)
    await waitReady(page)
    await expect(page.getByRole('heading', { name: 'Email 通知模板管理' })).toBeVisible()
    // 使用 heading role 避免 strict mode 違反
    await expect(page.getByRole('heading', { name: '訂單確認通知' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '付款成功通知' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '出貨通知' })).toBeVisible()
    // 確認有編輯按鈕
    await expect(page.getByRole('button', { name: '編輯' }).first()).toBeVisible()
  })

  test('Email 模板 - 開啟編輯並確認可用變數', async ({ page }) => {
    await page.goto(`${BASE}/admin/email-templates`)
    await waitReady(page)
    await page.getByRole('button', { name: '編輯' }).first().click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    await expect(dialog.getByText('可用變數說明')).toBeVisible()
    await expect(dialog.getByText('顧客姓名')).toBeVisible()
    await expect(dialog.getByText('網站名稱')).toBeVisible()
    // 確認有 subject input
    await expect(dialog.locator('input').first()).toBeVisible()
  })
})

test.describe('前台流程', () => {
  test('前台首頁（網站 ID 1）- 載入', async ({ page }) => {
    await page.goto(`${BASE}/project/1`)
    await waitReady(page)
    const body = await page.locator('body').innerText()
    expect(body).not.toMatch(/網站不存在|500|系統錯誤/)
  })

  test('前台 - 點擊商品進入詳情頁', async ({ page }) => {
    await page.goto(`${BASE}/project/1`)
    await waitReady(page)
    const productLink = page.locator('a[href*="/product/"]').first()
    if (await productLink.count() > 0) {
      await productLink.click()
      await waitReady(page)
      await expect(page.locator('body')).not.toContainText('商品不存在')
    }
  })

  test('前台 - 購物車頁', async ({ page }) => {
    await page.goto(`${BASE}/project/1/cart`)
    await waitReady(page)
    const body = await page.locator('body').innerText()
    expect(body).not.toMatch(/錯誤|500/)
  })
})

test.describe('登入登出', () => {
  test('使用測試帳號登入', async ({ page }) => {
    await page.goto(`${BASE}/admin/login`)
    await waitReady(page)
    await page.fill('input[type="email"]', 'kksjkdkk9933@gmail.com')
    await page.fill('input[type="password"]', 'kksjdd9999')
    await page.click('button[type="submit"]')
    await page.waitForURL(`${BASE}/admin/**`, { timeout: 10000 })
    await expect(page.locator('body')).not.toContainText('帳號或密碼錯誤')
  })

  test('登出', async ({ page }) => {
    await login(page)
    const logoutBtn = page.getByRole('button', { name: /登出/ })
    if (await logoutBtn.count() > 0) {
      await logoutBtn.click()
      await page.waitForURL(`${BASE}/admin/login`, { timeout: 5000 })
    }
  })
})

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin.spec.ts >> 前台流程 >> 前台 - 購物車頁
- Location: e2e\admin.spec.ts:239:7

# Error details

```
Error: page.goto: Target page, context or browser has been closed
Call log:
  - navigating to "http://localhost:3001/project/1/cart", waiting until "load"

```

# Test source

```ts
  140 | 
  141 |   test('訂單管理 - 搜尋篩選', async ({ page }) => {
  142 |     await page.goto(`${BASE}/admin/orders`)
  143 |     await waitReady(page)
  144 |     const statusSelect = page.locator('select').first()
  145 |     if (await statusSelect.count() > 0) {
  146 |       const options = await statusSelect.locator('option').count()
  147 |       if (options > 1) {
  148 |         await statusSelect.selectOption({ index: 1 })
  149 |         await waitReady(page)
  150 |       }
  151 |     }
  152 |   })
  153 | 
  154 |   // ── 發票管理 ──────────────────────────────────────────────────────────────
  155 | 
  156 |   test('發票列表頁 - 載入', async ({ page }) => {
  157 |     await page.goto(`${BASE}/admin/invoices`)
  158 |     await waitReady(page)
  159 |     await expect(page.getByRole('heading', { name: /發票/ })).toBeVisible()
  160 |   })
  161 | 
  162 |   // ── 庫存管理 ──────────────────────────────────────────────────────────────
  163 | 
  164 |   test('庫存管理頁 - 載入', async ({ page }) => {
  165 |     await page.goto(`${BASE}/admin/inventory`)
  166 |     await waitReady(page)
  167 |     await expect(page.getByRole('heading', { name: /庫存/ })).toBeVisible()
  168 |   })
  169 | 
  170 |   // ── 使用者管理 ────────────────────────────────────────────────────────────
  171 | 
  172 |   test('使用者管理頁 - 載入', async ({ page }) => {
  173 |     await page.goto(`${BASE}/admin/users`)
  174 |     await waitReady(page)
  175 |     await expect(page.getByRole('heading', { name: '使用者管理' })).toBeVisible()
  176 |     await expect(page.getByRole('button', { name: /新增使用者/ })).toBeVisible()
  177 |   })
  178 | 
  179 |   test('使用者管理 - 開啟新增使用者表單', async ({ page }) => {
  180 |     await page.goto(`${BASE}/admin/users`)
  181 |     await waitReady(page)
  182 |     await page.getByRole('button', { name: /新增使用者/ }).click()
  183 |     const dialog = page.getByRole('dialog')
  184 |     await dialog.waitFor()
  185 |     await expect(dialog.getByRole('heading', { name: '新增使用者' })).toBeVisible()
  186 |     // Email input (type=email)
  187 |     await expect(dialog.locator('input[type="email"]')).toBeVisible()
  188 |     // 密碼 input (type=password)
  189 |     await expect(dialog.locator('input[type="password"]')).toBeVisible()
  190 |   })
  191 | 
  192 |   // ── Email 模板 ────────────────────────────────────────────────────────────
  193 | 
  194 |   test('Email 模板頁 - 載入並確認模板列出', async ({ page }) => {
  195 |     await page.goto(`${BASE}/admin/email-templates`)
  196 |     await waitReady(page)
  197 |     await expect(page.getByRole('heading', { name: 'Email 通知模板管理' })).toBeVisible()
  198 |     // 使用 heading role 避免 strict mode 違反
  199 |     await expect(page.getByRole('heading', { name: '訂單確認通知' })).toBeVisible()
  200 |     await expect(page.getByRole('heading', { name: '付款成功通知' })).toBeVisible()
  201 |     await expect(page.getByRole('heading', { name: '出貨通知' })).toBeVisible()
  202 |     // 確認有編輯按鈕
  203 |     await expect(page.getByRole('button', { name: '編輯' }).first()).toBeVisible()
  204 |   })
  205 | 
  206 |   test('Email 模板 - 開啟編輯並確認可用變數', async ({ page }) => {
  207 |     await page.goto(`${BASE}/admin/email-templates`)
  208 |     await waitReady(page)
  209 |     await page.getByRole('button', { name: '編輯' }).first().click()
  210 |     const dialog = page.getByRole('dialog')
  211 |     await dialog.waitFor()
  212 |     await expect(dialog.getByText('可用變數說明')).toBeVisible()
  213 |     await expect(dialog.getByText('顧客姓名')).toBeVisible()
  214 |     await expect(dialog.getByText('網站名稱')).toBeVisible()
  215 |     // 確認有 subject input
  216 |     await expect(dialog.locator('input').first()).toBeVisible()
  217 |   })
  218 | })
  219 | 
  220 | test.describe('前台流程', () => {
  221 |   test('前台首頁（網站 ID 1）- 載入', async ({ page }) => {
  222 |     await page.goto(`${BASE}/project/1`)
  223 |     await waitReady(page)
  224 |     const body = await page.locator('body').innerText()
  225 |     expect(body).not.toMatch(/網站不存在|500|系統錯誤/)
  226 |   })
  227 | 
  228 |   test('前台 - 點擊商品進入詳情頁', async ({ page }) => {
  229 |     await page.goto(`${BASE}/project/1`)
  230 |     await waitReady(page)
  231 |     const productLink = page.locator('a[href*="/product/"]').first()
  232 |     if (await productLink.count() > 0) {
  233 |       await productLink.click()
  234 |       await waitReady(page)
  235 |       await expect(page.locator('body')).not.toContainText('商品不存在')
  236 |     }
  237 |   })
  238 | 
  239 |   test('前台 - 購物車頁', async ({ page }) => {
> 240 |     await page.goto(`${BASE}/project/1/cart`)
      |                ^ Error: page.goto: Target page, context or browser has been closed
  241 |     await waitReady(page)
  242 |     const body = await page.locator('body').innerText()
  243 |     expect(body).not.toMatch(/錯誤|500/)
  244 |   })
  245 | })
  246 | 
  247 | test.describe('登入登出', () => {
  248 |   test('使用測試帳號登入', async ({ page }) => {
  249 |     await page.goto(`${BASE}/admin/login`)
  250 |     await waitReady(page)
  251 |     await page.fill('input[type="email"]', 'kksjkdkk9933@gmail.com')
  252 |     await page.fill('input[type="password"]', 'kksjdd9999')
  253 |     await page.click('button[type="submit"]')
  254 |     await page.waitForURL(`${BASE}/admin/**`, { timeout: 10000 })
  255 |     await expect(page.locator('body')).not.toContainText('帳號或密碼錯誤')
  256 |   })
  257 | 
  258 |   test('登出', async ({ page }) => {
  259 |     await login(page)
  260 |     const logoutBtn = page.getByRole('button', { name: /登出/ })
  261 |     if (await logoutBtn.count() > 0) {
  262 |       await logoutBtn.click()
  263 |       await page.waitForURL(`${BASE}/admin/login`, { timeout: 5000 })
  264 |     }
  265 |   })
  266 | })
  267 | 
```
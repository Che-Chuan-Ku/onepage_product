import { Given, When, Then } from '@cucumber/cucumber'
import { chromium, Browser, Page } from 'playwright'
import { StorefrontPage } from '../page-objects/StorefrontPage'
import { ProductDetailPage } from '../page-objects/ProductDetailPage'

let browser: Browser
let page: Page
let storefrontPage: StorefrontPage
let productDetailPage: ProductDetailPage

Given('顧客進入網站 ID 為 {string} 的前台', async function (websiteId: string) {
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage()
  storefrontPage = new StorefrontPage(page)
  await storefrontPage.goto(websiteId)
})

Then('顧客應看到網站名稱 {string}', async function (name: string) {
  await storefrontPage.expectSiteName(name)
})

Then('顧客應看到商品列表', async function () {
  await storefrontPage.expectProductList()
  await browser.close()
})

When('顧客點擊商品 {string}', async function (productName: string) {
  await storefrontPage.clickProduct(productName)
})

Then('顧客應被導向商品詳情頁', async function () {
  await storefrontPage.expectOnProductDetailPage()
  await browser.close()
})

Given('顧客在商品詳情頁 {string}', async function (path: string) {
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage()
  productDetailPage = new ProductDetailPage(page)
  await productDetailPage.goto(path)
})

When('顧客選擇數量 {string}', async function (quantity: string) {
  await productDetailPage.setQuantity(Number(quantity))
})

When('顧客點擊加入購物車按鈕', async function () {
  await productDetailPage.clickAddToCart()
})

Then('顧客應看到成功提示', async function () {
  await productDetailPage.expectSuccessToast()
})

Then('購物車圖示應顯示數量 {string}', async function (count: string) {
  const actual = await productDetailPage.getCartBadgeCount()
  if (actual !== Number(count)) {
    throw new Error(`預期購物車數量為 ${count}，但實際為 ${actual}`)
  }
  await browser.close()
})

Given('顧客已將商品加入購物車', async function () {
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage()
  productDetailPage = new ProductDetailPage(page)
  await productDetailPage.goto('/project/1/product/premium-apple')
  await productDetailPage.clickAddToCart()
  await productDetailPage.expectSuccessToast()
})

When('顧客前往購物車頁面', async function () {
  await page.goto('/project/1/cart')
  await page.waitForLoadState('networkidle')
})

Then('顧客應看到已加入的商品', async function () {
  const { expect } = await import('@playwright/test')
  await expect(page.getByText('頂級蜜蘋果')).toBeVisible({ timeout: 5000 })
  await browser.close()
})

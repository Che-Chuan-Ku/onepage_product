import { Given, When, Then } from '@cucumber/cucumber'
import { chromium, Browser, Page } from 'playwright'
import { LoginPage } from '../page-objects/LoginPage'

let browser: Browser
let page: Page
let loginPage: LoginPage

Given('使用者在後台登入頁', async function () {
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage()
  loginPage = new LoginPage(page)
  await loginPage.goto()
})

When('使用者輸入 Email {string}', async function (email: string) {
  await loginPage.fillEmail(email)
})

When('使用者輸入密碼 {string}', async function (password: string) {
  await loginPage.fillPassword(password)
})

When('使用者點擊登入按鈕', async function () {
  await loginPage.clickLogin()
})

Then('使用者應被導向後台管理頁面', async function () {
  await loginPage.expectRedirectedToAdmin()
  await browser.close()
})

Then('使用者應看到錯誤訊息 {string}', async function (message: string) {
  await loginPage.expectErrorMessage(message)
  await browser.close()
})

Then('使用者應看到 Email 格式驗證錯誤', async function () {
  await loginPage.expectEmailValidationError()
  await browser.close()
})

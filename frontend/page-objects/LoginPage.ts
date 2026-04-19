import { Page, expect } from '@playwright/test'

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/admin/login')
    await expect(this.page.getByRole('heading', { name: 'OnePage' })).toBeVisible()
  }

  async fillEmail(email: string) {
    await this.page.getByPlaceholder('請輸入 Email').fill(email)
  }

  async fillPassword(password: string) {
    await this.page.getByPlaceholder('請輸入密碼').fill(password)
  }

  async clickLogin() {
    await this.page.getByRole('button', { name: '登入' }).click()
  }

  async expectRedirectedToAdmin() {
    await expect(this.page).toHaveURL(/\/admin\/websites/, { timeout: 5000 })
  }

  async expectErrorMessage(message: string) {
    await expect(this.page.getByText(message)).toBeVisible({ timeout: 5000 })
  }

  async expectEmailValidationError() {
    await expect(this.page.getByText('請輸入有效的 Email')).toBeVisible({ timeout: 3000 })
  }
}

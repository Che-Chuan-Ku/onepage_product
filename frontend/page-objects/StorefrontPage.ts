import { Page, expect } from '@playwright/test'

export class StorefrontPage {
  constructor(private page: Page) {}

  async goto(websiteId: string) {
    await this.page.goto(`/project/${websiteId}`)
    await this.page.waitForLoadState('networkidle')
  }

  async expectSiteName(name: string) {
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 10000 })
  }

  async expectProductList() {
    await expect(this.page.locator('a[href*="/product/"]').first()).toBeVisible({ timeout: 10000 })
  }

  async clickProduct(productName: string) {
    await this.page.getByText(productName).first().click()
  }

  async expectOnProductDetailPage() {
    await expect(this.page).toHaveURL(/\/product\//, { timeout: 5000 })
  }
}

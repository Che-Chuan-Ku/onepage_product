import { Page, expect } from '@playwright/test'

export class ProductDetailPage {
  constructor(private page: Page) {}

  async goto(path: string) {
    await this.page.goto(path)
    await this.page.waitForLoadState('networkidle')
  }

  async setQuantity(quantity: number) {
    const currentQty = Number(await this.page.locator('span.flex.items-center.justify-center').innerText())
    const diff = quantity - currentQty
    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        await this.page.getByRole('button', { name: '+' }).click()
      }
    }
  }

  async clickAddToCart() {
    await this.page.getByRole('button', { name: '加入購物車' }).click()
  }

  async expectSuccessToast() {
    await expect(this.page.getByText('已加入購物車')).toBeVisible({ timeout: 5000 })
  }

  async getCartBadgeCount(): Promise<number> {
    const badge = this.page.locator('a[href*="/cart"] span.bg-terra-500')
    const text = await badge.innerText()
    return Number(text)
  }
}

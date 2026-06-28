import { test, expect } from "@playwright/test";

/**
 * Regression: clicking the canvas must actually place stones (本地雙人 full loop
 * through MSW). Guards against the StrictMode listener-detach bug where
 * GomokuBoard.destroy() replaced the canvas node and orphaned its listeners,
 * leaving the board click-dead in dev.
 */
test("本地雙人：點擊棋盤連下兩手，計數與輪次正確", async ({ page }) => {
  await page.goto("/");
  await page.getByText("本地雙人").click();
  await expect(page).toHaveURL(/\/game\//);

  const canvas = page.locator("canvas.board");
  await expect(canvas).toBeVisible();
  await expect(page.getByText("第 0 手")).toBeVisible();

  const box = await canvas.boundingBox();
  if (!box) throw new Error("no canvas box");
  // mirrors GomokuBoard geometry: pad = size*0.045, gap = (size-2*pad)/14
  const pad = box.width * 0.045;
  const gap = (box.width - 2 * pad) / 14;
  const at = (r: number, c: number) => ({
    x: box.x + pad + c * gap,
    y: box.y + pad + r * gap,
  });

  // black at (7,7)
  const m1 = at(7, 7);
  await page.mouse.click(m1.x, m1.y);
  await expect(page.getByText("第 1 手")).toBeVisible();
  await expect(page.getByText("輪到白方落子")).toBeVisible();

  // white at (7,8)
  const m2 = at(7, 8);
  await page.mouse.click(m2.x, m2.y);
  await expect(page.getByText("第 2 手")).toBeVisible();
  await expect(page.getByText("輪到黑方落子")).toBeVisible();
});

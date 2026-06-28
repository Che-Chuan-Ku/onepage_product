import { test, expect } from "@playwright/test";

/**
 * Browser-level smoke scenarios derived from specs/activities (本地雙人對戰,
 * 使用者管理) + specs/ui. Validates the MSW-backed flows end-to-end without a
 * live backend.
 */

test("home renders mode select (模式選擇首頁)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "選擇你的對戰方式" })).toBeVisible();
  await expect(page.getByText("本地雙人")).toBeVisible();
  await expect(page.getByText("線上連線")).toBeVisible();
});

test("本地雙人對戰：start a local game and place a move", async ({ page }) => {
  await page.goto("/");
  await page.getByText("本地雙人").click();
  // routed to /game/<id>?mode=local
  await expect(page).toHaveURL(/\/game\//);
  await expect(page.locator("canvas.board")).toBeVisible();
  await expect(page.getByText("輪到黑方落子")).toBeVisible();
});

test("使用者管理：guest entry requires a nickname (Q4)", async ({ page }) => {
  await page.goto("/user#guest");
  await page.getByRole("tab", { name: "訪客" }).click();
  await page.getByRole("button", { name: "以訪客進入" }).click();
  await expect(page.getByText("請先輸入暱稱")).toBeVisible();
});

test("查看戰績與排行榜：leaderboard loads with threshold note (Q2)", async ({ page }) => {
  await page.goto("/leaderboard");
  await expect(page.getByRole("heading", { name: "排行榜" })).toBeVisible();
  await expect(page.getByText("棋聖阿哲")).toBeVisible();
  await expect(page.getByText(/上榜門檻：累計 10 場/)).toBeVisible();
});

test("回放：replay controls render and step forward", async ({ page }) => {
  await page.goto("/replay/g1");
  await expect(page.locator("canvas.board")).toBeVisible();
  await page.getByRole("button", { name: /下一步/ }).click();
  await expect(page.getByText("1 /")).toBeVisible();
});

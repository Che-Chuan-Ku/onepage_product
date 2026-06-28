import { test, expect } from "@playwright/test";

/**
 * Full-stack integration scenarios — run against the REAL backend
 * (MSW disabled). Requires:
 *   docker compose -f ../integration-test/docker-compose.fullstack.yml up -d
 *   NEXT_PUBLIC_API_MOCKING=disabled BACKEND_ORIGIN=http://127.0.0.1:18080 npm run dev
 *
 * Unlike smoke.spec.ts these do NOT depend on MSW fixture data — every
 * scenario seeds its own state through the live API.
 */

const uniq = () => `pw${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

test("註冊帳號 → 自動登入（POST /auth/register 真後端）", async ({ page }) => {
  const name = uniq();
  await page.goto("/user");
  await page.getByRole("tab", { name: "註冊" }).click();
  await page.locator('input[name="ru"]').fill(name);
  await page.locator('input[name="re"]').fill(`${name}@example.com`);
  await page.locator('input[name="rp"]').fill("passw0rd1");
  await page.getByRole("button", { name: "建立帳號" }).click();
  await expect(page.getByText("註冊成功，已自動登入")).toBeVisible();
});

test("登入取得 JWT（先註冊再登出登入）", async ({ page }) => {
  const name = uniq();
  await page.goto("/user");
  await page.getByRole("tab", { name: "註冊" }).click();
  await page.locator('input[name="ru"]').fill(name);
  await page.locator('input[name="re"]').fill(`${name}@example.com`);
  await page.locator('input[name="rp"]').fill("passw0rd1");
  await page.getByRole("button", { name: "建立帳號" }).click();
  await expect(page.getByText("註冊成功，已自動登入")).toBeVisible();

  // fresh context state: navigate and login with the same credentials
  await page.evaluate(() => localStorage.clear());
  await page.goto("/user");
  await page.getByRole("tab", { name: "登入" }).click();
  await page.locator('input[name="lu"]').fill(name);
  await page.locator('input[name="lp"]').fill("passw0rd1");
  await page.getByRole("button", { name: /登入/ }).click();
  await expect(page.getByText(`歡迎回來，${name}！`)).toBeVisible();
});

test("密碼錯誤登入失敗（401 真後端）", async ({ page }) => {
  await page.goto("/user");
  await page.getByRole("tab", { name: "登入" }).click();
  await page.locator('input[name="lu"]').fill("no_such_user");
  await page.locator('input[name="lp"]').fill("wrongpass1");
  await page.getByRole("button", { name: /登入/ }).click();
  await expect(page.getByText("帳號或密碼錯誤")).toBeVisible();
});

test("訪客模式進入（POST /auth/guest 真後端）", async ({ page }) => {
  await page.goto("/user#guest");
  await page.getByRole("tab", { name: "訪客" }).click();
  await page.locator('input[name="gn"]').fill(`訪客${uniq()}`);
  await page.getByRole("button", { name: "以訪客進入" }).click();
  await expect(page.getByText("以訪客身份進入")).toBeVisible();
});

test("本地雙人對戰：開局 + 連續落子（POST /games + /moves 真後端）", async ({ page }) => {
  await page.goto("/");
  await page.getByText("本地雙人").click();
  await expect(page).toHaveURL(/\/game\//);
  await expect(page.locator("canvas.board")).toBeVisible();
  await expect(page.getByText("輪到黑方落子")).toBeVisible();

  // Click two intersections — server validates and alternates turns
  const board = page.locator("canvas.board");
  const box = await board.boundingBox();
  if (!box) throw new Error("board not visible");
  const cell = box.width / 15;
  await board.click({ position: { x: cell * 7.5, y: cell * 7.5 } }); // black (7,7)
  await expect(page.getByText("輪到白方落子")).toBeVisible();
  await board.click({ position: { x: cell * 8.5, y: cell * 7.5 } }); // white
  await expect(page.getByText("輪到黑方落子")).toBeVisible();
});

test("排行榜載入（GET /players/leaderboard 真後端，空資料容忍）", async ({ page }) => {
  await page.goto("/leaderboard");
  await expect(page.getByRole("heading", { name: "排行榜" })).toBeVisible();
  await expect(page.getByText(/上榜門檻：累計 10 場/)).toBeVisible();
  // No fixture-name assertion — real DB may be empty; the page must not error.
});

test("大廳載入 + 建立房間（訪客 → 大廳 → POST /rooms 真後端）", async ({ page }) => {
  // guest login first (lobby requires identity)
  await page.goto("/user#guest");
  await page.getByRole("tab", { name: "訪客" }).click();
  await page.locator('input[name="gn"]').fill(`房主${uniq()}`);
  await page.getByRole("button", { name: "以訪客進入" }).click();
  await expect(page.getByText("以訪客身份進入")).toBeVisible();

  await page.goto("/lobby");
  await page.getByRole("button", { name: "＋ 建立房間" }).click();
  await page.getByRole("button", { name: "建立並進入房間" }).click();
  await expect(page).toHaveURL(/\/room\//, { timeout: 10_000 });
});

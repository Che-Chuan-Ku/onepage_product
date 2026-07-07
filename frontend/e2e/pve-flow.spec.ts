import { test, expect, type Page } from "@playwright/test";

/**
 * PVE 挑戰模式 e2e（documents/PVE-挑戰模式-增量需求.md；pve-ui-spec.md）。
 *
 * Scope: home PVE entry → class selection → run creation → shop
 * purchase/reroll/skip → result screen.
 *
 * Reaching the shop screen requires actually clearing encounter #1. This
 * spec drives the real board UI (same `pve-cell-{r}-{c}` / confirm-move-btn
 * testids as e2e/pve-game.spec.ts) rather than faking it: an earlier version
 * tried to seed state via raw `fetch()` + a manual `history.pushState` +
 * `popstate` dispatch to fake a client-side transition, but Next's App
 * Router does not react to a synthetic popstate the way Pages Router did —
 * the URL bar changes while the rendered tree stays on the previous page.
 * Verified via a throwaway repro spec (removed) showing the shop assertions
 * timing out against still-rendered class-page content. Real UI navigation
 * (as used below and in pve-game.spec.ts's own "非第8關導向商店頁" case) is
 * the only path that reliably lands on `/pve/shop/[runId]`.
 */

const uniq = () => Math.random().toString(36).slice(2, 7);

async function registerAndLogin(page: Page, username = `pve${uniq()}`) {
  await page.goto("/user");
  await page.getByRole("tab", { name: "註冊" }).click();
  await page.locator('input[name="ru"]').fill(username);
  await page.locator('input[name="re"]').fill(`${username}@example.com`);
  await page.locator('input[name="rp"]').fill("test1234");
  await page.getByRole("button", { name: "建立帳號" }).click();
  await expect(page.getByText("註冊成功，已自動登入")).toBeVisible();
  await page.waitForURL("/");
  return username;
}

function cell(page: Page, row: number, col: number) {
  return page.getByTestId(`pve-cell-${row}-${col}`);
}

/** Touch-confirm move flow, matching PveBoard.tsx / pve-game.spec.ts. */
async function placeMove(page: Page, row: number, col: number) {
  await cell(page, row, col).click();
  await page.getByTestId("confirm-move-btn").click();
}

/** Creates a WARRIOR run via the real class-selection UI, then clears
 * encounter #1 (two disjoint 5-in-a-rows = 50+50 = 100 dmg = level 1's
 * bossHpMax) by clicking the real board, landing on the shop page for real
 * (app-triggered `router.push`, see pve/game/[encounterId]/page.tsx
 * handleCleared). Returns the runId parsed from the resulting URL. */
async function createRunAndOpenShop(page: Page) {
  await page.goto("/pve/class");
  await page.locator(".class-card", { hasText: "劍士" }).click();
  await page.getByRole("button", { name: "開始挑戰" }).click();
  await expect(page).toHaveURL(/\/pve\/game\/.+/);

  await placeMove(page, 0, 0);
  await placeMove(page, 0, 1);
  await placeMove(page, 0, 2);
  await placeMove(page, 0, 3);
  await placeMove(page, 0, 4);
  await placeMove(page, 1, 0);
  await placeMove(page, 1, 1);
  await placeMove(page, 1, 2);
  await placeMove(page, 1, 3);
  await placeMove(page, 1, 4);

  await expect(page).toHaveURL(/\/pve\/shop\//, { timeout: 5000 });
  const match = page.url().match(/\/pve\/shop\/([^/]+)/);
  return { runId: match?.[1] ?? "" };
}

test.describe("PVE 挑戰模式：模式選擇首頁入口", () => {
  test("未登入點擊 PVE 卡片顯示需要註冊帳號提示，無訪客入口", async ({ page }) => {
    await page.goto("/");
    await page.locator(".mode-card.pve").click();
    await expect(page.getByText("PVE 挑戰模式需要註冊帳號")).toBeVisible();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("link", { name: "註冊 / 登入" })).toBeVisible();
    // 與線上連線不同：不應該出現「以訪客遊玩」選項
    await expect(dialog.getByRole("link", { name: "以訪客遊玩" })).toHaveCount(0);
  });
});

test.describe("PVE 挑戰模式：職業選擇 → 建立 Run（FR-B1, FR-C8）", () => {
  test("已登入 → PVE 入口導向職業選擇頁 → 選職業建立Run → 導向棋盤關卡頁", async ({ page }) => {
    await registerAndLogin(page);
    await page.goto("/");
    await page.locator(".mode-card.pve").click();
    await page.waitForURL("**/pve/class");

    // 未選職業時「開始挑戰」停用
    await expect(page.getByRole("button", { name: "開始挑戰" })).toBeDisabled();

    await page.locator(".class-card", { hasText: "劍士" }).click();
    await expect(page.getByRole("button", { name: "開始挑戰" })).toBeEnabled();
    await page.getByRole("button", { name: "開始挑戰" }).click();

    await expect(page).toHaveURL(/\/pve\/game\/.+/);
  });
});

test.describe("PVE 挑戰模式：商店頁（FR-C3~FR-C5）", () => {
  test("購買展示位扣除金幣，跳過導向下一關棋盤頁", async ({ page }) => {
    await registerAndLogin(page);
    await createRunAndOpenShop(page);
    await expect(page.getByText(/已通過第 1 關/)).toBeVisible();

    const goldBefore = await page.locator(".coin-display").innerText();

    const firstOffer = page.locator(".shop-card").first();
    const price = await firstOffer.locator(".price").innerText();
    await firstOffer.getByRole("button", { name: "購買" }).click();
    await expect(firstOffer.getByRole("button", { name: "已購買" })).toBeVisible();

    // 金幣顯示應該隨購買扣除（本關通關獎勵 = 10 + 剩餘手數(20) = 30，足夠買一次）
    await expect(page.locator(".coin-display")).not.toHaveText(goldBefore);
    void price;

    await page.getByRole("button", { name: "跳過，前往下一關" }).click();
    await expect(page).toHaveURL(/\/pve\/game\/.+/);
  });

  test("金幣不足時重抽按鈕停用", async ({ page }) => {
    await registerAndLogin(page);
    await createRunAndOpenShop(page);

    // 通關獎勵 30 金幣、重抽花費 5：連續重抽到金幣 < 5 應該會停用按鈕。
    const rerollBtn = page.getByRole("button", { name: /重抽/ });
    for (let i = 0; i < 6; i++) {
      if (await rerollBtn.isDisabled()) break;
      await rerollBtn.click();
    }
    await expect(rerollBtn).toBeDisabled();
  });
});

test.describe("PVE 挑戰模式：結算畫面（FR-C7）", () => {
  // 結算頁改呼叫權威 `GET /pve/runs/{runId}/result`（api.yml:833-875）取得
  // goldEarned/goldSpent 等資料，取代先前只讀 sessionStorage.pveResult 的
  // 暫時方案（見頁面檔頭註解）。
  // "pve-run-e2e-won" 是 mock engine 的固定 demo fixture（pveEngine.ts
  // ensurePveDemoFixtures，與既有 pve-run-other-owner 403 fixture同一手法）：
  // 一個已結束（WON）的 Run，供本測試驗證結算頁改呼叫權威
  // `GET /pve/runs/{runId}/result` 端點（api.yml:833-875）後的畫面渲染，不需
  // 要真的把一整輪 Run 玩到WON。這裡的期望值需與該 fixture 的欄位一致。
  const wonResult = {
    runId: "pve-run-e2e-won",
    reachedEncounterSequence: 8,
    totalDamageDealt: 3200,
  };

  test("WON 顯示到達關數/總傷害/金幣/持有清單，並可導航回首頁/再來一次", async ({ page }) => {
    await registerAndLogin(page);
    await page.goto(`/pve/result/${wonResult.runId}`);

    await expect(page.getByText("Run 完成")).toBeVisible();
    await expect(page.getByText("到達關數")).toBeVisible();
    await expect(page.getByText("8/8")).toBeVisible();
    await expect(page.getByText(wonResult.totalDamageDealt.toString())).toBeVisible();
    await expect(page.getByText("銳刃")).toBeVisible(); // finalHeldRelics 中文名對照
    await expect(page.getByText(/橫劈 ×2/)).toBeVisible(); // finalHeldSkills 中文名+數量

    await expect(page.getByRole("link", { name: "再來一次" })).toHaveAttribute("href", "/pve/class");
    await expect(page.getByRole("link", { name: "回首頁" })).toHaveAttribute("href", "/");
  });

  test("找不到結算資料時顯示空狀態並提供回首頁按鈕（未經正常流程直接進入本頁）", async ({ page }) => {
    await page.goto("/pve/result/unknown-run-id");
    await expect(page.getByText("找不到本次挑戰的結算資料")).toBeVisible();
    await expect(page.getByRole("link", { name: "回首頁" })).toHaveAttribute("href", "/");
  });
});

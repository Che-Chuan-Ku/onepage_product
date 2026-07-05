import { test, expect } from "@playwright/test";

/**
 * 觀戰者身份 e2e（bug fix）：對局頁棋盤必須對觀戰者唯讀。
 *
 * 背景：room/[roomId]/page.tsx 的 goToGame() 原本不會把觀戰者身份轉成
 * ?role=spectator 導到 /game 頁；game/[gameId]/page.tsx 的 isSpectator 也
 * 只認 URL 的 role 參數，沒有任何 fallback。兩處都已修（見對應檔案）。
 * 這裡直接以 role=spectator 進對局頁，驗證「觀戰者最終落地」時棋盤唯讀 ——
 * 不論 role 參數從何而來（room 頁附加或本測試直接指定），行為必須一致。
 *
 * 用既有 duel MSW demo（duel-volcano-demo，15×15，mode=local 固定資料，
 * 見 duel.spec.ts 開頭註解）：不需要登入/建房，穩定可重播。
 */

async function clickBoard(page: import("@playwright/test").Page, row: number, col: number, n = 15) {
  const board = page.locator("canvas.board");
  const box = await board.boundingBox();
  if (!box) throw new Error("board canvas not visible");
  const pad = box.width * 0.045;
  const gap = (box.width - 2 * pad) / (n - 1);
  await board.click({ position: { x: pad + col * gap, y: pad + row * gap } });
}

test.describe("觀戰者身份：對局頁棋盤唯讀（bug fix）", () => {
  test("SP1 帶 role=spectator 進對局頁 → 觀戰橫幅顯示、棋盤不可互動、技能列不顯示", async ({ page }) => {
    await page.goto("/game/duel-volcano-demo?mode=local&role=spectator");

    // 觀戰橫幅 + 唯讀提示
    await expect(page.getByText("👁 觀戰中")).toBeVisible();
    await expect(page.getByText("棋盤唯讀，無法落子")).toBeVisible();
    // 棋盤容器帶 spectating class（interactive=false）
    await expect(page.locator(".board-wrap.spectating")).toBeVisible();
    // 觀戰者無技能操作列（duel && !isSpectator 才渲染）
    await expect(page.getByTestId("skill-bar")).toHaveCount(0);

    await expect(page.getByText("第 0 手")).toBeVisible();

    // 點擊棋盤空格：interactive=false 時 GomokuBoard 直接吃掉點擊，不觸發 onPlace，
    // 手數應保持不變（觀戰者無法讓任何一步落子生效）。
    await clickBoard(page, 2, 4, 15);
    await expect(page.getByText("第 0 手")).toBeVisible();
  });
});

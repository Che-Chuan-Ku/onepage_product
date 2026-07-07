import { test, expect, type Page } from "@playwright/test";

/**
 * PVE 挑戰模式 — 棋盤關卡頁 e2e (specs/ui/PVE棋盤關卡頁.md; pve-ui-spec.md §3).
 *
 * Board is a DOM grid (frontend/src/components/pve-game/PveBoard.tsx), not a
 * canvas — cells are addressed directly via `data-testid="pve-cell-{r}-{c}"`,
 * no pixel-math coordinate helper needed (unlike duel.spec.ts's canvas
 * `clickBoard`).
 *
 * MSW mock state (mocks/handlers/pveEngine.ts) is per-page-load in-memory —
 * each test starts from a fresh browser context/page load, so runs never
 * leak between tests. Level 1 is always PLAIN / bossHpMax 100 / moveBudget
 * 30 / 11x11 (createPveRun always starts at sequence 1), so exact
 * coordinates below are deterministic.
 *
 * NOTE: per task scope this spec is written but not executed here (a
 * parallel agent's dev server may be running on the same port); run via
 * `npm run test:e2e` in a later verification pass.
 */

const uniq = () => Math.random().toString(36).slice(2, 7);

async function loginRegistered(page: Page, username = `勇者${uniq()}`) {
  await page.goto("/user");
  await page.locator("#lu").fill(username);
  await page.locator("#lp").fill("pass1234");
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page.getByText(/歡迎回來/)).toBeVisible();
  await expect(page).toHaveURL("/");
}

/** 建立一場新的 WARRIOR PVE Run，導向棋盤關卡頁並等待第1關資訊出現。 */
async function startWarriorRun(page: Page) {
  await page.goto("/pve/class");
  await page.getByText("劍士").click();
  await page.getByRole("button", { name: "開始挑戰" }).click();
  await expect(page).toHaveURL(/\/pve\/game\//);
  await expect(page.getByText("第 1/8 關")).toBeVisible();
}

function cell(page: Page, row: number, col: number) {
  return page.getByTestId(`pve-cell-${row}-${col}`);
}

/** 觸控確認流程：點格子預覽 → 按「確認落子」才真正送出（task point 2）。 */
async function placeMove(page: Page, row: number, col: number) {
  await cell(page, row, col).click();
  await page.getByTestId("confirm-move-btn").click();
}

test.describe("PVE棋盤關卡頁：觸控確認落子（增量需求 FR-B2）", () => {
  test("點格子只預覽不落子；按確認落子才真正送出，點別處可改變預覽位置", async ({ page }) => {
    await loginRegistered(page);
    await startWarriorRun(page);

    // 第一次點擊：僅預覽，尚未送出（棋盤上不應出現棋子，確認列顯示座標）。
    await cell(page, 5, 5).click();
    await expect(page.getByText("已選第 5 列、第 5 欄")).toBeVisible();
    await expect(page.getByTestId("confirm-move-btn")).toBeVisible();

    // 點別處：預覽位置改變（confirm bar 文字更新為新座標）。
    await cell(page, 6, 6).click();
    await expect(page.getByText("已選第 6 列、第 6 欄")).toBeVisible();

    // 確認落子才真正送出：手數從 0 變成已使用 1 手。
    await expect(page.getByText("30 / 30")).toBeVisible();
    await page.getByTestId("confirm-move-btn").click();
    await expect(page.getByText("29 / 30")).toBeVisible();
  });
});

test.describe("PVE棋盤關卡頁：連線傷害結算與 Boss HP（增量需求 FR-B3）", () => {
  test("形成五連時 Boss HP 下降並顯示傷害浮動數字", async ({ page }) => {
    await loginRegistered(page);
    await startWarriorRun(page);

    await expect(page.getByText("100 / 100")).toBeVisible(); // Boss HP 滿血（第1關）

    // 橫向鋪 4 子，第 5 子完成五連 → 基礎分50 x 倍率1.0 = 50 傷害。
    await placeMove(page, 0, 0);
    await placeMove(page, 0, 1);
    await placeMove(page, 0, 2);
    await placeMove(page, 0, 3);
    await placeMove(page, 0, 4);

    await expect(page.getByText("50 / 100")).toBeVisible();
    await expect(page.getByTestId("pve-dmg-layer")).toContainText("-50");
    // 五連棋子結算後全數移除，恢復可落子。
    await expect(cell(page, 0, 0)).not.toHaveClass(/pveg-cell-stone/);
  });
});

test.describe("PVE棋盤關卡頁：技能使用（增量需求 FR-A2 FR-B5）", () => {
  test("使用起始技能後手數不變、持有量歸零，按鈕從列表消失", async ({ page }) => {
    await loginRegistered(page);
    await startWarriorRun(page);

    // WARRIOR 附贈 HORIZONTAL_SLASH x1（建關必附贈，FR-B5）。
    const skillBtn = page.getByTestId("skill-btn-HORIZONTAL_SLASH");
    await expect(skillBtn).toBeVisible();
    await skillBtn.click();

    // axis 技能：先選方向（橫劈用 UP/DOWN）。
    await page.getByRole("button", { name: "上" }).click();
    await page.getByTestId("confirm-skill-btn").click();

    // 技能為獨立行動：不消耗手數（仍是 30/30）。
    await expect(page.getByText("30 / 30")).toBeVisible();
    // 持有量 1→0，按鈕自庫存清單移除（本地 heldSkills 遞減 + 過濾）。
    await expect(page.getByTestId("skill-btn-HORIZONTAL_SLASH")).not.toBeVisible();
    // 本關已使用技能清單即時更新（usedSkills 本地追蹤）。
    await expect(page.getByText("本關已使用技能：橫劈")).toBeVisible();
  });
});

test.describe("PVE棋盤關卡頁：關卡通過後導向（增量需求 FR-C3）", () => {
  test("Boss HP歸零時顯示通過overlay，非第8關導向商店頁", async ({ page }) => {
    await loginRegistered(page);
    await startWarriorRun(page);

    // 兩條不相交的橫向五連，各 50 傷害，合計 100 = 第1關 BossHP 上限，直接通關。
    await placeMove(page, 0, 0);
    await placeMove(page, 0, 1);
    await placeMove(page, 0, 2);
    await placeMove(page, 0, 3);
    await placeMove(page, 0, 4); // 第一條五連結算，HP 100->50
    await expect(page.getByText("50 / 100")).toBeVisible();

    await placeMove(page, 1, 0);
    await placeMove(page, 1, 1);
    await placeMove(page, 1, 2);
    await placeMove(page, 1, 3);
    await placeMove(page, 1, 4); // 第二條五連結算，HP 50->0，關卡通過

    await expect(page.getByText("關卡通過！")).toBeVisible();
    // 非第8關 → 900ms 後導向商店頁（見 page.tsx handleCleared）。
    await expect(page).toHaveURL(/\/pve\/shop\//, { timeout: 5000 });
  });
});

test.describe("PVE棋盤關卡頁：放棄挑戰（增量需求 FR-C7）", () => {
  test("放棄挑戰二次確認後導向結算畫面", async ({ page }) => {
    await loginRegistered(page);
    await startWarriorRun(page);

    await page.getByRole("button", { name: "放棄挑戰" }).click();
    await expect(page.getByText("確定要放棄本次挑戰？")).toBeVisible();
    await page.getByRole("button", { name: "確定放棄" }).click();
    await expect(page).toHaveURL(/\/pve\/result\//);
  });
});

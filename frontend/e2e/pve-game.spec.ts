import { test, expect, type Page } from "@playwright/test";

/**
 * PVE 挑戰模式 — 棋盤關卡頁 e2e，全對弈版（documents/PVE-全對弈階梯設計-
 * 2026-07-10.md §1/§8：全8關皆為 DUEL，消線 PUZZLE 機制整批退役——本檔原本的
 * 「預放雛形／BossHP／連線傷害」斷言隨之退役，改斷言對弈關的核心行為：空盤
 * 開局、無HP條、落子後Boss回手、技能不觸發Boss回手、贏一場真對弈後導向商店）。
 *
 * Board is the shared canvas `GomokuBoard` (frontend/src/components/
 * pve-game/PveBoard.tsx wraps `<Board>`) — cells are clicked via pixel-math
 * (`clickBoard`, mirroring pve-duel.spec.ts's helper for the same underlying
 * canvas), not DOM testids.
 *
 * 每次進入/切換關卡都會先顯示策略卡（§6 對弈課程化），按「開始」才收起——見
 * `dismissStrategyCard`，由 `startWarriorRun` 呼叫。
 *
 * MSW mock state (mocks/handlers/pveEngine.ts) is per-page-load in-memory —
 * each test starts from a fresh browser context/page load, so runs never
 * leak between tests.
 */

const uniq = () => Math.random().toString(36).slice(2, 7);
const SEED = "e2e-seed-0";

let pageErrors: string[] = [];
test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
});
test.afterEach(() => {
  expect(pageErrors, `偵測到未捕獲的前端例外：\n${pageErrors.join("\n")}`).toEqual([]);
});

async function loginRegistered(page: Page, username = `勇者${uniq()}`) {
  await page.goto("/user");
  await page.locator("#lu").fill(username);
  await page.locator("#lp").fill("pass1234");
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page.getByText(/歡迎回來/)).toBeVisible();
  await expect(page).toHaveURL("/");
}

/** 建立一場新的 WARRIOR PVE Run（固定 seed），導向棋盤關卡頁並等待第1關資訊出現。 */
async function startWarriorRun(page: Page, seed: string = SEED) {
  await page.goto(`/pve/class?seed=${seed}`);
  await page.getByText("劍士").click();
  await page.getByRole("button", { name: "開始挑戰" }).click();
  await expect(page).toHaveURL(/\/pve\/game\//);
  await expect(page.getByText("第 1/8 關")).toBeVisible();
  await dismissStrategyCard(page);
}

/** 策略卡（§6 對弈課程化）在棋盤可互動前顯示，按「開始」才收起。 */
async function dismissStrategyCard(page: Page) {
  await page.getByTestId("pve-strategy-card-start-btn").click();
}

/** 棋盤格座標 → canvas 點擊位置（11x11，同 pve-duel.spec.ts clickBoard 幾何公式）。 */
async function clickBoard(page: Page, row: number, col: number, n = 11) {
  const board = page.locator("canvas.board");
  const box = await board.boundingBox();
  if (!box) throw new Error("board canvas not visible");
  const pad = box.width * 0.045;
  const gap = (box.width - 2 * pad) / (n - 1);
  await board.click({ position: { x: pad + col * gap, y: pad + row * gap } });
}

/** 觸控確認流程：點格子預覽 → 按「確認落子」才真正送出（FR-B2）。 */
async function placeMove(page: Page, row: number, col: number) {
  await clickBoard(page, row, col);
  await page.getByTestId("confirm-move-btn").click();
}

/** 目前棋盤上所有棋子座標（黑＝玩家、白＝Boss ENEMY_STONE 都包含在
 * PveBoard.tsx e2e-only data-cells hook 裡）。 */
async function currentStoneCells(page: Page): Promise<[number, number][]> {
  const raw = await page.getByTestId("pve-stone-count").getAttribute("data-cells");
  return raw ? (JSON.parse(raw) as [number, number][]) : [];
}

/** 通關 overlay 是否在短暫視窗內出現（見 winDuelViaUi 內的競態註解）。 */
async function clearedOverlayAppeared(page: Page, timeoutMs = 400): Promise<boolean> {
  return page
    .getByText("五連達成，你贏了！")
    .waitFor({ state: "visible", timeout: timeoutMs })
    .then(() => true)
    .catch(() => false);
}

/**
 * 對弈版通關（與 pve-duel.spec.ts / pve-flow.spec.ts 同款 helper）：在遠離
 * 中心的某一「列」橫向連下 (row,2)..(row,5) 做出**活四**——mock Boss AI 只會
 * 擋「這一步就贏」的必殺格（pveEngine.ts simpleBossMove 一次只能擋一端）、
 * 否則揀最靠近中心的空格，因此活四的另一端必然補得上，第 5 手即五連取勝。
 *
 * 舊版「單欄堆疊」策略是間歇性 flaky 的根因：它逼出的一串必擋格會在同一欄
 * 縱向排成一線，與 Boss 早期就近中心的自由落子連成 Boss 自己的五連（mock
 * 的 own-five 檢查優先於擋子）——Boss 反而先贏。活四策略只給 Boss 4 顆
 * 散落棋子（3 自由 + 1 擋端），結構上不可能湊出五連。
 *
 * 每手落子後都以「盤面棋子總數」為同步點（玩家第 n 手 + Boss 回手 = 2n
 * 顆），避免下一輪讀到 Boss 回手尚未渲染的過期盤面（舊版另一個 flaky 源）。
 */
async function winDuelViaUi(page: Page): Promise<void> {
  const fallbackRows = [8, 7, 2, 3, 9];
  for (const row of fallbackRows) {
    const myCols = new Set<number>();
    // 構線span (row,1)..(row,6) 內出現任何「不是我這一列已下的」棋子 → 這一列
    // 已被 Boss 干擾，放棄換下一列。
    const foreignInSpan = async () => {
      const cells = await currentStoneCells(page);
      return cells.some(([r, c]) => r === row && c >= 1 && c <= 6 && !myCols.has(c));
    };
    if (await foreignInSpan()) continue;
    let aborted = false;
    const baseline = (await currentStoneCells(page)).length;
    for (const col of [2, 3, 4, 5]) {
      if (await foreignInSpan()) {
        aborted = true;
        break;
      }
      await placeMove(page, row, col);
      myCols.add(col);
      if (await clearedOverlayAppeared(page)) return;
      // 同步點：等 Boss 回手落地（玩家第 n 手 + Boss 回手 = baseline + 2n）。
      await expect
        .poll(async () => (await currentStoneCells(page)).length, { timeout: 5000 })
        .toBeGreaterThanOrEqual(baseline + myCols.size * 2);
    }
    if (aborted) continue;
    // 活四已成：Boss 只擋得了一端，補上仍空著的那一端即勝。
    const cells = await currentStoneCells(page);
    const flank = cells.some(([r, c]) => r === row && c === 6) ? 1 : 6;
    await placeMove(page, row, flank);
    if (await clearedOverlayAppeared(page, 3000)) return;
  }
  throw new Error("winDuelViaUi: exhausted every fallback row without completing five-in-a-row");
}

test.describe("PVE棋盤關卡頁：對弈關開局狀態（全對弈階梯 §1/§5.2）", () => {
  test("第1關載入時為對弈空盤：無預放棋子、無BossHP條、手數預算50、顯示先後手提示", async ({
    page,
  }) => {
    await loginRegistered(page);
    await startWarriorRun(page);

    // 全對弈化後不再有消線雛形：開局是空盤（L1 無開局腳本，NONE）。
    await expect(page.getByTestId("pve-stone-count")).toHaveAttribute("data-count", "0");
    // DUEL 關沒有 BossHP 概念，不渲染 HP 條（§5.2），改顯示手數與先後手提示。
    await expect(page.getByText("Boss HP")).toHaveCount(0);
    await expect(page.getByText("50 / 50")).toBeVisible(); // L1 手數預算（§7.6 致命骰禁令重校準值）
    await expect(page.getByTestId("pve-duel-turn-hint")).toBeVisible();
  });
});

test.describe("PVE棋盤關卡頁：觸控確認落子（增量需求 FR-B2）", () => {
  test("點格子只預覽不落子；按確認落子才真正送出並觸發Boss回手，點別處可改變預覽位置", async ({
    page,
  }) => {
    await loginRegistered(page);
    await startWarriorRun(page);

    // 第一次點擊：僅預覽，尚未送出（確認列顯示座標、手數未消耗）。
    await clickBoard(page, 5, 5);
    await expect(page.getByText("已選第 5 列、第 5 欄")).toBeVisible();
    await expect(page.getByTestId("confirm-move-btn")).toBeVisible();
    await expect(page.getByText("50 / 50")).toBeVisible();

    // 點別處：預覽位置改變（confirm bar 文字更新為新座標）。
    await clickBoard(page, 6, 6);
    await expect(page.getByText("已選第 6 列、第 6 欄")).toBeVisible();

    // 確認落子才真正送出：手數 50→49，且 Boss 立即回手一手（對弈節奏：一人
    // 一手）——盤面上應有兩顆棋子（玩家黑 + Boss 白）。
    await page.getByTestId("confirm-move-btn").click();
    await expect(page.getByText("49 / 50")).toBeVisible();
    const cells = await currentStoneCells(page);
    expect(cells).toContainEqual([6, 6]);
    expect(cells.length).toBe(2); // 玩家 1 子 + Boss 回手 1 子
  });
});

test.describe("PVE棋盤關卡頁：技能使用（增量需求 FR-A2 FR-B5；§1.6 技能不觸發Boss回手）", () => {
  test("使用起始技能後手數不變、Boss不回手、持有量歸零，按鈕從列表消失", async ({ page }) => {
    await loginRegistered(page);
    await startWarriorRun(page);

    // 先落一手觸發正常的 Boss 回手，取得穩定的盤面基準。
    await placeMove(page, 5, 5);
    await expect(page.getByText("49 / 50")).toBeVisible(); // 同步點：回手已落地
    const cellsBeforeSkill = await currentStoneCells(page);

    // WARRIOR 附贈 HORIZONTAL_SLASH x1（建關必附贈，FR-B5）。
    const skillBtn = page.getByTestId("skill-btn-HORIZONTAL_SLASH");
    await expect(skillBtn).toBeVisible();
    await skillBtn.click();

    // axis 技能：先選方向，再點棋盤格收集推擠參考格 anchor。錨點 (8,8) 遠離
    // 現有棋子，推擠為安全 no-op。
    await page.getByRole("button", { name: "上" }).click();
    await expect(page.getByText(/推擠參考格/)).toBeVisible();
    await clickBoard(page, 8, 8);
    await page.getByTestId("confirm-skill-btn").click();
    await expect(page.getByText("本關已使用技能：橫劈")).toBeVisible(); // 同步點

    // 技能為獨立行動（§1.6）：不消耗玩家手數，Boss 也不回手（棋子總數不變）。
    await expect(page.getByText("49 / 50")).toBeVisible();
    const cellsAfterSkill = await currentStoneCells(page);
    expect(cellsAfterSkill.sort()).toEqual(cellsBeforeSkill.sort());
    // 持有量 1→0，按鈕自庫存清單移除（本地 heldSkills 遞減 + 過濾）。
    await expect(page.getByTestId("skill-btn-HORIZONTAL_SLASH")).not.toBeVisible();
  });
});

test.describe("PVE棋盤關卡頁：關卡通過後導向（增量需求 FR-C3）", () => {
  // 打贏一整場對弈需要 ~15–20 手真實 UI 操作 + 每手的 overlay 競態緩衝，
  // 預設 30s 太緊。
  test.describe.configure({ timeout: 60_000 });
  test("打贏第1關對弈（連五）後顯示通過overlay，非第8關導向商店頁", async ({ page }) => {
    await loginRegistered(page);
    await startWarriorRun(page);

    // 全對弈化：通關 = 真的打贏一場對弈（玩家先連五），不再是補完消線雛形。
    await winDuelViaUi(page);

    await expect(page.getByText("五連達成，你贏了！")).toBeVisible();
    // 非第8關 → 900ms 後導向商店頁（見 page.tsx handleCleared）。
    await expect(page).toHaveURL(/\/pve\/shop\//, { timeout: 5000 });
  });
});

test.describe("PVE棋盤關卡頁：L3 不可橫向即時回饋（全對弈階梯 §4.1；§7.6 第二批 polish item #2）", () => {
  test.describe.configure({ timeout: 60_000 });
  test("第3關湊成橫向五連：不判勝、該線灰化虛線渲染、toast 提示橫向連線不計勝負", async ({
    page,
  }) => {
    await loginRegistered(page);
    // e2e 測試鉤子（pveEngine.ts START_SEQUENCE_SEED_MARKER）：seed 後綴
    // -pve-startseq-3 讓 Run 直接從第3關（APPRENTICE＋不可橫向）開始。
    await page.goto(`/pve/class?seed=${SEED}-pve-startseq-3`);
    await page.getByText("劍士").click();
    await page.getByRole("button", { name: "開始挑戰" }).click();
    await expect(page).toHaveURL(/\/pve\/game\//);
    await expect(page.getByText("第 3/8 關")).toBeVisible();
    await dismissStrategyCard(page);

    // 常駐提醒橫幅（§4.1 既有行為）＋ 尚無失效線。
    await expect(page.getByTestId("pve-horizontal-disabled-banner")).toBeVisible();
    await expect(page.getByTestId("pve-void-line")).toHaveAttribute("data-count", "0");

    // 在遠離中心的第 8 列橫向連下 5 手：mock 的勝負判定與 Boss 擋子邏輯在
    // horizontalDisabled 下都會忽略橫向（fiveThrough dirIndex 0 skip），所以
    // 這條線不會被擋、也不會判勝——正是「湊成瞬間」的回饋場景。
    const row = 8;
    for (const col of [2, 3, 4, 5, 6]) {
      await placeMove(page, row, col);
      // 同步點：等本手（與 Boss 回手）落地，避免下一手讀到過期盤面。
      await expect
        .poll(async () => (await currentStoneCells(page)).some(([r, c]) => r === row && c === col))
        .toBe(true);
    }

    // 湊成瞬間：不判勝（無結算 overlay、關卡進行中）、toast 出現、灰化線 e2e
    // hook 帶出這 5 格。
    await expect(page.getByText("橫向連線不計勝負！")).toBeVisible();
    await expect(page.getByTestId("pve-outcome-title")).toHaveCount(0);
    const raw = await page.getByTestId("pve-void-line").getAttribute("data-cells");
    const voidCells = raw ? (JSON.parse(raw) as [number, number][]) : [];
    for (const col of [2, 3, 4, 5, 6]) {
      expect(voidCells).toContainEqual([row, col]);
    }
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

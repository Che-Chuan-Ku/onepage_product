import { test, expect, type Page } from "@playwright/test";

/**
 * PVE 魔王對弈（documents/PVE-全對弈階梯設計-2026-07-10.md）e2e —
 * 第2關（DUEL）棋盤頁 UI：策略卡對弈要領文案、HP條隱藏、玩家落子後Boss立即
 * 回應一手。第2關保留07-09文件已驗證定案值（花月開局/moveBudget=45），全對弈
 * 階梯改版後從原第4關移至此。
 *
 * 第2關前必須先通過第1關；全程用真實棋盤點擊（同 pve-game.spec.ts /
 * pve-flow.spec.ts 既有手法）而非直接 `page.goto` 到中途關卡或呼叫API後硬
 * 重新整理——MSW 的 mock 狀態是 Service Worker 記憶體內狀態，一次硬重新整理
 * 可能讓瀏覽器回收閒置的 SW 導致狀態遺失（實測驗證：直接 `page.goto` 到
 * 已用API推進到的關卡會 404 並被導回首頁）。全程走真實 client-side 導航
 * （按鈕點擊、never a hard reload mid-run）才能保證 SW 狀態不中斷。
 */

const uniq = () => Math.random().toString(36).slice(2, 7);
const SEED = "duel-e2e-seed-0";

let pageErrors: string[] = [];
test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
});
test.afterEach(() => {
  expect(pageErrors, `偵測到未捕獲的前端例外：\n${pageErrors.join("\n")}`).toEqual([]);
});

async function registerAndLogin(page: Page, username = `duel${uniq()}`) {
  await page.goto("/user");
  await page.getByRole("tab", { name: "註冊" }).click();
  await page.locator('input[name="ru"]').fill(username);
  await page.locator('input[name="re"]').fill(`${username}@example.com`);
  await page.locator('input[name="rp"]').fill("test1234");
  await page.getByRole("button", { name: "建立帳號" }).click();
  await expect(page.getByText("註冊成功，已自動登入")).toBeVisible();
  await page.waitForURL("/");
}

async function clickBoard(page: Page, row: number, col: number, n = 11) {
  const board = page.locator("canvas.board");
  const box = await board.boundingBox();
  if (!box) throw new Error("board canvas not visible");
  const pad = box.width * 0.045;
  const gap = (box.width - 2 * pad) / (n - 1);
  await board.click({ position: { x: pad + col * gap, y: pad + row * gap } });
}

async function placeMove(page: Page, row: number, col: number) {
  await clickBoard(page, row, col);
  await page.getByTestId("confirm-move-btn").click();
}

async function dismissStrategyCard(page: Page) {
  await page.getByTestId("pve-strategy-card-start-btn").click();
}

/** 目前棋盤上的預放黑棋座標（PveBoard.tsx 的 e2e-only data-cells hook）。 */
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
 * documents/PVE-全對弈階梯設計-2026-07-10.md §1: 全8關皆為DUEL（不再有消線
 * PUZZLE關的預放雛形可補），第1關的推進改為真的打贏一場對弈：在遠離中心的
 * 某一列橫向連下 (row,2)..(row,5) 做出**活四**——mock Boss AI 刻意極簡（只會
 * 擋「這一步棋玩家就贏」的必殺格、否則揀最靠近棋盤中心的空格，見 pveEngine.ts
 * simpleBossMove），一次只擋得了活四的一端，補上另一端即五連取勝。
 *
 * 舊版「單欄堆疊」策略是本檔間歇性 flaky 的根因：堆疊逼出的一串必擋格會在
 * 同一欄縱向連線，與 Boss 早期就近中心的自由落子拼成 Boss 自己的五連（mock
 * 的 own-five 檢查優先於擋子）——Boss 反而先贏。活四策略只給 Boss 4 顆散落
 * 棋子（3 自由 + 1 擋端），結構上湊不出五連；每手並以「盤面棋子總數」為
 * 同步點，避免讀到 Boss 回手尚未渲染的過期盤面（另一個 flaky 源）。
 */
async function winDuelViaUi(page: Page): Promise<void> {
  const fallbackRows = [8, 7, 2, 3, 9];
  for (const row of fallbackRows) {
    const myCols = new Set<number>();
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

/**
 * 真實UI操作推進：打贏第1關對弈＋跳過商店，落在第2關棋盤頁——第2關是本測試
 * 鎖定的目標（documents/PVE-全對弈階梯設計-2026-07-10.md §1: 花月開局／
 * moveBudget=45 這兩個07-09文件已驗證定案值，全對弈階梯改版後移到第2關，
 * 不再是原本的第4關）。
 */
async function advanceToEncounter2ViaUi(page: Page, seed: string = SEED) {
  await page.goto(`/pve/class?seed=${seed}`);
  await page.locator(".class-card", { hasText: "劍士" }).click();
  await page.getByRole("button", { name: "開始挑戰" }).click();
  await expect(page).toHaveURL(/\/pve\/game\/.+/);

  await expect(page.getByText("第 1/8 關")).toBeVisible();
  await dismissStrategyCard(page);
  await winDuelViaUi(page);
  await expect(page.getByText("五連達成，你贏了！")).toBeVisible();
  await expect(page).toHaveURL(/\/pve\/shop\//, { timeout: 5000 });
  await page.getByRole("button", { name: "跳過，前往下一關" }).click();
  await expect(page).toHaveURL(/\/pve\/game\/.+/);
  await expect(page.getByText("第 2/8 關")).toBeVisible();
}

test.describe("PVE 魔王對弈：第2關（DUEL）棋盤頁 UI（documents/PVE-全對弈階梯設計-2026-07-10.md §1）", () => {
  // advanceToEncounter2ViaUi 需要打贏一整場第1關對弈（~15–20 手真實 UI 操作），
  // 預設 30s 太緊。
  test.describe.configure({ timeout: 60_000 });
  test("進入第4關：策略卡顯示對弈要領、HP條隱藏、玩家落子後Boss立即回應一手", async ({ page }) => {
    await registerAndLogin(page);
    await advanceToEncounter2ViaUi(page);

    // 策略卡（§2.2/§2.3）：對弈關顯示要領文案，不是消線關的棋形示意。
    await expect(page.getByTestId("pve-strategy-card-title")).toContainText("做活三");
    await dismissStrategyCard(page);

    // DUEL關無BossHP概念，不渲染HP條；改顯示手數與輪到誰提示（§5.2）。
    await expect(page.getByText("Boss HP")).toHaveCount(0);
    await expect(page.getByTestId("pve-duel-turn-hint")).toBeVisible();

    // 玩家落子（DUEL關沒有預放雛形，任一空格皆可）。Boss應在同一次回應內立即
    // 回手一手（開局腳本「花月」：Boss第一手＝(playerRow+1, playerCol)）。
    // 手數應消耗1手（Boss回手不佔玩家配額，§1.5）——用這個文字更新當作「回應
    // 已完成、DOM已重繪」的同步點，避免在非同步 confirmMove() 完成前就讀
    // data-cells（confirm-move-btn 的 click() 只保證事件已送出，不保證
    // await pveService.placeMove() 之後的 setState 已 flush）。
    await placeMove(page, 5, 5);
    await expect(page.getByText(/剩餘手數（你的落子）/)).toBeVisible();
    await expect(page.getByText("44 / 45")).toBeVisible();
    const cellsAfter = await currentStoneCells(page);
    expect(cellsAfter).toContainEqual([5, 5]);
    expect(cellsAfter).toContainEqual([6, 5]); // Boss開局腳本「花月」回手座標
  });

  test("DUEL關技能可用（智取路徑），且施放不觸發Boss回手（§1.6）", async ({ page }) => {
    await registerAndLogin(page);
    await advanceToEncounter2ViaUi(page);
    await dismissStrategyCard(page);

    // WARRIOR職業附贈HORIZONTAL_SLASH（ARCHER才附贈PRECISION_SNIPE）；用橫劈
    // 驗證「技能可用、且DUEL關技能不觸發Boss回手」（§1.6：技能是獨立行動，
    // 不佔玩家手數配額，也不讓Boss白賺一手）。
    await placeMove(page, 5, 5); // 觸發Boss第一手回應（開局腳本，非AI）
    await expect(page.getByText("44 / 45")).toBeVisible(); // 同步點：確認回應已落地
    const afterFirstMove = await currentStoneCells(page);

    const skillBtn = page.getByTestId("skill-btn-HORIZONTAL_SLASH");
    await expect(skillBtn).toBeVisible();
    await skillBtn.click();
    await page.getByRole("button", { name: "上" }).click();
    await clickBoard(page, 8, 8); // 推擠參考格，遠離任何棋子，安全no-op
    await page.getByTestId("confirm-skill-btn").click();
    await expect(page.getByText("本關已使用技能：橫劈")).toBeVisible(); // 同步點

    // 技能為獨立行動：玩家自己的手數不變、Boss不會多回一手（DUEL的moveBudget
    // 只計玩家落子；棋子總數應與技能施放前完全相同）。
    await expect(page.getByText("44 / 45")).toBeVisible();
    const cellsAfterSkill = await currentStoneCells(page);
    expect(cellsAfterSkill.sort()).toEqual(afterFirstMove.sort());
  });

  test("手數耗盡且未連五＝和局DRAW，顯示「再來一局」，重試後原地重開本關（§1.5/§6.5 公平性修正）", async ({
    page,
  }) => {
    // pve-drawtest 標記（mocks/handlers/pveEngine.ts createEncounterInternal）：
    // 測試專用 seed 後綴，讓 DUEL 關的 moveBudget 直接壓到1，不需要真的跑滿
    // 45手對局就能觸發手數耗盡。標記只影響 DUEL 關；餵進 rng 前會被剝掉，
    // 所以基底沿用既有已驗證可完成第1-3關的 SEED，第1-3關行為與其他測試
    // 完全一致。
    await registerAndLogin(page);
    await advanceToEncounter2ViaUi(page, `${SEED}-pve-drawtest`);
    await dismissStrategyCard(page);

    // moveBudget=1：玩家唯一一手落子後，若未連五，立即手數耗盡＝DRAW（不是
    // FAILED）——不導向結算頁，顯示「勢均力敵」提示與「再來一局」按鈕。
    await placeMove(page, 5, 5);
    await expect(page.getByTestId("pve-outcome-title")).toHaveText("勢均力敵！再來一局");
    // DRAW 不是失敗：不應該出現「挑戰失敗」字樣，也不應該離開棋盤頁去結算頁。
    await expect(page.getByText("挑戰失敗")).toHaveCount(0);
    await expect(page).toHaveURL(/\/pve\/game\/.+/);

    const retryBtn = page.getByTestId("pve-draw-retry-btn");
    await expect(retryBtn).toBeVisible();
    await retryBtn.click();

    // 重試後：仍在第4關棋盤頁（Run未受影響），策略卡重新顯示（視同關卡重新
    // 開始），outcome modal 已關閉，盤面已清空（新encounter，movesUsed=0）。
    await expect(page.getByText("第 2/8 關")).toBeVisible();
    await expect(page.getByTestId("pve-strategy-card-title")).toContainText("做活三");
    await expect(page.getByTestId("pve-outcome-title")).toHaveCount(0);
    await dismissStrategyCard(page);
    await expect(page.getByText(/剩餘手數（你的落子）/)).toBeVisible();
    await expect(page.getByText("1 / 1")).toBeVisible(); // 重試後 moveBudget 仍=1（同一 draw-test seed），movesUsed 已歸零

    // 重開後的盤面應該是全新的（沒有殘留上一次嘗試的棋子）。
    const cellsAfterRetry = await currentStoneCells(page);
    expect(cellsAfterRetry).toEqual([]);
  });
});

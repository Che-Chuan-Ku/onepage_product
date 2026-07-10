import { test, expect, type Page } from "@playwright/test";

/**
 * PVE 挑戰模式 e2e（documents/PVE-挑戰模式-增量需求.md；pve-ui-spec.md）。
 *
 * Scope: home PVE entry → class selection → run creation → shop
 * purchase/reroll/skip → result screen.
 *
 * Reaching the shop screen requires actually clearing encounter #1. This
 * spec drives the real board UI (canvas GomokuBoard click-by-position, same
 * `clickBoard` helper as e2e/pve-game.spec.ts) rather than faking it: an earlier version
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

// ── 全域 runtime-error 護欄（同 full-coverage.spec.ts 慣例）──────────────
// 沒有這道護欄，Gate A/B 的 zod parse 失敗或前端 runtime crash 會被 MSW
// silently swallow，測試仍顯示綠燈（見 integration-test/REPORT.md
// 2026-06-10「coverage_blind_spots_fixed」的教訓）。
let pageErrors: string[] = [];
test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
});
test.afterEach(() => {
  expect(pageErrors, `偵測到未捕獲的前端例外：\n${pageErrors.join("\n")}`).toEqual([]);
});

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

// Board is the shared canvas GomokuBoard now (documents/PVE-關卡重設計-
// 2026-07-08.md §6) — click by pixel position, same geometry helper as
// pve-game.spec.ts / duel.spec.ts's clickBoard.
async function clickBoard(page: Page, row: number, col: number, n = 11) {
  const board = page.locator("canvas.board");
  const box = await board.boundingBox();
  if (!box) throw new Error("board canvas not visible");
  const pad = box.width * 0.045;
  const gap = (box.width - 2 * pad) / (n - 1);
  await board.click({ position: { x: pad + col * gap, y: pad + row * gap } });
}

/** Touch-confirm move flow, matching PveBoard.tsx / pve-game.spec.ts. */
async function placeMove(page: Page, row: number, col: number) {
  await clickBoard(page, row, col);
  await page.getByTestId("confirm-move-btn").click();
}

// e2e-only determinism seed (wired via ?seed= on /pve/class, see
// app/pve/class/page.tsx). 全對弈化（documents/PVE-全對弈階梯設計-2026-07-10.md
// §1/§8）後不再有消線雛形可補——第1關（DUEL, moveBudget 35）要靠真的打贏一場
// 對弈通關，見 winDuelViaUi。
const SEED = "e2e-seed-0";

/** 目前棋盤上所有棋子座標（黑＝玩家、白＝Boss，PveBoard.tsx data-cells hook）。 */
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
 * 對弈版通關（與 pve-game.spec.ts / pve-duel.spec.ts 同款 helper）：在遠離
 * 中心的某一列橫向連下 (row,2)..(row,5) 做出活四——mock Boss（pveEngine.ts
 * simpleBossMove）一次只擋得了一端，補上另一端即五連取勝。舊版「單欄堆疊」
 * 是間歇性 flaky 根因（逼出的必擋格會縱向連成 Boss 自己的五連），詳見
 * pve-game.spec.ts 同名 helper 的註解。
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

/** 策略卡（documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §2.2）在棋盤可
 * 互動前顯示，按「開始」才收起——每次進入/切換關卡都需要先呼叫本函式。 */
async function dismissStrategyCard(page: Page) {
  await page.getByTestId("pve-strategy-card-start-btn").click();
}

/** Creates a WARRIOR run via the real class-selection UI, then clears
 * encounter #1 by genuinely WINNING the duel (five-in-a-row via
 * winDuelViaUi — 全對弈化後沒有雛形可補), landing on the shop page for real
 * (app-triggered `router.push`, see pve/game/[encounterId]/page.tsx
 * handleCleared). Returns the runId parsed from the resulting URL. */
async function createRunAndOpenShop(page: Page) {
  await page.goto(`/pve/class?seed=${SEED}`);
  await page.locator(".class-card", { hasText: "劍士" }).click();
  await page.getByRole("button", { name: "開始挑戰" }).click();
  await expect(page).toHaveURL(/\/pve\/game\/.+/);
  await dismissStrategyCard(page);

  await winDuelViaUi(page); // 打贏第1關對弈（玩家先連五）

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
  // createRunAndOpenShop 需要打贏一整場對弈（~15–20 手真實 UI 操作），預設 30s 太緊。
  test.describe.configure({ timeout: 60_000 });
  test("購買展示位扣除金幣，跳過導向下一關棋盤頁", async ({ page }) => {
    await registerAndLogin(page);
    await createRunAndOpenShop(page);
    await expect(page.getByText(/已通過第 1 關/)).toBeVisible();

    const goldBefore = await page.locator(".coin-display").innerText();

    const firstOffer = page.locator(".shop-card").first();
    const price = await firstOffer.locator(".price").innerText();
    await firstOffer.getByRole("button", { name: "購買" }).click();
    await expect(firstOffer.getByRole("button", { name: "已購買" })).toBeVisible();

    // 金幣顯示應該隨購買扣除（DUEL 通關獎勵 = 10 + (moveBudget − movesUsed)，
    // L1 預算50（§7.6 重校準）、winDuelViaUi 一般 10–20 手內取勝 → 獎勵約 40–50，足夠買一次）
    await expect(page.locator(".coin-display")).not.toHaveText(goldBefore);
    void price;

    await page.getByRole("button", { name: "跳過，前往下一關" }).click();
    await expect(page).toHaveURL(/\/pve\/game\/.+/);
  });

  test("金幣不足時重抽按鈕停用", async ({ page }) => {
    await registerAndLogin(page);
    await createRunAndOpenShop(page);

    // DUEL 通關獎勵 = 10 + 剩餘手數（L1 預算50，一般 40–50 金幣）、重抽花費 5：連續
    // 重抽到金幣 < 5 應該會停用按鈕（上限 12 次足以燒完任何合理獎勵額）。
    const rerollBtn = page.getByRole("button", { name: /重抽/ });
    for (let i = 0; i < 12; i++) {
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

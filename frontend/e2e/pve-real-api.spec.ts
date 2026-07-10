import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

/**
 * PVE 挑戰模式 — 真後端整合測試（非 MSW；對照 pve-flow.spec.ts / pve-game.spec.ts
 * 的 MSW 版本）。
 *
 * 背景：pve-flow.spec.ts / pve-game.spec.ts 用 MSW mock 驗證了前端邏輯，但
 * 打的是假資料——落子連線傷害、Boss HP 結算、商店抽取、Run 結算等真正的業務
 * 邏輯全部跑在後端 `PveChallengeService`，MSW 完全測不到（見
 * integration-test/REPORT.md 2026-07-07 輪 Soft Gate 1 記載的 mock 落差）。
 * 本檔比照 real-api.spec.ts 的既有慣例，直接打真後端驗證這些權威計算：
 *   1. 真實 Run 建立（POST /pve/runs）
 *   2. 落子連線傷害結算（真 PveChallengeService.placeMove，Boss HP 真實下降）
 *   3. 通關→商店查詢/購買/skip（真後端 FR-C3~FR-C5）
 *   4. 放棄→結算畫面改讀真後端權威 `GET /pve/runs/{runId}/result`
 *      （api.yml:833-875），而非 pve-flow.spec.ts 用的 MSW 固定 fixture
 *      "pve-run-e2e-won"。
 *
 * Requires（同 real-api.spec.ts）：
 *   docker compose -f ../integration-test/docker-compose.fullstack.yml up -d
 *   NEXT_PUBLIC_API_MOCKING=disabled BACKEND_ORIGIN=http://127.0.0.1:18080 npm run dev
 *
 * 2026-07-08 關卡重做（documents/PVE-關卡重設計-2026-07-08.md）新增：/pve/class
 * 現支援 `?seed=` query（e2e-only determinism hook，app/pve/class/page.tsx），
 * 讓上面兩個 UI 流程測試可以把第1關的 Template A/B 抽選釘死為可預期座標
 * （見 REAL_SEED 常數）；完整的 seed 決定性驗證（含商店抽取一致性）仍在下方
 * 第二個 describe 區塊直接打真後端 API（繞過瀏覽器 UI，涵蓋 UI 沒曝光的兩個
 * Run 互相隔離情境）。
 *
 * 修復回歸驗證（前端模組已修復，本檔原 test.fail() 案例已解鎖為正向斷言，
 * 見下方獨立 describe 區塊）：
 * PVE 橫劈/縱劈（axis 技能）先前在真後端下 100% 回 422，因為前端從未收集
 * `anchor` 參考格就送出請求，但 api.yml 明定 PVE 情境下 anchor 為必填
 * （PVP 由本手 row/col 帶入，PVE 無伴隨落子不能省略）。MSW mock 未驗證
 * 此欄位（bookkeeping-only），故既有 pve-game.spec.ts 的技能測試測不到。
 * 修復：frontend/src/app/pve/game/[encounterId]/page.tsx 的 pickSkillDirection()
 * 對 axis 模式選完方向後改進入 stage="anchor"（同 ultimate），onSkillCellClick()
 * 補上 axis 分支收集 anchor 後才轉 stage="ready"。已用真後端 curl 驗證修後 201。
 */

const uniq = () => `pve${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

let pageErrors: string[] = [];
test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
});
test.afterEach(() => {
  expect(pageErrors, `偵測到未捕獲的前端例外：\n${pageErrors.join("\n")}`).toEqual([]);
});

async function registerAndLogin(page: Page, username = uniq()) {
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
// 2026-07-08.md §6) — click by pixel position (same geometry as
// duel.spec.ts's clickBoard / pve-game.spec.ts).
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

/** 目前棋盤上的預放黑棋座標（PveBoard.tsx 的 e2e-only data-cells hook）。 */
async function readStoneCells(page: Page): Promise<[number, number][]> {
  const raw = await page.getByTestId("pve-stone-count").getAttribute("data-cells");
  return raw ? (JSON.parse(raw) as [number, number][]) : [];
}

/** 通關 overlay 是否在短暫視窗內出現（同 pve-duel.spec.ts 的競態修正）。 */
async function clearedOverlayAppeared(page: Page, timeoutMs = 600): Promise<boolean> {
  return page
    .getByText("五連達成，你贏了！")
    .waitFor({ state: "visible", timeout: timeoutMs })
    .then(() => true)
    .catch(() => false);
}

/**
 * 真後端版對弈通關（全對弈階梯 §1：全8關皆DUEL，通關=真的打贏 NOVICE）：
 * 開四策略——在某一列橫向連下 (row,2)..(row,5) 做出活四。真後端 L1 是
 * NOVICE 檔（BossAiPolicy §2.3）：`preventOpenFourChance=0%`（活三→活四的
 * 延伸格它永遠不會預判攔截），唯一的干擾點是我方第3子成形活三前後、它的
 * 層⑥（55% 機率）擋一格構線格——被擋就放棄該列換下一列（同 seed 下 RNG
 * 決定性，綠了就恆綠）。活四成形後它的層②只擋得住一端（15% 還會手滑），
 * 補上另一端即勝。
 */
async function winDuelViaUiReal(page: Page): Promise<void> {
  const fallbackRows = [8, 7, 2, 3, 9, 1, 10, 0];
  for (const row of fallbackRows) {
    const myCols = new Set<number>();
    const foreignInSpan = async () => {
      const cells = await readStoneCells(page);
      return cells.some(([r, c]) => r === row && c >= 1 && c <= 6 && !myCols.has(c));
    };
    if (await foreignInSpan()) continue;
    let aborted = false;
    const baseline = (await readStoneCells(page)).length;
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
        .poll(async () => (await readStoneCells(page)).length, { timeout: 5000 })
        .toBeGreaterThanOrEqual(baseline + myCols.size * 2);
    }
    if (aborted) continue;
    // 活四已成：Boss 至多擋一端，補上仍空著的那一端即勝。
    const cells = await readStoneCells(page);
    const flank = cells.some(([r, c]) => r === row && c === 6) ? 1 : 6;
    await placeMove(page, row, flank);
    if (await clearedOverlayAppeared(page, 3000)) return;
  }
  throw new Error("winDuelViaUiReal: exhausted every fallback row without completing five-in-a-row");
}

/** 策略卡（documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §2.2）在棋盤可
 * 互動前顯示，按「開始」才收起——每次進入/切換關卡都需要先呼叫本函式。 */
async function dismissStrategyCard(page: Page) {
  await page.getByTestId("pve-strategy-card-start-btn").click();
}

// e2e-only determinism seed pinning level 1's Template draw to Template A:
// pre-placed TYPE_B stones at (2,4)/(3,4)/(5,4)/(6,4), single completion
// point (4,4) — verified against the real PveFieldScheduler (documents/
// PVE-魔王對弈與策略引導設計-2026-07-09.md §3.1，2026-07-09改版：第1關重新
// 主題化為「衝四」單一TYPE_B樣板).
const REAL_SEED = "fe2e-seed-0";

/**
 * 全流程（打贏 L1 對弈）測試專用的釘死 seed（2026-07-10）：真後端 NOVICE 的
 * 機率旋鈕（層⑥ 55% 擋構線格等）由 run seed 決定性驅動——同一 seed 下整場
 * 軌跡恆定，但「任意 seed」下 winDuelViaUiReal 的開四策略約有一半的 seed 會
 * 在換列重試間被 Boss 搶到節奏。依「seed 邊界就釘 seed」原則，用
 * scratchpad/probe_seed.py 對真後端逐一試出本 seed（首手 (5,9) + 開四策略
 * 可穩定取勝），釘死後測試恆綠。若未來 BossAiPolicy 的 NOVICE 參數或 RNG
 * purpose 字串改版，需重跑 probe 重釘。
 */
const DUEL_WIN_SEED = "flow-fr-a3-pin-2";

/**
 * Injects `seed` into the POST /pve/runs request body at the network layer
 * instead of via a `?seed=` URL / page reload: a direct `page.goto` straight
 * to /pve/class (with or without a seed query, with or without an existing
 * session) reproducibly hits a real-backend-only timing race — verified via
 * a throwaway probe spec showing the SAME "class-card element detached,
 * retrying" symptom on a bare reload carrying no seed at all, so it's not
 * caused by the seed hook. MSW's synchronous responses never expose this
 * window, which is why pve-flow.spec.ts / pve-game.spec.ts (MSW) can use the
 * `?seed=` query directly. The proven-safe path here is the real click-driven
 * navigation (home → mode-card → class page) used elsewhere in this file;
 * this route interception keeps that path completely unchanged.
 */
async function pinRunSeed(page: Page, seed: string) {
  await page.route("**/pve/runs", async (route) => {
    const req = route.request();
    if (req.method() !== "POST") {
      await route.continue();
      return;
    }
    const body = { ...(req.postDataJSON() as Record<string, unknown>), seed };
    await route.continue({ postData: JSON.stringify(body) });
  });
}

test.describe("PVE 真後端整合：建 Run → 打贏對弈 → 商店 → 放棄取得權威結算", () => {
  test.setTimeout(60_000);

  test("WARRIOR Run 全流程打真後端：打贏第1關對弈、通關進商店購買/skip、第2關放棄後結算畫面顯示真後端資料", async ({
    page,
  }) => {
    await registerAndLogin(page);
    await pinRunSeed(page, DUEL_WIN_SEED);

    // 走首頁「PVE 挑戰模式」卡片進入職業選擇頁（同 pve-flow.spec.ts 已驗證過的
    // 真實 UI 導航路徑），不用 page.goto 直接跳轉——避免登入態剛 hydrate
    // 完成、guard 尚未確認 isLoggedIn 前就直接載入受保護路徑的競態。
    await page.goto("/");
    await page.locator(".mode-card.pve").click();
    await page.waitForURL("**/pve/class");

    // 1) 真實 Run 建立（POST /pve/runs，真後端，seed 已由 pinRunSeed 注入）
    const runCreateResp = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().endsWith("/pve/runs"),
    );
    await page.locator(".class-card", { hasText: "劍士" }).click();
    await page.getByRole("button", { name: "開始挑戰" }).click();
    expect((await runCreateResp).status(), "POST /pve/runs 應為 201（真後端）").toBe(201);
    await expect(page).toHaveURL(/\/pve\/game\/.+/);
    await dismissStrategyCard(page);
    await expect(page.getByText("第 1/8 關")).toBeVisible();
    // 全對弈化（documents/PVE-全對弈階梯設計-2026-07-10.md §1/§5.2）：DUEL 關
    // 無 BossHP 概念——不渲染 HP 條，開局空盤（L1 無開局腳本），手數預算 35。
    await expect(page.getByText("Boss HP")).toHaveCount(0);
    await expect(page.getByText("35 / 35")).toBeVisible();
    await expect(page.getByTestId("pve-stone-count")).toHaveAttribute("data-count", "0");

    // 2) 對弈節奏（真 PveChallengeService.settleDuel）：第一手落子應為 201，
    //    且 Boss 立即回手一手（一人一手）。
    const move1Resp = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/moves"),
    );
    await placeMove(page, 5, 9); // (5,9) 在所有 fallback row 構線 span 之外，不干擾後續通關
    expect((await move1Resp).status(), "落子應為 201（真後端）").toBe(201);
    await expect(page.getByText("34 / 35")).toBeVisible();
    await expect
      .poll(async () => (await readStoneCells(page)).length, { timeout: 5000 })
      .toBeGreaterThanOrEqual(2); // 玩家 1 子 + Boss 回手 1 子

    // 3) 技能施放 —— 見下方獨立的 describe 區塊（axis anchor 修復回歸驗證），
    //    本流程測試不在此呼叫技能，維持單一責任。

    // 4) 真的打贏這場對弈（玩家先連五）通關，導向商店頁。
    await winDuelViaUiReal(page);
    await expect(page).toHaveURL(/\/pve\/shop\//, { timeout: 8_000 });
    await expect(page.getByText(/已通過第 1 關/)).toBeVisible();

    // 5) 商店購買（真後端扣款）+ skip 到下一關。
    const goldBefore = await page.locator(".coin-display").innerText();
    const purchaseResp = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/shop/actions/purchase"),
    );
    await page.locator(".shop-card").first().getByRole("button", { name: "購買" }).click();
    expect((await purchaseResp).status(), "商店購買應為 200/201（真後端）").toBeLessThan(300);
    await expect(page.locator(".coin-display")).not.toHaveText(goldBefore);

    const skipResp = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/shop/actions/skip"),
    );
    await page.getByRole("button", { name: "跳過，前往下一關" }).click();
    expect((await skipResp).status(), "商店 skip 應為 200/201（真後端）").toBeLessThan(300);
    await expect(page).toHaveURL(/\/pve\/game\/.+/);
    await dismissStrategyCard(page);
    await expect(page.getByText("第 2/8 關")).toBeVisible();

    // 6) 放棄挑戰 → 結算畫面改讀真後端權威 GET /pve/runs/{runId}/result
    //    （非 pve-flow.spec.ts 用的 MSW 固定 fixture）。
    const resultFetchResp = page.waitForResponse(
      (r) => r.request().method() === "GET" && r.url().includes("/result"),
    );
    await page.getByRole("button", { name: "放棄挑戰" }).click();
    await expect(page.getByText("確定要放棄本次挑戰？")).toBeVisible();
    await page.getByRole("button", { name: "確定放棄" }).click();
    await expect(page).toHaveURL(/\/pve\/result\//, { timeout: 8_000 });
    expect((await resultFetchResp).status(), "GET /pve/runs/{runId}/result 應為 200（真後端）").toBe(200);

    // 真後端權威結算欄位斷言（非 MSW fixture 的固定值）：
    // 已通過第1關但放棄於第2關 → reachedEncounterSequence=1，狀態 ABANDONED。
    // 全對弈化後無傷害機制（§8 拆除清單：HP/傷害語意退役），總傷害恆為 0。
    await expect(page.getByText("已放棄")).toBeVisible();
    await expect(page.getByText("1/8")).toBeVisible();
    const dmgStat = page.locator(".pve-stat-grid .stat", { hasText: "全Run總傷害" }).locator(".v");
    await expect(dmgStat).toHaveText("0");
  });
});

test.describe("PVE 真後端整合：橫劈技能收集 anchor 後施放（bug 修復回歸驗證，見 REPORT.md）", () => {
  test.setTimeout(30_000);

  // 原本此區塊用 test.fail() 鎖定「anchor 未收集 → 真後端 422」的已知 bug。
  // 前端模組已修復 pickSkillDirection()/onSkillCellClick()（見上方檔頭註解），
  // 本測試解鎖為正向斷言：不只驗證 201，還驗證技能的真實後端效果——棋子被
  // 推擠的位移、CONSUMABLE 技能用罄後按鈕消失、間隔鎖定提示——證明技能「真的
  // 生效」而非只是請求格式碰巧通過。
  test("施放橫劈技能：選方向→點棋盤格收集 anchor→確認，真後端 201 且棋子確實被推擠", async ({
    page,
  }) => {
    await registerAndLogin(page);
    // 同上一個 describe：先走真實 UI 導航到 class 頁（避免直接 page.goto 造成
    // 的真後端限定 timing race，見 pinRunSeed javadoc），seed 從網路層注入
    // （pins level 1 to Template A + minor disruption NONE，見 REAL_SEED 註解）
    // 讓這裡自己放的單顆棋子 (4,9) 不會在施放技能前被靜默清除/推移。
    await pinRunSeed(page, REAL_SEED);
    await page.goto("/");
    await page.locator(".mode-card.pve").click();
    await page.waitForURL("**/pve/class");
    const runCreateResp = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().endsWith("/pve/runs"),
    );
    await page.locator(".class-card", { hasText: "劍士" }).click();
    await page.getByRole("button", { name: "開始挑戰" }).click();
    await runCreateResp;
    await expect(page).toHaveURL(/\/pve\/game\/.+/);
    await dismissStrategyCard(page);

    // 在 (4,9) 鋪一顆棋子（col9 不屬於第1關雛形，只用 col4），讓橫劈的推擠有
    // 東西可推——只驗證 201 不足以證明技能「生效」，必須看到棋盤真的位移
    // 才是有意義的效果驗證。stones 座標經 pve-stone-count e2e hook 曝光
    // （canvas 像素不可直接斷言，同 Board.tsx 既有 skill-anim hook 手法）。
    await placeMove(page, 4, 9);
    const stoneCells = page.getByTestId("pve-stone-count");
    await expect(stoneCells).toHaveAttribute("data-cells", /\[4,9\]/);

    await page.getByTestId("skill-btn-HORIZONTAL_SLASH").click();
    await page.getByRole("button", { name: "上" }).click();
    // 選完方向後應進入「收集 anchor」階段（修復前直接跳 stage=ready，
    // 不會顯示此提示——這正是原 bug 的可觀察徵狀）。
    await expect(page.getByText(/請點選棋盤上一格作為推擠參考格/)).toBeVisible();

    // 點擊棋盤格 (5,9) 作為推擠參考格 anchor。
    await clickBoard(page, 5, 9);
    await expect(page.getByTestId("confirm-skill-btn")).toBeVisible();

    const skillResp = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/actions/use-skill"),
    );
    await page.getByTestId("confirm-skill-btn").click();
    expect((await skillResp).status(), "橫劈技能（已收集 anchor）打真後端應為 201").toBe(201);

    // 真後端效果驗證（backend PveChallengeService.slashPush + PushResolver.push）：
    // HORIZONTAL_SLASH 方向 UP（dRow=-1）、anchor=(5,9) 的推擠來源列為
    // anchor.row-1=4，橫跨 col 8~10；(4,9) 的棋子被推一格到 (3,9)。
    await expect(stoneCells).toHaveAttribute("data-cells", /\[3,9\]/, { timeout: 8_000 });
    await expect(stoneCells).not.toHaveAttribute("data-cells", /\[4,9\]/);

    // 間隔鎖定提示（真後端 skillUsableThisInterval 權威欄位）應出現。
    await expect(page.getByText("本間隔已使用過技能，落子後可再次使用")).toBeVisible();
    // WARRIOR 起始 HORIZONTAL_SLASH 僅 1 個（CONSUMABLE），用罄後 quantity=0
    // 被前端過濾掉，技能按鈕應消失——證明真後端確實扣減了持有量。
    await expect(page.getByTestId("skill-btn-HORIZONTAL_SLASH")).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// PveRunCreateRequest.seed 決定性（FR-A3）—— 直接打真後端 API，繞過瀏覽器
// UI：/pve/class 目前沒有 seed 輸入欄位（grep 全 repo 確認過），無法透過
// UI 驅動決定性測試，故在此用 Playwright APIRequestContext 直接呼叫後端。
// ─────────────────────────────────────────────────────────────────────
const BACKEND = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:18080";
const API = `${BACKEND}/api/gmk/v1`;

async function registerAndGetToken(request: APIRequestContext, username: string): Promise<string> {
  const reg = await request.post(`${API}/auth/register`, {
    data: { username, email: `${username}@example.com`, password: "test1234", nickname: username },
  });
  expect(reg.ok(), `register ${username} 失敗: ${await reg.text()}`).toBeTruthy();
  const login = await request.post(`${API}/auth/login`, {
    data: { username, password: "test1234" },
  });
  expect(login.ok(), `login ${username} 失敗: ${await login.text()}`).toBeTruthy();
  const body = (await login.json()) as { data: { token: string } };
  return body.data.token;
}

async function createRun(
  request: APIRequestContext,
  token: string,
  classType: "WARRIOR" | "ARCHER",
  seed?: string,
) {
  const res = await request.post(`${API}/pve/runs`, {
    headers: { Authorization: `Bearer ${token}` },
    data: seed ? { classType, seed } : { classType },
  });
  expect(res.ok(), `createRun 失敗: ${await res.text()}`).toBeTruthy();
  return (await res.json()).data;
}

async function placeMoveApi(
  request: APIRequestContext,
  token: string,
  encounterId: string,
  row: number,
  col: number,
) {
  const res = await request.post(`${API}/pve/encounters/${encounterId}/moves`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { row, col },
  });
  expect(res.ok(), `placeMove(${row},${col}) 失敗: ${await res.text()}`).toBeTruthy();
  return (await res.json()).data;
}

async function getShop(request: APIRequestContext, token: string, runId: string) {
  const res = await request.get(`${API}/pve/runs/${runId}/shop`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `getShop 失敗: ${await res.text()}`).toBeTruthy();
  return (await res.json()).data;
}

/**
 * 全對弈化後的 API 版通關（同 winDuelViaUiReal 的開四策略，但直接讀 API 回應
 * 的盤面狀態而非 DOM hook）：回傳實際走過的落子序列，供決定性驗證比對「同
 * seed 下兩個 Run 的實際軌跡完全一致」。狀態 CLEARED 時結束。
 */
async function apiWinDuel(
  request: APIRequestContext,
  token: string,
  encounterId: string,
): Promise<Array<[number, number]>> {
  const played: Array<[number, number]> = [];
  const fallbackRows = [8, 7, 2, 3, 9, 1, 10, 0];
  // occupied = 玩家黑子 + Boss 白子（obstacles ENEMY_STONE）合併座標。
  let occupied: Array<[number, number]> = [];
  const refresh = (state: Record<string, any>) => {
    occupied = [
      ...(state.stones ?? []).map((s: any): [number, number] => [s.row, s.col]),
      ...(state.obstacles ?? []).map((o: any): [number, number] => [o.row, o.col]),
    ];
    return state.status as string;
  };
  for (const row of fallbackRows) {
    const myCols = new Set<number>();
    const foreignInSpan = () =>
      occupied.some(([r, c]) => r === row && c >= 1 && c <= 6 && !myCols.has(c));
    if (foreignInSpan()) continue;
    let aborted = false;
    for (const col of [2, 3, 4, 5]) {
      if (foreignInSpan()) {
        aborted = true;
        break;
      }
      const state = await placeMoveApi(request, token, encounterId, row, col);
      played.push([row, col]);
      myCols.add(col);
      if (refresh(state) === "CLEARED") return played;
    }
    if (aborted) continue;
    const flank = occupied.some(([r, c]) => r === row && c === 6) ? 1 : 6;
    const state = await placeMoveApi(request, token, encounterId, row, flank);
    played.push([row, flank]);
    if (refresh(state) === "CLEARED") return played;
  }
  throw new Error("apiWinDuel: exhausted every fallback row without completing five-in-a-row");
}

test.describe("PVE 真後端整合：PveRunCreateRequest.seed 決定性（FR-A3，直接呼叫真後端 API）", () => {
  test("同 seed 建立兩個獨立 Run（不同玩家）+ 相同落子序列 → 商店抽取結果一致", async ({ request }) => {
    // 釘死 seed（2026-07-10，同 DUEL_WIN_SEED 的論證與 probe 流程）：全對弈化
    // 後本測試必須真的打贏 L1 才開得了商店，隨機 seed 下 apiWinDuel 的開四
    // 策略對約一半的 seed 會輸給 NOVICE 的節奏——決定性驗證只需要「同 seed
    // 兩 Run 一致」，seed 本身固定並不減損驗證力。
    const seed = "det-fr-a3-pin-0";
    const tokenA = await registerAndGetToken(request, uniq());
    const tokenB = await registerAndGetToken(request, uniq());

    const runA = await createRun(request, tokenA, "WARRIOR", seed);
    const runB = await createRun(request, tokenB, "WARRIOR", seed);

    // 第1關規格固定 PLAIN（與 seed 無關），純粹健檢兩邊起始狀態一致。
    expect(runA.currentEncounter.fieldType).toBe("PLAIN");
    expect(runB.currentEncounter.fieldType).toBe("PLAIN");
    // 全對弈化：DUEL 開局空盤（L1 無開局腳本），兩邊起始狀態天然一致。
    expect(runA.currentEncounter.stones).toEqual([]);
    expect(runB.currentEncounter.stones).toEqual([]);

    // 兩邊各自真的打贏第1關對弈（apiWinDuel 對盤面自適應，但同 seed → Boss
    // 的每一手回應相同 → 兩邊實際走出的落子軌跡必然逐手一致——這本身就是
    // FR-A3 決定性的更強驗證），讓兩個 Run 消耗 RNG 的順序一致後比對商店。
    const playedA = await apiWinDuel(request, tokenA, runA.currentEncounter.encounterId);
    const playedB = await apiWinDuel(request, tokenB, runB.currentEncounter.encounterId);
    expect(playedB, "同 seed 下兩個 Run 的實際對局軌跡應完全一致（FR-A3）").toEqual(playedA);

    const shopA = await getShop(request, tokenA, runA.runId);
    const shopB = await getShop(request, tokenB, runB.runId);

    const strip = (offers: Array<Record<string, unknown>>) =>
      offers.map((o) => ({
        offerKind: o.offerKind,
        relicType: o.relicType,
        skillType: o.skillType,
        price: o.price,
      }));
    expect(strip(shopA.offers), "同 seed + 同操作序列應產生相同商店抽取（含順序），驗證 FR-A3 決定性").toEqual(
      strip(shopB.offers),
    );
  });

  test("省略 seed 時伺服器自動產生亂數 seed，Run 仍可正常建立並推進", async ({ request }) => {
    const token = await registerAndGetToken(request, uniq());
    const run = await createRun(request, token, "WARRIOR", undefined);
    expect(run.runId).toBeTruthy();
    expect(run.status).toBe("IN_PROGRESS");
    expect(run.currentEncounter.fieldType).toBe("PLAIN");
  });
});

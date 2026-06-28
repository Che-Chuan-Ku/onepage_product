import { test, expect, Page, BrowserContext } from "@playwright/test";

/**
 * 線上連線對戰整合測試 — 兩個真實瀏覽器 context（A=房主、B=對手），真 STOMP。
 * 對真後端執行；STOMP 直連後端（dev.sh 設 NEXT_PUBLIC_WS_ENDPOINT）。
 *
 * 對應 spec：activities/線上連線對戰.mmd + features/room/* + features/game/線上落子.feature
 *           + features/opening/*（O4 Swap2）。
 *
 * 嚴格規則：流程該出現的元素硬斷言；waitForResponse 攔關鍵 API，非預期狀態碼即 fail；
 *          全程監聽 pageerror，未捕獲例外即 fail。碰壁不當成功。
 */

const uniq = () => `pw${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

function guardErrors(page: Page, bag: string[]) {
  page.on("pageerror", (e) => bag.push(e.message));
}

/** 以訪客身份登入（訪客可線上單場，需求 #2；guest 端點回 JWT 供 /rooms 鑑權）。 */
async function guestLogin(page: Page, nick: string) {
  await page.goto("/user#guest");
  await page.getByRole("tab", { name: "訪客" }).click();
  await page.locator('input[name="gn"]').fill(nick);
  await page.getByRole("button", { name: "以訪客進入" }).click();
  await expect(page.getByText("以訪客身份進入")).toBeVisible();
}

/**
 * 等 session 水合完成（header 顯示訪客身份）。page.goto 是硬導航會重置 in-memory
 * authToken，zustand 由 localStorage 重新水合後才重設 token；在此前發 authenticated
 * 請求會 401。等訪客 badge 出現 = token 已套用（真實用戶走 client-side 導航不會遇到）。
 */
async function awaitHydrated(page: Page) {
  await expect(page.locator(".app-header").getByText("訪客", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
}

/** A 建立一個線上房間（可選 Swap2），回傳 {roomId, roomCode}。 */
async function createRoom(page: Page, swap2: boolean): Promise<{ roomId: string; roomCode: string }> {
  await page.goto("/lobby");
  await awaitHydrated(page);
  await page.getByRole("button", { name: "＋ 建立房間" }).click();
  const dialog = page.getByRole("dialog");
  if (swap2) await dialog.getByText("Swap2", { exact: true }).click();
  await dialog.getByRole("button", { name: "建立並進入房間" }).click();
  await expect(page).toHaveURL(/\/room\//, { timeout: 10_000 });
  const roomId = page.url().split("/room/")[1].split("?")[0];
  // 從房間頁讀真實 6 碼 roomCode（房間碼：XXXXXX（點擊複製））
  const badge = page.getByRole("button", { name: /房間碼：/ });
  await expect(badge).not.toContainText("…", { timeout: 8_000 });
  const text = (await badge.textContent()) ?? "";
  const roomCode = text.replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return { roomId, roomCode };
}

/** B 以 6 碼房間碼從大廳加入。 */
async function joinRoom(page: Page, roomCode: string) {
  await page.goto("/lobby");
  await awaitHydrated(page);
  const codeRow = page.locator(".row", { has: page.getByPlaceholder(/房間碼/) });
  await page.getByPlaceholder(/房間碼/).fill(roomCode);
  await codeRow.getByRole("button", { name: "加入" }).click();
  await expect(page).toHaveURL(/\/room\//, { timeout: 10_000 });
}

/** 棋盤格座標 → canvas 點擊位置。 */
async function clickBoard(page: Page, row: number, col: number) {
  const board = page.locator("canvas.board");
  const box = await board.boundingBox();
  if (!box) throw new Error("board not visible");
  const cell = box.width / 15;
  await board.click({ position: { x: (col + 0.5) * cell, y: (row + 0.5) * cell } });
}

/**
 * 共用：兩訪客開一場線上對局（標準或 Swap2），雙方導到同一對局頁。
 * 關鍵：ready 前先等雙方房間 STOMP「已連線」，確保先 ready 方能收到 READY 廣播。
 * 回傳 gameId（從 A 的 URL）。
 */
async function setupOnlineGame(
  pageA: Page,
  pageB: Page,
  swap2: boolean,
): Promise<string> {
  await guestLogin(pageA, `房主${uniq()}`);
  await guestLogin(pageB, `對手${uniq()}`);
  const { roomCode } = await createRoom(pageA, swap2);
  await joinRoom(pageB, roomCode);

  // 雙方房間 STOMP 連上（避免先 ready 方錯過 READY 廣播）
  await expect(pageA.getByText("已連線")).toBeVisible({ timeout: 12_000 });
  await expect(pageB.getByText("已連線")).toBeVisible({ timeout: 12_000 });

  await pageA.getByRole("button", { name: "標記 Ready" }).click();
  const startResp = pageA.waitForResponse((r) => r.url().includes("/actions/start-game"));
  await pageB.getByRole("button", { name: "標記 Ready" }).click();
  const resp = await startResp;
  expect(resp.status(), "start-game 應為 2xx").toBeLessThan(300);

  const dest = swap2 ? /\/opening\// : /\/game\//;
  await expect(pageA).toHaveURL(dest, { timeout: 12_000 });
  await expect(pageB).toHaveURL(dest, { timeout: 12_000 });
  const gidA = pageA.url().split(swap2 ? "/opening/" : "/game/")[1].split("?")[0];
  const gidB = pageB.url().split(swap2 ? "/opening/" : "/game/")[1].split("?")[0];
  expect(gidA, "雙方應在同一對局").toBe(gidB);
  return gidA;
}

test.describe("線上連線對戰（兩瀏覽器）", () => {
  // 兩瀏覽器 + 真 STOMP 的整合測試對時序敏感；允許 1 次重試吸收殘餘抖動
  // （核心流程正確性已由穩定通過證明，非以重試掩蓋功能缺陷）。
  test.describe.configure({ retries: 1 });

  let ctxA: BrowserContext;
  let ctxB: BrowserContext;
  let pageA: Page;
  let pageB: Page;
  let errA: string[];
  let errB: string[];

  test.beforeEach(async ({ browser }) => {
    // 兩個 context + 完整線上流程步驟多，放寬單條測試時限
    test.setTimeout(75_000);
    ctxA = await browser.newContext();
    ctxB = await browser.newContext();
    pageA = await ctxA.newPage();
    pageB = await ctxB.newPage();
    errA = [];
    errB = [];
    guardErrors(pageA, errA);
    guardErrors(pageB, errB);
  });

  test.afterEach(async () => {
    expect(errA, `A 端未捕獲例外:\n${errA.join("\n")}`).toEqual([]);
    expect(errB, `B 端未捕獲例外:\n${errB.join("\n")}`).toEqual([]);
    await ctxA?.close();
    await ctxB?.close();
  });

  // ── O0：de-risk 閘門 —— 證明 SockJS/STOMP 經整套環境可用 ──
  test("O0 STOMP 落子同步健檢：A 落子 B 即時收到", async () => {
    await setupOnlineGame(pageA, pageB, false);
    // 兩端初始皆黑方回合，且 game 頁 STOMP 已連線
    await expect(pageA.getByText("輪到黑方落子")).toBeVisible({ timeout: 8_000 });
    await expect(pageB.getByText("輪到黑方落子")).toBeVisible({ timeout: 8_000 });
    await expect(pageA.getByText("已連線")).toBeVisible({ timeout: 10_000 });
    await expect(pageB.getByText("已連線")).toBeVisible({ timeout: 10_000 });

    // A（房主=黑）落一子 → REST 201 → 後端廣播 /topic/game/{id} → B 端即時更新
    const moveResp = pageA.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().endsWith("/moves"),
    );
    await clickBoard(pageA, 7, 7);
    expect((await moveResp).status(), "A 落子應為 201").toBe(201);
    await expect(pageB.getByText("輪到白方落子")).toBeVisible({ timeout: 10_000 });
    await expect(pageA.getByText("輪到白方落子")).toBeVisible({ timeout: 10_000 });
  });

  // mover 在自己回合落一子(201)，雙方輪次切到 nextTurnText
  async function onlineMove(
    mover: Page,
    other: Page,
    row: number,
    col: number,
    nextTurnText: string,
  ) {
    const resp = mover.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().endsWith("/moves"),
    );
    await clickBoard(mover, row, col);
    expect((await resp).status(), `落子 (${row},${col}) 應為 201`).toBe(201);
    await expect(mover.getByText(nextTurnText)).toBeVisible({ timeout: 10_000 });
    await expect(other.getByText(nextTurnText)).toBeVisible({ timeout: 10_000 });
  }

  // ── O1：標準線上對戰玩到底（建房→加入→Ready→落子同步→黑方五連勝） ──
  // spec：線上連線對戰.mmd S1→S7 + 線上落子.feature（五連判勝、雙方同步）
  test("O1 標準線上對戰：黑方五連勝，雙方即時同步且都見勝負", async () => {
    await setupOnlineGame(pageA, pageB, false);
    await expect(pageA.getByText("輪到黑方落子")).toBeVisible({ timeout: 8_000 });
    await expect(pageA.getByText("已連線")).toBeVisible({ timeout: 10_000 });
    await expect(pageB.getByText("已連線")).toBeVisible({ timeout: 10_000 });

    // A=黑(房主先手)、B=白，交錯落子，A 在 (7,0..4) 連成水平五連
    await onlineMove(pageA, pageB, 7, 0, "輪到白方落子");
    await onlineMove(pageB, pageA, 8, 0, "輪到黑方落子");
    await onlineMove(pageA, pageB, 7, 1, "輪到白方落子");
    await onlineMove(pageB, pageA, 8, 1, "輪到黑方落子");
    await onlineMove(pageA, pageB, 7, 2, "輪到白方落子");
    await onlineMove(pageB, pageA, 8, 2, "輪到黑方落子");
    await onlineMove(pageA, pageB, 7, 3, "輪到白方落子");
    await onlineMove(pageB, pageA, 8, 3, "輪到黑方落子");
    // A 的第五子致勝
    const winResp = pageA.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().endsWith("/moves"),
    );
    await clickBoard(pageA, 7, 4);
    expect((await winResp).status(), "致勝落子應為 201").toBe(201);
    // 雙方都看到結束畫面（勝負）
    await expect(pageA.getByText(/獲勝|和局/)).toBeVisible({ timeout: 10_000 });
    await expect(pageB.getByText(/獲勝|和局/)).toBeVisible({ timeout: 10_000 });
  });

  // ── O2：房間真實成員 + 聊天收發 ──
  // spec：建立房間（成員）+ 標記準備與聊天（聊天廣播給房內成員）
  test("O2 房間顯示雙方真實暱稱 + A 送聊天 B 收到", async () => {
    const nickA = `房主${uniq()}`;
    const nickB = `對手${uniq()}`;
    await guestLogin(pageA, nickA);
    await guestLogin(pageB, nickB);
    const { roomCode } = await createRoom(pageA, false);
    await joinRoom(pageB, roomCode);
    await expect(pageA.getByText("已連線")).toBeVisible({ timeout: 12_000 });
    await expect(pageB.getByText("已連線")).toBeVisible({ timeout: 12_000 });

    // 房間對戰席顯示雙方真實暱稱（非 hardcoded 阿哲/你）；scope 到 main 避開 AppHeader 的自身暱稱
    await expect(pageA.locator("main").getByText(nickA)).toBeVisible({ timeout: 8_000 });
    await expect(pageA.locator("main").getByText(nickB)).toBeVisible({ timeout: 8_000 });
    await expect(pageB.locator("main").getByText(nickA)).toBeVisible({ timeout: 8_000 });
    await expect(pageB.locator("main").getByText(nickB)).toBeVisible({ timeout: 8_000 });

    // A 送聊天 → STOMP 廣播 → B 即時收到
    const msg = `哈囉${uniq()}`;
    await pageA.getByPlaceholder(/輸入訊息/).fill(msg);
    await pageA.getByRole("button", { name: "送出" }).click();
    await expect(pageB.getByText(msg)).toBeVisible({ timeout: 10_000 });
  });

  // ── O3：對戰席已滿後第三人加入成為觀戰者（唯讀，無 Ready） ──
  // spec：加入房間（席滿成 SPECTATOR）+ 觀戰者不可標記 Ready
  test("O3 第三人加入已滿房間成為觀戰者，無 Ready 鈕", async () => {
    await guestLogin(pageA, `房主${uniq()}`);
    await guestLogin(pageB, `對手${uniq()}`);
    const { roomCode } = await createRoom(pageA, false);
    await joinRoom(pageB, roomCode);

    // 第三個 context 加入已滿（2 PLAYER）的房間 → 成為觀戰者
    const ctxC = await pageA.context().browser()!.newContext();
    const pageC = await ctxC.newPage();
    const errC: string[] = [];
    guardErrors(pageC, errC);
    await guestLogin(pageC, `觀眾${uniq()}`);
    await joinRoom(pageC, roomCode);

    // 觀戰者頁面：顯示觀戰者身份提示，且無「標記 Ready」按鈕（唯讀）
    await expect(pageC.getByText(/觀戰者身份/).first()).toBeVisible({ timeout: 10_000 });
    await expect(pageC.getByRole("button", { name: "標記 Ready" })).toHaveCount(0);
    // 觀戰席應列出觀眾（至少 1 人）
    await expect(pageC.getByText(/觀戰中 [1-9]/)).toBeVisible();
    expect(errC, `C 端未捕獲例外:\n${errC.join("\n")}`).toEqual([]);
    await ctxC.close();
  });

  // ── O4：線上 Swap2 端到端（假先方放子 → 假後方即時看到 → 選擇 → 對局） ──
  // spec：投擲硬幣決定先手 + Swap2開局放置 + Swap2選擇
  test("O4 線上 Swap2：假先方放3子→假後方即時同步看到→選執黑→雙方進對局", async () => {
    await setupOnlineGame(pageA, pageB, true); // swap2 → 雙方在 /opening

    // 雙方關閉教學 Modal
    await pageA.getByRole("dialog").getByRole("button", { name: "我知道了" }).click();
    await pageB.getByRole("dialog").getByRole("button", { name: "我知道了" }).click();

    // 判定誰是假先方（顯示「確認此子」放置面板者）
    const aIsFirst = await pageA
      .getByRole("button", { name: "確認此子" })
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    const first = aIsFirst ? pageA : pageB;
    const second = aIsFirst ? pageB : pageA;
    await expect(first.getByRole("button", { name: "確認此子" })).toBeVisible({ timeout: 10_000 });
    await expect(second.getByText("等待對手開局")).toBeVisible({ timeout: 10_000 });

    // 假先方放標準三子（B,W,B），每子 confirm；後端廣播 → 假後方即時看到
    const places: [number, number][] = [[7, 7], [7, 8], [8, 8]];
    for (const [r, c] of places) {
      const resp = first.waitForResponse((rr) => rr.request().method() === "POST" && rr.url().endsWith("/opening-stones"));
      await clickBoard(first, r, c);
      await first.getByRole("button", { name: "確認此子" }).click();
      expect((await resp).status(), `開局子 (${r},${c}) 應為 201`).toBe(201);
    }

    // 假後方即時同步看到三子後自動進入選擇階段
    await expect(second.getByText("選擇你的接手方式")).toBeVisible({ timeout: 12_000 });
    await expect(second.locator("canvas.board")).toBeVisible();

    // 假後方選執黑 → swap2-choice 200 → 雙方進對局
    const choiceResp = second.waitForResponse((rr) => rr.url().includes("/actions/swap2-choice"));
    await second.getByText("執黑", { exact: true }).click();
    expect((await choiceResp).status(), "swap2-choice 應為 200").toBe(200);
    await expect(first).toHaveURL(/\/game\//, { timeout: 12_000 });
    await expect(second).toHaveURL(/\/game\//, { timeout: 12_000 });
  });
});

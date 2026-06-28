import { test, expect, Page } from "@playwright/test";

/**
 * 全覆蓋整合測試 — 實際驅動真 Chromium，逐頁逐鈕逐流程。
 * 對真後端執行（NEXT_PUBLIC_API_MOCKING=disabled, BACKEND_ORIGIN=:18080）。
 *
 * 這份腳本即為「錄製下來的測試動作」：下次整合測試直接重播，
 * 不必再人工點一遍。每個 describe = 一個頁面；每個 test = 一條按鈕/流程路徑。
 *
 * 跑法（真 Chrome 可見視窗）：
 *   NEXT_PUBLIC_API_MOCKING=disabled BACKEND_ORIGIN=http://127.0.0.1:18080 \
 *     npx playwright test e2e/full-coverage.spec.ts --headed
 */

const uniq = () => `pw${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

// ── 全域 runtime-error 護欄 ──────────────────────────────────
// 任何未捕獲的瀏覽器例外（如 GomokuBoard 讀 undefined.r）都必須讓測試失敗，
// 否則「過」是假的 —— 這正是上一版漏掉 Swap2 崩潰的原因。
let pageErrors: string[] = [];
test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
});
test.afterEach(() => {
  expect(pageErrors, `偵測到未捕獲的前端例外：\n${pageErrors.join("\n")}`).toEqual([]);
});

/** 以訪客身份登入（多數線上頁面前置）。 */
async function guestLogin(page: Page, nick = `訪客${uniq()}`) {
  await page.goto("/user#guest");
  await page.getByRole("tab", { name: "訪客" }).click();
  await page.locator('input[name="gn"]').fill(nick);
  await page.getByRole("button", { name: "以訪客進入" }).click();
  await expect(page.getByText("以訪客身份進入")).toBeVisible();
  return nick;
}

/** 棋盤格座標 → canvas 點擊位置（(r,c) → 中心）。 */
async function clickBoard(page: Page, row: number, col: number) {
  const board = page.locator("canvas.board");
  const box = await board.boundingBox();
  if (!box) throw new Error("board canvas not visible");
  const cell = box.width / 15;
  await board.click({ position: { x: (col + 0.5) * cell, y: (row + 0.5) * cell } });
}

// ════════════════════════════════════════════════════════════
//  模式選擇首頁  /
// ════════════════════════════════════════════════════════════
test.describe("首頁 / 模式選擇", () => {
  test("渲染標題與兩張模式卡", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "選擇你的對戰方式" })).toBeVisible();
    await expect(page.getByRole("button", { name: /本地雙人/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /線上連線/ })).toBeVisible();
  });

  test("Swap2 開局 checkbox 可勾選", async ({ page }) => {
    await page.goto("/");
    const cb = page.getByRole("checkbox");
    await expect(cb).not.toBeChecked();
    await cb.check();
    await expect(cb).toBeChecked();
  });

  test("線上連線（未登入）→ 身份 Modal → 取消關閉", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /線上連線/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("線上對戰需要身份")).toBeVisible();
    await expect(dialog.getByRole("link", { name: "登入 / 註冊" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "以訪客遊玩" })).toBeVisible();
    await dialog.getByRole("button", { name: "取消" }).click();
    await expect(page.getByText("線上對戰需要身份")).toBeHidden();
  });

  test("本地雙人（無 Swap2）→ 進入對局頁", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /本地雙人/ }).click();
    await expect(page).toHaveURL(/\/game\//);
    await expect(page.locator("canvas.board")).toBeVisible();
  });

  test("本地雙人（勾 Swap2）→ 進入開局頁", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /本地雙人/ }).click();
    await expect(page).toHaveURL(/\/opening\//);
  });
});

// ════════════════════════════════════════════════════════════
//  登入 / 註冊 / 訪客  /user
// ════════════════════════════════════════════════════════════
test.describe("使用者頁 /user", () => {
  test("三個分頁可切換", async ({ page }) => {
    await page.goto("/user");
    await page.getByRole("tab", { name: "登入" }).click();
    await expect(page.locator('input[name="lu"]')).toBeVisible();
    await page.getByRole("tab", { name: "註冊" }).click();
    await expect(page.locator('input[name="ru"]')).toBeVisible();
    await page.getByRole("tab", { name: "訪客" }).click();
    await expect(page.locator('input[name="gn"]')).toBeVisible();
  });

  test("註冊新帳號（真後端）→ 自動登入", async ({ page }) => {
    const name = uniq();
    await page.goto("/user");
    await page.getByRole("tab", { name: "註冊" }).click();
    await page.locator('input[name="ru"]').fill(name);
    await page.locator('input[name="re"]').fill(`${name}@example.com`);
    await page.locator('input[name="rp"]').fill("passw0rd1");
    await page.getByRole("button", { name: "建立帳號" }).click();
    await expect(page.getByText("註冊成功，已自動登入")).toBeVisible();
  });

  test("登入（先註冊→清 session→登入）", async ({ page }) => {
    const name = uniq();
    await page.goto("/user");
    await page.getByRole("tab", { name: "註冊" }).click();
    await page.locator('input[name="ru"]').fill(name);
    await page.locator('input[name="re"]').fill(`${name}@example.com`);
    await page.locator('input[name="rp"]').fill("passw0rd1");
    await page.getByRole("button", { name: "建立帳號" }).click();
    await expect(page.getByText("註冊成功，已自動登入")).toBeVisible();

    await page.evaluate(() => localStorage.clear());
    await page.goto("/user");
    await page.getByRole("tab", { name: "登入" }).click();
    await page.locator('input[name="lu"]').fill(name);
    await page.locator('input[name="lp"]').fill("passw0rd1");
    await page.getByRole("button", { name: "登入" }).click();
    await expect(page.getByText(`歡迎回來，${name}！`)).toBeVisible();
  });

  test("登入失敗（帳號不存在 → 錯誤 toast）", async ({ page }) => {
    await page.goto("/user");
    await page.getByRole("tab", { name: "登入" }).click();
    await page.locator('input[name="lu"]').fill(`ghost${uniq()}`);
    await page.locator('input[name="lp"]').fill("wrongpass1");
    await page.getByRole("button", { name: "登入" }).click();
    await expect(page.getByText("帳號或密碼錯誤")).toBeVisible();
  });

  test("訪客進入（空暱稱被擋）", async ({ page }) => {
    await page.goto("/user#guest");
    await page.getByRole("tab", { name: "訪客" }).click();
    await page.getByRole("button", { name: "以訪客進入" }).click();
    await expect(page.getByText("請先輸入暱稱")).toBeVisible();
  });

  test("訪客進入（真後端）成功", async ({ page }) => {
    await guestLogin(page);
  });

  test("回首頁連結", async ({ page }) => {
    await page.goto("/user");
    await page.getByRole("link", { name: /回首頁/ }).click();
    await expect(page).toHaveURL(/\/$|\/$/);
  });
});

// ════════════════════════════════════════════════════════════
//  大廳  /lobby
// ════════════════════════════════════════════════════════════
test.describe("大廳 /lobby", () => {
  test("刷新房間列表", async ({ page }) => {
    await guestLogin(page);
    await page.goto("/lobby");
    await page.getByRole("button", { name: /重新整理|刷新/ }).first().click();
    await expect(page.getByText("房間列表已更新")).toBeVisible();
  });

  test("建立房間 Modal（可見性/模式分頁）→ 建立並進入 → 房間頁", async ({ page }) => {
    await guestLogin(page);
    await page.goto("/lobby");
    await page.getByRole("button", { name: "＋ 建立房間" }).click();
    // 可見性 + 模式分頁切換（限定在 Modal 內，避免撞到 main 的 badge）
    const dialog = page.getByRole("dialog");
    await dialog.getByText("私人", { exact: true }).click();
    await dialog.getByText("Swap2", { exact: true }).click();
    await dialog.getByText("普通", { exact: true }).click();
    await dialog.getByRole("button", { name: "建立並進入房間" }).click();
    await expect(page).toHaveURL(/\/room\//, { timeout: 10_000 });
  });

  test("以房間碼加入（不存在碼 → 錯誤）", async ({ page }) => {
    await guestLogin(page);
    await page.goto("/lobby");
    // 限定在房間碼輸入框所在的 .row，避免撞到房間列表的「加入」按鈕
    const codeRow = page.locator(".row", { has: page.getByPlaceholder(/房間碼/) });
    await page.getByPlaceholder(/房間碼/).fill("ZZZZ9");
    await codeRow.getByRole("button", { name: "加入" }).click();
    // 後端回錯 → toast（任一錯誤訊息即可）
    await expect(page.locator(".toast-host .toast")).toBeVisible({ timeout: 8_000 });
  });

  test("快速配對 → 配對中 Modal → 取消", async ({ page }) => {
    await guestLogin(page);
    await page.goto("/lobby");
    await page.getByRole("button", { name: /快速配對/ }).click();
    // 配對成功會直接進房；若進入等待則出現取消鈕
    const cancel = page.getByRole("button", { name: "取消配對" });
    const inRoom = page.waitForURL(/\/room\//, { timeout: 8_000 }).then(() => "room").catch(() => null);
    const matching = cancel.waitFor({ timeout: 8_000 }).then(() => "matching").catch(() => null);
    const which = await Promise.race([inRoom, matching]);
    if (which === "matching") {
      await cancel.click();
      await expect(cancel).toBeHidden();
    } else {
      await expect(page).toHaveURL(/\/room\//);
    }
  });
});

// ════════════════════════════════════════════════════════════
//  房間  /room/[roomId]
// ════════════════════════════════════════════════════════════
test.describe("房間 /room", () => {
  async function createRoom(page: Page) {
    await guestLogin(page);
    await page.goto("/lobby");
    await page.getByRole("button", { name: "＋ 建立房間" }).click();
    await page.getByRole("button", { name: "建立並進入房間" }).click();
    await expect(page).toHaveURL(/\/room\//, { timeout: 10_000 });
  }

  test("複製房間碼按鈕", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await createRoom(page);
    const copyBtn = page.getByRole("button", { name: /點擊複製/ });
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();
  });

  test("標記準備按鈕（切換 Ready 狀態）", async ({ page }) => {
    await createRoom(page);
    const ready = page.getByRole("button", { name: "標記 Ready" });
    await expect(ready).toBeVisible();
    await ready.click();
    await expect(page.getByRole("button", { name: "取消 Ready" })).toBeVisible();
  });

  test("聊天：送出訊息後清空輸入框（桌面）", async ({ page }) => {
    await createRoom(page);
    const chatInput = page.getByPlaceholder(/輸入訊息/);
    await expect(chatInput).toBeVisible();
    await chatInput.fill("哈囉整合測試");
    await page.getByRole("button", { name: "送出" }).click();
    await expect(chatInput).toHaveValue("");
  });

  test("聊天折疊切換（行動版 viewport，收合/展開為 mobile-only）", async ({ page }) => {
    // .collapse-toggle 在桌面 display:none，僅 max-width:640px 顯示
    await page.setViewportSize({ width: 390, height: 800 });
    await createRoom(page);
    const toggle = page.getByRole("button", { name: "收合" });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.getByRole("button", { name: "展開" })).toBeVisible();
    await page.getByRole("button", { name: "展開" }).click();
    await expect(page.getByRole("button", { name: "收合" })).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════
//  本地對局  /game/[gameId]
// ════════════════════════════════════════════════════════════
test.describe("對局頁 /game (本地)", () => {
  async function startLocal(page: Page) {
    await page.goto("/");
    await page.getByRole("button", { name: /本地雙人/ }).click();
    await expect(page).toHaveURL(/\/game\//);
    await expect(page.locator("canvas.board")).toBeVisible();
  }

  test("落子後輪次交替", async ({ page }) => {
    await startLocal(page);
    await expect(page.getByText("輪到黑方落子")).toBeVisible();
    await clickBoard(page, 7, 7);
    await expect(page.getByText("輪到白方落子")).toBeVisible();
    await clickBoard(page, 8, 8);
    await expect(page.getByText("輪到黑方落子")).toBeVisible();
  });

  test("離開對局 Modal：取消 / 確定離開", async ({ page }) => {
    await startLocal(page);
    await page.getByRole("button", { name: "← 離開" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("離開對局")).toBeVisible();
    // 取消鈕文案為「繼續對局」
    await dialog.getByRole("button", { name: "繼續對局" }).click();
    await expect(page.getByText("離開對局")).toBeHidden();
    // 再開一次並確定離開
    await page.getByRole("button", { name: "← 離開" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "確定離開" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("黑方五連 → 結束畫面 → 再戰", async ({ page }) => {
    await startLocal(page);
    // 黑 (7,0..4)，白 (8,0..3) 交錯，黑第五子勝
    const seq: [number, number][] = [
      [7, 0], [8, 0], [7, 1], [8, 1], [7, 2], [8, 2], [7, 3], [8, 3], [7, 4],
    ];
    for (const [r, c] of seq) await clickBoard(page, r, c);
    await expect(page.getByText(/獲勝|和局/)).toBeVisible({ timeout: 8_000 });
    await page.getByRole("button", { name: "再戰" }).click();
    await expect(page).toHaveURL(/\/game\//);
    await expect(page.getByText("輪到黑方落子")).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════
//  本地 Swap2 開局  /opening/[gameId]
// ════════════════════════════════════════════════════════════
test.describe("開局頁 /opening (本地 Swap2)", () => {
  // 進入本地 Swap2 開局頁、關教學、投幣、到達放置階段。
  async function enterAndToss(page: Page) {
    await page.addInitScript(() => localStorage.removeItem("gmk_swap2_tut"));
    await page.goto("/");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /本地雙人/ }).click();
    await expect(page).toHaveURL(/\/opening\//);
    await page.getByRole("dialog").getByRole("button", { name: "我知道了" }).click();
    await page.getByRole("button", { name: "投擲硬幣" }).click();
    // 本地強制假先方 → 進放置階段
    await expect(page.getByRole("button", { name: "確認此子" })).toBeVisible({ timeout: 12_000 });
  }

  // 放一顆開局子並斷言後端回 201（攔 POST /opening-stones，不含 undo-last）
  async function placeOpening(page: Page, row: number, col: number) {
    const wait = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().endsWith("/opening-stones"),
    );
    await clickBoard(page, row, col);
    await page.getByRole("button", { name: "確認此子" }).click();
    const resp = await wait;
    expect(resp.status(), `放置開局子 (${row},${col}) 應為 201`).toBe(201);
  }

  // 做 Swap2 選擇並回傳 response（攔 swap2-choice）
  async function makeChoice(page: Page, label: string) {
    const wait = page.waitForResponse((r) => r.url().includes("/actions/swap2-choice"));
    await page.getByText(label, { exact: true }).click();
    const resp = await wait;
    return resp;
  }

  // 在對局頁落一子並斷言 201（驗證 Swap2 結束後確實可續弈）
  async function placeMove(page: Page, row: number, col: number) {
    const wait = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().endsWith("/moves"),
    );
    await clickBoard(page, row, col);
    const resp = await wait;
    expect(resp.status(), `對局落子 (${row},${col}) 應為 201`).toBe(201);
  }

  // S5 — 教學提示（spec: Swap2教學提示.md / 需求 #33）
  test("S5 教學 Modal：黑·白·黑 文案、不再顯示、重看教學", async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem("gmk_swap2_tut"));
    await page.goto("/");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /本地雙人/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Swap2 開局怎麼玩")).toBeVisible();
    await expect(dialog.getByText(/黑·白·黑/)).toBeVisible();   // spec 嚴格配色
    await dialog.getByText("不再顯示").click();
    await dialog.getByRole("button", { name: "我知道了" }).click();
    await expect(dialog).toBeHidden();
    // 重看教學
    await page.getByRole("button", { name: /Swap2 規則說明/ }).click();
    await expect(page.getByRole("dialog").getByText("Swap2 開局怎麼玩")).toBeVisible();
  });

  // S1 — 執黑玩到底（spec: Swap2開局放置 + Swap2選擇「執黑」+ 本地雙人.mmd S2→S3→S4）
  test("S1 本地 Swap2 執黑玩到底：放3子→選執黑→進對局輪白方→可續弈", async ({ page }) => {
    await enterAndToss(page);
    // 放標準三子（黑·白·黑）
    await placeOpening(page, 7, 7);
    await placeOpening(page, 7, 8);
    await placeOpening(page, 8, 8);
    // 完成三子自動進入假後方選擇
    await expect(page.getByText("選擇你的接手方式")).toBeVisible({ timeout: 8_000 });
    // 選執黑 → 後端 200、status PLAYING
    const resp = await makeChoice(page, "執黑");
    expect(resp.status(), "swap2-choice 應為 200").toBe(200);
    // 進入對局，spec：執黑 → OpeningCompleted 輪到白方
    await expect(page).toHaveURL(/\/game\//, { timeout: 10_000 });
    await expect(page.getByText("輪到白方落子")).toBeVisible({ timeout: 8_000 });
    // 可續弈：白方落一子 → 201、輪回黑方
    await placeMove(page, 9, 9);
    await expect(page.getByText("輪到黑方落子")).toBeVisible();
  });

  // S2 — 執白玩到底（spec: Swap2選擇「執白」。標準三子 B,W,B 後第四子恆為白，
  // 故開局完成後一律「輪到白方落子」—— 後端 curl 證實 TAKE_WHITE→currentTurn=WHITE）
  test("S2 本地 Swap2 執白玩到底：放3子→選執白→進對局輪白方→可續弈", async ({ page }) => {
    await enterAndToss(page);
    await placeOpening(page, 7, 7);
    await placeOpening(page, 7, 8);
    await placeOpening(page, 8, 8);
    await expect(page.getByText("選擇你的接手方式")).toBeVisible({ timeout: 8_000 });
    const resp = await makeChoice(page, "執白");
    expect(resp.status(), "swap2-choice 應為 200").toBe(200);
    await expect(page).toHaveURL(/\/game\//, { timeout: 10_000 });
    await expect(page.getByText("輪到白方落子")).toBeVisible({ timeout: 8_000 });
    await placeMove(page, 9, 9);
    await expect(page.getByText("輪到黑方落子")).toBeVisible();
  });

  // S3 — 放第四五子二階段（spec: Swap2選擇「放第四、五子」→ 選色權轉回假先方）
  test("S3 本地 Swap2 放第四五子二階段：不導航→續放2子→假先方選色→進對局", async ({ page }) => {
    await enterAndToss(page);
    await placeOpening(page, 7, 7);
    await placeOpening(page, 7, 8);
    await placeOpening(page, 8, 8);
    await expect(page.getByText("選擇你的接手方式")).toBeVisible({ timeout: 8_000 });
    // 選「放第四、五子」→ 後端 200 但 status 仍 OPENING（不定色、不進對局）
    const resp = await makeChoice(page, "放第四、五子");
    expect(resp.status(), "swap2-choice(PLACE_TWO_MORE) 應為 200").toBe(200);
    const body = await resp.json();
    expect(body.data.status, "PLACE_TWO_MORE 後 status 應仍為 OPENING").toBe("OPENING");
    // 不得導航到對局頁，應回到放置（第四五子）—— 用「確認此子」按鈕判定 place 階段，避免文字撞名
    await expect(page).toHaveURL(/\/opening\//);
    await expect(page.getByRole("button", { name: "確認此子" })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText("放置第四、五子（3/5）")).toBeVisible();
    // 續放第 4、5 子（白·黑）
    await placeOpening(page, 6, 6); // 第4子 白
    await placeOpening(page, 9, 9); // 第5子 黑
    // 自動進入假先方選色（標題 h3「假先方選色」，只剩執黑/執白）
    await expect(page.getByRole("heading", { name: "假先方選色" })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText("放第四、五子", { exact: true })).toHaveCount(0); // 二階段不得再有此選項
    const resp2 = await makeChoice(page, "執黑");
    expect(resp2.status(), "二次選色 swap2-choice 應為 200").toBe(200);
    const body2 = await resp2.json();
    expect(body2.data.status, "二次選色後 status 應為 PLAYING").toBe("PLAYING");
    await expect(page).toHaveURL(/\/game\//, { timeout: 10_000 });
    await placeMove(page, 5, 5); // 進對局可落子
  });

  // S4 — 開局悔最後一子（spec: Swap2開局放置 悔子規則）
  test("S4 開局悔最後一子：放2子→悔→計數退回 1/3", async ({ page }) => {
    await enterAndToss(page);
    await placeOpening(page, 7, 7);
    await placeOpening(page, 7, 8);
    await expect(page.getByText("放置開局子（2/3）")).toBeVisible();
    // 悔最後一子 → 後端 undo-last 2xx
    const wait = page.waitForResponse((r) => r.url().includes("/opening-stones/actions/undo-last"));
    await page.getByRole("button", { name: "悔最後一子" }).click();
    const resp = await wait;
    expect(resp.status(), "undo-last 應為 2xx").toBeLessThan(300);
    await expect(page.getByText("已悔最後一子")).toBeVisible();
    await expect(page.getByText("放置開局子（1/3）")).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════
//  排行榜  /leaderboard
// ════════════════════════════════════════════════════════════
test.describe("排行榜 /leaderboard", () => {
  test("渲染表頭與門檻說明", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page.getByRole("heading", { name: "排行榜" })).toBeVisible();
    await expect(page.getByText(/上榜門檻：累計 10 場/)).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "名次" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "勝率" })).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════
//  回放  /replay/[gameId]
// ════════════════════════════════════════════════════════════
test.describe("回放頁 /replay", () => {
  test("建立本地對局取得 gameId → 回放控制（上一步/播放/下一步）", async ({ page }) => {
    // 先打一局本地、落幾子，拿 gameId
    await page.goto("/");
    await page.getByRole("button", { name: /本地雙人/ }).click();
    await expect(page).toHaveURL(/\/game\//);
    await expect(page.getByText("輪到黑方落子")).toBeVisible();
    // 等每手 POST /moves 真的落地（輪次切換 = 後端已寫入）後再去回放
    await clickBoard(page, 7, 7);
    await expect(page.getByText("輪到白方落子")).toBeVisible();
    await clickBoard(page, 8, 8);
    await expect(page.getByText("輪到黑方落子")).toBeVisible();
    const url = page.url();
    const gameId = url.split("/game/")[1].split("?")[0];

    await page.goto(`/replay/${gameId}`);
    await expect(page.locator("canvas.board")).toBeVisible();
    // 等回放資料載入（total 變為非 0）再操作，避免在 0/0 狀態下點擊被 clamp
    await expect(page.getByText(/0 \/ [1-9]/)).toBeVisible({ timeout: 8_000 });
    await page.getByRole("button", { name: "下一步" }).click();
    await expect(page.getByText(/1 \/ [1-9]/)).toBeVisible();
    await page.getByRole("button", { name: "上一步" }).click();
    await expect(page.getByText(/0 \/ [1-9]/)).toBeVisible();
    // 播放/暫停切換
    const play = page.getByRole("button", { name: /播放|暫停/ });
    if (await play.count()) await play.first().click();
  });
});

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: online.spec.ts >> 線上連線對戰（兩瀏覽器） >> O0 STOMP 落子同步健檢：A 落子 B 即時收到
- Location: e2e/online.spec.ts:144:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/room\//
Received string:  "http://localhost:3000/lobby"
Timeout: 10000ms

Call log:
  - Expect "toHaveURL" with timeout 10000ms
    24 × unexpected value "http://localhost:3000/lobby"

```

```yaml
- banner:
  - link "五子棋 Gomoku":
    - /url: /
  - text: 訪客 對手pwmqg71i9x6225
  - link "升級為註冊":
    - /url: /user
- main:
  - heading "公開房間" [level=1]
  - button "↻ 重新整理"
  - text: 房間碼 R8AKR9 房主 房主pwmqg71i2e1402 對戰 1/2 觀戰 0 人 普通
  - button "加入"
  - text: 房間碼 DRD7X6 房主 訪客pwmqg70wlw2164 對戰 1/2 觀戰 0 人 普通
  - button "加入"
  - text: 房間碼 VVG675 房主 訪客pwmqg70vhw2919 對戰 1/2 觀戰 0 人 普通
  - button "加入"
  - text: 房間碼 VXXQSJ 房主 訪客pwmqg70uq95993 對戰 1/2 觀戰 0 人 普通
  - button "加入"
  - text: 房間碼 Q5LD9U 房主 訪客pwmqg70u871 對戰 1/2 觀戰 0 人 普通
  - button "加入"
  - text: 房間碼 EXZHUN 房主 訪客pwmqg70tk27376 對戰 1/2 觀戰 0 人 普通
  - button "加入"
  - text: 房間碼 TGURVQ 房主 regmqg6zhi9 對戰 1/2 觀戰 0 人 普通
  - button "加入"
  - text: 房間碼 J3BFAV 房主 房主pwmqg2k2re2238 對戰 2/2 觀戰 1 人 普通
  - button "觀戰"
  - text: 房間碼 8SGDV5 房主 房主pwmqg2jtju7776 對戰 2/2 觀戰 0 人 普通
  - button "觀戰"
  - text: 房間碼 HXKWSJ 房主 房主pwmqg2jsmu3351 對戰 2/2 觀戰 0 人 普通
  - button "觀戰"
  - text: 房間碼 7DTLDM 房主 房主pwmqg2je7l4046 對戰 1/2 觀戰 0 人 普通
  - button "加入"
  - text: 房間碼 JZZKEV 房主 訪客pwmqg2isen7396 對戰 1/2 觀戰 0 人 普通
  - button "加入"
  - text: 房間碼 NJU9SK 房主 訪客pwmqg2irx97321 對戰 1/2 觀戰 0 人 普通
  - button "加入"
  - text: 房間碼 TLUAHB 房主 訪客pwmqg2iqtg547 對戰 1/2 觀戰 0 人 普通
  - button "加入"
  - text: 房間碼 CC7Z8E 房主 訪客pwmqg2iqcr3661 對戰 1/2 觀戰 0 人 普通
  - button "加入"
  - text: 房間碼 STWC4Q 房主 测试1781537750 對戰 1/2 觀戰 0 人 普通
  - button "加入"
  - text: 房間碼 253S73 房主 房主pwmqfchfpb6578 對戰 2/2 觀戰 1 人 普通
  - button "觀戰"
  - text: 房間碼 AVC8KR 房主 房主pwmqfche5l6995 對戰 2/2 觀戰 0 人 普通
  - button "觀戰"
  - text: 房間碼 L4CUXG 房主 房主pwmqfch3u06880 對戰 2/2 觀戰 1 人 普通
  - button "觀戰"
  - text: 房間碼 LF9ECK 房主 房主pwmqfch2ai3013 對戰 2/2 觀戰 0 人 普通
  - button "觀戰"
  - complementary:
    - heading "建立房間" [level=3]
    - button "＋ 建立房間"
    - heading "輸入房間碼加入" [level=3]
    - textbox "房間碼 如 7F3K": R8AKR9
    - button "加入"
    - heading "快速配對" [level=3]
    - button "⚡ 快速配對"
- alert
```

# Test source

```ts
  1   | import { test, expect, Page, BrowserContext } from "@playwright/test";
  2   | 
  3   | /**
  4   |  * 線上連線對戰整合測試 — 兩個真實瀏覽器 context（A=房主、B=對手），真 STOMP。
  5   |  * 對真後端執行；STOMP 直連後端（dev.sh 設 NEXT_PUBLIC_WS_ENDPOINT）。
  6   |  *
  7   |  * 對應 spec：activities/線上連線對戰.mmd + features/room/* + features/game/線上落子.feature
  8   |  *           + features/opening/*（O4 Swap2）。
  9   |  *
  10  |  * 嚴格規則：流程該出現的元素硬斷言；waitForResponse 攔關鍵 API，非預期狀態碼即 fail；
  11  |  *          全程監聽 pageerror，未捕獲例外即 fail。碰壁不當成功。
  12  |  */
  13  | 
  14  | const uniq = () => `pw${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  15  | 
  16  | function guardErrors(page: Page, bag: string[]) {
  17  |   page.on("pageerror", (e) => bag.push(e.message));
  18  | }
  19  | 
  20  | /** 以訪客身份登入（訪客可線上單場，需求 #2；guest 端點回 JWT 供 /rooms 鑑權）。 */
  21  | async function guestLogin(page: Page, nick: string) {
  22  |   await page.goto("/user#guest");
  23  |   await page.getByRole("tab", { name: "訪客" }).click();
  24  |   await page.locator('input[name="gn"]').fill(nick);
  25  |   await page.getByRole("button", { name: "以訪客進入" }).click();
  26  |   await expect(page.getByText("以訪客身份進入")).toBeVisible();
  27  | }
  28  | 
  29  | /**
  30  |  * 等 session 水合完成（header 顯示訪客身份）。page.goto 是硬導航會重置 in-memory
  31  |  * authToken，zustand 由 localStorage 重新水合後才重設 token；在此前發 authenticated
  32  |  * 請求會 401。等訪客 badge 出現 = token 已套用（真實用戶走 client-side 導航不會遇到）。
  33  |  */
  34  | async function awaitHydrated(page: Page) {
  35  |   await expect(page.locator(".app-header").getByText("訪客", { exact: true })).toBeVisible({
  36  |     timeout: 10_000,
  37  |   });
  38  | }
  39  | 
  40  | /** A 建立一個線上房間（可選 Swap2），回傳 {roomId, roomCode}。 */
  41  | async function createRoom(page: Page, swap2: boolean): Promise<{ roomId: string; roomCode: string }> {
  42  |   await page.goto("/lobby");
  43  |   await awaitHydrated(page);
  44  |   await page.getByRole("button", { name: "＋ 建立房間" }).click();
  45  |   const dialog = page.getByRole("dialog");
  46  |   if (swap2) await dialog.getByText("Swap2", { exact: true }).click();
  47  |   await dialog.getByRole("button", { name: "建立並進入房間" }).click();
  48  |   await expect(page).toHaveURL(/\/room\//, { timeout: 10_000 });
  49  |   const roomId = page.url().split("/room/")[1].split("?")[0];
  50  |   // 從房間頁讀真實 6 碼 roomCode（房間碼：XXXXXX（點擊複製））
  51  |   const badge = page.getByRole("button", { name: /房間碼：/ });
  52  |   await expect(badge).not.toContainText("…", { timeout: 8_000 });
  53  |   const text = (await badge.textContent()) ?? "";
  54  |   const roomCode = text.replace(/[^A-Z0-9]/g, "").slice(0, 6);
  55  |   return { roomId, roomCode };
  56  | }
  57  | 
  58  | /** B 以 6 碼房間碼從大廳加入。 */
  59  | async function joinRoom(page: Page, roomCode: string) {
  60  |   await page.goto("/lobby");
  61  |   await awaitHydrated(page);
  62  |   const codeRow = page.locator(".row", { has: page.getByPlaceholder(/房間碼/) });
  63  |   await page.getByPlaceholder(/房間碼/).fill(roomCode);
  64  |   await codeRow.getByRole("button", { name: "加入" }).click();
> 65  |   await expect(page).toHaveURL(/\/room\//, { timeout: 10_000 });
      |                      ^ Error: expect(page).toHaveURL(expected) failed
  66  | }
  67  | 
  68  | /** 棋盤格座標 → canvas 點擊位置。 */
  69  | async function clickBoard(page: Page, row: number, col: number) {
  70  |   const board = page.locator("canvas.board");
  71  |   const box = await board.boundingBox();
  72  |   if (!box) throw new Error("board not visible");
  73  |   const cell = box.width / 15;
  74  |   await board.click({ position: { x: (col + 0.5) * cell, y: (row + 0.5) * cell } });
  75  | }
  76  | 
  77  | /**
  78  |  * 共用：兩訪客開一場線上對局（標準或 Swap2），雙方導到同一對局頁。
  79  |  * 關鍵：ready 前先等雙方房間 STOMP「已連線」，確保先 ready 方能收到 READY 廣播。
  80  |  * 回傳 gameId（從 A 的 URL）。
  81  |  */
  82  | async function setupOnlineGame(
  83  |   pageA: Page,
  84  |   pageB: Page,
  85  |   swap2: boolean,
  86  | ): Promise<string> {
  87  |   await guestLogin(pageA, `房主${uniq()}`);
  88  |   await guestLogin(pageB, `對手${uniq()}`);
  89  |   const { roomCode } = await createRoom(pageA, swap2);
  90  |   await joinRoom(pageB, roomCode);
  91  | 
  92  |   // 雙方房間 STOMP 連上（避免先 ready 方錯過 READY 廣播）
  93  |   await expect(pageA.getByText("已連線")).toBeVisible({ timeout: 12_000 });
  94  |   await expect(pageB.getByText("已連線")).toBeVisible({ timeout: 12_000 });
  95  | 
  96  |   await pageA.getByRole("button", { name: "標記 Ready" }).click();
  97  |   const startResp = pageA.waitForResponse((r) => r.url().includes("/actions/start-game"));
  98  |   await pageB.getByRole("button", { name: "標記 Ready" }).click();
  99  |   const resp = await startResp;
  100 |   expect(resp.status(), "start-game 應為 2xx").toBeLessThan(300);
  101 | 
  102 |   const dest = swap2 ? /\/opening\// : /\/game\//;
  103 |   await expect(pageA).toHaveURL(dest, { timeout: 12_000 });
  104 |   await expect(pageB).toHaveURL(dest, { timeout: 12_000 });
  105 |   const gidA = pageA.url().split(swap2 ? "/opening/" : "/game/")[1].split("?")[0];
  106 |   const gidB = pageB.url().split(swap2 ? "/opening/" : "/game/")[1].split("?")[0];
  107 |   expect(gidA, "雙方應在同一對局").toBe(gidB);
  108 |   return gidA;
  109 | }
  110 | 
  111 | test.describe("線上連線對戰（兩瀏覽器）", () => {
  112 |   // 兩瀏覽器 + 真 STOMP 的整合測試對時序敏感；允許 1 次重試吸收殘餘抖動
  113 |   // （核心流程正確性已由穩定通過證明，非以重試掩蓋功能缺陷）。
  114 |   test.describe.configure({ retries: 1 });
  115 | 
  116 |   let ctxA: BrowserContext;
  117 |   let ctxB: BrowserContext;
  118 |   let pageA: Page;
  119 |   let pageB: Page;
  120 |   let errA: string[];
  121 |   let errB: string[];
  122 | 
  123 |   test.beforeEach(async ({ browser }) => {
  124 |     // 兩個 context + 完整線上流程步驟多，放寬單條測試時限
  125 |     test.setTimeout(75_000);
  126 |     ctxA = await browser.newContext();
  127 |     ctxB = await browser.newContext();
  128 |     pageA = await ctxA.newPage();
  129 |     pageB = await ctxB.newPage();
  130 |     errA = [];
  131 |     errB = [];
  132 |     guardErrors(pageA, errA);
  133 |     guardErrors(pageB, errB);
  134 |   });
  135 | 
  136 |   test.afterEach(async () => {
  137 |     expect(errA, `A 端未捕獲例外:\n${errA.join("\n")}`).toEqual([]);
  138 |     expect(errB, `B 端未捕獲例外:\n${errB.join("\n")}`).toEqual([]);
  139 |     await ctxA?.close();
  140 |     await ctxB?.close();
  141 |   });
  142 | 
  143 |   // ── O0：de-risk 閘門 —— 證明 SockJS/STOMP 經整套環境可用 ──
  144 |   test("O0 STOMP 落子同步健檢：A 落子 B 即時收到", async () => {
  145 |     await setupOnlineGame(pageA, pageB, false);
  146 |     // 兩端初始皆黑方回合，且 game 頁 STOMP 已連線
  147 |     await expect(pageA.getByText("輪到黑方落子")).toBeVisible({ timeout: 8_000 });
  148 |     await expect(pageB.getByText("輪到黑方落子")).toBeVisible({ timeout: 8_000 });
  149 |     await expect(pageA.getByText("已連線")).toBeVisible({ timeout: 10_000 });
  150 |     await expect(pageB.getByText("已連線")).toBeVisible({ timeout: 10_000 });
  151 | 
  152 |     // A（房主=黑）落一子 → REST 201 → 後端廣播 /topic/game/{id} → B 端即時更新
  153 |     const moveResp = pageA.waitForResponse(
  154 |       (r) => r.request().method() === "POST" && r.url().endsWith("/moves"),
  155 |     );
  156 |     await clickBoard(pageA, 7, 7);
  157 |     expect((await moveResp).status(), "A 落子應為 201").toBe(201);
  158 |     await expect(pageB.getByText("輪到白方落子")).toBeVisible({ timeout: 10_000 });
  159 |     await expect(pageA.getByText("輪到白方落子")).toBeVisible({ timeout: 10_000 });
  160 |   });
  161 | 
  162 |   // mover 在自己回合落一子(201)，雙方輪次切到 nextTurnText
  163 |   async function onlineMove(
  164 |     mover: Page,
  165 |     other: Page,
```
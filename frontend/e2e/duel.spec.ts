import { test, expect, type Page } from "@playwright/test";

/**
 * 真劍勝負模式 e2e（需求 #34–#48, MSW 環境）。
 * Demo games are deterministically seeded (duelEngine.ts):
 *  - duel-volcano-demo (seed 42, 15x15, black=WARRIOR, white=ARCHER):
 *    obstacles (6,12)(10,2)(7,4)(9,12)(7,3)(13,11)(4,2);
 *    hidden eruptions (7,10)(9,0)(7,12)(0,8)(0,4)
 *  - duel-beach-demo (seed 7, 16x16, ocean UP, black=ARCHER, white=WARRIOR):
 *    hidden tides (0,15)(11,8)(6,7)(3,8)(11,4)
 * Test coordinates below deliberately avoid (or hit) those cells.
 */

const uniq = () => Math.random().toString(36).slice(2, 7);

async function guestLogin(page: Page, nick = `訪客${uniq()}`) {
  await page.goto("/user#guest");
  await page.getByRole("tab", { name: "訪客" }).click();
  await page.locator('input[name="gn"]').fill(nick);
  await page.getByRole("button", { name: "以訪客進入" }).click();
  await expect(page.getByText("以訪客身份進入")).toBeVisible();
}

/** 棋盤格座標 → canvas 點擊位置（依棋盤大小 n 計算格距）。 */
async function clickBoard(page: Page, row: number, col: number, n = 15) {
  const board = page.locator("canvas.board");
  const box = await board.boundingBox();
  if (!box) throw new Error("board canvas not visible");
  // mirrors GomokuBoard geometry: pad = size*0.045, gap = (size-2*pad)/(n-1)
  const pad = box.width * 0.045;
  const gap = (box.width - 2 * pad) / (n - 1);
  await board.click({ position: { x: pad + col * gap, y: pad + row * gap } });
}

test.describe("真劍勝負：建房與職業選擇（需求 #34 #35）", () => {
  test("D1 大廳建立真劍勝負沙灘房 → 房間顯示場地與職業選擇，對手職業隱藏", async ({ page }) => {
    await guestLogin(page);
    await page.goto("/lobby");
    await page.getByRole("button", { name: "＋ 建立房間" }).click();
    // 房間模式三選一互斥（Q9）；選真劍勝負後出現場地選擇（需求 #34）
    await expect(page.getByTestId("field-picker")).toHaveCount(0);
    await page.locator(".tab", { hasText: "真劍勝負" }).click();
    await expect(page.getByTestId("field-picker")).toBeVisible();
    await page.getByTestId("field-picker").locator(".tab", { hasText: "沙灘" }).click();
    await page.getByRole("button", { name: "建立並進入房間" }).click();
    await expect(page).toHaveURL(/\/room\//);
    // 房間頁：模式/場地徽章 + 職業選擇卡 + 對手職業隱藏（Q8）
    await expect(page.getByText("⚔️ 真劍勝負 🏖️ 沙灘 16×16")).toBeVisible();
    await expect(page.getByTestId("class-select")).toBeVisible();
    await expect(page.getByText("❓ 選擇中（開局揭曉）")).toBeVisible();
  });

  test("D2 選職業 → Ready → 自動開局進入 16×16 沙灘對局，開局揭曉職業", async ({ page }) => {
    await guestLogin(page);
    await page.goto("/lobby");
    await page.getByRole("button", { name: "＋ 建立房間" }).click();
    await page.locator(".tab", { hasText: "真劍勝負" }).click();
    await page.getByTestId("field-picker").locator(".tab", { hasText: "沙灘" }).click();
    await page.getByRole("button", { name: "建立並進入房間" }).click();
    await expect(page).toHaveURL(/\/room\//);
    // 未選職業就 Ready 會被擋（Q8：Ready 即鎖定，先選再鎖）
    await page.getByRole("button", { name: "標記 Ready" }).click();
    await expect(page.getByText("請先選擇職業再標記 Ready")).toBeVisible();
    await page.getByRole("button", { name: /弓箭手/ }).click();
    await expect(page.getByText("弓箭手（已選）")).toBeVisible();
    await page.getByRole("button", { name: "標記 Ready" }).click();
    // 雙方 Ready（mock 對手恆 Ready）→ start-game → 對局頁
    await expect(page).toHaveURL(/\/game\/duel-/, { timeout: 10_000 });
    // 開局揭曉橫幅（Q8）
    await expect(page.getByTestId("duel-reveal")).toBeVisible();
    // 16×16 沙灘棋盤（需求 #40，Q6）
    await expect(page.getByRole("grid", { name: "16 乘 16 五子棋盤" })).toBeVisible();
    await expect(page.getByTestId("skill-bar")).toBeVisible();
  });
});

test.describe("真劍勝負：火山場地與技能（需求 #36 #39 #42 #43）", () => {
  test("D3 火山 demo：一般落子 + 障礙物格被拒", async ({ page }) => {
    await page.goto("/game/duel-volcano-demo?mode=local");
    await expect(page.getByRole("grid", { name: "15 乘 15 五子棋盤" })).toBeVisible();
    await expect(page.getByText("🌋 火山 15×15").first()).toBeVisible();
    // 障礙物 (6,12)：點擊被拒（需求 #39）
    await clickBoard(page, 6, 12, 15);
    await expect(page.getByText("該格為障礙物，禁止落子")).toBeVisible();
    await expect(page.getByText("第 0 手")).toBeVisible();
    // 正常落子
    await clickBoard(page, 2, 4, 15);
    await expect(page.getByText("第 1 手")).toBeVisible();
    await expect(page.getByText("輪到白方落子")).toBeVisible();
  });

  test("D4 大絕流程：選技能 → 選方向 → 3×2 預覽 → 錨點施放（取代落子，Q4）", async ({ page }) => {
    await page.goto("/game/duel-volcano-demo?mode=local");
    await expect(page.getByTestId("skill-bar")).toBeVisible();
    // 黑方 = 劍士：大絕「天地反轉」
    await page.getByRole("button", { name: /天地反轉/ }).click();
    await expect(page.getByText("選擇大絕方向")).toBeVisible();
    await page.getByTestId("dir-pad").getByRole("button", { name: "右", exact: true }).click();
    await expect(page.getByText("已選方向 — 點擊棋盤空格作為錨點（3寬×2深）")).toBeVisible();
    // 錨點（空格）施放：大絕取代本回合落子（Q1）
    await clickBoard(page, 5, 5, 15);
    // 機能性技能動畫（新增）：施放觸發 GomokuBoard 的一次性 canvas VFX
    // （3×2 範圍框＋翻轉），canvas 像素不可直接斷言，改用 e2e hook 屬性驗證。
    await expect(page.getByTestId("skill-anim")).toHaveAttribute("data-active", "true");
    await expect(page.getByText("第 1 手")).toBeVisible();
    await expect(page.getByText("輪到白方落子")).toBeVisible();
    await expect(page.getByText("1/3 已用")).toBeVisible();
  });

  test("D5 精準狙擊：白方（弓箭手）替換黑棋（Q10）", async ({ page }) => {
    await page.goto("/game/duel-volcano-demo?mode=local");
    await expect(page.getByTestId("skill-bar")).toBeVisible();
    await clickBoard(page, 2, 4, 15); // 黑先落一子
    await expect(page.getByText("第 1 手")).toBeVisible();
    // 白方 = 弓箭手
    await page.getByRole("button", { name: /精準狙擊/ }).click();
    await expect(page.getByText("點擊一顆敵方棋子以替換成己方顏色")).toBeVisible();
    await clickBoard(page, 2, 4, 15); // 點黑棋 → 替換
    await expect(page.getByText("第 2 手")).toBeVisible();
    await expect(page.getByText("輪到黑方落子")).toBeVisible();
    await expect(page.getByText("1/3 已用")).toBeVisible();
  });
});

test.describe("真劍勝負：沙灘場地（需求 #40 #41，Q6 Q7）", () => {
  test("D6 沙灘 demo：16×16、海浪倒數、散射兩子（Chebyshev ≥ 2）", async ({ page }) => {
    await page.goto("/game/duel-beach-demo?mode=local");
    await expect(page.getByRole("grid", { name: "16 乘 16 五子棋盤" })).toBeVisible();
    await expect(page.getByText("下次海浪")).toBeVisible();
    await expect(page.getByText("未觸發")).toBeVisible();
    // 黑方 = 弓箭手：散射（該手同時下 2 子）
    await page.getByRole("button", { name: /散射/ }).click();
    await clickBoard(page, 10, 3, 16);
    await expect(page.getByText("已選第 1 子，請點第 2 個空格（間隔 ≥ 2）")).toBeVisible();
    await clickBoard(page, 10, 6, 16);
    // 機能性技能動畫（新增）：散射兩箭同時飛向兩個落點的 canvas VFX 已觸發
    await expect(page.getByTestId("skill-anim")).toHaveAttribute("data-active", "true");
    await expect(page.getByText("第 1 手")).toBeVisible();
    await expect(page.getByText("輪到白方落子")).toBeVisible();
  });
});

test.describe("真劍勝負：結束揭露與回放（需求 #44 #45 #47）", () => {
  test("D7 火山對局黑勝 → 結束畫面標示隱藏噴發格全數揭露", async ({ page }) => {
    await page.goto("/game/duel-volcano-demo?mode=local");
    await expect(page.getByTestId("skill-bar")).toBeVisible();
    // 黑列 row2 (4..8)、白列 row12 (0..3)，皆避開障礙與隱藏噴發格
    const seq: [number, number][] = [
      [2, 4], [12, 0], [2, 5], [12, 1], [2, 6], [12, 2], [2, 7], [12, 3], [2, 8],
    ];
    for (let i = 0; i < seq.length; i++) {
      await clickBoard(page, seq[i][0], seq[i][1], 15);
      await expect(page.getByText(`第 ${i + 1} 手`)).toBeVisible();
    }
    await expect(page.getByText("玩家一 獲勝！")).toBeVisible({ timeout: 5000 });
    // 結束畫面揭露所有隱藏格（需求 #44；火山 → 噴發格 🌋）
    await expect(page.getByTestId("duel-reveal-note")).toContainText("噴發格已全數揭露");
  });

  test("D8 沙灘回放：場地/職業標示、事件時間軸、漲潮於觸發時點揭露（🌊 非 🌋）", async ({ page }) => {
    await page.goto("/replay/duel-replay-beach");
    await expect(page.getByText("⚔️ 真劍勝負")).toBeVisible();
    await expect(page.getByText("🏖️ 沙灘 16×16")).toBeVisible();
    await expect(page.getByText("⚔️ 劍士")).toBeVisible(); // 黑方職業
    await expect(page.getByText("🏹 弓箭手")).toBeVisible(); // 白方職業
    await expect(page.getByRole("grid", { name: "16 乘 16 五子棋盤" })).toBeVisible();
    // 跳到第 11 手：隱藏漲潮格觸發（fixture: TIDE_TRIGGERED @ move 11）
    await page.getByLabel("回放進度").fill("11");
    await expect(page.getByText(/漲潮觸發/)).toBeVisible();
    // 跳到第 20 手：海浪 + 沙灘侵蝕
    await page.getByLabel("回放進度").fill("20");
    await expect(page.getByText(/海浪/)).toBeVisible();
    await expect(page.getByText(/沙灘侵蝕/)).toBeVisible();
    // 播到底
    await page.getByLabel("回放進度").fill("25");
    await expect(page.getByText("25 / 25")).toBeVisible();
  });
});

test.describe("真劍勝負：對局頁 UI 改進（不洩漏對手技能 + 施放提示）", () => {
  test("D9 online 模式：技能列鎖定己方職業，對手回合置灰但不消失（不顯示對手技能名稱）", async ({ page }) => {
    // 直接把 session 種進 localStorage（zustand persist 格式），把自己釘死在
    // duelEngine.ts duelGameReplay() 現在回傳的 blackPlayerId="p-001" —
    // 讓 game 頁的 myColor 判斷（mode=online 分支）能解析出「我是黑方」。
    await page.addInitScript(() => {
      localStorage.setItem(
        "gmk-session",
        JSON.stringify({
          state: { identity: "guest", nickname: "測試黑方", playerId: "p-001", token: null },
          version: 0,
        }),
      );
    });
    await page.goto("/game/duel-volcano-demo?mode=online");
    await expect(page.getByTestId("skill-bar")).toBeVisible();
    // 黑方（我）= 劍士：技能列顯示自己的技能，白方（弓箭手）技能名稱完全不出現
    await expect(page.getByRole("button", { name: /橫劈/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /精準狙擊/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /散射/ })).toHaveCount(0);
    // 黑方落一手普通子（未用技能），輪到白方
    await clickBoard(page, 2, 4, 15);
    await expect(page.getByText("第 1 手")).toBeVisible();
    await expect(page.getByText("輪到白方落子")).toBeVisible();
    // 對手（白方）回合：技能列仍是「我方」（黑方）技能 — 置灰停用、不消失，
    // 且依然看不到白方（對手）的任何技能名稱
    await expect(page.getByTestId("skill-bar")).toBeVisible();
    const horizontalSlash = page.getByRole("button", { name: /橫劈/ });
    await expect(horizontalSlash).toBeVisible();
    await expect(horizontalSlash).toBeDisabled();
    await expect(page.getByRole("button", { name: /精準狙擊/ })).toHaveCount(0);
    await expect(page.getByText("對方回合，暫時無法使用")).toBeVisible();
  });

  test("D10 本地對局：施放大絕時彈出「對方發動了」提示，約 3 秒後自動消失且不阻擋操作", async ({ page }) => {
    await page.goto("/game/duel-volcano-demo?mode=local");
    await expect(page.getByTestId("skill-bar")).toBeVisible();
    await page.getByRole("button", { name: /天地反轉/ }).click();
    await page.getByTestId("dir-pad").getByRole("button", { name: "右", exact: true }).click();
    await clickBoard(page, 5, 5, 15);
    // 施放後彈出提示：「對方發動了 天地反轉（大絕）！」
    await expect(page.getByText(/對方發動了.*天地反轉/)).toBeVisible();
    // 不阻擋操作：提示顯示的同時，落子/回合切換都已正常完成
    await expect(page.getByText("第 1 手")).toBeVisible();
    await expect(page.getByText("輪到白方落子")).toBeVisible();
    // 自動消失（toast 預設 3 秒 ttl），給緩衝避免 flaky
    await expect(page.getByText(/對方發動了.*天地反轉/)).toHaveCount(0, { timeout: 5000 });
  });
});

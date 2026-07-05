import { test, expect, type Page } from "@playwright/test";

/**
 * Full-stack integration scenarios — run against the REAL backend
 * (MSW disabled). Requires:
 *   docker compose -f ../integration-test/docker-compose.fullstack.yml up -d
 *   NEXT_PUBLIC_API_MOCKING=disabled BACKEND_ORIGIN=http://127.0.0.1:18080 npm run dev
 *
 * Unlike smoke.spec.ts these do NOT depend on MSW fixture data — every
 * scenario seeds its own state through the live API.
 */

const uniq = () => `pw${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

test("註冊帳號 → 自動登入（POST /auth/register 真後端）", async ({ page }) => {
  const name = uniq();
  await page.goto("/user");
  await page.getByRole("tab", { name: "註冊" }).click();
  await page.locator('input[name="ru"]').fill(name);
  await page.locator('input[name="re"]').fill(`${name}@example.com`);
  await page.locator('input[name="rp"]').fill("passw0rd1");
  await page.getByRole("button", { name: "建立帳號" }).click();
  await expect(page.getByText("註冊成功，已自動登入")).toBeVisible();
});

test("登入取得 JWT（先註冊再登出登入）", async ({ page }) => {
  const name = uniq();
  await page.goto("/user");
  await page.getByRole("tab", { name: "註冊" }).click();
  await page.locator('input[name="ru"]').fill(name);
  await page.locator('input[name="re"]').fill(`${name}@example.com`);
  await page.locator('input[name="rp"]').fill("passw0rd1");
  await page.getByRole("button", { name: "建立帳號" }).click();
  await expect(page.getByText("註冊成功，已自動登入")).toBeVisible();

  // fresh context state: navigate and login with the same credentials
  await page.evaluate(() => localStorage.clear());
  await page.goto("/user");
  await page.getByRole("tab", { name: "登入" }).click();
  await page.locator('input[name="lu"]').fill(name);
  await page.locator('input[name="lp"]').fill("passw0rd1");
  await page.getByRole("button", { name: /登入/ }).click();
  await expect(page.getByText(`歡迎回來，${name}！`)).toBeVisible();
});

test("密碼錯誤登入失敗（401 真後端）", async ({ page }) => {
  await page.goto("/user");
  await page.getByRole("tab", { name: "登入" }).click();
  await page.locator('input[name="lu"]').fill("no_such_user");
  await page.locator('input[name="lp"]').fill("wrongpass1");
  await page.getByRole("button", { name: /登入/ }).click();
  await expect(page.getByText("帳號或密碼錯誤")).toBeVisible();
});

test("訪客模式進入（POST /auth/guest 真後端）", async ({ page }) => {
  await page.goto("/user#guest");
  await page.getByRole("tab", { name: "訪客" }).click();
  await page.locator('input[name="gn"]').fill(`訪客${uniq()}`);
  await page.getByRole("button", { name: "以訪客進入" }).click();
  await expect(page.getByText("以訪客身份進入")).toBeVisible();
});

test("本地雙人對戰：開局 + 連續落子（POST /games + /moves 真後端）", async ({ page }) => {
  await page.goto("/");
  await page.getByText("本地雙人").click();
  await expect(page).toHaveURL(/\/game\//);
  await expect(page.locator("canvas.board")).toBeVisible();
  await expect(page.getByText("輪到黑方落子")).toBeVisible();

  // Click two intersections — server validates and alternates turns
  const board = page.locator("canvas.board");
  const box = await board.boundingBox();
  if (!box) throw new Error("board not visible");
  const cell = box.width / 15;
  await board.click({ position: { x: cell * 7.5, y: cell * 7.5 } }); // black (7,7)
  await expect(page.getByText("輪到白方落子")).toBeVisible();
  await board.click({ position: { x: cell * 8.5, y: cell * 7.5 } }); // white
  await expect(page.getByText("輪到黑方落子")).toBeVisible();
});

test("排行榜載入（GET /players/leaderboard 真後端，空資料容忍）", async ({ page }) => {
  await page.goto("/leaderboard");
  await expect(page.getByRole("heading", { name: "排行榜" })).toBeVisible();
  await expect(page.getByText(/上榜門檻：累計 10 場/)).toBeVisible();
  // No fixture-name assertion — real DB may be empty; the page must not error.
});

test("大廳載入 + 建立房間（訪客 → 大廳 → POST /rooms 真後端）", async ({ page }) => {
  // guest login first (lobby requires identity)
  await page.goto("/user#guest");
  await page.getByRole("tab", { name: "訪客" }).click();
  await page.locator('input[name="gn"]').fill(`房主${uniq()}`);
  await page.getByRole("button", { name: "以訪客進入" }).click();
  await expect(page.getByText("以訪客身份進入")).toBeVisible();

  await page.goto("/lobby");
  await page.getByRole("button", { name: "＋ 建立房間" }).click();
  await page.getByRole("button", { name: "建立並進入房間" }).click();
  await expect(page).toHaveURL(/\/room\//, { timeout: 10_000 });
});

/**
 * 真劍勝負（SERIOUS_DUEL）真後端整合測試 — 兩個真實瀏覽器 context，覆蓋
 * schemas.ts FieldEventItem.moveNumber 缺 .nullable() 造成的靜默降級 bug：
 * 真後端 GameReplayResponse.fieldEvents 的 FIELD_GENERATED 恆帶
 * moveNumber:null（建局時發生，無對應手數），schema 誤標非 null 時
 * loadReplay() 的 catch 會吞掉 ZodError，duel 狀態永不設定 → 障礙物/技能列/
 * 場地徽章全部不渲染，但 UI 不報任何錯誤（"靜默降級"）。
 */
test.describe("真劍勝負線上對局（真後端，兩瀏覽器）", () => {
  test.describe.configure({ retries: 1 });

  async function guestLogin(page: Page, nick: string) {
    await page.goto("/user#guest");
    await page.getByRole("tab", { name: "訪客" }).click();
    await page.locator('input[name="gn"]').fill(nick);
    await page.getByRole("button", { name: "以訪客進入" }).click();
    await expect(page.locator(".app-header").getByText("訪客", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  }

  async function clickBoard(page: Page, row: number, col: number, n = 15) {
    const board = page.locator("canvas.board");
    const box = await board.boundingBox();
    if (!box) throw new Error("board not visible");
    const pad = box.width * 0.045;
    const gap = (box.width - 2 * pad) / (n - 1);
    await board.click({ position: { x: pad + col * gap, y: pad + row * gap } });
  }

  test("建房(火山)→雙方選職業 Ready→開局：skill-bar 可見、場地/障礙資訊渲染、施放技能成功", async ({
    browser,
  }) => {
    test.setTimeout(75_000);
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    const errA: string[] = [];
    const errB: string[] = [];
    pageA.on("pageerror", (e) => errA.push(e.message));
    pageB.on("pageerror", (e) => errB.push(e.message));

    await guestLogin(pageA, `劍士${uniq()}`);
    await guestLogin(pageB, `弓手${uniq()}`);

    // A 建立真劍勝負 · 火山房
    await pageA.goto("/lobby");
    await pageA.getByRole("button", { name: "＋ 建立房間" }).click();
    const dialog = pageA.getByRole("dialog");
    await dialog.locator(".tab", { hasText: "真劍勝負" }).click();
    await dialog.getByTestId("field-picker").locator(".tab", { hasText: "火山" }).click();
    await dialog.getByRole("button", { name: "建立並進入房間" }).click();
    await expect(pageA).toHaveURL(/\/room\//, { timeout: 10_000 });
    const badge = pageA.getByRole("button", { name: /房間碼：/ });
    await expect(badge).not.toContainText("…", { timeout: 8_000 });
    const roomCode = ((await badge.textContent()) ?? "").replace(/[^A-Z0-9]/g, "").slice(0, 6);

    // B 以房間碼加入
    await pageB.goto("/lobby");
    const codeRow = pageB.locator(".row", { has: pageB.getByPlaceholder(/房間碼/) });
    await pageB.getByPlaceholder(/房間碼/).fill(roomCode);
    await codeRow.getByRole("button", { name: "加入" }).click();
    await expect(pageB).toHaveURL(/\/room\//, { timeout: 10_000 });

    await expect(pageA.getByText("已連線")).toBeVisible({ timeout: 12_000 });
    await expect(pageB.getByText("已連線")).toBeVisible({ timeout: 12_000 });

    // A=劍士(黑，先手)、B=弓箭手(白)
    await pageA.getByRole("button", { name: /劍士/ }).click();
    await expect(pageA.getByText("劍士（已選）")).toBeVisible();
    await pageB.getByRole("button", { name: /弓箭手/ }).click();
    await expect(pageB.getByText("弓箭手（已選）")).toBeVisible();

    await pageA.getByRole("button", { name: "標記 Ready" }).click();
    // start-game is idempotent and called from whichever page's own reactive
    // effect observes status===READY first (host or joiner — see room page's
    // ensureStartAndGo comment); don't assume it's pageA's network stack that
    // fires it — race both and take whichever succeeds first.
    const startResp = Promise.any([
      pageA.waitForResponse((r) => r.url().includes("/actions/start-game"), { timeout: 20_000 }),
      pageB.waitForResponse((r) => r.url().includes("/actions/start-game"), { timeout: 20_000 }),
    ]);
    await pageB.getByRole("button", { name: "標記 Ready" }).click();
    expect((await startResp).status(), "start-game 應為 2xx").toBeLessThan(300);

    await expect(pageA).toHaveURL(/\/game\//, { timeout: 12_000 });
    await expect(pageB).toHaveURL(/\/game\//, { timeout: 12_000 });

    // 根因回歸斷言：schema mismatch 修復前，duel 狀態永不設定 →
    // 以下三者（場地徽章／對局資訊面板／skill-bar）全部不會渲染，但頁面本身
    // 不報錯（靜默降級）。這裡逐一硬斷言，任何一個消失即 fail。
    await expect(pageA.getByText("🌋 火山 15×15").first()).toBeVisible({ timeout: 10_000 });
    await expect(pageA.getByText("⚔️ 真劍勝負")).toBeVisible();
    await expect(pageA.getByTestId("skill-bar")).toBeVisible();
    await expect(pageB.getByTestId("skill-bar")).toBeVisible();

    // 黑方（A，劍士）正常落子一手
    const moveResp = pageA.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().endsWith("/moves"),
    );
    await clickBoard(pageA, 7, 7, 15);
    expect((await moveResp).status(), "黑方落子應為 201").toBe(201);
    await expect(pageB.getByText("輪到白方落子")).toBeVisible({ timeout: 10_000 });

    // 白方（B，弓箭手）施放「精準狙擊」替換黑方剛落的棋子（需求 #42 #43，Q10）
    await pageB.getByRole("button", { name: /精準狙擊/ }).click();
    await expect(pageB.getByText("點擊一顆敵方棋子以替換成己方顏色")).toBeVisible();
    const skillResp = pageB.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().endsWith("/moves"),
    );
    await clickBoard(pageB, 7, 7, 15);
    expect((await skillResp).status(), "技能施放應為 201").toBe(201);
    await expect(pageA.getByText("輪到黑方落子")).toBeVisible({ timeout: 10_000 });
    await expect(pageB.getByText("1/3 已用")).toBeVisible();

    expect(errA, `A 端未捕獲例外:\n${errA.join("\n")}`).toEqual([]);
    expect(errB, `B 端未捕獲例外:\n${errB.join("\n")}`).toEqual([]);
    await ctxA.close();
    await ctxB.close();
  });
});

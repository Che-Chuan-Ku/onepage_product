#!/usr/bin/env node
/*
 * PVE 挑戰模式 smoke test（prototype/_tests/pve-smoke.mjs）
 *
 * 目的：把先前僅存在於 _module-state.yml change_log 文字敘述的「8關全通關無 console error」
 * 驗證聲明落地為可重跑、可稽核的腳本；並針對本輪修正（uiux_design 審核回饋）補上直接回歸驗證：
 *   1) pve-game 行動版觸控（無鍵盤）落子路徑：requireConfirm=true 時需按下「確認落子」鈕才會真正落子。
 *   3) BEACH 場地「漲潮」為漸進侵蝕（每次觸發侵蝕排數累加），而非固定播一次 flash。
 *   4) 關卡結算「已使用技能」需為本關「實際使用」的技能，而非通關/失敗當下的持有庫存快照
 *      （消耗型技能用完會從持有清單移除，若讀庫存快照會誤植為「未使用」）。
 *   5) pve-shop 行動版金幣/操作按鈕列固定於底部（不得破壞既有 PVP 頁面版型）。
 *
 * 執行：node prototype/_tests/pve-smoke.mjs
 * 依賴：借用 frontend/node_modules/playwright（僅 require 使用，不修改 frontend 任何檔案）。
 *       本機需已安裝 Chromium（`npx playwright install chromium`，若 frontend 已跑過 e2e 通常已存在）。
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROTOTYPE_ROOT = path.resolve(__dirname, '..'); // prototype/
const require = createRequire(import.meta.url);
const PLAYWRIGHT_PATH = path.resolve(__dirname, '../../frontend/node_modules/playwright');
const { chromium } = require(PLAYWRIGHT_PATH);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml'
};

function startServer(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath.endsWith('/')) urlPath += 'index.html';
      const filePath = path.join(root, urlPath);
      if (!filePath.startsWith(root)) { res.writeHead(403); res.end(); return; }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found: ' + urlPath); return; }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const results = [];
async function record(name, fn) {
  try {
    await fn();
    results.push({ name, pass: true });
    console.log('[PASS]', name);
  } catch (e) {
    results.push({ name, pass: false, detail: e.message });
    console.log('[FAIL]', name, '-', e.message);
  }
}

function collectConsoleErrors(page, bucket) {
  page.on('console', (msg) => { if (msg.type() === 'error') bucket.push(msg.text()); });
  page.on('pageerror', (err) => { bucket.push('pageerror: ' + err.message); });
}

async function tapCanvasCell(page, selector, r, c, N) {
  // 依 board.js 的 _xy/_hit 座標換算邏輯，計算格子中心像素座標，用 touchscreen 模擬純觸控點擊（無鍵盤）
  const box = await page.locator(selector).boundingBox();
  const pad = box.width * 0.045, gap = (box.width - 2 * pad) / (N - 1);
  const x = Math.round(box.x + pad + c * gap), y = Math.round(box.y + pad + r * gap);
  await page.touchscreen.tap(x, y);
}

async function goPveClassAndCreateRun(page, base) {
  await page.goto(`${base}/home/index.html`);
  await page.tap('button.mode-card.pve');
  await page.waitForURL('**/pve-class/index.html**');
  await page.locator('.class-card').first().tap(); // 選第一個職業（劍士，附贈橫劈）
  await page.tap('#startBtn');
  await page.waitForURL('**/pve-game/index.html**');
}

async function main() {
  const server = await startServer(PROTOTYPE_ROOT);
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();

  // ── A. 完整 8 關通關（第 1 關以真實觸控路徑落子，驗證問題1「確認落子」鈕修正） ──
  await record('A. 8關全通關（含第1關真實觸控落子）全程無 console error', async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const errors = [];
    collectConsoleErrors(page, errors);

    await goPveClassAndCreateRun(page, base);

    for (let stage = 1; stage <= 8; stage++) {
      await page.waitForSelector('#board');
      const N = await page.evaluate(() => board.N);

      if (stage === 1) {
        const initiallyDisabled = await page.evaluate(() => document.getElementById('confirmPlaceBtn').disabled);
        assert.equal(initiallyDisabled, true, '確認鈕初始應為 disabled（尚無 cursor）');

        await tapCanvasCell(page, '#board', 5, 4, N); // 中央附近空格
        await page.waitForTimeout(150);
        const nowEnabled = await page.evaluate(() => !document.getElementById('confirmPlaceBtn').disabled);
        assert.equal(nowEnabled, true, '觸控點擊空格後，確認鈕應轉為可按（cursor 已設定）');

        const movesBefore = await page.evaluate(() => enc.movesUsed);
        await page.tap('#confirmPlaceBtn');
        await page.waitForTimeout(200);
        const movesAfter = await page.evaluate(() => enc.movesUsed);
        assert.equal(movesAfter, movesBefore + 1, '按下確認鈕後應完成落子，movesUsed 應 +1（純觸控、無鍵盤路徑）');
      }

      await page.evaluate(() => window.demoBurstDamage()); // 既有捷徑：加速結束本關，仍為真實函式呼叫
      await page.waitForTimeout(1600);

      if (stage < 8) {
        await page.waitForURL('**/pve-shop/index.html**');
        await page.tap('button:has-text("跳過，前往下一關")');
        await page.waitForTimeout(700);
        await page.waitForURL('**/pve-game/index.html**');
      } else {
        await page.waitForURL('**/pve-result/index.html**');
      }
    }

    const stageReached = (await page.textContent('#stageReached')).trim();
    assert.equal(stageReached, '8/8', '應顯示 8/8 到達關數');
    assert.equal(errors.length, 0, 'console 應無 error，實際：' + JSON.stringify(errors));
    await ctx.close();
  });

  // ── B1. 漲潮漸進侵蝕（問題3）：強制第2關為 BEACH，直接呼叫 triggerWave() 兩次比對狀態累加 ──
  await record('B1. BEACH 漲潮侵蝕排數逐次累加（非單次 flash）', async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const errors = [];
    collectConsoleErrors(page, errors);

    await goPveClassAndCreateRun(page, base);
    await page.evaluate(() => window.demoBurstDamage());
    await page.waitForTimeout(1600);
    await page.waitForURL('**/pve-shop/index.html**');

    // 原本第2/5/7關場地為 50% 隨機 volcano/beach；直接以 sessionStorage 推進到第2關並注入 levelField
    // 使其決定性地落在 BEACH（不透過 shop 頁的 skip()，避免其記憶體內舊 run 物件 saveRun 時覆蓋掉本次注入）
    await page.evaluate(() => {
      const run = JSON.parse(sessionStorage.getItem('pveRun'));
      run.stage = 2;
      run.encounter = null;
      run.levelField = run.levelField || {};
      run.levelField[2] = 'beach';
      sessionStorage.setItem('pveRun', JSON.stringify(run));
    });
    await page.goto(`${base}/pve-game/index.html`);

    const fieldLabel = await page.textContent('#fieldBadge');
    assert.ok(fieldLabel.includes('沙灘'), '第2關應為強制指定的 BEACH 場地，實際：' + fieldLabel);

    const erosion0 = await page.evaluate(() => enc.erosion || 0);
    assert.equal(erosion0, 0, '初始侵蝕排數應為 0');

    await page.evaluate(() => window.triggerWave());
    await page.waitForTimeout(100);
    const erosion1 = await page.evaluate(() => enc.erosion);
    const boardErosion1 = await page.evaluate(() => board.erosion);
    assert.equal(erosion1, 1, '第一次觸發後侵蝕排數應累加為 1');
    assert.equal(boardErosion1, 1, 'board.js 內部 erosion 狀態應與 enc.erosion 同步為 1');

    await page.waitForTimeout(1500); // 等待延遲的 fx-tide 視覺標記出現（1300ms 後加上，1400ms 後移除）
    const hasFxTide = await page.evaluate(() => document.getElementById('bw').classList.contains('fx-tide'));
    assert.equal(hasFxTide, true, '漲潮視覺標記 .fx-tide 應被觸發（先前該 CSS 已定義但從未使用）');

    await page.evaluate(() => window.triggerWave());
    await page.waitForTimeout(100);
    const erosion2 = await page.evaluate(() => enc.erosion);
    assert.equal(erosion2, 2, '第二次觸發後應再累加為 2，證明為漸進侵蝕而非固定播一次');

    assert.equal(errors.length, 0, 'console 應無 error，實際：' + JSON.stringify(errors));
    await ctx.close();
  });

  // ── B2. 本關實際使用技能追蹤（問題4）：技能用罄後持有清單會清空，驗證結算仍正確記錄「有使用過」 ──
  await record('B2. 結算「已使用技能」為實際使用紀錄，非持有庫存快照', async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const errors = [];
    collectConsoleErrors(page, errors);

    await goPveClassAndCreateRun(page, base);
    const N = await page.evaluate(() => board.N);

    // 觸控放置一顆棋子，作為橫劈技能的目標
    await tapCanvasCell(page, '#board', 5, 5, N);
    await page.waitForTimeout(150);
    await page.tap('#confirmPlaceBtn');
    await page.waitForTimeout(200);

    const skillsBefore = await page.evaluate(() => JSON.parse(JSON.stringify(run.skills)));
    assert.deepEqual(skillsBefore.map(s => s.id), ['horizontal'], '劍士初始應持有 1 個橫劈（起始技能）');

    // 觸控觸發技能：點技能鈕進入選取模式，再點擊剛放置的棋子指定列（handleStoneClick → applyLineSkill → consumeSkill）
    // 技能列在桌面版(#skillBar)與行動版抽屜(#skillBarMobile)各渲染一份，此處明確指定行動版抽屜避免重複匹配
    await page.tap('#skillBarMobile button:has-text("橫劈")');
    await page.waitForTimeout(100);
    await tapCanvasCell(page, '#board', 5, 5, N);
    await page.waitForTimeout(200);

    const usedSkills = await page.evaluate(() => enc.usedSkills);
    const skillsAfter = await page.evaluate(() => run.skills);
    assert.deepEqual(usedSkills, ['橫劈'], '本關應記錄「橫劈」為實際使用過的技能');
    assert.deepEqual(skillsAfter, [], '起始技能僅1個，用罄後應從持有清單移除（凸顯：庫存快照法會誤判為未使用）');

    // 直接觸發關卡失敗（呼叫既有全域函式，模擬手數用盡），驗證結算資料使用 enc.usedSkills 而非（已清空的）run.skills
    await page.evaluate(() => window.onLevelFail());
    await page.waitForTimeout(1700);
    await page.waitForURL('**/pve-result/index.html**');

    const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('pveResult')));
    assert.deepEqual(stored.usedSkillsSnapshot, ['橫劈'], 'pveResult.usedSkillsSnapshot 應正確反映本關實際使用過橫劈');
    assert.deepEqual(stored.skills, [], '持有技能庫存本身確實已清空（驗證舊邏輯讀庫存會誤判為「無使用」）');

    const domText = (await page.textContent('#encSkillsUsedCount')).trim();
    assert.equal(domText, '橫劈', '結算頁「已使用技能」欄位應顯示橫劈，而非「無」');

    assert.equal(errors.length, 0, 'console 應無 error，實際：' + JSON.stringify(errors));
    await ctx.close();
  });

  // ── B3. pve-shop 行動版金幣/按鈕列固定底部（問題5），並確認桌面版不受影響 ──
  await record('B3. pve-shop 行動版 .shop-actionbar 固定底部；桌面版維持正常流式版面', async () => {
    const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const mobilePage = await mobileCtx.newPage();
    const mobileErrors = [];
    collectConsoleErrors(mobilePage, mobileErrors);
    await mobilePage.goto(`${base}/pve-shop/index.html`);
    const mobilePosition = await mobilePage.evaluate(() =>
      getComputedStyle(document.getElementById('shopActionbar')).position);
    assert.equal(mobilePosition, 'fixed', '行動版寬度下 .shop-actionbar 應為 fixed 固定底部');
    assert.equal(mobileErrors.length, 0, '行動版 console 應無 error，實際：' + JSON.stringify(mobileErrors));
    await mobileCtx.close();

    const desktopCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const desktopPage = await desktopCtx.newPage();
    const desktopErrors = [];
    collectConsoleErrors(desktopPage, desktopErrors);
    await desktopPage.goto(`${base}/pve-shop/index.html`);
    const desktopPosition = await desktopPage.evaluate(() =>
      getComputedStyle(document.getElementById('shopActionbar')).position);
    assert.notEqual(desktopPosition, 'fixed', '桌面版寬度下 .shop-actionbar 不應為 fixed（維持原流式版面）');
    assert.equal(desktopErrors.length, 0, '桌面版 console 應無 error，實際：' + JSON.stringify(desktopErrors));
    await desktopCtx.close();
  });

  // ── B4. 迴歸防護：theme.css 為純新增，既有 PVP 頁面（home / game）不受影響 ──
  await record('B4. theme.css 純新增不影響既有 PVP 頁面（home / game 無 console error）', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    collectConsoleErrors(page, errors);
    await page.goto(`${base}/home/index.html`);
    await page.goto(`${base}/game/index.html?mode=local`);
    await page.waitForTimeout(300);
    assert.equal(errors.length, 0, 'PVP 頁面 console 應無 error，實際：' + JSON.stringify(errors));
    await ctx.close();
  });

  await browser.close();
  server.close();

  const failed = results.filter(r => !r.pass);
  console.log('\n=== PVE smoke test summary ===');
  results.forEach(r => console.log((r.pass ? 'PASS' : 'FAIL') + ' - ' + r.name + (r.detail ? ' :: ' + r.detail : '')));
  console.log(`${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });

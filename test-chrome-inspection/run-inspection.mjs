/**
 * Chrome 全頁面巡檢腳本 — aibdd-chrome-page-test
 * L1 UI 渲染 + L2 Network/Console 監控 + L3 資料正確性比對
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3001';
const API_BASE = 'http://localhost:8080/api/v1';
const EMAIL = process.argv[2] || 'kksjkdkk9933@gmail.com';
const PASSWORD = process.argv[3] || 'kksjdd9999';
const SCREENSHOT_DIR = path.join(import.meta.dirname, 'screenshots');

// ── Test Plan ──
const PAGES = [
  // Admin pages
  { path: '/admin/login', name: 'admin-login', type: 'admin', needsAuth: false, expectedApi: [] },
  { path: '/admin/websites', name: 'admin-websites', type: 'admin', needsAuth: true, expectedApi: ['/websites'] },
  { path: '/admin/products', name: 'admin-products', type: 'admin', needsAuth: true, expectedApi: ['/products'] },
  { path: '/admin/categories', name: 'admin-categories', type: 'admin', needsAuth: true, expectedApi: ['/product-categories'] },
  { path: '/admin/orders', name: 'admin-orders', type: 'admin', needsAuth: true, expectedApi: ['/orders'] },
  { path: '/admin/invoices', name: 'admin-invoices', type: 'admin', needsAuth: true, expectedApi: ['/invoices'] },
  { path: '/admin/inventory', name: 'admin-inventory', type: 'admin', needsAuth: true, expectedApi: ['/inventory'] },
  { path: '/admin/users', name: 'admin-users', type: 'admin', needsAuth: true, expectedApi: ['/users'] },
  { path: '/admin/email-templates', name: 'admin-email-templates', type: 'admin', needsAuth: true, expectedApi: ['/email-templates'] },
  { path: '/admin/websites/1/products', name: 'admin-website-products', type: 'admin', needsAuth: true, expectedApi: ['/websites/1/products', '/products'] },
  // Storefront pages
  { path: '/project/1', name: 'storefront-home', type: 'storefront', needsAuth: false, expectedApi: ['/storefront/websites/1'] },
  { path: '/project/1/cart', name: 'storefront-cart', type: 'storefront', needsAuth: false, expectedApi: [] },
];

const results = [];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });

  // ── Phase 0: Login ──
  console.log('\n=== Phase 0: Authentication ===');
  const loginPage = await context.newPage();
  await loginPage.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' });
  await loginPage.fill('input[type="email"]', EMAIL);
  await loginPage.fill('input[type="password"]', PASSWORD);
  await loginPage.click('button[type="submit"]');
  try {
    await loginPage.waitForURL('**/admin/websites', { timeout: 10000 });
    console.log('[OK] Login successful');
  } catch {
    console.error('[FAIL] Login failed');
    await browser.close();
    process.exit(1);
  }

  // Save auth state
  const storageState = await context.storageState();
  await loginPage.close();

  // ── Phase 2: Test each page ──
  console.log('\n=== Phase 2: Page-by-page inspection ===\n');

  for (const pageInfo of PAGES) {
    const pageResult = {
      page: pageInfo.path,
      name: pageInfo.name,
      status: 'PASS',
      l1_rendering: { passed: true, details: '' },
      l2_network: { passed: true, api_errors: [], console_errors: [] },
      l3_data: { passed: true, checks: [] },
      duration_ms: 0,
      screenshot: '',
    };

    const startTime = Date.now();
    const page = await context.newPage();

    // ── Step 1: Start monitoring ──
    const networkErrors = [];
    const consoleErrors = [];

    page.on('response', async (res) => {
      const url = res.url();
      if (url.includes('/api/') && res.status() >= 400) {
        let body = '';
        try { body = await res.text(); } catch {}
        networkErrors.push({ url, status: res.status(), body: body.substring(0, 300) });
      }
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Skip React dev warnings that aren't real errors
        if (!text.includes('Warning:') && !text.includes('Download the React DevTools')) {
          consoleErrors.push(text.substring(0, 300));
        }
      }
    });

    page.on('pageerror', (err) => {
      consoleErrors.push('PAGE_ERROR: ' + err.message.substring(0, 300));
    });

    // ── Step 2: Navigate + wait ──
    try {
      await page.goto(`${BASE}${pageInfo.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000); // extra settle time
    } catch (e) {
      pageResult.status = 'FAIL';
      pageResult.l1_rendering = { passed: false, details: 'Navigation timeout: ' + e.message };
      results.push(pageResult);
      console.log(`[FAIL] ${pageInfo.path} — Navigation timeout`);
      await page.close();
      continue;
    }

    // ── Step 3: L1 UI Rendering ──
    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
    const title = await page.title().catch(() => '');
    const is404 = bodyText.includes('404') && bodyText.includes('could not be found');
    const is500 = bodyText.includes('500') && bodyText.includes('Internal Server Error');
    const isEmpty = bodyText.trim().length === 0;

    if (isEmpty) {
      pageResult.l1_rendering = { passed: false, details: 'Page is blank (empty body)' };
      pageResult.status = 'FAIL';
    } else if (is404) {
      pageResult.l1_rendering = { passed: false, details: 'Page shows 404 error' };
      pageResult.status = 'FAIL';
    } else if (is500) {
      pageResult.l1_rendering = { passed: false, details: 'Page shows 500 error' };
      pageResult.status = 'FAIL';
    }

    // Screenshot
    const ssPath = path.join(SCREENSHOT_DIR, `${pageInfo.name}.png`);
    await page.screenshot({ path: ssPath, fullPage: true }).catch(() => {});
    pageResult.screenshot = `screenshots/${pageInfo.name}.png`;

    // ── Step 4: L2 Network/Console errors ──
    if (networkErrors.length > 0) {
      pageResult.l2_network.passed = false;
      pageResult.l2_network.api_errors = networkErrors.map(e => ({
        url: e.url.replace(BASE, ''),
        status: e.status,
        body: e.body,
      }));
      // 5xx = FAIL, 4xx with expected context = WARN
      if (networkErrors.some(e => e.status >= 500)) {
        pageResult.status = 'FAIL';
      } else if (pageResult.status === 'PASS') {
        pageResult.status = 'WARN';
      }
    }

    if (consoleErrors.length > 0) {
      pageResult.l2_network.console_errors = consoleErrors;
      if (consoleErrors.some(e => e.includes('PAGE_ERROR'))) {
        pageResult.status = 'FAIL';
      }
    }

    // ── Step 5: L3 Data correctness ──
    if (pageInfo.needsAuth && pageInfo.expectedApi.length > 0 && pageResult.l1_rendering.passed) {
      // Get token from storage state
      const localStorage = storageState.origins?.[0]?.localStorage || [];
      const authEntry = localStorage.find(e => e.name === 'auth-storage');
      let token = '';
      if (authEntry) {
        try {
          const parsed = JSON.parse(authEntry.value);
          token = parsed?.state?.accessToken || '';
        } catch {}
      }

      if (token) {
        for (const apiPath of pageInfo.expectedApi) {
          try {
            const apiRes = await fetch(`${API_BASE}${apiPath}`, {
              headers: { 'Authorization': `Bearer ${token}` },
            });
            if (apiRes.ok) {
              const data = await apiRes.json();
              const apiCount = Array.isArray(data) ? data.length :
                              data.content ? data.content.length : 1;

              // Count matching elements on page (table rows or cards)
              const pageCount = await page.evaluate(() => {
                const rows = document.querySelectorAll('table tbody tr');
                if (rows.length > 0) return rows.length;
                const cards = document.querySelectorAll('[class*=card], [class*=Card]');
                if (cards.length > 0) return cards.length;
                return -1; // can't determine
              });

              const check = {
                api: apiPath,
                apiCount,
                pageCount,
                match: pageCount === -1 ? 'N/A' : pageCount === apiCount,
              };
              pageResult.l3_data.checks.push(check);

              if (pageCount !== -1 && pageCount !== apiCount) {
                pageResult.l3_data.passed = false;
                if (pageResult.status === 'PASS') pageResult.status = 'WARN';
              }
            }
          } catch {}
        }
      }
    }

    pageResult.duration_ms = Date.now() - startTime;

    // Log result
    const icon = pageResult.status === 'PASS' ? '[PASS]' :
                 pageResult.status === 'WARN' ? '[WARN]' : '[FAIL]';
    const netInfo = networkErrors.length > 0
      ? ` | ${networkErrors.length} API error(s): ${networkErrors.map(e => e.status + ' ' + e.url.split('/api/v1')[1]).join(', ')}`
      : '';
    const consInfo = consoleErrors.length > 0
      ? ` | ${consoleErrors.length} console error(s)`
      : '';
    console.log(`${icon} ${pageInfo.path} (${pageResult.duration_ms}ms)${netInfo}${consInfo}`);

    results.push(pageResult);
    await page.close();
  }

  await browser.close();

  // ── Phase 4: Generate reports ──
  console.log('\n=== Phase 4: Generating reports ===');

  const summary = {
    total: results.length,
    pass: results.filter(r => r.status === 'PASS').length,
    fail: results.filter(r => r.status === 'FAIL').length,
    warn: results.filter(r => r.status === 'WARN').length,
  };

  // JSON report
  const jsonReport = {
    timestamp: new Date().toISOString(),
    summary,
    pages: results,
  };
  const jsonPath = path.join(import.meta.dirname, 'test-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));

  // Markdown report
  let md = `# Chrome 全頁面巡檢報告\n\n`;
  md += `**執行時間：** ${new Date().toLocaleString('zh-TW')}\n`;
  md += `**測試頁面：** ${summary.total} 頁\n`;
  md += `**結果：** ${summary.pass} PASS / ${summary.fail} FAIL / ${summary.warn} WARN\n\n`;
  md += `## 結果總覽\n\n`;
  md += `| # | 頁面 | 狀態 | Network | Console | 資料比對 | 耗時 |\n`;
  md += `|---|------|------|---------|---------|----------|------|\n`;
  results.forEach((r, i) => {
    const status = r.status === 'PASS' ? 'PASS' : r.status === 'WARN' ? 'WARN' : 'FAIL';
    const net = r.l2_network.api_errors.length > 0 ? `${r.l2_network.api_errors.length} err` : '0';
    const con = r.l2_network.console_errors.length > 0 ? `${r.l2_network.console_errors.length} err` : '0';
    const data = r.l3_data.checks.length > 0
      ? r.l3_data.checks.map(c => c.match === 'N/A' ? 'N/A' : c.match ? 'match' : 'MISMATCH').join(',')
      : '-';
    md += `| ${i + 1} | ${r.page} | ${status} | ${net} | ${con} | ${data} | ${r.duration_ms}ms |\n`;
  });

  // Failure details
  const failures = results.filter(r => r.status !== 'PASS');
  if (failures.length > 0) {
    md += `\n## 問題詳情\n\n`;
    for (const f of failures) {
      md += `### ${f.status} ${f.page}\n\n`;
      if (!f.l1_rendering.passed) md += `**渲染問題：** ${f.l1_rendering.details}\n\n`;
      if (f.l2_network.api_errors.length > 0) {
        md += `**Network 錯誤：**\n`;
        for (const e of f.l2_network.api_errors) {
          md += `- \`${e.url}\` → ${e.status} ${e.body}\n`;
        }
        md += '\n';
      }
      if (f.l2_network.console_errors.length > 0) {
        md += `**Console 錯誤：**\n`;
        for (const e of f.l2_network.console_errors) {
          md += `- ${e.substring(0, 200)}\n`;
        }
        md += '\n';
      }
      if (!f.l3_data.passed) {
        md += `**資料比對問題：**\n`;
        for (const c of f.l3_data.checks) {
          if (c.match === false) md += `- ${c.api}: API=${c.apiCount}, Page=${c.pageCount}\n`;
        }
        md += '\n';
      }
    }
  }

  const mdPath = path.join(import.meta.dirname, 'test-report.md');
  fs.writeFileSync(mdPath, md);

  console.log(`\n[OK] Reports generated:`);
  console.log(`  - ${mdPath}`);
  console.log(`  - ${jsonPath}`);
  console.log(`\n=== Summary: ${summary.pass} PASS / ${summary.fail} FAIL / ${summary.warn} WARN ===\n`);
}

run().catch(e => {
  console.error('[FATAL]', e);
  process.exit(1);
});

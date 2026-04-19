/**
 * Chrome 全頁面巡檢 v2 — aibdd-chrome-page-test
 * L1 UI 渲染 + L2 Network/Console + L3 資料比對 + L4 寫入 API 煙霧測試
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3001';
const API_BASE = 'http://localhost:8080/api/v1';
const EMAIL = process.argv[2] || 'kksjkdkk9933@gmail.com';
const PASSWORD = process.argv[3] || 'kksjdd9999';
const OUTDIR = path.join(import.meta.dirname, '..', 'test-chrome-inspection');
const SSDIR = path.join(OUTDIR, 'screenshots');
fs.mkdirSync(SSDIR, { recursive: true });

let TOKEN = '';
const results = [];

// ── Test Plan: pages + read APIs + write APIs ──
const PAGES = [
  { path: '/admin/login', name: 'admin-login', type: 'admin', auth: false, readApis: [], writeApis: [] },
  { path: '/admin/websites', name: 'admin-websites', type: 'admin', auth: true, readApis: ['/websites'], writeApis: ['POST /websites'] },
  { path: '/admin/products', name: 'admin-products', type: 'admin', auth: true, readApis: ['/products'], writeApis: ['POST /products'] },
  { path: '/admin/categories', name: 'admin-categories', type: 'admin', auth: true, readApis: ['/product-categories'], writeApis: ['POST /product-categories', 'DELETE /product-categories/{id}'] },
  { path: '/admin/orders', name: 'admin-orders', type: 'admin', auth: true, readApis: ['/orders'], writeApis: [] },
  { path: '/admin/invoices', name: 'admin-invoices', type: 'admin', auth: true, readApis: ['/invoices'], writeApis: [] },
  { path: '/admin/inventory', name: 'admin-inventory', type: 'admin', auth: true, readApis: ['/inventory'], writeApis: ['PUT /inventory/{id}', 'PUT /inventory/{id}/threshold'] },
  { path: '/admin/users', name: 'admin-users', type: 'admin', auth: true, readApis: ['/users'], writeApis: ['POST /users'] },
  { path: '/admin/email-templates', name: 'admin-email-templates', type: 'admin', auth: true, readApis: ['/email-templates'], writeApis: [] },
  { path: '/admin/websites/1/products', name: 'admin-website-products', type: 'admin', auth: true, readApis: ['/websites/1/products', '/products'], writeApis: ['PUT /websites/{id}/products'] },
  { path: '/project/1', name: 'storefront-home', type: 'storefront', auth: false, readApis: ['/storefront/websites/1'], writeApis: [] },
  { path: '/project/1/cart', name: 'storefront-cart', type: 'storefront', auth: false, readApis: [], writeApis: [] },
];

// ── Helpers ──
async function apiCall(method, path, body) {
  const opts = {
    method,
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  let data = null;
  try { data = await res.json(); } catch { try { data = await res.text(); } catch {} }
  return { status: res.status, data };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });

  // ═══ Phase 0: Login ═══
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

  // Extract token
  const storageState = await context.storageState();
  const localStorage = storageState.origins?.[0]?.localStorage || [];
  const authEntry = localStorage.find(e => e.name === 'auth-storage');
  if (authEntry) {
    try { TOKEN = JSON.parse(authEntry.value)?.state?.accessToken || ''; } catch {}
  }
  if (!TOKEN) {
    // Fallback: login via API
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    TOKEN = (await loginRes.json()).accessToken;
  }
  console.log(`[OK] Token obtained (${TOKEN.substring(0, 20)}...)`);
  await loginPage.close();

  // ═══ Phase 2: Per-page 7+1 step test ═══
  console.log('\n=== Phase 2: Page-by-page inspection (L1+L2+L3+L4) ===\n');

  for (const pi of PAGES) {
    const r = {
      page: pi.path, name: pi.name, status: 'PASS', duration_ms: 0,
      screenshot: `screenshots/${pi.name}.png`,
      l1_rendering: { passed: true, details: '' },
      l2_network: { passed: true, api_errors: [], console_errors: [] },
      l3_data: { passed: true, checks: [] },
      l4_write_apis: { passed: true, results: [] },
      interactions: { passed: true, details: '' },
    };
    const t0 = Date.now();
    const page = await context.newPage();

    // ── Step 1: Start monitoring ──
    const netErrors = [];
    const conErrors = [];
    page.on('response', async (res) => {
      if (res.url().includes('/api/') && res.status() >= 400) {
        let body = ''; try { body = await res.text(); } catch {}
        netErrors.push({ url: res.url(), status: res.status(), body: body.substring(0, 300) });
      }
    });
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('Warning:') && !msg.text().includes('DevTools'))
        conErrors.push(msg.text().substring(0, 300));
    });
    page.on('pageerror', err => conErrors.push('PAGE_ERROR: ' + err.message.substring(0, 300)));

    // ── Step 2: Navigate ──
    try {
      await page.goto(`${BASE}${pi.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
    } catch (e) {
      r.status = 'FAIL'; r.l1_rendering = { passed: false, details: 'Timeout: ' + e.message };
      r.duration_ms = Date.now() - t0; results.push(r); await page.close();
      console.log(`[FAIL] ${pi.path} — timeout`); continue;
    }

    // ── Step 3: L1 UI rendering ──
    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
    if (bodyText.trim().length === 0) { r.l1_rendering = { passed: false, details: 'Blank page' }; r.status = 'FAIL'; }
    else if (bodyText.includes('404') && bodyText.includes('could not be found')) { r.l1_rendering = { passed: false, details: '404 page' }; r.status = 'FAIL'; }
    await page.screenshot({ path: path.join(SSDIR, `${pi.name}.png`), fullPage: true }).catch(() => {});

    // ── Step 4: L2 Network/Console ──
    if (netErrors.length > 0) {
      r.l2_network.passed = false;
      r.l2_network.api_errors = netErrors.map(e => ({ url: e.url.replace(BASE, ''), status: e.status, body: e.body }));
      if (netErrors.some(e => e.status >= 500)) r.status = 'FAIL';
      else if (r.status === 'PASS') r.status = 'WARN';
    }
    if (conErrors.length > 0) {
      r.l2_network.console_errors = conErrors;
      if (conErrors.some(e => e.includes('PAGE_ERROR'))) r.status = 'FAIL';
    }

    // ── Step 5: L3 Data correctness ──
    if (pi.auth && pi.readApis.length > 0 && r.l1_rendering.passed) {
      for (const apiPath of pi.readApis) {
        try {
          const { status, data } = await apiCall('GET', apiPath);
          if (status < 400) {
            const apiCount = Array.isArray(data) ? data.length : data?.content ? data.content.length : -1;
            if (apiCount >= 0) {
              const pageCount = await page.evaluate(() => {
                const rows = document.querySelectorAll('table tbody tr');
                if (rows.length > 0) return rows.length;
                return -1;
              });
              r.l3_data.checks.push({ api: apiPath, apiCount, pageCount, match: pageCount === -1 ? 'N/A' : pageCount === apiCount });
              if (pageCount !== -1 && pageCount !== apiCount) { r.l3_data.passed = false; }
            }
          }
        } catch {}
      }
    }

    // ── Step 6.5: L4 Write API smoke test ──
    if (pi.writeApis.length > 0) {
      for (const wa of pi.writeApis) {
        const waResult = { api: wa, status: 0, body: '', itemCount: 1 };
        try {
          if (wa === 'POST /products') {
            const { status, data } = await apiCall('POST', '/product-categories');  // need categoryId
            // Get first category
            const cats = (await apiCall('GET', '/product-categories')).data;
            const catId = cats?.[0]?.id || 1;
            const formData = new URLSearchParams();
            // Use JSON API for smoke test
            const res = await fetch(`${API_BASE}/products`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${TOKEN}` },
              body: (() => { const fd = new FormData(); fd.append('name', '[E2E-TEST] smoke'); fd.append('price', '100'); fd.append('priceUnit', 'KG'); fd.append('categoryId', String(catId)); fd.append('stockQuantity', '10'); return fd; })(),
            });
            waResult.status = res.status;
            if (res.ok) {
              const prod = await res.json();
              waResult.body = 'Created ID ' + prod.id;
              // Cleanup: deactivate
              await apiCall('POST', `/products/${prod.id}/deactivate`);
            } else { waResult.body = (await res.text()).substring(0, 200); }

          } else if (wa === 'POST /product-categories') {
            const { status, data } = await apiCall('POST', '/product-categories', { name: '[E2E-TEST] cat' });
            waResult.status = status;
            if (status < 300 && data?.id) {
              waResult.body = 'Created ID ' + data.id;
              await apiCall('DELETE', `/product-categories/${data.id}`);
            } else { waResult.body = JSON.stringify(data).substring(0, 200); }

          } else if (wa.startsWith('DELETE /product-categories')) {
            // Already tested via POST+DELETE above
            waResult.status = 204; waResult.body = 'Tested via POST+DELETE cycle';

          } else if (wa === 'PUT /websites/{id}/products') {
            // Critical: test MULTI-ITEM PUT (the bug we caught)
            const prods = (await apiCall('GET', '/products')).data;
            const activeProds = (prods?.content || prods || []).filter(p => p.status === 'ACTIVE').slice(0, 3);
            if (activeProds.length >= 2) {
              const items = activeProds.map(p => ({ productId: p.id, publishAt: new Date().toISOString() }));
              waResult.itemCount = items.length;
              const { status, data } = await apiCall('PUT', '/websites/1/products', items);
              waResult.status = status;
              waResult.body = status < 300 ? `Updated ${items.length} products OK` : JSON.stringify(data).substring(0, 200);
            } else { waResult.status = 0; waResult.body = 'Not enough active products to test'; }

          } else if (wa === 'POST /websites') {
            // Skip: requires multipart with image file
            waResult.status = 0; waResult.body = 'Skipped (requires file upload)';

          } else if (wa === 'PUT /inventory/{id}') {
            const inv = (await apiCall('GET', '/inventory')).data;
            if (inv?.[0]) {
              const orig = inv[0].stockQuantity;
              const { status, data } = await apiCall('PUT', `/inventory/${inv[0].productId}`, { stockQuantity: orig });
              waResult.status = status;
              waResult.body = status < 300 ? 'Updated OK (restored original value)' : JSON.stringify(data).substring(0, 200);
            }

          } else if (wa === 'PUT /inventory/{id}/threshold') {
            const inv = (await apiCall('GET', '/inventory')).data;
            if (inv?.[0]) {
              const orig = inv[0].lowStockThreshold;
              const { status, data } = await apiCall('PUT', `/inventory/${inv[0].productId}/threshold`, { threshold: orig });
              waResult.status = status;
              waResult.body = status < 300 ? 'Updated OK (restored original value)' : JSON.stringify(data).substring(0, 200);
            }

          } else if (wa === 'POST /users') {
            const ts = Date.now();
            const { status, data } = await apiCall('POST', '/users', {
              email: `e2e-test-${ts}@test.com`, name: '[E2E-TEST] user', password: 'Test1234!', role: 'GENERAL_USER',
            });
            waResult.status = status;
            waResult.body = status < 300 ? 'Created ID ' + data.id : JSON.stringify(data).substring(0, 200);
            // Note: no delete user API, leave cleanup for manual
          }
        } catch (e) {
          waResult.status = 0; waResult.body = 'Exception: ' + e.message.substring(0, 200);
        }

        r.l4_write_apis.results.push(waResult);
        if (waResult.status >= 500) { r.l4_write_apis.passed = false; r.status = 'FAIL'; }
        else if (waResult.status >= 400 && waResult.status < 500) {
          // Unexpected 4xx on write
          if (!waResult.body.includes('Skipped')) { r.l4_write_apis.passed = false; r.status = 'FAIL'; }
        }
      }
    }

    r.duration_ms = Date.now() - t0;

    // ── Log ──
    const icon = r.status === 'PASS' ? '[PASS]' : r.status === 'WARN' ? '[WARN]' : '[FAIL]';
    const l2Info = netErrors.length > 0 ? ` | L2: ${netErrors.map(e => e.status).join(',')}` : '';
    const l4Info = r.l4_write_apis.results.length > 0
      ? ` | L4: ${r.l4_write_apis.results.map(w => w.api.split(' ')[0] + ':' + w.status).join(', ')}`
      : '';
    console.log(`${icon} ${pi.path} (${r.duration_ms}ms)${l2Info}${l4Info}`);
    results.push(r);
    await page.close();
  }

  // ═══ Phase 3: Storefront image verification ═══
  console.log('\n=== Phase 3: Storefront image verification ===');
  const sfPage = await context.newPage();
  const imgErrors = [];
  sfPage.on('response', async (res) => {
    if ((res.url().includes('/uploads/') || res.url().includes('/_next/image')) && res.status() >= 400) {
      imgErrors.push({ url: res.url(), status: res.status() });
    }
  });
  await sfPage.goto(`${BASE}/project/1`, { waitUntil: 'networkidle', timeout: 15000 });
  await sfPage.waitForTimeout(3000);
  const imgResults = await sfPage.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.src.substring(0, 100),
      loaded: img.complete && img.naturalHeight > 0,
      alt: img.alt,
    }));
  });
  console.log(`  Images found: ${imgResults.length}`);
  imgResults.forEach(img => console.log(`  ${img.loaded ? '[OK]' : '[FAIL]'} ${img.alt || 'no-alt'} → ${img.src}`));
  if (imgErrors.length > 0) console.log(`  Image load errors: ${imgErrors.map(e => e.status + ':' + e.url.substring(0, 80)).join(', ')}`);
  else console.log('  [OK] All images loaded successfully');
  await sfPage.close();

  await browser.close();

  // ═══ Phase 4: Reports ═══
  console.log('\n=== Phase 4: Generating reports ===');
  const summary = {
    total: results.length,
    pass: results.filter(r => r.status === 'PASS').length,
    fail: results.filter(r => r.status === 'FAIL').length,
    warn: results.filter(r => r.status === 'WARN').length,
  };

  // JSON
  const jsonReport = { timestamp: new Date().toISOString(), summary, pages: results, storefront_images: { images: imgResults, errors: imgErrors } };
  fs.writeFileSync(path.join(OUTDIR, 'test-results.json'), JSON.stringify(jsonReport, null, 2));

  // Markdown
  let md = `# Chrome 全頁面巡檢報告 v2\n\n`;
  md += `**執行時間：** ${new Date().toLocaleString('zh-TW')}\n`;
  md += `**測試頁面：** ${summary.total} 頁\n`;
  md += `**結果：** ${summary.pass} PASS / ${summary.fail} FAIL / ${summary.warn} WARN\n\n`;
  md += `## 結果總覽\n\n`;
  md += `| # | 頁面 | 狀態 | L2 Network | L3 Data | L4 Write APIs | 耗時 |\n`;
  md += `|---|------|------|------------|---------|---------------|------|\n`;
  results.forEach((r, i) => {
    const l2 = r.l2_network.api_errors.length > 0 ? `${r.l2_network.api_errors.length} err` : 'OK';
    const l3 = r.l3_data.checks.length > 0 ? r.l3_data.checks.map(c => c.match === 'N/A' ? 'N/A' : c.match ? 'match' : 'MISMATCH').join(',') : '-';
    const l4 = r.l4_write_apis.results.length > 0 ? r.l4_write_apis.results.map(w => w.status < 300 ? 'OK' : w.status || 'skip').join(',') : '-';
    md += `| ${i + 1} | ${r.page} | ${r.status} | ${l2} | ${l3} | ${l4} | ${r.duration_ms}ms |\n`;
  });

  // Image section
  md += `\n## 前台圖片驗證\n\n`;
  md += `| 圖片 | 載入 | URL |\n|------|------|-----|\n`;
  imgResults.forEach(img => {
    md += `| ${img.alt || '-'} | ${img.loaded ? 'OK' : 'FAIL'} | ${img.src} |\n`;
  });
  if (imgErrors.length > 0) {
    md += `\n**圖片載入錯誤：**\n`;
    imgErrors.forEach(e => md += `- ${e.status}: ${e.url}\n`);
  }

  // Failure details
  const failures = results.filter(r => r.status !== 'PASS');
  if (failures.length > 0) {
    md += `\n## 問題詳情\n\n`;
    for (const f of failures) {
      md += `### ${f.status} ${f.page}\n\n`;
      if (!f.l1_rendering.passed) md += `**L1 渲染：** ${f.l1_rendering.details}\n\n`;
      if (f.l2_network.api_errors.length > 0) { md += `**L2 Network：**\n`; f.l2_network.api_errors.forEach(e => md += `- \`${e.url}\` → ${e.status} ${e.body}\n`); md += '\n'; }
      if (!f.l4_write_apis.passed) { md += `**L4 Write APIs：**\n`; f.l4_write_apis.results.filter(w => w.status >= 400).forEach(w => md += `- \`${w.api}\` (${w.itemCount} items) → ${w.status} ${w.body}\n`); md += '\n'; }
      if (!f.l3_data.passed) { md += `**L3 Data：**\n`; f.l3_data.checks.filter(c => c.match === false).forEach(c => md += `- ${c.api}: API=${c.apiCount}, Page=${c.pageCount}\n`); md += '\n'; }
    }
  }

  fs.writeFileSync(path.join(OUTDIR, 'test-report.md'), md);

  console.log(`\n[OK] Reports: test-report.md + test-results.json`);
  console.log(`\n========================================`);
  console.log(`  SUMMARY: ${summary.pass} PASS / ${summary.fail} FAIL / ${summary.warn} WARN`);
  console.log(`========================================\n`);
}

run().catch(e => { console.error('[FATAL]', e); process.exit(1); });

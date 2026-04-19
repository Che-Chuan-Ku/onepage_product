# Chrome 全頁面巡檢報告 v2

**執行時間：** 2026/4/19 下午12:00:51
**測試頁面：** 12 頁
**結果：** 12 PASS / 0 FAIL / 0 WARN

## 結果總覽

| # | 頁面 | 狀態 | L2 Network | L3 Data | L4 Write APIs | 耗時 |
|---|------|------|------------|---------|---------------|------|
| 1 | /admin/login | PASS | OK | - | - | 3134ms |
| 2 | /admin/websites | PASS | OK | N/A | OK | 3077ms |
| 3 | /admin/products | PASS | OK | match | OK | 3244ms |
| 4 | /admin/categories | PASS | OK | N/A | OK,OK | 3079ms |
| 5 | /admin/orders | PASS | OK | match | - | 3122ms |
| 6 | /admin/invoices | PASS | OK | N/A | - | 3040ms |
| 7 | /admin/inventory | PASS | OK | match | OK,OK | 3029ms |
| 8 | /admin/users | PASS | OK | match | OK | 3089ms |
| 9 | /admin/email-templates | PASS | OK | N/A | - | 2999ms |
| 10 | /admin/websites/1/products | PASS | OK | MISMATCH,MISMATCH | OK | 3191ms |
| 11 | /project/1 | PASS | OK | - | - | 3211ms |
| 12 | /project/1/cart | PASS | OK | - | - | 2775ms |

## 前台圖片驗證

| 圖片 | 載入 | URL |
|------|------|-----|
| 測試商店 banner | OK | http://localhost:3001/_next/image?url=http%3A%2F%2Flocalhost%3A8080%2Fapi%2Fv1%2Fuploads%2Fproducts% |
| 宣傳圖 | OK | http://localhost:3001/_next/image?url=http%3A%2F%2Flocalhost%3A8080%2Fapi%2Fv1%2Fuploads%2Fproducts% |

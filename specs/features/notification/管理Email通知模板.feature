@ignore @command
Feature: 管理Email通知模板

  Background:
    Given 管理員已登入後台

  Rule: 前置（狀態）- 僅管理員可操作 Email 通知模板管理
  Rule: 前置（參數）- 系統預設四種通知模板：下單確認通知、付款成功通知、付款失敗通知、發貨通知
  Rule: 前置（參數）- 每種模板可自訂標題與內文（HTML 模板，結構固定）
  Rule: 後置（狀態）- 模板修改後即時生效，下次觸發通知時使用新模板
  Rule: 約束 - 模板僅支援編輯，不支援新增或刪除（模板類型固定）
  Rule: 約束 - 內文支援預設變數替換（如：訂單編號、顧客姓名、商品明細、出貨資訊）
  Rule: 後置（回應）- 可用變數以表格或列表方式清楚呈現，含中文說明（REQ-032）
  Rule: 前置（參數）- 可用變數包含：{{customerName}}（顧客姓名）、{{orderNumber}}（訂單編號）、{{totalAmount}}（訂單總金額）、{{websiteName}}（網站名稱）、{{contactInfo}}（店家聯絡資訊）（REQ-032）
  Rule: 約束 - RBAC：每位使用者（店家）各自擁有一套獨立模板，互不共享（REQ-034）

  # ── DFS 路徑分析 ──
  # 正常路徑：選擇模板 → 編輯標題/內文 → 儲存 → 即時生效
  # 例外路徑：標題為空 / 內文為空 / 嘗試新增/刪除模板
  # 邊界路徑：變數替換功能驗證
  # 循環路徑：無

  # ═══ Scenario Examples ═══

  Scenario: 成功編輯通知模板
    Given 管理員已登入後台
    When 管理員選擇 "<模板類型>" 模板
    And 將標題修改為 "<新標題>"
    And 將內文修改為包含變數 "{{訂單編號}}" 的 HTML
    And 管理員儲存
    Then 模板修改成功
    And 下次觸發 "<模板類型>" 通知時使用新模板

    Examples:
      | 模板類型       | 新標題                 |
      | 下單確認通知   | 您的訂單已確認收到！   |
      | 付款成功通知   | 付款成功通知           |
      | 付款失敗通知   | 付款處理失敗通知       |
      | 發貨通知       | 您的訂單已出貨！       |

  Scenario: 模板標題為空時拒絕儲存
    Given 管理員已登入後台
    When 管理員編輯模板時將標題清空
    And 管理員儲存
    Then 系統回傳錯誤訊息「模板標題為必填」

  Scenario: 預覽模板使用範例資料填入
    Given 管理員已登入後台
    And 模板內文包含變數 "{{訂單編號}}", "{{顧客姓名}}", "{{商品明細}}"
    When 管理員點擊預覽
    Then 系統以範例資料填入變數顯示最終效果
    And 預覽內容包含範例訂單編號、顧客姓名、商品明細

  Scenario: 嘗試新增模板時系統不提供操作
    Given 管理員已登入後台
    When 管理員進入 Email 通知模板管理頁
    Then 頁面僅顯示四種固定模板
    And 無新增模板按鈕

  Scenario: 嘗試刪除模板時系統不提供操作
    Given 管理員已登入後台
    When 管理員進入 Email 通知模板管理頁
    Then 模板列表無刪除按鈕

  Scenario: 非管理員嘗試存取模板管理頁
    Given 一般使用者已登入後台
    When 嘗試存取 Email 通知模板管理頁
    Then 系統回傳 403 無權限

  # REQ-032：可用變數說明與擴充

  Scenario: 可用變數表格正確顯示且含中文說明
    Given 管理員已登入後台
    When 管理員進入 Email 通知模板管理頁並選擇任一模板
    Then 編輯區顯示可用變數說明
    And 說明以表格或列表方式呈現
    And 包含 "{{customerName}}" 說明為 "顧客姓名"
    And 包含 "{{orderNumber}}" 說明為 "訂單編號"
    And 包含 "{{totalAmount}}" 說明為 "訂單總金額"
    And 包含 "{{websiteName}}" 說明為 "網站名稱"
    And 包含 "{{contactInfo}}" 說明為 "店家聯絡資訊"

  Scenario: 模板使用 websiteName 與 contactInfo 變數正確替換
    Given 管理員已登入後台
    And 管理員所屬網站名稱為 "夏季水果季"，Footer 副標題為 "電話：0912-345-678"
    When 管理員在模板內文中使用 "{{websiteName}}" 與 "{{contactInfo}}" 變數並儲存
    And 顧客下單後系統發送 Email
    Then Email 內文中 "{{websiteName}}" 替換為 "夏季水果季"
    And "{{contactInfo}}" 替換為 "電話：0912-345-678"

  Scenario: 模板預覽顯示新增變數的替換結果
    Given 管理員已登入後台
    And 模板內文包含 "{{websiteName}}" 與 "{{contactInfo}}"
    When 管理員點擊預覽
    Then 預覽內容顯示範例網站名稱與聯絡資訊（非變數原文）

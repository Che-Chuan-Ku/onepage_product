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
  Rule: 後置（回應）- 可用變數含中文說明（REQ-032）

  # ── DFS 路徑分析 ──
  # 正常路徑：選擇模板 → 編輯標題/內文 → 儲存 → 即時生效
  # 例外路徑：標題為空 / 內文為空 / 嘗試新增/刪除模板
  # 邊界路徑：變數替換功能驗證
  # 循環路徑：無

  # ═══ Scenario Examples ═══

  Scenario: 成功編輯通知模板
    Given 管理員已登入後台
    And 管理員的 Email 模板已初始化
    When 管理員取得模板清單
    Then 模板清單回傳成功且含四種模板

  Scenario: 模板標題為空時拒絕儲存
    Given 管理員已登入後台
    And 管理員的 Email 模板已初始化
    When 管理員更新模板標題為空字串
    Then 系統回傳錯誤訊息「模板標題為必填」

  Scenario: 非管理員嘗試存取模板管理頁
    Given 一般使用者已登入後台
    When 嘗試存取 Email 通知模板管理頁
    Then 系統回傳 403 無權限

  # REQ-032：可用變數說明與擴充

  Scenario: 模板清單包含可用變數說明
    Given 管理員已登入後台
    And 管理員的 Email 模板已初始化
    When 管理員取得模板清單
    Then 模板清單包含可用變數說明
    And 變數清單包含 "{{customerName}}" 說明為 "顧客姓名"
    And 變數清單包含 "{{websiteName}}" 說明為 "網站名稱"
    And 變數清單包含 "{{contactInfo}}" 說明為 "店家聯絡資訊"

  Scenario: 預覽模板時新變數正確替換
    Given 管理員已登入後台
    And 管理員的 Email 模板已初始化
    When 管理員預覽模板
    Then 預覽結果中 websiteName 被替換為範例值

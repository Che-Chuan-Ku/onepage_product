@ignore @command
Feature: 管理使用者角色

  Background:
    Given 管理員已登入後台

  Rule: 前置（狀態）- 僅管理員可管理使用者角色
  Rule: 前置（參數）- RBAC 僅「管理員」與「一般使用者」兩種角色
  Rule: 後置（狀態）- MENU 控制：管理員看全部 MENU，一般使用者不顯示「使用者管理」選單（REQ-034）
  Rule: 約束 - 不可將最後一位管理員降級
  Rule: 後置（回應）- 權限管理頁為使用者清單表格 + 角色下拉選單
  Rule: 約束（RBAC 資料隔離）- 一般使用者登入後各功能模組只能查看並操作自己的資料（REQ-034）
  Rule: 約束（RBAC 資料隔離）- 一般使用者網站管理：只看到自己建立的網站（REQ-034）
  Rule: 約束（RBAC 資料隔離）- 一般使用者商品管理：只看到自己的商品（REQ-034）
  Rule: 約束（RBAC 資料隔離）- 一般使用者商品類型：只看到自己設定的類型（REQ-034）
  Rule: 約束（RBAC 資料隔離）- 一般使用者訂單查詢：只看到自己網站的訂單（REQ-034）
  Rule: 約束（RBAC 資料隔離）- 一般使用者 Email 模板：只能設定自己的模板（REQ-034）
  Rule: 約束（RBAC 資料隔離）- 管理員可查看所有使用者的全部資料（REQ-034）
  Rule: 約束（RBAC 資料隔離）- API 層強制 owner filter，一般使用者 API 呼叫不可取得他人資料（REQ-034）

  # ── DFS 路徑分析 ──
  # 正常路徑：變更角色（管理員→一般使用者 / 一般使用者→管理員）
  # 例外路徑：最後一位管理員降級 / 非管理員嘗試操作
  # 邊界路徑：僅剩1位管理員 / 僅剩2位管理員
  # 循環路徑：無

  # ═══ Scenario Examples ═══

  Scenario: 將一般使用者升級為管理員
    Given 管理員已登入後台
    And 系統中有一般使用者 "user@example.com"
    When 管理員將 "user@example.com" 的角色變更為「管理員」
    Then 角色變更成功
    And "user@example.com" 下次登入後可看全部 MENU

  Scenario: 將管理員降級為一般使用者
    Given 管理員已登入後台
    And 系統中有 2 位管理員
    And 其中一位為 "admin2@example.com"
    When 管理員將 "admin2@example.com" 的角色變更為「一般使用者」
    Then 角色變更成功
    And "admin2@example.com" 下次登入後僅看訂單查詢與商品查詢

  Scenario: 不可將最後一位管理員降級
    Given 管理員已登入後台
    And 系統中僅有 1 位管理員 "admin@example.com"
    When 管理員嘗試將 "admin@example.com" 的角色變更為「一般使用者」
    Then 系統回傳錯誤訊息「不可將最後一位管理員降級」
    And 角色維持為「管理員」

  Scenario: 非管理員嘗試存取使用者管理頁
    Given 一般使用者 "user@example.com" 已登入後台
    When 該使用者嘗試存取使用者管理頁
    Then 系統回傳 403 無權限

  # REQ-034：RBAC 資料隔離

  Scenario: 一般使用者不顯示使用者管理選單
    Given 一般使用者 "shop@example.com" 已登入後台
    Then MENU 不顯示「使用者管理」選項

  Scenario: 一般使用者只看到自己的網站
    Given 一般使用者 "shop1@example.com" 已登入後台
    And 系統中有 "shop1@example.com" 建立的網站 "我的水果店"
    And 系統中有 "shop2@example.com" 建立的網站 "他人水果店"
    When 一般使用者 "shop1@example.com" 查詢網站清單
    Then 清單中顯示 "我的水果店"
    And 清單中不顯示 "他人水果店"

  Scenario: 一般使用者只看到自己的商品
    Given 一般使用者 "shop1@example.com" 已登入後台
    And 系統中有 "shop1@example.com" 建立的商品 "我的芒果"
    And 系統中有 "shop2@example.com" 建立的商品 "他人芒果"
    When 一般使用者 "shop1@example.com" 查詢商品清單
    Then 清單中顯示 "我的芒果"
    And 清單中不顯示 "他人芒果"

  Scenario: 一般使用者只看到自己網站的訂單
    Given 一般使用者 "shop1@example.com" 已登入後台
    And 系統中有 "shop1@example.com" 網站的訂單 "ORD-001"
    And 系統中有 "shop2@example.com" 網站的訂單 "ORD-002"
    When 一般使用者 "shop1@example.com" 查詢訂單清單
    Then 清單中包含訂單 "ORD-001"
    And 清單中不包含訂單 "ORD-002"

  Scenario: 一般使用者 API 呼叫不可取得他人資料
    Given 一般使用者 "shop1@example.com" 已登入後台
    And 系統中有 "shop2@example.com" 建立的網站 ID 為 "site-other"
    When 一般使用者嘗試透過 API 取得網站 "site-other" 的資料
    Then API 回傳 403 無權限或 404 不存在

  Scenario: 管理員可查看所有使用者的全部資料
    Given 管理員已登入後台
    And 系統中有多位一般使用者各自建立的網站與商品
    When 管理員查詢網站清單
    Then 清單包含所有使用者建立的網站

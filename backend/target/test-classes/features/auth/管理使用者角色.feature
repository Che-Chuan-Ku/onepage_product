@ignore @command
Feature: 管理使用者角色

  Background:
    Given 管理員已登入後台

  Rule: 前置（狀態）- 僅管理員可管理使用者角色
  Rule: 前置（參數）- RBAC 僅「管理員」與「一般使用者」兩種角色
  Rule: 後置（狀態）- MENU 控制：管理員看全部 MENU，一般使用者僅看訂單查詢與商品查詢
  Rule: 約束 - 不可將最後一位管理員降級
  Rule: 後置（回應）- 權限管理頁為使用者清單表格 + 角色下拉選單

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

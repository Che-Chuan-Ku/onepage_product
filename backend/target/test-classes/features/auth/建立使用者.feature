@ignore @command
Feature: 建立使用者

  Background:
    Given 管理員已登入後台

  Rule: 前置（狀態）- 僅管理員可建立使用者（REQ-033）
  Rule: 前置（參數）- Email 為必填，且系統內唯一
  Rule: 前置（參數）- 姓名為必填
  Rule: 前置（參數）- 密碼為必填，8碼以上
  Rule: 前置（參數）- 角色為必選：管理員 或 一般使用者
  Rule: 後置（狀態）- 建立成功後新使用者可使用該帳號登入後台

  # ═══ Scenario Examples ═══

  Scenario: 成功建立一般使用者
    Given 管理員已登入後台
    When 管理員建立新使用者 Email 為 "newuser@example.com" 姓名為 "王小明" 密碼為 "Secure123" 角色為 "GENERAL_USER"
    Then 新使用者建立成功且回傳 201

  Scenario: 成功建立管理員角色使用者
    Given 管理員已登入後台
    When 管理員建立新使用者 Email 為 "admin2@example.com" 姓名為 "管理員2" 密碼為 "Secure1234" 角色為 "ADMIN"
    Then 新使用者建立成功且回傳 201

  Scenario: Email 重複時拒絕建立
    Given 管理員已登入後台
    And 系統中已有使用者 "existing@example.com"
    When 管理員嘗試建立 Email 為 "existing@example.com" 的新使用者
    Then 系統回傳 409 衝突

  Scenario: 密碼不足 8 碼時拒絕建立
    Given 管理員已登入後台
    When 管理員建立新使用者密碼為 "1234567"（7碼）
    Then 系統回傳 400 驗證失敗

  Scenario: 非管理員嘗試建立使用者
    Given 一般使用者 "user@example.com" 已登入後台
    When 一般使用者嘗試建立新使用者
    Then 系統回傳 403 無權限

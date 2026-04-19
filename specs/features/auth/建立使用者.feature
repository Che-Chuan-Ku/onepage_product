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
  Rule: 後置（回應）- 建立成功後可選擇寄送歡迎 Email 給新使用者

  # ── DFS 路徑分析 ──
  # 正常路徑：填寫完整資料 → 建立成功
  # 例外路徑：Email 重複 / 姓名為空 / 密碼不足8碼 / 角色未選
  # 邊界路徑：密碼恰好8碼
  # 循環路徑：無

  # ═══ Scenario Examples ═══

  Scenario: 成功建立一般使用者
    Given 管理員已登入後台
    When 管理員填寫新使用者資料如下：
      | 欄位   | 值                        |
      | Email  | newuser@example.com       |
      | 姓名   | 王小明                    |
      | 密碼   | Secure123                 |
      | 角色   | 一般使用者                |
    And 管理員提交建立
    Then 新使用者建立成功
    And 使用者清單中出現 "newuser@example.com"
    And 該使用者可使用 "newuser@example.com" 及密碼登入後台

  Scenario: 成功建立管理員角色使用者
    Given 管理員已登入後台
    When 管理員建立角色為「管理員」的新使用者 "admin2@example.com"
    And 管理員提交建立
    Then 新使用者建立成功
    And 新使用者登入後可看全部 MENU

  Scenario: Email 重複時拒絕建立
    Given 管理員已登入後台
    And 系統中已有使用者 "existing@example.com"
    When 管理員嘗試建立 Email 為 "existing@example.com" 的新使用者
    And 管理員提交建立
    Then 系統回傳錯誤訊息「此 Email 已被使用」

  Scenario: 密碼不足 8 碼時拒絕建立
    Given 管理員已登入後台
    When 管理員填寫密碼為 "1234567"（7碼）
    And 管理員提交建立
    Then 系統回傳錯誤訊息「密碼須為 8 碼以上」

  Scenario: 密碼恰好 8 碼時允許建立
    Given 管理員已登入後台
    When 管理員填寫密碼為 "12345678"（8碼）且其他欄位有效
    And 管理員提交建立
    Then 新使用者建立成功

  Scenario: 建立使用者後寄送歡迎 Email
    Given 管理員已登入後台
    When 管理員填寫新使用者完整資料且勾選「寄送歡迎 Email」
    And 管理員提交建立
    Then 新使用者建立成功
    And 系統寄送歡迎 Email 至新使用者信箱

  Scenario: 非管理員嘗試建立使用者
    Given 一般使用者已登入後台
    When 該使用者嘗試存取建立使用者功能
    Then 系統回傳 403 無權限

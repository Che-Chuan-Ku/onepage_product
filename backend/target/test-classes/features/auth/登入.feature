@ignore @command
Feature: 登入後台

  Rule: 前置（參數）- Email + 密碼登入（不含 OAuth）
  Rule: 後置（回應）- 登入成功回傳 accessToken、refreshToken、角色、使用者名稱
  Rule: 後置（狀態）- JWT Token 認證（Access Token 30 分鐘 + Refresh Token 7 天）
  Rule: 後置（狀態）- 記錄登入時間與 IP 供稽核
  Rule: 約束 - 連續登入失敗 5 次鎖定帳號 30 分鐘
  Rule: 約束 - 統一錯誤訊息「帳號或密碼錯誤」防止帳號列舉
  Rule: 約束 - 登入頁為最小 MVP（帳號+密碼+登入按鈕，無忘記密碼）

  # ── DFS 路徑分析 ──
  # 正常路徑：輸入正確Email+密碼 → 登入成功 → 取得JWT
  # 例外路徑：錯誤密碼 / 不存在的帳號 / 帳號被鎖定
  # 邊界路徑：第5次失敗→鎖定 / 鎖定後30分鐘→解鎖 / Token過期→Refresh
  # 循環路徑：Token Refresh 循環

  # ═══ Scenario Examples ═══

  Scenario: 管理員成功登入
    Given 系統中有管理員帳號 "admin@example.com"
    When 使用者輸入 Email "admin@example.com" 密碼 "correct_password"
    And 點擊登入
    Then 登入成功
    And 回傳 accessToken（有效期 30 分鐘）
    And 回傳 refreshToken（有效期 7 天）
    And 回傳角色為「管理員」
    And 回傳使用者名稱
    And 系統記錄登入時間與 IP

  Scenario: 一般使用者成功登入
    Given 系統中有一般使用者帳號 "user@example.com"
    When 使用者輸入 Email "user@example.com" 密碼 "correct_password"
    And 點擊登入
    Then 登入成功
    And 回傳角色為「一般使用者」

  Scenario: 密碼錯誤時顯示統一錯誤訊息
    Given 系統中有帳號 "admin@example.com"
    When 使用者輸入 Email "admin@example.com" 密碼 "wrong_password"
    And 點擊登入
    Then 顯示錯誤訊息「帳號或密碼錯誤」

  Scenario: 帳號不存在時顯示統一錯誤訊息
    When 使用者輸入 Email "notexist@example.com" 密碼 "any_password"
    And 點擊登入
    Then 顯示錯誤訊息「帳號或密碼錯誤」

  Scenario: 連續登入失敗 5 次鎖定帳號
    Given 系統中有帳號 "admin@example.com"
    And 該帳號已連續登入失敗 4 次
    When 使用者再次輸入錯誤密碼
    Then 顯示錯誤訊息「帳號或密碼錯誤」
    And 帳號被鎖定 30 分鐘

  Scenario: 帳號鎖定期間嘗試登入
    Given 帳號 "admin@example.com" 已被鎖定
    When 使用者輸入正確的 Email 與密碼
    Then 顯示錯誤訊息「帳號已鎖定，請 30 分鐘後再試」

  Scenario: 鎖定 30 分鐘後自動解鎖
    Given 帳號 "admin@example.com" 已被鎖定 30 分鐘
    And 鎖定時間已過
    When 使用者輸入正確的 Email 與密碼
    Then 登入成功

  Scenario: Access Token 過期後使用 Refresh Token 換發
    Given 使用者已登入且 Access Token 已過期
    When 前端使用 Refresh Token 呼叫換發 API
    Then 回傳新的 Access Token
    And Refresh Token 維持不變

@ignore @command
Feature: 接收付款回調

  Background:
    Given 訂單狀態為「付款處理中」

  Rule: 前置（參數）- 回調使用 HTTP POST
  Rule: 前置（參數）- CheckMacValue（SHA256）驗證
  Rule: 後置（回應）- 成功回應 "1|OK"
  Rule: 後置（狀態）- 付款成功 → 訂單狀態變為「已付款」
  Rule: 後置（狀態）- 付款失敗 → 訂單狀態變為「付款失敗」
  Rule: 後置（連鎖）- 付款成功後同步自動開立發票
  Rule: 後置（連鎖）- 發票開立成功回傳發票號碼 + 隨機碼 + 開立日期
  Rule: 後置（連鎖）- 付款成功後自動觸發付款成功 Email 通知（Java Mail SMTP）
  Rule: 後置（連鎖）- 付款失敗後自動觸發付款失敗 Email 通知（Java Mail SMTP）
  Rule: 約束 - 每張訂單僅開立一次發票
  Rule: 約束 - 不顯示付款手續費

  # ── DFS 路徑分析 ──
  # 正常路徑：付款成功回調 → 更新狀態 → 開立發票 → 發Email
  # 正常路徑：付款失敗回調 → 更新狀態 → 發Email
  # 例外路徑：CheckMacValue 驗證失敗 / 重複回調 / 發票開立失敗
  # 邊界路徑：每張訂單僅一次發票
  # 循環路徑：無

  # ═══ Scenario Examples ═══

  Scenario: 付款成功回調處理
    Given 訂單 "ORD-20260501-001" 狀態為「付款處理中」
    When 綠界發送付款成功回調（HTTP POST）
    And CheckMacValue SHA256 驗證通過
    Then 系統回應 "1|OK"
    And 訂單狀態變為「已付款」
    And 系統同步呼叫綠界開立電子發票
    And 發票開立成功回傳發票號碼、隨機碼、開立日期
    And 系統發送付款成功 Email 通知給顧客

  Scenario: 付款失敗回調處理
    Given 訂單 "ORD-20260501-002" 狀態為「付款處理中」
    When 綠界發送付款失敗回調（HTTP POST）
    And CheckMacValue SHA256 驗證通過
    Then 系統回應 "1|OK"
    And 訂單狀態變為「付款失敗」
    And 系統發送付款失敗 Email 通知給顧客

  Scenario: CheckMacValue 驗證失敗時拒絕處理
    Given 訂單 "ORD-20260501-001" 狀態為「付款處理中」
    When 綠界發送回調但 CheckMacValue 驗證失敗
    Then 系統回傳錯誤回應
    And 訂單狀態不變

  Scenario: 重複回調時不重複開立發票
    Given 訂單 "ORD-20260501-001" 狀態已為「已付款」
    And 該訂單已開立發票
    When 綠界重複發送付款成功回調
    Then 系統回應 "1|OK"
    And 不重複開立發票
    And 訂單狀態維持「已付款」

  Scenario: 發票開立失敗時記錄同步中狀態
    Given 訂單 "ORD-20260501-001" 付款成功
    When 系統呼叫綠界開立發票但 API 回傳錯誤
    Then 訂單狀態仍為「已付款」
    And 發票狀態為「同步中」
    And 管理員可在發票管理頁手動重新同步

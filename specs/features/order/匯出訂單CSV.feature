@ignore @command
Feature: 匯出訂單CSV

  Background:
    Given 管理員已登入後台
    And 訂單查詢結果已顯示

  Rule: 後置（回應）- CSV 固定 7 欄位：訂單編號、所屬網站、顧客、商品、金額、狀態、時間
  Rule: 後置（回應）- 編碼為 UTF-8 with BOM
  Rule: 約束 - 直接匯出不需確認框
  Rule: 約束 - 匯出權限與查詢權限相同

  # ── DFS 路徑分析 ──
  # 正常路徑：查詢結果 → 點擊匯出 → 下載CSV
  # 例外路徑：查詢結果為空時匯出
  # 邊界路徑：僅一筆 / 大量資料
  # 循環路徑：無

  # ═══ Scenario Examples ═══

  Scenario: 成功匯出訂單 CSV
    Given 管理員已登入後台
    And 訂單查詢結果顯示 3 筆訂單
    When 管理員點擊匯出 CSV
    Then 瀏覽器下載 CSV 檔案
    And CSV 包含表頭：訂單編號、所屬網站、顧客、商品、金額、狀態、時間
    And CSV 包含 3 筆資料列
    And 檔案編碼為 UTF-8 with BOM

  Scenario: 篩選後匯出僅含篩選結果
    Given 管理員已登入後台
    And 管理員篩選所屬網站為 "夏季水果季" 後查詢結果顯示 5 筆
    When 管理員點擊匯出 CSV
    Then CSV 包含 5 筆資料列
    And 所有資料列的所屬網站均為 "夏季水果季"

  Scenario: 查詢結果為空時匯出空CSV
    Given 管理員已登入後台
    And 訂單查詢結果為空
    When 管理員點擊匯出 CSV
    Then CSV 僅包含表頭列
    And 無資料列

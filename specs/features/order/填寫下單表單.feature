@ignore @command
Feature: 填寫下單表單

  Background:
    Given 顧客購物車中有商品

  Rule: 後置（回應）- 下單表單為獨立頁面（/checkout）
  Rule: 前置（參數）- 姓名為必填
  Rule: 前置（參數）- 地址為純文字（縣市+區+詳細地址）
  Rule: 前置（參數）- 電話為必填
  Rule: 前置（參數）- Email 為必填，基本格式驗證
  Rule: 前置（參數）- 備註為選填
  Rule: 前置（參數）- 統一編號為選填，僅 8 碼數字格式驗證
  Rule: 前置（參數）- 運送方式：宅配或自取
  Rule: 約束 - 自取時運費固定 NT$0，免地址驗證
  Rule: 約束 - 表單前後端都執行驗證
  Rule: 約束 - 顧客為匿名使用者（不需登入）

  # ── DFS 路徑分析 ──
  # 正常路徑：填寫完整表單（宅配） / 填寫完整表單（自取）
  # 例外路徑：姓名為空 / 電話為空 / Email格式錯 / 統編非8碼 / 地址為空（宅配時）
  # 邊界路徑：自取免地址驗證 / 統編恰好8碼
  # 循環路徑：前端即時驗證回饋

  # ═══ Scenario Examples ═══

  Scenario: 宅配模式下成功填寫下單表單
    Given 顧客購物車中有商品
    When 顧客在結帳頁填寫如下資料：
      | 欄位     | 值                         |
      | 姓名     | <姓名>                     |
      | 地址     | <地址>                     |
      | 電話     | <電話>                     |
      | Email    | <Email>                    |
      | 運送方式 | 宅配                       |
      | 備註     | <備註>                     |
      | 統一編號 | <統編>                     |
    Then 表單驗證通過

    Examples:
      | 姓名   | 地址                     | 電話         | Email            | 備註       | 統編     |
      | 王大明 | 台北市信義區松仁路100號  | 0912345678   | wang@example.com | 請盡快出貨 |          |
      | 李小華 | 新北市板橋區中山路50號   | 0923456789   | li@example.com   |            | 12345678 |

  Scenario: 自取模式下免地址驗證
    Given 顧客購物車中有商品
    When 顧客選擇運送方式為「自取」
    And 顧客填寫姓名 "王大明"、電話 "0912345678"、Email "wang@example.com"
    And 顧客未填寫地址
    Then 表單驗證通過
    And 運費顯示 NT$0

  Scenario: 姓名為空時驗證失敗
    Given 顧客購物車中有商品
    When 顧客未填寫姓名
    Then 前端即時顯示錯誤訊息「姓名為必填」

  Scenario: Email 格式錯誤時驗證失敗
    Given 顧客購物車中有商品
    When 顧客填寫 Email 為 "invalid-email"
    Then 前端即時顯示錯誤訊息「Email 格式不正確」

  Scenario: 統一編號非 8 碼時驗證失敗
    Given 顧客購物車中有商品
    When 顧客填寫統一編號為 "<統編>"
    Then 前端即時顯示錯誤訊息「統一編號須為 8 碼數字」

    Examples:
      | 統編      |
      | 1234567   |
      | 123456789 |
      | 1234abcd  |

  Scenario: 電話為空時驗證失敗
    Given 顧客購物車中有商品
    When 顧客未填寫電話
    Then 前端即時顯示錯誤訊息「電話為必填」

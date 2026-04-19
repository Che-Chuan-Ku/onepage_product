@ignore @command
Feature: 編輯網站

  Background:
    Given 管理員已登入後台
    And 系統中已有網站

  Rule: 前置（狀態）- 網站必須存在
  Rule: 前置（參數）- 可編輯名稱、訂閱方案、上下架時間、Banner 圖片、宣傳文案圖片、滿額免運門檻
  Rule: 前置（參數）- 網站標題為必填（REQ-029）
  Rule: 前置（參數）- 網站副標題為選填（REQ-029）
  Rule: 後置（狀態）- 編輯成功後資訊即時更新

  # ── DFS 路徑分析 ──
  # 正常路徑：修改各欄位 → 儲存成功
  # 例外路徑：名稱清空 / 標題清空
  # 邊界路徑：修改已上線網站 / 修改已下線網站
  # 循環路徑：無

  # ═══ Scenario Examples ═══

  Scenario: 成功編輯網站資訊
    Given 管理員已登入後台
    And 系統中已有網站 "<原名稱>"
    When 管理員將網站名稱修改為 "<新名稱>"
    And 將滿額免運門檻修改為 <新門檻>
    And 管理員儲存修改
    Then 網站資訊更新成功

    Examples:
      | 原名稱       | 新名稱           | 新門檻 |
      | 夏季水果季   | 夏季水果嘉年華   | 2000   |
      | 中秋禮盒專區 | 中秋送禮專區     | 1000   |

  Scenario: 編輯網站名稱清空時拒絕
    Given 管理員已登入後台
    And 系統中已有網站 "夏季水果季"
    When 管理員將網站名稱清空
    And 管理員儲存修改
    Then 系統回傳錯誤訊息「網站名稱為必填」

  Scenario: 編輯已上線網站的 Banner 圖片
    Given 管理員已登入後台
    And 系統中已有已上線網站 "夏季水果季"
    When 管理員更換 Banner 圖片
    And 管理員儲存修改
    Then 網站 Banner 即時更新

  # REQ-029：網站設定欄位擴充

  Scenario: 設定網站標題與副標題
    Given 管理員已登入後台
    And 系統中已有網站 "夏季水果季"
    When 管理員更新網站標題為 "夏季鮮果特賣" 副標題為 "限時優惠，品質保證"
    Then 網站資訊更新成功
    And 回應中 title 為 "夏季鮮果特賣"
    And 回應中 subtitle 為 "限時優惠，品質保證"

  Scenario: 設定 Footer 標題與副標題
    Given 管理員已登入後台
    And 系統中已有網站 "夏季水果季"
    When 管理員更新網站 footerTitle 為 "阿吉水果行" footerSubtitle 為 "電話：0912-345-678"
    Then 網站資訊更新成功
    And 回應中 footerTitle 為 "阿吉水果行"

  Scenario: 網站標題為必填
    Given 管理員已登入後台
    And 系統中已有網站 "夏季水果季"
    When 管理員更新網站時清空標題
    Then 系統回傳錯誤訊息「網站標題為必填」

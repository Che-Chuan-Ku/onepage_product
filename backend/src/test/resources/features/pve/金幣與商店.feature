@ignore @command
Feature: 金幣與商店
  # 來源：PVE 增量 FR-C3 FR-C4（documents/PVE-挑戰模式-增量需求.md）
  # 事件：GoldAwarded, PveShopOpened, PveShopOfferPurchased, PveShopRerolled, PveShopSkipped
  # 規則：Run起始0金幣，通過一關獲得 10+該關剩餘手數 金幣，不設上限；
  #   每關通過後進入商店（第8關通關後無商店，直接Run結算）；
  #   商店固定展示遺物x2、技能x1（僅自玩家職業3技能池抽取，同名技能可重複購買持有，
  #   售價固定6）；提供重抽（5金幣，三位全部重抽，次數不限）與跳過；
  #   已持有遺物不會被抽出；持有達上限（遺物5、技能3）時對應商品不可購買。

  Background:
    Given 玩家 "alice" 職業為 "WARRIOR"，一個PVE Run進行中

  Rule: 後置（狀態）- 通過一關獲得 10+剩餘手數 金幣（全8關皆為DUEL，公式統一適用）

    Example: 第1關對弈以較少手數獲勝（手數預算50，剩餘20手）時獲得金幣
      # documents/PVE-全對弈階梯設計-2026-07-10.md §5.1: 8關全部統一沿用既有
      # DUEL公式 reward=10+(moveBudget-movesUsed)，公式本身與具體關卡數值無關；
      # 第1關(NOVICE) moveBudget=50（§7.6重校準）；獎勵只看剩餘手數，示例採剩餘20手。
      Given 玩家 "alice" 於第1關魔王對弈剩餘手數為 20 時通過
      When 系統結算通關獎勵
      Then 玩家獲得金幣 30（10+20）
      And 系統發布 GoldAwarded 事件

  Rule: 後置（狀態）- 每關通過後開啟商店，第8關通關後無商店

    Example: 通過第1至7關後開啟商店
      Given 玩家 "alice" 通過第3關
      When 系統推進至商店階段
      Then 系統開啟商店，展示遺物x2與技能x1
      And 系統發布 PveShopOpened 事件

    Example: 通過第8關後不開商店直接Run結算
      Given 玩家 "alice" 通過第8關
      When 系統結算通關獎勵
      Then 系統不開啟商店，直接進行Run結算

  Rule: 前置（參數）- 商店技能位僅自玩家職業3技能池抽取

    Example: 劍士商店技能位僅從劍士3技能中抽取
      Given 玩家 "alice" 職業為 "WARRIOR"
      When 系統開啟商店
      Then 技能展示位僅可能為 "HORIZONTAL_SLASH"、"VERTICAL_SLASH" 或 "HEAVEN_EARTH_REVERSAL" 之一

  Rule: 後置（狀態）- 已持有遺物不會被抽出；持有達上限時對應商品不可購買

    Example: 已持有的遺物不出現於展示位
      Given 玩家 "alice" 已持有遺物 "SHARP_BLADE"
      When 系統開啟商店
      Then 展示位中不含 "SHARP_BLADE"

    Example: 遺物持有已達5件上限時不可再購買
      Given 玩家 "alice" 已持有5件遺物
      When 玩家 "alice" 嘗試購買展示位中的遺物
      Then 操作失敗
      And 錯誤為 "遺物持有已達上限"

    Example: 技能持有已達3件上限時不可再購買
      Given 玩家 "alice" 已持有技能總數量達3
      When 玩家 "alice" 嘗試購買展示位中的技能
      Then 操作失敗
      And 錯誤為 "技能持有已達上限"

  Rule: 後置（狀態）- 同名技能可重複購買持有，售價固定6

    Example: 重複購買同名技能後數量累加
      Given 玩家 "alice" 已持有技能 "HORIZONTAL_SLASH" 數量 1
      When 玩家 "alice" 花費6金幣再次購買 "HORIZONTAL_SLASH"
      Then 玩家 "alice" 持有技能 "HORIZONTAL_SLASH" 數量為 2
      And 系統發布 PveShopOfferPurchased 事件

  Rule: 後置（狀態）- 重抽固定花費5金幣，三個展示位全部重新抽取，次數不限

    Example: 金幣足夠時可重抽
      Given 玩家 "alice" 金幣為10
      When 玩家 "alice" 重抽商店
      Then 玩家花費5金幣，剩餘金幣為5
      And 三個展示位全部更新為新內容
      And 系統發布 PveShopRerolled 事件

    Example: 金幣不足時重抽遭拒
      Given 玩家 "alice" 金幣為3
      When 玩家 "alice" 嘗試重抽商店
      Then 操作失敗
      And 錯誤為 "金幣不足"

  Rule: 後置（狀態）- 跳過商店不購買，直接進入下一關

    Example: 跳過商店
      When 玩家 "alice" 跳過商店
      Then 系統不扣除金幣
      And 系統建立下一關並發布 PveShopSkipped 事件

  # FR-C3/FR-C4 已定：金幣=10+剩餘手數，不設上限；商店固定遺物2+技能1；
  # 技能僅職業池、售價6、可重複持有；遺物不重複且不會被抽出；
  # 重抽5金幣不限次數；持有上限遺物5/技能3；第8關後無商店。

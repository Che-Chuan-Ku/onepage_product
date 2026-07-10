@ignore @command
Feature: 真劍勝負回合行動經濟
  # 來源：需求 #36（回合行動經濟狀態機）
  # 事件：TurnResolved, SkillUsed
  # 規則（Q1 已定）：每回合一個主要動作：
  #   一般技能（橫劈/縱劈/精準狙擊/散射）附掛在該手落子上、與落子同時結算；
  #   大絕（天地反轉/開拓之星）取代該回合落子，施法即該回合的行動。
  #   每個技能一場只能使用一次。

  Background:
    Given 一場真劍勝負對局進行中
    And 玩家 "alice"（劍士，黑）與 "bob"（弓箭手，白）

  Rule: 前置（參數）- 一般技能必須附掛於本回合落子同時提出，不可單獨施放

    Example: 附掛橫劈技能於本手落子
      When 玩家 "alice" 於 (7,7) 落子並附掛技能 "HORIZONTAL_SLASH"，方向 "UP"
      Then 操作成功
      And 系統發布 SkillUsed 事件，技能為 "HORIZONTAL_SLASH"
      And 該手落子與橫劈推擠效果同時結算

  Rule: 前置（狀態）- 大絕取代該回合落子，不可與落子同時提出

    Example: 施放大絕天地反轉取代本回合落子
      When 玩家 "alice" 施放大絕 "HEAVEN_EARTH_REVERSAL"，錨點 (5,5)，方向 "RIGHT"
      Then 操作成功
      And 本回合視為已完成落子行動（不另行落子）
      And 系統發布 SkillUsed 事件

  Rule: 前置（狀態）- 每個技能一場對局只能使用一次

    Example: 重複使用同一技能時遭拒
      Given 玩家 "alice" 本場已使用過 "HORIZONTAL_SLASH"
      When 玩家 "alice" 再次嘗試附掛技能 "HORIZONTAL_SLASH"
      Then 操作失敗
      And 錯誤為 "該技能本場已使用過"

  Rule: 前置（狀態）- 每回合僅能選擇一種主要動作（純落子 / 附掛一般技能 / 施放大絕）

    Example: 同一回合嘗試同時附掛一般技能與施放大絕時遭拒
      When 玩家 "alice" 嘗試同時附掛 "HORIZONTAL_SLASH" 與施放大絕 "HEAVEN_EARTH_REVERSAL"
      Then 操作失敗
      And 錯誤為 "每回合僅能選擇一個主要動作"

  Rule: 前置（參數）- 落子座標須在棋盤範圍內，超出範圍一律回 422（api.yml:590-594/1335-1338）

    Example: 座標超出 schema 寬鬆上界時仍精確回報 422 而非 400（Bean Validation 短路防呆，需求 #36）
      When 玩家 "alice" 於 (16,16) 落子
      Then 操作失敗
      And 錯誤狀態碼為 422 且錯誤訊息為 "座標超出棋盤範圍"

  # Q1 已定（B）：一般技能附掛落子同手結算；大絕取代落子＝該手行動。

@ignore @command
Feature: 關卡勝敗判定
  # 來源：PVE 增量 FR-B4 FR-B7（documents/PVE-挑戰模式-增量需求.md）
  # 事件：EncounterCleared, EncounterFailed
  # 規則：Boss HP<=0 → 關卡通過（當下立即結束，不再落子）；
  #   手數用盡且Boss HP>0 → 關卡失敗。
  #   關卡結算（FR-B7）需顯示：勝/敗、總傷害、剩餘手數、已使用技能清單；
  #   總傷害由 bossHpMax-bossHpCurrent 推算、剩餘手數由 moveBudget-movesUsed 推算，
  #   已使用技能清單為 PveEncounterStateResponse.usedSkills（本輪新增欄位）。

  Background:
    Given 一場PVE挑戰對局進行中，第1關 BossHP 100，手數預算30

  Rule: 後置（狀態）- BossHP<=0 時關卡立即通過，不再接受落子

    Example: 傷害使BossHP歸零時立即判定通過
      Given 當前BossHP為50
      When 玩家落子結算造成傷害50
      Then BossHP降為0
      And 系統判定關卡通過
      And 系統發布 EncounterCleared 事件
      And 系統不再接受本關後續落子

    Example: 傷害超過BossHP時仍判定通過（不判定為負值）
      Given 當前BossHP為30
      When 玩家落子結算造成傷害50
      Then 系統判定關卡通過
      And 系統發布 EncounterCleared 事件

  Rule: 後置（狀態）- 手數用盡且BossHP>0時關卡失敗

    Example: 第30手結算後BossHP仍大於0時判定失敗
      Given 玩家已用滿30手，當前BossHP為20
      When 第30手落子結算完成
      Then 系統判定關卡失敗
      And 系統發布 EncounterFailed 事件

  Rule: 前置（狀態）- 關卡結束後不可再落子或使用技能

    Example: 關卡已通過後嘗試落子遭拒
      Given 該關已判定通過（EncounterCleared）
      When 玩家嘗試再次落子
      Then 操作失敗
      And 錯誤為 "關卡已結束"

  Rule: 後置（狀態）- 關卡結算顯示勝敗、總傷害、剩餘手數、已使用技能清單（FR-B7）

    Example: 關卡通過時查詢結算內容
      Given 第1關通過，bossHpMax為100、bossHpCurrent為0，moveBudget為30、movesUsed為25
      And 玩家 "alice" 於本關已使用技能 "HORIZONTAL_SLASH"、"PRECISION_SNIPE"
      When 玩家 "alice" 查詢該關卡狀態
      Then 系統回傳 status為 "CLEARED"
      And 系統回傳的 bossHpMax與bossHpCurrent可推算本關總傷害為100
      And 系統回傳的 moveBudget與movesUsed可推算剩餘手數為5
      And 系統回傳已使用技能清單為 "HORIZONTAL_SLASH"、"PRECISION_SNIPE"

    Example: 關卡失敗時查詢結算內容
      Given 第2關手數用盡失敗，movesUsed為30、moveBudget為30，bossHpCurrent仍大於0
      And 玩家 "alice" 於本關已使用技能 "PRECISION_SNIPE"
      When 玩家 "alice" 查詢該關卡狀態
      Then 系統回傳 status為 "FAILED"
      And 系統回傳的 moveBudget與movesUsed可推算剩餘手數為0
      And 系統回傳已使用技能清單為 "PRECISION_SNIPE"

  # FR-B4 已定：BossHP<=0=通過(立即結束)；手數用盡且HP>0=失敗。
  # FR-B7 已定：關卡結算顯示勝敗/總傷害/剩餘手數/已用技能清單；
  # 本輪新增 PveEncounterStateResponse.usedSkills 欄位（api.yml），總傷害與剩餘手數
  # 由既有 bossHp*/move* 欄位推算，不需新增欄位。

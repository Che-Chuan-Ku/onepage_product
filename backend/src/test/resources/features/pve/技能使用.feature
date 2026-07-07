@ignore @command
Feature: 技能使用
  # 來源：PVE 增量 FR-A2 FR-B5（documents/PVE-挑戰模式-增量需求.md）
  # 事件：SkillUsed
  # 規則：PVE技能一律消耗型+獨立行動：發動時不落子、不消耗手數；
  #   大絕（HEAVEN_EARTH_REVERSAL/PIONEER_STAR）在PVE同樣是獨立行動（非PVP的取代落子）；
  #   使用時點：任兩次落子之間（含第一次落子之前），每個間隔至多使用1個技能；
  #   第30手落子及其全部連鎖結算完成後不可再使用技能；
  #   建關時依職業附贈1個技能：WARRIOR附HORIZONTAL_SLASH、ARCHER附PRECISION_SNIPE；
  #   技能持有上限3；技能效果本身造成的棋子移除不計傷害（僅連線計傷）。

  Background:
    Given 一場PVE挑戰對局進行中，玩家 "alice" 職業為 "WARRIOR"

  Rule: 後置（狀態）- 技能為獨立行動，使用時不落子、不消耗手數

    Example: 使用橫劈技能不消耗手數
      Given 玩家 "alice" 剩餘手數為 25，持有技能 "HORIZONTAL_SLASH"
      When 玩家 "alice" 使用技能 "HORIZONTAL_SLASH"，方向 "UP"
      Then 操作成功
      And 剩餘手數仍為 25
      And 系統發布 SkillUsed 事件

  Rule: 後置（狀態）- 大絕在PVE同樣是獨立行動，不取代落子

    Example: 使用大絕天地反轉不消耗手數也不視為落子
      Given 玩家 "alice" 剩餘手數為 25，持有技能 "HEAVEN_EARTH_REVERSAL"
      When 玩家 "alice" 使用大絕 "HEAVEN_EARTH_REVERSAL"，錨點 (5,5)，方向 "RIGHT"
      Then 操作成功
      And 剩餘手數仍為 25
      And 本次操作不計入落子序列

  Rule: 前置（狀態）- 每個間隔（任兩次落子之間）至多使用1個技能

    Example: 同一間隔內第二次使用技能時遭拒
      Given 玩家 "alice" 在本間隔已使用過一次技能
      When 玩家 "alice" 於同一間隔再次嘗試使用技能
      Then 操作失敗
      And 錯誤為 "本間隔已使用過技能"

    Example: 落子後進入下一個間隔可再次使用技能
      Given 玩家 "alice" 在上一個間隔已使用過技能
      When 玩家 "alice" 落子後，於新的間隔使用技能
      Then 操作成功

  Rule: 前置（狀態）- 第30手落子結算完成後不可再使用技能

    Example: 關卡已依第30手判定結束後嘗試使用技能遭拒
      Given 第30手落子與全部連鎖結算已完成，關卡已判定
      When 玩家 "alice" 嘗試使用技能
      Then 操作失敗
      And 錯誤為 "關卡已結束"

  Rule: 前置（狀態）- 技能持有上限為3，消耗型使用後從持有中移除

    Example: 使用技能後持有數量遞減，歸零即不再持有
      Given 玩家 "alice" 持有技能 "HORIZONTAL_SLASH" 數量 1
      When 玩家 "alice" 使用技能 "HORIZONTAL_SLASH"
      Then 玩家 "alice" 持有技能 "HORIZONTAL_SLASH" 數量降為 0
      And 技能操作列中 "HORIZONTAL_SLASH" 不再可選

    Example: 未持有的技能無法使用
      Given 玩家 "alice" 未持有技能 "SCATTER_SHOT"
      When 玩家 "alice" 嘗試使用技能 "SCATTER_SHOT"
      Then 操作失敗
      And 錯誤為 "未持有該技能"

  Rule: 後置（狀態）- 技能效果本身造成的棋子移除不計傷害，僅連線計傷

    Example: 大絕開拓之星清除範圍棋子不直接造成傷害
      When 玩家使用大絕 "PIONEER_STAR" 清除範圍內棋子
      Then 該次清除不直接對Boss造成傷害
      And 若清除或推移後另形成連線，依連線傷害結算規則另行計傷

  # FR-A2/FR-B5 已定：全部技能=獨立行動+消耗型；每間隔至多1個；第30手後不可用；
  # 建關附贈技能（劍士橫劈/弓箭手精準狙擊）；持有上限3；技能移除不計傷、連線才計傷。

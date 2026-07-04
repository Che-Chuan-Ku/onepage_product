@ignore @command
Feature: 劍士技能組
  # 來源：需求 #42（劍士技能組）
  # 事件：SkillUsed, StonesPushed, ColorsSwapped
  # 規則（Q4、Q10 已定）：
  #   橫劈：附掛落子，以該子為基準選上或下，緊鄰該方向橫排 3 格（正前+左前+右前）往該方向推 1 格；
  #   縱劈：附掛落子，以該子為基準選左或右，緊鄰該方向縱列 3 格往該方向推 1 格；
  #   大絕 天地反轉：取代落子，選一個空格為錨點＋四方向之一，3寬×2深（含錨點格）共 6 格內
  #     棋子雙方顏色互換；錨點格必須為空格。

  Background:
    Given 一場真劍勝負對局進行中，玩家 "alice" 職業為 "WARRIOR"

  Rule: 前置（參數）- 橫劈以落子為基準選擇上或下方向，推該方向緊鄰橫排 3 格

    Example: 橫劈選擇 "UP" 方向推擠緊鄰橫排三格
      When 玩家 "alice" 於 (7,7) 落子並附掛 "HORIZONTAL_SLASH"，方向 "UP"
      Then 系統對 (6,6),(6,7),(6,8) 這一橫排施加往上推 1 格
      And 系統發布 SkillUsed 與 StonesPushed 事件

  Rule: 前置（參數）- 縱劈以落子為基準選擇左或右方向，推該方向緊鄰縱列 3 格

    Example: 縱劈選擇 "LEFT" 方向推擠緊鄰縱列三格
      When 玩家 "alice" 於 (7,7) 落子並附掛 "VERTICAL_SLASH"，方向 "LEFT"
      Then 系統對 (6,6),(7,6),(8,6) 這一縱列施加往左推 1 格
      And 系統發布 SkillUsed 與 StonesPushed 事件

  Rule: 前置（狀態）- 大絕天地反轉的錨點格必須為空格

    Example: 天地反轉指定已有棋子的格子為錨點時遭拒
      Given (5,5) 已有棋子
      When 玩家 "alice" 施放大絕 "HEAVEN_EARTH_REVERSAL"，錨點 (5,5)
      Then 操作失敗
      And 錯誤為 "大絕錨點格必須為空格"

  Rule: 後置（狀態）- 天地反轉將錨點＋方向 3寬×2深共 6 格內棋子雙方顏色互換

    Example: 天地反轉互換指定範圍內棋子顏色
      Given 空格 (5,5) 為錨點，方向 "RIGHT"
      And 範圍內 (4,5),(4,6),(6,5),(6,6) 各有棋子
      When 玩家 "alice" 施放大絕 "HEAVEN_EARTH_REVERSAL"，錨點 (5,5)，方向 "RIGHT"
      Then 範圍內棋子顏色雙方互換
      And 系統發布 ColorsSwapped 事件

  Rule: 前置（狀態）- 每個技能一場僅能使用一次（同需求 #36）

    Example: 劍士重複使用大絕天地反轉時遭拒
      Given 玩家 "alice" 本場已使用過 "HEAVEN_EARTH_REVERSAL"
      When 玩家 "alice" 再次嘗試施放 "HEAVEN_EARTH_REVERSAL"
      Then 操作失敗
      And 錯誤為 "該技能本場已使用過"

  # Q4/Q10 已定：3寬x2深＝含目標格橫排3+其後一排共6格；錨點必須空格；橫劈/縱劈方向與範圍如上。

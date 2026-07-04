@ignore @command
Feature: 弓箭手技能組
  # 來源：需求 #43（弓箭手技能組）
  # 事件：SkillUsed, StoneReplaced, StonesCleared
  # 規則（Q4、Q10 已定）：
  #   精準狙擊：附掛落子，替換場上現存一顆敵方棋子為己方顏色（替換即該手落子；
  #     已被燒毀/推走的舊位置不算）；
  #   散射：該手同時下 2 子於空格，兩子中心距離（Chebyshev）需 ≥ 2（不得在彼此九宮格內）；
  #   大絕 開拓之星：取代落子，選一個空格為錨點＋四方向之一，3寬×2深（含錨點格）共 6 格內
  #     棋子全部消除；錨點格必須為空格。

  Background:
    Given 一場真劍勝負對局進行中，玩家 "bob" 職業為 "ARCHER"

  Rule: 前置（狀態）- 精準狙擊只能替換場上現存的敵方棋子

    Example: 精準狙擊替換敵方現存棋子為己方顏色
      Given (7,7) 為敵方棋子且現存於棋盤上
      When 玩家 "bob" 使用技能 "PRECISION_SNIPE" 指定 (7,7)
      Then 操作成功
      And (7,7) 的棋子顏色替換為 "bob" 的顏色
      And 該次替換視為 "bob" 本回合落子
      And 系統發布 SkillUsed 與 StoneReplaced 事件

    Example: 精準狙擊指定已被燒毀或推走的舊位置時遭拒
      Given (7,7) 原有的敵方棋子已被燒毀
      When 玩家 "bob" 使用技能 "PRECISION_SNIPE" 指定 (7,7)
      Then 操作失敗
      And 錯誤為 "該位置無現存敵方棋子"

  Rule: 前置（參數）- 散射同手下 2 子，兩子中心距離（Chebyshev）須 ≥ 2

    Example: 散射兩子距離過近時遭拒
      When 玩家 "bob" 使用技能 "SCATTER_SHOT" 於 (7,7) 與 (7,8)
      Then 操作失敗
      And 錯誤為 "散射兩子不得在彼此九宮格內"

    Example: 散射兩子距離合法時同手下二子
      When 玩家 "bob" 使用技能 "SCATTER_SHOT" 於 (7,7) 與 (7,10)
      Then 操作成功
      And (7,7) 與 (7,10) 同時落下 "bob" 的棋子
      And 系統發布 SkillUsed 事件

  Rule: 前置（狀態）- 大絕開拓之星的錨點格必須為空格

    Example: 開拓之星指定已有棋子的格子為錨點時遭拒
      Given (5,5) 已有棋子
      When 玩家 "bob" 施放大絕 "PIONEER_STAR"，錨點 (5,5)
      Then 操作失敗
      And 錯誤為 "大絕錨點格必須為空格"

  Rule: 後置（狀態）- 開拓之星將錨點＋方向 3寬×2深共 6 格內棋子全部消除

    Example: 開拓之星清除指定範圍內所有棋子
      Given 空格 (5,5) 為錨點，方向 "LEFT"
      And 範圍內 (4,4),(4,5),(6,4),(6,5) 各有棋子
      When 玩家 "bob" 施放大絕 "PIONEER_STAR"，錨點 (5,5)，方向 "LEFT"
      Then 範圍內棋子全部被消除
      And 系統發布 StonesCleared 事件

  Rule: 前置（狀態）- 每個技能一場僅能使用一次（同需求 #36）

    Example: 弓箭手重複使用散射時遭拒
      Given 玩家 "bob" 本場已使用過 "SCATTER_SHOT"
      When 玩家 "bob" 再次嘗試使用技能 "SCATTER_SHOT"
      Then 操作失敗
      And 錯誤為 "該技能本場已使用過"

  # Q10 已定：精準狙擊替換現存敵子；散射兩子 Chebyshev 距離>=2；開拓之星範圍同大絕天地反轉。

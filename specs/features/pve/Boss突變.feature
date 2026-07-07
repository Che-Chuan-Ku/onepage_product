@ignore @command
Feature: Boss突變
  # 來源：PVE 增量 FR-C6（documents/PVE-挑戰模式-增量需求.md）
  # 事件：BossMutationTriggered
  # 規則：固定配置，不隨機——第3關「獨眼」：橫向連線不結算；
  #   第6關「震怒」：玩家每落5手，隨機一個有棋子的格子噴發，清除該格及周圍8格棋子
  #   （不造成Boss傷害，持有「火山之心」則照其效果計傷）；
  #   第8關「深淵」：每次連線結算完成後，隨機一個空格生成1顆障礙棋子。

  Background:
    Given 玩家 "alice" 一個PVE Run進行中

  Rule: 前置（狀態）- 第3關「獨眼」使橫向連線不結算

    Example: 第3關形成橫向五連時不造成傷害也不移除棋子
      Given 玩家 "alice" 於第3關（mutationType為"ONE_EYE"）
      When 玩家形成橫向五連
      Then 該橫向連線不造成傷害
      And 該五連棋子不被移除

    Example: 第3關縱向或斜向連線仍正常結算
      Given 玩家 "alice" 於第3關
      When 玩家形成縱向五連
      Then 系統正常結算該連線傷害

  Rule: 後置（狀態）- 第6關「震怒」每落5手隨機噴發清除一格及周圍8格

    Example: 第5手落子結算後觸發震怒噴發
      Given 玩家 "alice" 於第6關（mutationType為"RAGE"），已落滿5手
      When 第5手結算完成
      Then 系統隨機選定一個有棋子的格子觸發噴發
      And 系統清除該格及周圍8格的棋子
      And 該次清除不對Boss造成傷害
      And 系統發布 BossMutationTriggered 事件

    Example: 持有火山之心時震怒噴發清除的棋子照其效果計傷
      Given 玩家 "alice" 於第6關，持有遺物 "VOLCANO_HEART"
      When 震怒噴發清除5顆棋子
      Then 系統依火山之心效果對Boss造成傷害 50（每顆10）

  Rule: 後置（狀態）- 第8關「深淵」每次連線結算後隨機生成障礙棋子

    Example: 連線結算後棋盤隨機新增障礙棋子
      Given 玩家 "alice" 於第8關（mutationType為"ABYSS"）
      When 玩家完成一次連線結算
      Then 系統於一個隨機空格生成1顆障礙棋子
      And 該障礙棋子不可落子、不可作為連線組成
      And 系統發布 BossMutationTriggered 事件

    Example: 障礙棋子可被技能推移或移除
      Given 第8關棋盤上 (4,4) 為深淵生成的障礙棋子
      When 玩家使用橫劈技能推擠涵蓋 (4,4) 的一排
      Then (4,4) 的障礙棋子依推擠解算器規則被推移

  # FR-C6 已定：第3/6/8關固定突變（獨眼/震怒/深淵），不隨機；
  # 震怒清除不計傷（火山之心例外）；深淵障礙棋子可被推移/移除但不可落子/連線。

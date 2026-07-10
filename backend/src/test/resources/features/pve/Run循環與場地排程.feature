@ignore @command
Feature: Run循環與場地排程
  # 來源：PVE 增量 FR-C1 FR-C2（documents/PVE-挑戰模式-增量需求.md）；全面改版依
  # documents/PVE-全對弈階梯設計-2026-07-10.md §1「八關階梯總覽」：全8關皆為
  # DUEL魔王對弈encounter，不再有PUZZLE關卡（TYPE_A/TYPE_B樣板、HP曲線、D4盤面
  # 變換、單次小干擾全數退役，見§8拆除清單）。
  # 事件：PveEncounterCreated
  # 規則：8關依固定順序，全部bossHpMax=0（DUEL無HP概念的sentinel）；
  #   手數預算依序為 50,45,55,55,60,65,70,75（L2/L7為07-09文件已驗證定案值；L1=50 為 §7.6 致命骰禁令重校準值（35→50，理由見設計文件§7.6），
  #   其餘為本文件的設計起始值，見Boss對弈統計驗證.feature的N=200校準）；
  #   fieldType：1/2/3/4/7/8=PLAIN，5=VOLCANO（開局一次性5-8格靜態岩石，無隱藏
  #   噴發），6=BEACH（沿用每10手推浪，海5行沙6行）；開局腳本：2=HUAYUE(花月)、
  #   7/8=PUYUE(浦月)，其餘=NONE（純反應式起手）。

  Background:
    Given 一個PVE Run進行中

  Rule: 後置（狀態）- 全8關皆為DUEL，bossHpMax恆為0（sentinel）

    Example: 各關bossHpMax依序皆為0（DUEL無HP概念）
      When Run依序建立第1至8關
      Then 各關bossHpMax依序為 0,0,0,0,0,0,0,0

  Rule: 後置（狀態）- 8關手數預算依固定順序遞增（L2/L7為07-09文件已驗證定案值）

    Example: 各關moveBudget依序符合§1階梯總覽
      When Run依序建立第1至8關
      Then 各關moveBudget依序為 50,45,55,55,60,65,70,75

  Rule: 前置（參數）- 1/2/3/4/7/8關固定為PLAIN場地，無場地效果

    Example: 第1關為PLAIN場地
      When Run建立第1關
      Then fieldType為 "PLAIN"，該關無任何場地效果

  Rule: 前置（參數）- 第5關固定為VOLCANO，開局一次性5-8格靜態岩石（無隱藏噴發）

    Example: 第5關fieldType為VOLCANO
      Given 玩家位於第5關魔王對弈
      Then 該關場地類型為 "VOLCANO"
      And 該關障礙格（kind為ROCK）數量介於5至8之間

  Rule: 前置（參數）- 第6關固定為BEACH，沿用每10手結算一次的推浪機制

    Example: 第6關fieldType為BEACH
      Given 玩家位於第6關魔王對弈
      Then 該關場地類型為 "BEACH"

  Rule: 後置（狀態）- 通過一關後依固定順序建立下一關

    Example: 通過第1關後建立第2關
      Given 玩家已通過第1關
      When 系統推進至下一關（商店結束後）
      Then 系統建立第2關，currentEncounterSequence為2
      And 系統發布 PveEncounterCreated 事件

  # FR-C1/FR-C2 已定，2026-07-10全對弈階梯改版：全8關為DUEL，bossHpMax恆0；
  # 手數預算 50/45/55/55/60/65/70/75（L2/L7為既有驗證定案值、L1為§7.6重校準值，其餘為本文件
  # 起始值，Boss對弈統計驗證.feature 的N=200統計即為校準結果）；1/2/3/4/7/8=
  # PLAIN，5=VOLCANO(一次性岩石)，6=BEACH(每10手推浪)；開局腳本2=HUAYUE、
  # 7/8=PUYUE，其餘NONE。

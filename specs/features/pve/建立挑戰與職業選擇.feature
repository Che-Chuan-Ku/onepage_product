@ignore @command
Feature: 建立挑戰與職業選擇
  # 來源：PVE 增量 FR-B1 FR-C8（documents/PVE-挑戰模式-增量需求.md）；
  #   全面改版依 documents/PVE-全對弈階梯設計-2026-07-10.md §1：第1關重新定位為
  #   「NOVICE 入門魔王」對弈教學關，不再是消線PUZZLE（原TYPE_B衝四樣板/
  #   BossHP50 全數退役，見§8拆除清單）。
  # 事件：PveRunCreated
  # 規則：玩家選擇職業（WARRIOR 或 ARCHER）後建立 Run，同時建立第1關
  #   （棋盤11×11、場地PLAIN、encounterType DUEL、手數預算50，無BossHP概念、
  #   無開局腳本——NOVICE純反應式起手，§1）；同一帳號同時至多1個進行中的Run，
  #   建立新Run前必須先結束（通關/失敗/放棄）現有Run；PVE僅限已登入玩家。

  Background:
    Given 玩家 "alice" 已登入

  Rule: 後置（狀態）- 選擇職業後建立 Run 與第1關

    Example: 選擇劍士建立 Run
      When 玩家 "alice" 選擇職業 "WARRIOR" 建立 PVE Run
      Then 操作成功
      And 系統建立 Run，classType 為 "WARRIOR"，gold 為 0
      And 系統建立第1關：棋盤11×11、fieldType "PLAIN"、bossHpMax 0、moveBudget 50
      And 玩家 "alice" 持有技能 "HORIZONTAL_SLASH" 數量 1（劍士附贈技能，FR-B5）
      And 系統發布 PveRunCreated 事件

    Example: 選擇弓箭手建立 Run
      When 玩家 "alice" 選擇職業 "ARCHER" 建立 PVE Run
      Then 操作成功
      And 玩家 "alice" 持有技能 "PRECISION_SNIPE" 數量 1（弓箭手附贈技能，FR-B5）

    Example: 弓箭手第4關不會被贈送WARRIOR的保底橫劈技能（bug fix：舊版跨職業贈送殘留）
      # documents/PVE-全對弈階梯設計-2026-07-10.md §5.2「保底技能贈送」沿用07-09
      # 文件先例，但原程式碼沒有職業判斷——ARCHER起始技能是精準狙擊、班職技能組
      # 完全不含橫劈，卻仍被無條件贈送第4關保底HORIZONTAL_SLASH x2，是離題的
      # WARRIOR專屬贈禮殘留。修法：第4關保底僅套用於WARRIOR職業。
      When 玩家 "alice" 選擇職業 "ARCHER" 建立 PVE Run
      And 玩家位於第4關魔王對弈
      Then 玩家 "alice" 持有技能 "HORIZONTAL_SLASH" 數量為 0

  Rule: 前置（狀態）- 同一帳號同時至多 1 個進行中的 Run

    Example: 已有進行中 Run 時再次建立遭拒
      Given 玩家 "alice" 已有一個進行中的 PVE Run
      When 玩家 "alice" 再次嘗試建立 PVE Run
      Then 操作失敗
      And 錯誤為 "已有進行中的Run，須先結束才能建立新Run"

    Example: 前一個 Run 已結束（失敗）後可建立新 Run
      Given 玩家 "alice" 前一個 PVE Run 狀態為 "LOST"
      When 玩家 "alice" 選擇職業建立新 PVE Run
      Then 操作成功

  Rule: 前置（角色）- PVE 僅限已登入玩家

    Example: 訪客玩家嘗試建立 Run 時遭拒
      Given "guest001" 為訪客玩家
      When "guest001" 嘗試建立 PVE Run
      Then 操作失敗
      And 錯誤為 "PVE挑戰模式僅限已登入玩家"

  # FR-B1/FR-C8 已定（2026-07-10 全對弈階梯改版後）：第1關 11×11/PLAIN/DUEL/
  # 手數50（NOVICE教學關§7.6重校準，無HP概念）；一帳號至多1進行中Run；訪客不可玩。

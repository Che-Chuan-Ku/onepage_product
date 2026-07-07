@ignore @command
Feature: 建立挑戰與職業選擇
  # 來源：PVE 增量 FR-B1 FR-C8（documents/PVE-挑戰模式-增量需求.md）
  # 事件：PveRunCreated
  # 規則：玩家選擇職業（WARRIOR 或 ARCHER）後建立 Run，同時建立第1關
  #   （棋盤11×11、場地PLAIN、BossHP100、手數預算30）；同一帳號同時至多1個進行中的Run，
  #   建立新Run前必須先結束（通關/失敗/放棄）現有Run；PVE僅限已登入玩家。

  Background:
    Given 玩家 "alice" 已登入

  Rule: 後置（狀態）- 選擇職業後建立 Run 與第1關

    Example: 選擇劍士建立 Run
      When 玩家 "alice" 選擇職業 "WARRIOR" 建立 PVE Run
      Then 操作成功
      And 系統建立 Run，classType 為 "WARRIOR"，gold 為 0
      And 系統建立第1關：棋盤11×11、fieldType "PLAIN"、bossHpMax 100、moveBudget 30
      And 玩家 "alice" 持有技能 "HORIZONTAL_SLASH" 數量 1（劍士附贈技能，FR-B5）
      And 系統發布 PveRunCreated 事件

    Example: 選擇弓箭手建立 Run
      When 玩家 "alice" 選擇職業 "ARCHER" 建立 PVE Run
      Then 操作成功
      And 玩家 "alice" 持有技能 "PRECISION_SNIPE" 數量 1（弓箭手附贈技能，FR-B5）

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

  # FR-B1/FR-C8 已定：11×11/PLAIN/HP100/手數30；一帳號至多1進行中Run；訪客不可玩。

@ignore @query
Feature: 關卡持久化與續玩
  # 來源：PVE 增量 FR-B6（documents/PVE-挑戰模式-增量需求.md）
  # 事件：無新事件；查詢型行為
  # 規則：關卡狀態存於後端；玩家斷線或重新整理後，回到遊戲即從最後一手續玩。

  Background:
    Given 玩家 "alice" 有一個進行中的PVE Run，第2關進行中，已落子12手

  Rule: 後置（狀態）- 重新整理或重新登入後可查得最後狀態並續玩

    Example: 查詢目前進行中的Run取得最後一手狀態
      When 玩家 "alice" 查詢目前進行中的Run
      Then 系統回傳第2關狀態，movesUsed為12
      And 棋盤快照與已使用技能清單皆為斷線前最後狀態

    Example: 查詢特定關卡狀態供續玩渲染
      When 玩家 "alice" 查詢該進行中關卡的狀態
      Then 系統回傳Boss HP、剩餘手數、場地狀態（含已觸發的隱藏格）、已使用技能清單

  # FR-B6 已定：關卡狀態後端持久化，斷線/整理後由最後一手續玩。

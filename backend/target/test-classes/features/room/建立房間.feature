@ignore @command
Feature: 建立房間
  # 來源：需求 #5（建立/加入房間）、#26（線上 Swap2 特殊房間模式）
  # 事件：RoomCreated

  Rule: 後置（狀態）- 建立房間後產生唯一房間碼並將建立者加入房間

    Example: 建立私人房間後取得房間碼
      Given 玩家 "alice" 已登入
      When 玩家 "alice" 建立房間，可見性為 "PRIVATE"
      Then 操作成功
      And 系統產生一個唯一房間碼
      And 房間狀態為 "WAITING"
      And 玩家 "alice" 為房內成員
      And 系統發布 RoomCreated 事件

  Rule: 前置（參數）- 建立者可指定房間為普通模式或 Swap2 模式

    Example: 建立 Swap2 模式房間後 isSwap2Mode 為真
      Given 玩家 "alice" 已登入
      When 玩家 "alice" 建立房間並選擇 "Swap2 模式"
      Then 操作成功
      And 該房間的 isSwap2Mode 為 true

  Rule: 後置（狀態）- 公開房間可被列入公開房間列表

    Example: 建立公開房間後出現在公開列表
      Given 玩家 "alice" 已登入
      When 玩家 "alice" 建立房間，可見性為 "PUBLIC"
      Then 操作成功
      And 該房間出現在公開房間列表中

@ignore @command
Feature: 投擲硬幣決定先手 / 假先方
  # 來源：需求 #8（投擲硬幣）、#19（硬幣動畫）、#27（線上 Swap2 投擲決定假先方）
  # 事件：CoinTossCompleted → Swap2OpeningStarted

  Rule: 後置（狀態）- 普通模式硬幣結果決定誰執黑（先手）

    Example: 普通模式投擲後指派黑白
      Given 房間 "ABC123" 為普通模式且雙方皆 Ready
      When 系統投擲硬幣
      Then 操作成功
      And 系統指派一方執黑（先手）、另一方執白
      And 系統發布 CoinTossCompleted 事件

  Rule: 後置（狀態）- Swap2 模式硬幣結果決定誰是假先方（放置開局三子者）

    Example: Swap2 模式投擲後指派假先方並進入開局
      Given 房間 "SWAP01" 為 Swap2 模式且雙方皆 Ready
      When 系統投擲硬幣
      Then 操作成功
      And 系統指派一方為假先方（tentative-first）
      And 系統發布 CoinTossCompleted 事件
      And 隨後發布 Swap2OpeningStarted 事件

  Rule: 後置（回應）- 硬幣結果由後端決定，前端僅播放動畫呈現

    Example: 前端動畫結果與後端判定一致
      Given 後端已判定硬幣結果為 "HEADS"
      When 前端播放硬幣翻轉動畫
      Then 動畫最終呈現結果為 "HEADS"

@ignore @command
Feature: 開始本地遊戲
  # 來源：需求 #13（本地雙人）、#25（本地 Swap2 可選開局，假先方系統隨機）
  # 事件：LocalGameStarted（帶 useSwap2）

  Rule: 後置（狀態）- 開始本地遊戲時可選擇是否啟用 Swap2

    Example: 開始標準本地遊戲
      When 玩家開始本地遊戲，useSwap2 為 false
      Then 操作成功
      And 系統發布 LocalGameStarted 事件，useSwap2 為 false
      And 黑方先手開始落子

    Example: 開始啟用 Swap2 的本地遊戲
      When 玩家開始本地遊戲，useSwap2 為 true
      Then 操作成功
      And 系統發布 LocalGameStarted 事件，useSwap2 為 true
      And 系統隨機指派一方為假先方

  # ASM(A2 已確認): 本地 Swap2 假先方「由系統隨機決定」（需求 #25）。

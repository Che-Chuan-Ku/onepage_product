@ignore @command
Feature: 本地再戰與重置
  # 來源：需求 #14（本地再戰與重置）

  Rule: 後置（狀態）- 一鍵再戰時清空棋盤但保留雙方玩家名稱

    Example: 對局結束後再戰
      Given 一場本地對局已結束，玩家名稱為 "甲" 與 "乙"
      When 玩家點擊再戰
      Then 操作成功
      And 棋盤清空為空盤
      And 玩家名稱仍為 "甲" 與 "乙"

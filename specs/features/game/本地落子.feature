@ignore @command
Feature: 本地雙人落子
  # 來源：需求 #13（同裝置輪流下棋）、#11（共用 GameLogic 勝負判定）
  # 事件：LocalGameStarted, MovePlaced, WinConditionMet, GameDraw
  # 同裝置、無需網路；棋盤 15×15；長連算勝、無禁手

  Background:
    Given 一場本地雙人對局進行中，棋盤為 15×15
    And 目前輪到黑方

  Rule: 前置（參數）- 落子位置必須在棋盤範圍內且為空位

    Example: 在已有棋子的位置落子時遭拒
      Given (7,7) 已有黑子
      When 在 (7,7) 落子
      Then 操作失敗，錯誤為 "該位置已有棋子"

  Rule: 後置（狀態）- 合法落子後切換回合並更新本地棋盤

    Example: 合法落子後回合切換
      When 黑方在 (7,7) 落子
      Then 操作成功
      And 系統發布 MovePlaced 事件
      And 回合切換為白方

  Rule: 後置（狀態）- 同色達成五子或以上連線即判該方勝

    Example: 黑方連成五子時判黑方勝
      Given 黑方已在 (7,3),(7,4),(7,5),(7,6) 連續落子
      When 黑方在 (7,7) 落子形成水平五連
      Then 操作成功
      And 系統發布 WinConditionMet 事件，勝方為黑方

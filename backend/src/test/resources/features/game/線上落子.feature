@ignore @command
Feature: 線上即時落子
  # 來源：需求 #9（即時遊戲進行）、#11（落子驗證與勝負判定）、#16（狀態同步廣播）、#20（防作弊）
  # 事件：MovePlaced, GameStateUpdated, WinConditionMet, GameDraw, InvalidMoveRejected
  # 棋盤 15×15；長連算勝、無禁手（需求 #11 備註）

  Background:
    Given 一場線上對局進行中，棋盤為 15×15
    And 目前輪到黑方

  Rule: 前置（狀態）- 必須輪到該玩家才能落子（伺服器權威）

    Example: 非當前回合方落子時遭拒
      When 白方嘗試在 (7,7) 落子
      Then 操作失敗，系統發布 InvalidMoveRejected 事件
      And 錯誤為 "尚未輪到你"

  Rule: 前置（參數）- 落子位置必須在棋盤範圍內且為空位

    Example: 在已有棋子的位置落子時遭拒
      Given (7,7) 已有黑子
      When 黑方嘗試在 (7,7) 落子
      Then 操作失敗，系統發布 InvalidMoveRejected 事件
      And 錯誤為 "該位置已有棋子"

    Example: 在棋盤外的位置落子時遭拒
      When 黑方嘗試在 (15,15) 落子
      Then 操作失敗，系統發布 InvalidMoveRejected 事件
      And 錯誤為 "落子超出棋盤範圍"

    Example: 座標超出 schema 寬鬆上界時仍精確回報 422 而非 400（Bean Validation 短路防呆，需求 #36，api.yml:590-594/1335-1338）
      When 黑方嘗試在 (16,16) 落子
      Then 操作失敗，系統發布 InvalidMoveRejected 事件
      And 錯誤狀態碼為 422 且錯誤訊息為 "座標超出棋盤範圍"

  Rule: 後置（狀態）- 合法落子後後端記錄並廣播給房內雙方

    Example: 合法落子後廣播狀態更新
      When 黑方在 (7,7) 落子
      Then 操作成功
      And 系統發布 MovePlaced 事件
      And 系統發布 GameStateUpdated 事件廣播給雙方
      And 回合切換為白方

  Rule: 後置（狀態）- 同色達成五子或以上連線即判該方勝（長連算勝、無禁手）

    Example: 黑方連成五子時判黑方勝
      Given 黑方已在 (7,3),(7,4),(7,5),(7,6) 連續落子
      When 黑方在 (7,7) 落子形成水平五連
      Then 操作成功
      And 系統發布 WinConditionMet 事件，勝方為黑方
      And 系統發布 GameEnded 事件

    Example: 黑方連成六子（長連）時仍判黑方勝
      Given 黑方已在 (7,2),(7,3),(7,4),(7,5),(7,6) 連續落子
      When 黑方在 (7,7) 落子形成水平六連
      Then 操作成功
      And 系統發布 WinConditionMet 事件，勝方為黑方

  Rule: 後置（狀態）- 棋盤填滿且無人連線即判和局

    Example: 棋盤填滿無五連時判和局
      Given 棋盤已落滿 225 子且無任一方達成五連
      When 最後一子落下
      Then 系統發布 GameDraw 事件
      And 系統發布 GameEnded 事件

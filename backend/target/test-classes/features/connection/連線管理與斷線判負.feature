@ignore @command
Feature: 連線管理與斷線判負
  # 來源：需求 #15（WebSocket 連線管理）、#21（斷線與超時處理）
  # 事件：PlayerDisconnected, PlayerReconnected
  # 規則：線上遊戲中一方斷線 30 秒未重連 → 對手勝利（需求 #21）

  Background:
    Given 一場線上對局進行中
    And 玩家為 "alice"（黑）與 "bob"（白）

  Rule: 後置（狀態）- 以 2 秒心跳偵測連線；連續 6 秒無心跳判定為斷線

    Example: 連續 6 秒未收到心跳時判定玩家斷線
      Given WebSocket 心跳間隔為 2 秒
      When 系統連續 6 秒未收到 "alice" 的心跳
      Then 系統判定 "alice" 已斷線
      And 系統發布 PlayerDisconnected 事件

  Rule: 後置（狀態）- 偵測到玩家斷線時標記其為離線並啟動重連寬限計時

    Example: 玩家斷線後啟動 30 秒寬限計時
      When 玩家 "alice" 的 WebSocket 連線中斷
      Then 系統發布 PlayerDisconnected 事件
      And 系統對 "alice" 啟動 30 秒重連寬限計時

  Rule: 後置（狀態）- 玩家於寬限期內重連則恢復對局

    Example: 斷線後於寬限期內重連恢復對局
      Given 玩家 "alice" 斷線且重連寬限計時進行中
      When 玩家 "alice" 在 30 秒內重新連線
      Then 系統發布 PlayerReconnected 事件
      And 對局恢復進行，棋盤狀態與斷線前一致

  Rule: 後置（狀態）- 斷線方逾 30 秒未重連則判對手勝

    Example: 斷線逾 30 秒未重連時判對手勝
      Given 玩家 "alice" 斷線且重連寬限計時進行中
      When 30 秒過後 "alice" 仍未重連
      Then 系統判 "bob" 勝
      And 系統發布 GameEnded 事件

  Rule: 後置（狀態）- 雙方同時斷線且皆逾寬限期未重連則判和局

    Example: 雙方同時斷線皆逾 30 秒未重連時判和局
      Given 玩家 "alice" 與 "bob" 於同一寬限視窗內皆斷線
      When 30 秒過後雙方皆未重連
      Then 系統判該局為和局（DRAW）
      And 系統發布 GameEnded 事件

  Rule: 後置（狀態）- 對局尚未開始（開局/Ready 階段）即斷線不判負，僅退出房間

    Example: 對局尚未開始即斷線時不判負
      Given 房間 "ABC123" 尚在 WAITING / READY / OPENING 階段（對局未進入 PLAYING）
      When 對戰玩家 "alice" 斷線且逾寬限期未重連
      Then 系統不判任一方勝負
      And 系統將 "alice" 移出對戰席，房間退回等待狀態

  # 斷線參數（Q1 已定）：心跳間隔 2 秒；連續 6 秒無心跳判定斷線；
  #   斷線後 30 秒重連寬限；雙方同時斷線逾寬限 → 判和局；對局未進入 PLAYING 即斷線 → 不判負。

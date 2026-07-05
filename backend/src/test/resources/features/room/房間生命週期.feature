@ignore @command
Feature: 房間生命週期（對局結束關房、Ready 防護）
  # 來源：Bug fix — ONLINE 對局結束時房間應同步關閉（狀態轉 FINISHED）並退出大廳；
  #       已進行中/已結束的房間不可再切換 Ready（避免狀態被誤翻回 WAITING，見 GameService#closeRoomIfOnline / RoomService#toggleReady）。

  Rule: 後置（狀態）- ONLINE 對局結束時，房間狀態轉為 FINISHED 且不再出現於公開房間列表

    Example: 標準線上對局黑方五連勝後，房間關閉且退出大廳
      Given 玩家 "rl_host1" 與 "rl_guest1" 建立並加入一個公開線上房間
      And 雙方皆已標記 Ready 並完成開局
      When 黑方玩家於對局中連下五子獲勝
      Then 對局狀態為 "FINISHED"
      And 該房間狀態為 "FINISHED"
      And 該房間不再出現在公開房間列表中

  Rule: 前置（防護）- 已結束（FINISHED）的房間不可再切換 Ready

    Example: 對局結束後嘗試切換 Ready 應被拒絕（422）
      Given 玩家 "rl_host2" 與 "rl_guest2" 建立並加入一個公開線上房間
      And 雙方皆已標記 Ready 並完成開局
      And 黑方玩家於對局中連下五子獲勝
      When 玩家 "rl_host2" 嘗試切換 Ready
      Then 回應狀態碼為 422

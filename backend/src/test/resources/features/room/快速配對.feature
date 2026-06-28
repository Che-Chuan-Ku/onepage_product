@ignore @command
Feature: 快速配對
  # 來源：需求 #6（快速配對，Should）
  # 事件：PlayerJoinedRoom

  Rule: 後置（狀態）- 等待區無對手時玩家進入配對佇列等待

    Example: 配對佇列為空時加入等待
      Given 配對佇列為空
      And 玩家 "alice" 已登入
      When 玩家 "alice" 請求快速配對
      Then 操作成功
      And 玩家 "alice" 進入配對佇列等待

  Rule: 後置（狀態）- 佇列中已有等待者時系統自動配對並建立房間

    Example: 佇列中有等待者時自動配對成局
      Given 玩家 "alice" 已在配對佇列中等待
      And 玩家 "bob" 已登入
      When 玩家 "bob" 請求快速配對
      Then 操作成功
      And 系統將 "alice" 與 "bob" 配對到同一房間
      And 系統發布 PlayerJoinedRoom 事件

  Rule: 後置（狀態）- 在佇列等待逾 60 秒未配對則退出佇列並提示

    Example: 等待逾 60 秒未配對時退出佇列
      Given 玩家 "alice" 已在配對佇列中等待
      When "alice" 在佇列中已等待 60 秒仍無對手
      Then 系統將 "alice" 移出配對佇列
      And 系統提示 "排隊過久請重新開始配對"

  # 配對逾時（Q6 已定）：N=60 秒；逾時將玩家移出佇列，提示「排隊過久請重新開始配對」。

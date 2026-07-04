@ignore @command
Feature: 真劍勝負房間建立與場地選擇
  # 來源：需求 #34（真劍勝負房間建立與場地選擇）
  # 事件：RoomCreated（帶 fieldType）、CoinTossCompleted
  # 規則：線上限定；與 Swap2 互斥；先手沿用既有投擲硬幣（Q9）

  Rule: 前置（參數）- 建立真劍勝負房間時必須指定場地，且不可同時啟用 Swap2

    Example: 建立真劍勝負房間並選擇火山場地
      Given 玩家 "alice" 已登入
      When 玩家 "alice" 建立房間，選擇 "真劍勝負" 模式並指定場地 "VOLCANO"
      Then 操作成功
      And 該房間 battleMode 為 "SERIOUS_DUEL"
      And 該房間 fieldType 為 "VOLCANO"
      And 系統發布 RoomCreated 事件

    Example: 建立真劍勝負房間並選擇沙灘場地
      When 玩家 "alice" 建立房間，選擇 "真劍勝負" 模式並指定場地 "BEACH"
      Then 操作成功
      And 該房間 fieldType 為 "BEACH"

    Example: 同時啟用真劍勝負與 Swap2 時遭拒
      When 玩家 "alice" 嘗試建立房間並同時啟用 "真劍勝負" 與 "Swap2 模式"
      Then 操作失敗
      And 錯誤為 "真劍勝負模式與 Swap2 模式互斥"
      And 回應 HTTP 狀態碼為 422（對應 POST /rooms 422 UnprocessableEntity）

    Example: 建立真劍勝負房間未指定場地時遭拒
      When 玩家 "alice" 嘗試建立 "真劍勝負" 房間但未指定場地
      Then 操作失敗
      And 錯誤為 "真劍勝負模式必須指定場地"
      And 回應 HTTP 狀態碼為 422（對應 POST /rooms 422 UnprocessableEntity）

  Rule: 後置（狀態）- 真劍勝負對局先手沿用既有投擲硬幣機制，不使用 Swap2 開局

    Example: 真劍勝負房間雙方 Ready 後直接投擲硬幣決定黑白
      Given 房間 "ABC123" 為真劍勝負模式，場地為 "VOLCANO"
      When 雙方對戰玩家皆標記 Ready
      Then 系統進入投擲硬幣流程決定黑白
      And 不進入 Swap2 開局流程

  Rule: 後置（優先級）- 本地雙人真劍勝負為第二波後補功能（需求 #48）

    Example: 本地雙人模式建立真劍勝負對局時提示尚未支援
      When 玩家於本地雙人模式嘗試啟用 "真劍勝負"
      Then 系統標示為第二波後補功能（Could，需求 #48）

  # Q9 已定（A）：線上房間限定；與 Swap2 互斥；先手用既有投硬幣；優先級 Should。

@ignore @command
Feature: 加入房間
  # 來源：需求 #5
  # 事件：PlayerJoinedRoom

  Background:
    Given 系統中有以下房間：
      | roomCode | status      | playerSeatCount |
      | ABC123   | WAITING     | 1               |
      | FULL99   | IN_PROGRESS | 2               |

  Rule: 前置（狀態）- 房間碼必須存在

    Example: 輸入不存在的房間碼加入時操作失敗
      Given 玩家 "bob" 已登入
      When 玩家 "bob" 以房間碼 "NOEXIST" 加入房間
      Then 操作失敗，錯誤為 "房間不存在"

  Rule: 後置（狀態）- 對戰席未滿（上限 2）時加入成為對戰玩家

    Example: 加入有空對戰席的房間後成為對戰玩家
      Given 玩家 "bob" 已登入
      When 玩家 "bob" 以房間碼 "ABC123" 加入房間
      Then 操作成功
      And 玩家 "bob" 為房間 "ABC123" 的成員，角色為 "PLAYER"
      And 系統發布 PlayerJoinedRoom 事件

  Rule: 後置（狀態）- 對戰席已滿（2 人）時加入成為觀戰者

    Example: 加入對戰席已滿的房間後成為觀戰者
      Given 玩家 "bob" 已登入
      When 玩家 "bob" 以房間碼 "FULL99" 加入房間
      Then 操作成功
      And 玩家 "bob" 為房間 "FULL99" 的成員，角色為 "SPECTATOR"
      And 系統發布 SpectatorJoinedRoom 事件

  Rule: 前置（狀態）- 觀戰者為唯讀，不可落子且不參與 Ready 判定

    Example: 觀戰者嘗試標記 Ready 時操作失敗
      Given 玩家 "bob" 以觀戰者身份在房間 "FULL99" 中
      When 玩家 "bob" 標記 Ready
      Then 操作失敗，錯誤為 "觀戰者不可標記 Ready"

  # 房間人數（Q5 已定）：對戰席固定上限 2（role=PLAYER）；對戰席滿後再加入者
  #   自動成為 SPECTATOR 觀戰席（唯讀，不落子、不參與 Ready）。

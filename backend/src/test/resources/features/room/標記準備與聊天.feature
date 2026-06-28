@ignore @command
Feature: 房間內準備與聊天
  # 來源：需求 #7（房間內準備與聊天，Should）、#26（雙方 Ready 後強制 Swap2）
  # 事件：PlayerReadyToggled, AllPlayersReady

  Background:
    Given 房間 "ABC123" 中有玩家：
      | username | ready |
      | alice    | false |
      | bob      | false |

  Rule: 後置（狀態）- 玩家可切換自己的 Ready 狀態

    Example: 玩家標記 Ready 後狀態更新
      When 玩家 "alice" 標記 Ready
      Then 操作成功
      And 玩家 "alice" 的 ready 狀態為 true
      And 系統發布 PlayerReadyToggled 事件

  Rule: 後置（狀態）- 房內兩名對戰玩家皆 Ready 後觸發開局流程（觀戰者不計入）

    Example: 雙方對戰玩家皆 Ready 後進入開局
      Given 玩家 "alice" 已標記 Ready
      When 玩家 "bob" 標記 Ready
      Then 操作成功
      And 系統判定 AllPlayersReady（僅統計 role=PLAYER 的成員）
      And 普通模式房間進入投擲硬幣決定黑白；Swap2 模式房間進入投擲硬幣決定假先方

  Rule: 後置（狀態）- 玩家可在房內發送即時聊天訊息

    Example: 玩家發送聊天訊息後廣播給房內成員
      When 玩家 "alice" 在房間發送訊息 "hi"
      Then 操作成功
      And 房間 "ABC123" 內所有成員收到該訊息

  # ASM(A6 已確認): 聊天為 MVP 後加（需求 #7 備註）；訊息持久化於 room_chat_messages，長度上限 500 字。

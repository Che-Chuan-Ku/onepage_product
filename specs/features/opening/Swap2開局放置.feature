@ignore @command
Feature: Swap2 開局放置
  # 來源：需求 #24（Swap2 開局支援，標準規則）、#28（開局即時同步與權限）、#31（開局悔最後一子）
  # 事件：Swap2OpeningStarted, OpeningStonePlaced, ColorAssignmentFinalized

  Background:
    Given 一場 Swap2 模式對局已完成投擲硬幣
    And 假先方為玩家 "alice"，假後方為玩家 "bob"
    And 開局階段已開始（Swap2OpeningStarted）

  Rule: 前置（狀態）- 開局階段僅假先方可放置，假後方僅能觀看

    Example: 假後方於開局階段嘗試放置時遭拒
      When 假後方 "bob" 嘗試放置開局子
      Then 操作失敗，錯誤為 "開局階段僅假先方可放置"

  Rule: 後置（狀態）- 假先方依標準 Swap2 放置三子（黑·白·黑），每子確認並同步雙方

    Example: 假先方放置第一顆開局子後同步雙方
      When 假先方 "alice" 放置開局黑子於 (7,7) 並確認
      Then 操作成功
      And 系統發布 OpeningStonePlaced 事件
      And 該開局子記錄於 openingStones
      And 雙方畫面同步顯示落子動畫

    Example: 假先方完成三子開局後進入假後方選擇
      Given 假先方已放置開局子 (7,7)黑 與 (7,8)白
      When 假先方 "alice" 放置第三顆開局黑子於 (8,8) 並確認
      Then 操作成功
      And 開局放置階段結束
      And 進入假後方 Swap2 選擇階段

  Rule: 前置（狀態）- 開局階段僅允許悔「最後放置的一子」

    Example: 悔最後一子後該子被移除
      Given 假先方已放置開局子 (7,7)黑 與 (7,8)白
      When 假先方 "alice" 悔棋
      Then 操作成功
      And 最後放置的 (7,8)白 被移除
      And openingStones 不再包含 (7,8)

    Example: 嘗試悔非最後一子時操作失敗
      Given 假先方已放置開局子 (7,7)黑 與 (7,8)白
      When 假先方 "alice" 嘗試悔 (7,7)黑
      Then 操作失敗，錯誤為 "僅能悔最後放置的一子"

  # ASM(A1 已確認): 標準 Swap2 開局三子配色為「黑·白·黑」嚴格標準規則（需求 #24/#30）。

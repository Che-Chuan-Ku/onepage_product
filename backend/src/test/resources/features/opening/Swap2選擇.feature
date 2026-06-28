@ignore @command
Feature: Swap2 假後方選擇
  # 來源：需求 #28（Swap2ChoiceMade）、#29（假後方三個選項）、#30（顏色分配與輪次設定，嚴格標準）
  # 事件：Swap2ChoiceMade, ColorAssignmentFinalized, OpeningCompleted

  Background:
    Given 假先方已完成標準 Swap2 三子開局
    And 假先方為 "alice"，假後方為 "bob"
    And 系統進入假後方選擇階段

  Rule: 前置（狀態）- 僅假後方可在選擇階段做出 Swap2 選擇

    Example: 假先方於選擇階段嘗試選擇時遭拒
      When 假先方 "alice" 嘗試做出 Swap2 選擇
      Then 操作失敗，錯誤為 "僅假後方可選擇"

  Rule: 後置（狀態）- 假後方三選一，每個選項依標準規則確定最終黑白與輪次

    Example: 假後方選擇執黑時顏色分配定案
      When 假後方 "bob" 選擇 "執黑"
      Then 操作成功
      And 系統發布 Swap2ChoiceMade 事件
      And 假後方 "bob" 最終執黑，"alice" 執白
      And 系統發布 ColorAssignmentFinalized 事件
      And 系統發布 OpeningCompleted 事件，輪到白方落子

    Example: 假後方選擇執白時顏色分配定案
      When 假後方 "bob" 選擇 "執白"
      Then 操作成功
      And 假後方 "bob" 最終執白，"alice" 執黑
      And 系統發布 ColorAssignmentFinalized 與 OpeningCompleted 事件

    Example: 假後方選擇放第四五子轉嫁選擇權時進入二階段
      When 假後方 "bob" 選擇 "放置第四、五子(再由對手選色)"
      Then 操作成功
      And 假後方 "bob" 放置一白一黑兩顆子
      And 選色權轉回假先方 "alice"

  # ASM(A1 已確認): 三選項採嚴格標準 Swap2：(1)執黑 (2)執白 (3)放第4·5子再由對手選色（需求 #30）。

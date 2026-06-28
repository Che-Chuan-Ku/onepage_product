# Swap2 第一次教學提示

來源：需求 #33（Swap2 第一次教學提示，Should）

## 描述
玩家第一次進入 Swap2 模式時，顯示簡單規則說明（可跳過）。以 localStorage 記錄是否已看過。

## 佈局
- Modal / Tooltip 覆蓋層，內含 Markdown 規則說明（假先方放三子 → 假後方三選一）
- 「我知道了」/「跳過」按鈕
- 「不再顯示」選項

## 互動行為
- 首次進入 Swap2 模式 → 顯示；已看過（localStorage 標記）→ 不顯示
- 可隨時從說明入口再次開啟

## RWD
- 行動版全屏 Modal

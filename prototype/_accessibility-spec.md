# Accessibility Spec — Gomoku（P3）

## 1. 對比度（WCAG AA）
- 主文字 `--c-text #f2ece2` on `--c-bg #1a1714` ≈ 13:1（AAA）。
- 次文字 `--c-text-dim` on surface ≥ 4.5:1。
- 主按鈕文字（深色）on `--c-primary #e0a458` ≥ 4.5:1。
- 棋子不可僅靠顏色辨識 → 黑/白子搭配「執黑/執白」文字標籤 + 回合指示器。

## 2. 鍵盤操作
- 所有按鈕、頁籤、選項卡 `tabindex` 可達，`:focus-visible` 有 2px 金色外框。
- 棋盤支援方向鍵移動游標 + Enter/Space 落子（桌機輔助）。
- Modal（教學/結束）開啟時 focus trap，Esc 關閉（教學可關，結束畫面不可 Esc 跳過）。

## 3. 觸控目標（需求 #18）
- 互動元件最小 44×44px。
- 棋盤行動版落子採「兩段式」：點擊先放半透明預覽 + 放大鏡，再點「確認此子」落定，避免誤觸。

## 4. ARIA / 語意
- 棋盤 `role="grid"`，交叉點 `role="gridcell"` 含 `aria-label="第N行第M列，空/黑/白"`。
- 回合指示 `aria-live="polite"`；Toast `role="status" aria-live="polite"`；錯誤 Toast `aria-live="assertive"`。
- 連線狀態 badge `aria-live="polite"`（重連/斷線播報）。
- 硬幣結果、Swap2 輪次切換以 `aria-live` 播報「輪到你 / 等待對手」。

## 5. 動效尊重
- `@media (prefers-reduced-motion: reduce)`：硬幣改淡入直接顯示結果、落子去除 scale 動畫、連五高亮改靜態描邊。

## 6. 表單可及性
- 登入/註冊欄位有 `<label>`、`autocomplete`、錯誤訊息以 `aria-describedby` 關聯。
- 訪客暱稱空白錯誤即時 `aria-live` 提示。

## 7. 色盲友善
- 連五高亮除黃光外加「連線描繪 + 端點圓圈」雙重編碼。
- 房間模式標籤「普通 / Swap2」用文字 + 圖示，不僅靠色塊。

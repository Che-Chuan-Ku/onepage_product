# UX Review — Gomoku（P3）

> hybrid 模式自動產出。對 9 個 prototype 執行可用性審查。
> status: **passed_with_warnings**（無 ❌ 阻斷項；3 項 ⚠ 待後端整合澄清）

## 審查維度

### 1. 任務入口（Task Entry）✅
- 首頁兩大模式按鈕 3 次點擊內可開局（本地）。
- 線上未登入有明確分流彈窗（登入 / 訪客）。
- 大廳建房/加入/配對三入口並列於側欄，行動版堆疊。

### 2. 錯誤恢復（Error Recovery）✅
- 所有失敗以 Toast 呈現、不破壞當前狀態：房間不存在、暱稱空白、Email 格式、登入失敗、配對逾時、非法落子、斷線重連。
- 離開對局有二次確認 Modal，防誤觸。

### 3. 空狀態（Empty State）✅
- 大廳：列表為示意資料；房間：對手空位顯示「等待對手」。
- 回放：起始狀態顯示空盤 + 「起始」標記。
- ⚠ 建議補：大廳無公開房間時的空狀態插畫/文案（後端整合時補）。

### 4. 互動密度（Interaction Density）✅
- 對戰頁採沉浸式，隱藏全域 Header，僅留最小「離開」入口。
- 棋盤行動版兩段式落子（預覽 + 確認此子），桌機方向鍵 + Enter 輔助。
- 資訊列輕量，回合/執色/連線狀態恆可見。

### 5. 狀態透明（State Transparency）✅
- TurnIndicator + aria-live 播報「輪到誰」。
- Swap2 開局橫幅顯示階段與 n/3 進度。
- ConnectionBadge 三態（online/reconnecting/offline）。

### 6. 權限一致性（Permission Consistency）✅
- 觀戰者：棋盤唯讀（spectating cursor）、Ready 按鈕移除、結束畫面無再戰、點棋盤給「觀戰中無法落子」Toast。
- Swap2 非當前操作方控制元件禁用。
- 訪客線上局結束無再戰，改「重新輸入暱稱」+ 註冊引導（Q4）。

### 7. 響應式（RWD）✅
- 棋盤 `aspect-ratio:1/1` + `min()` 等比縮放。
- mode-grid / opt-grid 行動版單欄；聊天可收合；layout 900px 以下單欄。

### 8. 可及性（Accessibility）✅
- focus-visible、role=grid/gridcell、aria-live、prefers-reduced-motion、≥44px 觸控目標。

## ⚠ 警告（非阻斷，待後端/需求澄清）
1. 觀戰人數無上限規格 → 原型不設硬上限。
2. 連線斷線「寬限時間」具體秒數未定（#15）→ 原型以示意重連 2.2s 呈現。
3. 大廳無房間之空狀態文案待補。

## 結論
9 feature 全數通過可用性審查，無嚴重問題。3 項警告屬後端整合/需求補充範疇，不阻斷交付前端。

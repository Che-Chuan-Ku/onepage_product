# Design Strategy — Gomoku 五子棋（P3）

> 跨 feature 設計語言。Tone：沉穩木質對弈 + 現代極簡 UI，專注棋局、適度慶祝。

## 1. 設計原則
1. **棋盤是主角** — 對戰頁所有元素服務於棋盤可讀性，資訊列輕量化。
2. **狀態永遠透明** — 「輪到誰、執什麼色、連線狀態」任何時刻可見。
3. **觸控優先** — 行動版為第一公民，落子有放大確認，按鈕 ≥ 44px。
4. **適度動效** — 落子、硬幣、連五高亮有動畫；過場克制，不干擾決策。
5. **失敗不破壞** — 錯誤用 Toast，不彈窗打斷、不重置棋盤。

## 2. 設計 Token

### 配色（深色木質基調）
| Token | 值 | 用途 |
|-------|-----|------|
| `--c-bg` | `#1a1714` | 全局背景（深木炭） |
| `--c-surface` | `#252019` | 卡片/面板 |
| `--c-surface-2` | `#2f2820` | 次層面板/hover |
| `--c-board` | `#d9a86c` | 棋盤木色 |
| `--c-board-line` | `#6b4f30` | 棋盤格線 |
| `--c-stone-black` | `#1b1b1f` | 黑子（含高光漸層） |
| `--c-stone-white` | `#f4f1ea` | 白子 |
| `--c-primary` | `#e0a458` | 主行動（暖金，本地/主按鈕） |
| `--c-accent` | `#4ea1d3` | 線上/次要強調（藍） |
| `--c-success` | `#5cb85c` | Ready/勝 |
| `--c-danger` | `#e0573e` | 錯誤/離開/負 |
| `--c-win-highlight` | `#ffd34d` | 連五高亮 |
| `--c-text` | `#f2ece2` | 主文字 |
| `--c-text-dim` | `#a99e8d` | 次文字 |
| `--c-border` | `#3a322a` | 邊框 |

### 字體
- 系統 stack：`-apple-system, "PingFang TC", "Noto Sans TC", "Segoe UI", Roboto, sans-serif`
- 標題 700、正文 400/500、數字（戰績/計時）使用 `font-variant-numeric: tabular-nums`

### 間距 / 圓角 / 陰影
- spacing scale：4 / 8 / 12 / 16 / 24 / 32 / 48
- radius：`--r-sm 8px` / `--r-md 14px` / `--r-lg 22px` / `--r-pill 999px`
- shadow：`--sh-card 0 6px 24px rgba(0,0,0,.35)`；`--sh-stone 0 2px 4px rgba(0,0,0,.5)`

## 3. 響應式斷點（RWD，需求 #18）
| 斷點 | 寬度 | 佈局 |
|------|------|------|
| mobile | < 640px | 單欄、模式按鈕上下堆疊、聊天/側欄可收合、棋盤占滿寬度、落子放大確認 |
| tablet | 640–1024px | 棋盤主區 + 可收合側欄 |
| desktop | > 1024px | 棋盤居中 + 固定資訊側欄並排 |

棋盤一律以 `min(可用寬, 可用高)` 等比縮放，維持正方形。

## 4. 動效策略（Framer Motion 意圖，原型以 CSS/JS 模擬）
| 動效 | 規格 |
|------|------|
| 落子 | scale 0.6→1 + 透明 0→1，180ms ease-out |
| 硬幣 3D 翻轉 | rotateX/rotateY 多圈，1.6s，停在結果面 |
| 連五高亮 | 連五子依序 pulse 發光 + 連線描繪，逐子 120ms |
| 結束橫幅 | 從下滑入 + 背景 dim，300ms |
| Toast | 右上/頂部滑入，自動 3s 淡出 |
| 頁面過場 | fade 150ms（原型內以 SPA-ish hash 切換或獨立頁示意） |

## 5. 共用元件（→ 詳見 _component-inventory.md）
Board、Stone、TurnIndicator、ConnectionBadge、Toast、Modal、Button（primary/accent/ghost/danger）、PlayerSlot、RoomCard、ChatPanel、CoinFlip、Swap2OptionCard、WinHighlight、StatCard、LeaderRow、ReplayControls。

## 6. 原型技術做法
- 純靜態自包含 HTML，每 feature 一個 `index.html`。
- 共用樣式 `assets/theme.css`、共用腳本 `assets/board.js`（棋盤渲染）、`assets/ui.js`（Toast/Modal/導覽）。
- 互動以原生 JS 模擬（無後端）：硬幣結果、落子、Swap2 流程、配對倒數皆前端假資料演示。
- 所有頁面以 `assets/` 相對路徑連結，可直接雙擊開啟（`file://` 友好，不依賴打包）。

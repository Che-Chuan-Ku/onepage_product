# Feature Manifest — Gomoku（五子棋）

> spec-reader 產出。Input Guard 結果 + feature 清單 + input 狀態。
> 模式：P3（最終視覺）｜workflow_mode：hybrid

## Input Guard 結果

| 檢查項 | 狀態 | 備註 |
|--------|------|------|
| `specs/activities/` | ✅ 3 檔 | `.mmd` 而非 `.activity`，內含標準 `[ACTIVITY]/[ACTOR]/[STEP]/[DECISION]` 標記，相容解析 |
| `arguments.yml` | ⚠️ 缺失 | Hub 未提供；模組以預設路徑（`specs/`、`prototype/`）運行，不阻擋 |
| `specs/ui/` | ✅ 11 檔 | 覆蓋率高 |
| `specs/actors/` | ✅ 2 檔 | 訪客玩家 / 註冊玩家 |
| `specs/features/` | ✅ 17 feature + 系統抽象.md | 補充事件流與權限規則 |

> 註：`arguments.yml` 缺失與 `.mmd` 副檔名差異屬環境配置層，非規格內容衝突，**不記 CiC**。

## Activity → UI 對照

| Activity (.mmd) | 涉及 UI 頁 |
|-----------------|-----------|
| 使用者管理 | 登入註冊頁、排行榜頁、（回放頁入口） |
| 本地雙人對戰 | 模式選擇首頁、Swap2開局介面、Swap2教學提示、棋盤對局頁、對局結束畫面 |
| 線上連線對戰 | 模式選擇首頁、大廳與房間列表、房間頁、硬幣投擲動畫、Swap2開局介面、棋盤對局頁、對局結束畫面 |

## Feature 清單（9 個 prototype 單元）

11 頁 UI 規格依互動場景與共用渲染整併為 9 個 feature 原型單元：

| # | feature | 對應 UI 規格 | 角色 | UI 來源 | 信心 |
|---|---------|-------------|------|---------|------|
| 1 | `home` | 模式選擇首頁 | 訪客/註冊 | spec（+derived 補首頁 entry 細節） | high |
| 2 | `user` | 登入註冊頁（含訪客暱稱入口） | 訪客→註冊 | spec | high |
| 3 | `lobby` | 大廳與房間列表 | 註冊 | spec | high |
| 4 | `room` | 房間頁（準備/聊天/觀戰席） | 註冊/訪客/觀戰 | spec | high |
| 5 | `opening` | Swap2開局介面 + Swap2教學提示 + 硬幣投擲動畫 | 假先/假後 | spec | high |
| 6 | `game` | 棋盤對局頁（15×15，含觀戰唯讀） | 玩家/觀戰 | spec | high |
| 7 | `result` | 對局結束畫面 | 玩家/訪客/觀戰 | spec | high |
| 8 | `leaderboard` | 戰績與排行榜頁 | 註冊 | spec | high |
| 9 | `replay` | 對局回放頁 | 註冊 | spec | high |

整併理由：
- `opening` 三頁（Swap2介面 / 教學 / 硬幣）在 activity 中是同一連續開局子流，且共用棋盤渲染，整併為單一原型可完整演示「硬幣 → 放置 → 三選一 → 進對局」的轉場。
- 棋盤渲染（15×15 + 星位）為 `game` / `opening` / `replay` 共用元件，集中定義於 `assets/board.js`。

features_count = 9

## 衍生產物

| 檔案 | 原因 |
|------|------|
| `prototype/_derived/home.md` | 首頁規格未明確界定「已登入 vs 未登入 vs 訪客」三態 header 與入口顯隱，spec-reader 推導補全（不汙染 specs/） |

## 待澄清（不阻擋，記錄供需求模組參考）

- 觀戰者上限人數未定義（房間頁顯示「觀戰人數」但無上限規格）→ 原型以「不設硬上限」呈現。
- 快速配對逾時 60 秒（Q6）已明確，原型實作倒數提示。

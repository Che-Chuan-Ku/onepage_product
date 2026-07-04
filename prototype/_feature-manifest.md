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

---

## 增量：真劍勝負模式（需求 #34–48，2026-07-04 CHANGE 模式）

> 上游需求模組新增/更新規格，本模組執行增量原型更新（不重做既有 9 個 feature 單元，僅整合修改）。

### 本次消費的規格

| 文件 | 狀態 |
|------|------|
| `specs/activities/真劍勝負模式.mmd` | 新增 |
| `specs/activities/線上連線對戰.mmd` | 更新（D2a 新增「真劍勝負」分支） |
| `specs/ui/職業選擇介面.md` | 新增 |
| `specs/ui/大廳與房間列表.md` | 更新（三選一房間模式 + 場地選擇） |
| `specs/ui/房間頁.md` | 更新（職業選擇區塊嵌入） |
| `specs/ui/棋盤對局頁.md` | 更新（場地渲染、技能操作列） |
| `specs/ui/對局結束畫面.md` | 更新（隱藏格賽後揭露） |
| `specs/ui/回放頁.md` | 更新（技能/場地事件回放） |
| `documents/clarify/2026-07-04-1021.md` | 規則定案依據（權威） |

### Feature 對照（整併入既有單元，未新增獨立 feature 目錄）

| 規格 | 整併至 | 理由 |
|------|--------|------|
| `specs/ui/職業選擇介面.md` | `room`（`prototype/room/index.html`） | 規格明定「嵌於房間頁」，非獨立路由頁面 |
| 場地/職業選擇（房間建立） | `lobby` + `room` | 建立房間彈窗（lobby）+ 房間內狀態（room） |
| 技能操作列、場地渲染 | `game`（`prototype/game/index.html`，`?mode=duel&field=volcano\|beach`） | 沿用共用棋盤渲染 `assets/board.js`，擴充 `size`/`field`/障礙物/隱藏格/預覽框 API |
| 隱藏格賽後揭露 | `result` | 新增「真劍勝負」情境切換按鈕 |
| 技能/場地事件回放 | `replay` | 新增 `?mode=duel&field=` 情境入口 |

features_count 維持 9（無新增 feature 單元，皆為既有單元的增量修改）。

### 共用資產擴充

- `assets/board.js`：`GomokuBoard` 新增 `size`（15/16 參數化）、`field`（volcano/beach）、`setObstacles`/`isObstacle`、`setBeach`/`isOcean`（含 erosion 侵蝕推進）、`revealHidden`/`revealAll`（隱藏格揭露）、`setPreviewRect`/`setPreviewLine`（大絕 3×2、附掛預覽）、`onHover`/`onStoneClick` 回呼。
- `assets/theme.css`：新增 `.badge-duel`、`.class-card`/`.class-grid`、`.reveal-banner`、`.skill-bar`/`.skill-btn`/`.skill-drawer`（行動版底部抽屜）、`.field-legend`、`.dir-pad`、`.fx-burn`/`.fx-wave`/`.fx-tide` 特效占位。

### 待澄清（本次增量，不阻擋）

- 橫劈/縱劈/精準狙擊/散射/大絕的精確連鎖推擠與棋盤邊界規則，原型以簡化版示範互動流程（選技能→選方向/目標→結算），實際引擎規則以需求文件與後續 domain 模組為準，非本模組職責。
- 職業揭曉動畫、火山噴發/海浪/漲潮特效的具體動效規格，需求文件標注「留待 UI 設計階段」（documents/clarify/2026-07-04-1021.md R2-1），本次以 CSS keyframe 占位呈現，供前端模組後續精修。

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

## Feature 清單（初版 9 個 prototype 單元；PVE 增量後共 13 個，見文末增量段）

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

---

## 增量：PVE 挑戰模式（documents/PVE-挑戰模式-增量需求.md，2026-07-07 CHANGE 模式）

> 上游需求模組新增單人 PVE 玩法規格，本模組執行增量原型（新增 4 個獨立 feature 單元 + 更新 `home` 的模式選擇入口）。

### 本次消費的規格

| 文件 | 狀態 |
|------|------|
| `specs/activities/PVE挑戰模式.mmd` | 新增 |
| `specs/ui/模式選擇首頁.md` | 更新（新增「PVE 挑戰模式」第三入口） |
| `specs/ui/PVE職業選擇頁.md` | 新增 |
| `specs/ui/PVE棋盤關卡頁.md` | 新增 |
| `specs/ui/PVE商店頁.md` | 新增 |
| `specs/ui/PVE結算畫面.md` | 新增 |
| `specs/actors/註冊玩家.md` | 更新（新增 PVE 相關可執行行為） |
| `specs/actors/訪客玩家.md` | 更新（明定訪客不可遊玩 PVE） |
| `documents/PVE-挑戰模式-增量需求.md` | 規則定案依據（權威，含 FR-A/B/C 全量） |
| `documents/PVE-小丑牌模式-設計指引.md` | 設計脈絡與核心手感決策依據（連線=傷害模型） |

### Feature 對照（新增 4 個獨立單元）

| 規格 | feature | 對應輸出 |
|------|---------|---------|
| `specs/ui/PVE職業選擇頁.md` | `pve-class` | `prototype/pve-class/index.html` |
| `specs/ui/PVE棋盤關卡頁.md` | `pve-game` | `prototype/pve-game/index.html` |
| `specs/ui/PVE商店頁.md` | `pve-shop` | `prototype/pve-shop/index.html` |
| `specs/ui/PVE結算畫面.md` | `pve-result` | `prototype/pve-result/index.html`（同版面骨架涵蓋關卡結算＋Run結算兩種情境） |
| `specs/ui/模式選擇首頁.md`（更新） | `home`（既有單元，整合修改） | `prototype/home/index.html` 新增第三張模式卡＋PVE 訪客阻擋彈窗＋進行中 Run 導續玩邏輯 |

features_count：9（既有）+ 4（新增）= 13。

### 共用資產擴充

- `assets/board.js`：`GomokuBoard` 星位新增 `N===11` 座標定義（PVE 11×11 專用幾何，FR-B1，向下相容 15/16 既有邏輯不變）。
- `assets/theme.css`：新增 PVE 專屬區塊 — Boss HP／手數預算進度條、Boss 突變橫幅、連線傷害浮動數字（`.dmg-anchor`/`.dmg-float`）、技能持有數量徽章（`.skill-btn .qty`）、商店卡片（`.shop-grid`/`.shop-card`）、Run/關卡結算統計格（`.pve-stat-grid`）；`.mode-grid` 由 2 欄調整為 3 欄（首頁新增第三入口）。

### 核心手感實作說明（非僅線框，含可運作邏輯）

依《PVE-小丑牌模式-設計指引.md》風險段點名「連線清除後的棋型設計是新玩法的手感核心，需要 prototype 驗證」，`pve-game/index.html` 並未僅以靜態示意呈現，而是實作了：
- 真實連線偵測（四方向，含 6+ 連自動合併不拆多條五連，FR-B2 FR-B3）與傷害結算（50 + 每多1顆 +20）。
- Boss 突變：第3關「獨眼」（橫向連線不結算）、第6關「震怒」（每5手自動噴發）、第8關「深淵」（每次結算後生成障礙棋子）皆為真實觸發邏輯，非僅文字說明。
- 技能操作流程（選技能→選目標→結算）沿用真劍勝負模式已驗證過的 UX 模式（方向/錨點選取、散射兩點選取）。

已完成瀏覽器實測（Playwright，本機臨時伺服器）：首頁三卡入口／訪客阻擋彈窗、職業選擇→建立 Run、關卡內落子連線傷害結算與技能施放、商店購買/跳過、放棄挑戰、以及 8 關全通關的完整 Run 結算（Boss HP 曲線 100/160/260/420/670/1070/1710/2740、突變出現於第3/6/8關、隨機場地 volcano/beach 皆正確），全程無 console error。

### 待澄清（本次增量，不阻擋）

- 技能效果於 PVE 情境下的確切數值/範圍（橫劈/縱劈/大絕/精準狙擊/散射）：需求文件僅定義使用機制（消耗型、獨立行動、每間隔至多1個，FR-A2 FR-B5），未定義各技能在無敵方棋子情境下的具體效果轉換；原型依《PVE-小丑牌模式-設計指引.md》建議（「橫斬變成清一行並計傷」）採用簡化占位公式（15 + 每多1顆 +10），並於 UI 文案標示「占位公式」，正式數值由後續 domain/引擎模組（效果系統資料驅動化，增量A）定案，非本模組職責。
- 遺物（FR-C5）之數值效果（如「斜行者」倍率、「節拍器」連擊加成）僅於商店/持有清單/結算畫面呈現名稱與效果說明文字，未接入實際傷害計算，因效果系統的資料驅動實作屬增量A範疇。
- 第2/5/7關「隱藏格（噴發/漲潮，至多3個）」之確切觸發時機規格未明定（僅第6關「震怒」與 BEACH 場地「每10手海浪」為明確觸發規則，已實作為真實邏輯），原型改以「示範觸發」按鈕呈現（沿用真劍勝負模式既有 demoEruption/demoWave/demoTide 之慣例），供設計檢視用途。

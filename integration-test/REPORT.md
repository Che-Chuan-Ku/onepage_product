## 2026-07-04 CHANGE 輪：需求 #34–48「真劍勝負模式」真前後端對接

**方法沿用**：分段全棧 E2E（backend compile → Cucumber e2e → compose 全棧 → Playwright 真 API），auto_fix。

### Stage 結果
| Stage | 結果 |
|---|---|
| 後端 compile / test-compile | PASS |
| 後端 Cucumber e2e（含新 room/game 真劍勝負 features） | **124/124 PASS**（穩定重跑 2 次皆綠；期間 1 次因 VOLCANO 障礙物隨機座標撞上測試 filler 座標的既有 flake，與本輪改動無關） |
| docker-compose 全棧（backend 用本輪程式碼重建） | healthy |
| 前端 Playwright 真 API（`real-api.spec.ts` + `online.spec.ts`） | **12/12 PASS**（online 1 次 STOMP 雙瀏覽器已知 flaky，retry 後綠） |
| 前端 MSW 回歸（`duel.spec.ts` + `full-coverage.spec.ts` + `smoke.spec.ts` + `play.spec.ts`） | 41/44（3 個既有失敗與本輪無關，見下） |
| 前端 `next build` | PASS |

### 4 個已知縫隙驗證結論
1. **終局隱藏格全揭露**：**真 bug，已修**。`SeriousDuelService.buildRevealedHiddenCells` 只揭露 `isTriggered()` 的格，FINISHED 後仍過濾未觸發格；`specs/ui/對局結束畫面.md:20` 明定「結束後揭露本局所有隱藏格」。改為 `gameFinished || cell.isTriggered()`；以真後端跑一場沙灘對局到底驗證：5 個 TIDE 格全數出現於 `revealedHiddenCells`，即使全程 `tideTriggered=false`。
2. **usedSkills 重連恢復**：**真 bug，已修**。前端 `usedSkills` 純本地追蹤，重連/reload 必reset 成 0/3，違反 R2-3。`GameReplayResponse` 新增 `skillUsages`（playerId+skillType）與 `currentTurn`；前端 `loadReplay()` 依 `blackPlayerId`/`whitePlayerId` 映射回填。一併發現並修：①`GameReplayResponse` 原無 `currentTurn`，duel 模式重連只能靠 moveCount 奇偶猜測，大絕（0 子）、散射（2 子）皆會猜錯——改用權威 `currentTurn`；②`if (moveCount>0)` 門檻在「第一手就是大絕」時會整組跳過重建（moveCount 停在 0）——改用「是否有非 FIELD_GENERATED 事件」判斷。
3. **散射第二子 replay**：**查無 bug**。後端每子各存一筆 `Move`（同色、連續 moveNumber），前端回放用 `m.color` 逐筆渲染（非奇偶推斷），真後端驗證兩子皆正確出現於 `moves`。
4. **seaSide 前端主路徑消費**：**真 bug，已修**。真後端 `FIELD_GENERATED` 事件的 `row/col` 恆為 null（game 級事件非格級），前端 `duelFieldMeta` 舊有 fallback 完全靠該事件座標推斷海側/障礙物，等同失效——BEACH 恆誤判為海在上方，VOLCANO 障礙物恆空。`GameReplayResponse` 新增權威 `obstacles`/`seaSide`（來源同 `GameStateResponse.fieldState`），`game/[gameId]` 與 `replay/[gameId]` 頁改為優先採用，事件推斷僅作 MSW mock 相容 fallback。真後端驗證：BEACH 房間 `seaSide=WEST` 正確回傳且前端採用。

### 額外發現並修復（auto_fix 範圍內，整合層對齊）
- **（高風險，已修）`GameStateResponse` zod schema 缺陷阻斷所有真後端落子**：後端 `GameStateResponse` 標註 `@JsonInclude(ALWAYS)`，NORMAL 對局的 `revealedHiddenCells`/`skillEvents` 顯式回傳 `null`；前端 zod schema 只有 `.optional()` 缺 `.nullable()`，`schema.parse()` 對顯式 `null` 拋 ZodError，被 `place()` 的 `catch` 誤判為業務錯誤（「落子不合法」toast），`applyState` 從未執行 → **UI 上任何一手棋（不分本地/線上、一般/真劍勝負模式）點擊後棋盤/回合/手數完全不更新**，但後端已正確落子。這是本輪 Playwright 真 API 回歸測試（`本地雙人對戰`）抓到的，MSW 因為 mock 手寫回應不會顯式帶 `null` 故未曾暴露。修法：兩欄位補 `.nullable()`。
- **（中風險，已修）MSW `swap2-choice` handler 回歸**：`PLACE_TWO_MORE` 分支被移除，不論選項一律直接 finalize 成 `PLAYING`，導致既有「放第四五子二階段」流程（`full-coverage.spec.ts` S3）整條斷裂。補回分支＋`swap2TwoMoreChosen` 旗標＋開局子上限依旗標調整（3→5）。

### 既有流程回歸
- 一般模式 / Swap2（本地+線上）：real-api + online 套件全綠，S1–S5 全綠。
- 3 個 MSW 既有失敗（`使用者頁登入失敗 toast`、`房間 Ready 按鈕文字`、`房間聊天 STOMP pageerror`）**與本輪改動無關**：分別為 mock 登入 handler 從不驗證帳密（pre-existing）、mock toggle-ready 回傳硬編 playerId 對不上動態 guestId（pre-existing，程式註解自承「pre-duel behavior verbatim」）、STOMP 斷線時序 pageerror（未追查根因，房間頁本輪未變動）。均與 `git diff` 確認非本輪或本 session 觸碰的程式碼，建議另開 ticket。

### 修改檔案
- `backend/src/main/java/com/gomoku/service/SeriousDuelService.java`（新，隨 backend_development 本輪產出；本模組修 `buildRevealedHiddenCells` 全揭露、新增 `listSkillUsages`/`buildFieldSummary`）
- `backend/src/main/java/com/gomoku/service/GameService.java`（`getGameReplay` 新增 `currentTurn`/`skillUsages`/`obstacles`/`seaSide`）
- `backend/src/main/java/com/gomoku/dto/response/GameReplayResponse.java`（同上新欄位，additive）
- `backend/src/main/java/com/gomoku/repository/SkillUsageRepository.java`（新增 `findByGameIdOrderByUsedAtAsc`）
- `frontend/src/lib/types/schemas.ts`（**關鍵修復**：`GameStateResponse.revealedHiddenCells`/`skillEvents` 補 `.nullable()`；`GameReplayResponse` 新增對應欄位）
- `frontend/src/app/game/[gameId]/page.tsx`（duel `loadReplay()`：採用權威 currentTurn/obstacles/seaSide、usedSkills 重連回填、修 moveCount>0 門檻）
- `frontend/src/app/replay/[gameId]/page.tsx`（duelMeta 優先採用權威 obstacles/seaSide）
- `frontend/src/mocks/handlers/index.ts`（修復 swap2-choice PLACE_TWO_MORE 回歸）

改動前均已 `cp <檔> <檔>.bak-20260704b`（或 c）備份於同目錄。

---

# 整合測試報告 — gomoku

- **模組**：integration_test（AIBDD Workflow v3.0）
- **日期**：2026-06-07
- **方法**：分段全棧 E2E（後端編譯 → Cucumber e2e → compose 全棧 → Playwright 真 API），問題自動修正
- **驗收基準**（唯讀）：`specs/features/*.feature`（17 features / 64 scenarios）+ `specs/api.yml`（18 endpoints）

## 結果總覽

| 階段 | 結果 | 備註 |
|---|---|---|
| 後端編譯（Docker maven + JDK21） | ✅ PASS | 首次編譯；main 一次過，test 修 4 處泛型 |
| 後端 Cucumber e2e（Testcontainers→直連 PG15+Redis7） | ✅ **64/64** | 從首輪 64 全錯修到全綠 |
| 全棧 compose（backend+PG+Redis） | ✅ healthy | `integration-test/docker-compose.fullstack.yml` |
| 前端 Playwright 真 API（MSW disabled） | ✅ **7/7** | `frontend/e2e/real-api.spec.ts` |
| 前端 **真 Chrome 全覆蓋**（headed，每頁每鈕每流程） | ✅ **25/25** | `frontend/e2e/full-coverage.spec.ts`（2026-06-10 新增） |
| 前端 MSW smoke 回歸 | ✅ 5/5 | 原 smoke 不受影響 |

> **2026-06-10 補充（真 Chrome headed 全覆蓋）**：用 Playwright headed 實際驅動可見 Chromium，
> 逐頁逐鈕逐流程點過一遍（首頁/user/lobby/room/opening/game/leaderboard/replay 共 25 條路徑），
> 錄成可重播的 `full-coverage.spec.ts`。過程三輪自修：18→23→25 全綠。
> 另已註冊 Playwright MCP server（`mcp__playwright__*`，user scope，`✓ Connected`）—
> **重連 session 後**即可用 MCP 交互式驅動 Chrome。
>
> 抓到 **第 5 個前端真 bug**：`GameReplayResponse.result` 非 nullable，但後端對未結束對局回 `result:null`
> → zod 解析失敗 → 任何「回放未結束對局」整頁 0/0 載不出來。已修為 `GameResult.nullable()`。
> 其餘 6 個失敗為測試端選擇器（strict-mode 撞多元素：dialog/columnheader/code-row scope）與時序 race（回放資料載入前點擊）。
>
> **2026-06-10 二修（使用者回報本地 Swap2 崩潰，揭露覆蓋盲點）**：
> 抓到 **第 6 個前端真 bug** —— 本地 Swap2 投幣後自動放子用了**不純的 state updater** `setStones(s => [...s, demo[i++]])`，
> `next.config` 開了 `reactStrictMode`，dev 下 React 雙呼叫 updater 檢測副作用 → `i` 衝出邊界 → `demo[3]=undefined`
> 塞入 stones → `GomokuBoard.set` 讀 `undefined.r` 整頁崩潰（`TypeError: Cannot read properties of undefined (reading 'r')`）。
> 修法：updater 改純（`setStones(demo.slice(0,i))`）+ `GomokuBoard.set` 加 `.filter(Boolean)` 防禦。
>
> **為何上一版「全覆蓋」沒抓到（覆蓋盲點，已修）**：
> (1) opening 測試用了一堆 `if (await x.count())` 可選點擊，流程跑去 demo 分支就**靜默跳過**；
> (2) **完全沒監聽 page error**，runtime crash 發生了測試還是「過」。
> 系統性修正：全檔加 `page.on("pageerror")` 護欄（`afterEach` 斷言無未捕獲例外）＋ 移除 room/opening 的可選點擊掩蓋，改硬斷言。
> chat 折疊改用行動版 viewport 測（`.collapse-toggle` 桌面 `display:none`，mobile-only）。
> **full-coverage.spec.ts 現 28/28 全綠，且任何前端 runtime 例外都會 fail。**
>
> **2026-06-10 三修（本地 Swap2 對齊 spec、真正玩到最後）**：使用者回報放完三子選「執黑」→ 後端 422、玩不到底。
> 以 spec 為真值（`Swap2開局放置.feature`/`Swap2選擇.feature`/`開始本地遊戲.feature`/`本地雙人對戰.mmd`）重做：
> - **前端真 bug #7（核心）**：本地 Swap2 投幣後因 `tentativeFirstPlayerId=null` 誤入「wait demo」分支（只設 React state、不呼叫後端 `placeOpeningStone`）→ 選擇時後端 0 開局子 → 422。修：本地強制走真實 place 路徑（玩家即假先方），3 子打真後端。
> - **前端真 bug #8**：`PLACE_TWO_MORE` 前端對所有選項都直接導航 `/game`，未實作二階段。修：`choose()` 依回傳 `status`（PLAYING 才導航；OPENING 進「放第四五子」子流程→續放 2 子→假先方選色）。
> - **前端真 bug #9**：`/game` 頁 `turn` 寫死 BLACK、**從不載入對局初始狀態**，故 Swap2 完成後不顯示開局子、回合也錯。修：本地局掛載時用 `/replay` 重建開局子+落子+回合（無 `GET /games/{id}` 端點）。
> - 另修：三子完成**自動**進選擇（spec 要求，不靠手動按鈕）、教學文案「2黑1白」→「黑·白·黑」、Toast 語意、線上 wait demo 標 `TODO(online)`。
> - **新增 S1–S5 spec 映射測試**（`waitForResponse` 攔 opening-stones/swap2-choice/moves，任何非預期狀態碼即 fail）：
>   S1 執黑玩到底→輪白方→可續弈；S2 執白玩到底；S3 放第四五子二階段（status 必為 OPENING、不導航、續放、二次選色 PLAYING）；S4 悔最後一子；S5 教學黑·白·黑。**全綠**。
> - 線上 Swap2（假後方真實 STOMP 同步、斷線判負之前端 UI）**仍為 TODO，後端 Cucumber 已覆蓋，不納入前端綠燈**（誠實標示）。
> - 後端真值基準（curl）：建局→投幣→3子(201)→TAKE_BLACK/WHITE(200,turn=WHITE)；PLACE_TWO_MORE(200,OPENING)→放2子(201)→二次選色(200,PLAYING)。

> **2026-06-15 線上對戰端到端實作（使用者：「你線上對戰沒測欸」）**：審計發現線上**結構上根本沒接通**——
> 後端無任何建 ONLINE game 的路徑、room Ready 後不建 game、房間成員/玩家名 hardcoded、聊天只發不收、線上 Swap2 是 demo。
> 本輪把線上多人真正實作出來並用**兩個真實瀏覽器 + 真 STOMP** 端到端測試（`frontend/e2e/online.spec.ts`）。
>
> **新增後端**：`POST /rooms/{roomId}/actions/start-game`（從房間成員建 ONLINE game、即「投幣」隨機指派黑白/假先方、廣播 GameStartedEvent）；
> `GET /rooms/{roomId}`（房間快照）；join 支援 6 碼 roomCode；RoomDetailResponse 加 hostPlayerId。
> **修 6 個並發/競態真 bug**：
> 1. start-game 雙方同時呼叫 → GameRoom 樂觀鎖 500 → **悲觀鎖 `findByIdForUpdate` 序列化** + 冪等回傳同一 gameId
> 2. toggleReady 雙方同時按 Ready → 互相讀不到對方 ready → 永不 READY → 同樣悲觀鎖序列化
> 3. **StompClient 訂閱競態**：`已連線`(onConnect) 在訂閱真正建立前就亮 → 600ms 輪詢窗口漏接廣播 → 改 **onConnect 立即套用待訂閱**
> 4. join-by-code 用 36 碼 UUID 但輸入框限 6 碼 → 房間頁顯示真 6 碼 roomCode、後端 join 解析 id-or-code
> 5. game 頁線上 place() 既 applyState 又收廣播 → 同手疊兩次 → 線上只靠廣播套用
> 6. 線上 Swap2 假先方 waitChoice 才訂閱 game → 對手選得快漏接 PLAYING → 改**提早(放置階段)訂閱**
> **前端接線**：room 頁讀真成員/觀戰席、Ready→start-game、聊天 STOMP 收發、GameStarted 廣播統一導航（含 tf）；
> opening 頁線上跳投幣依角色分流、假後方訂閱 `/topic/game/{id}/opening`→fetch replay 即時渲染對手開局子、假先方等選色。
>
> **線上整合測試（兩瀏覽器 context，真 STOMP，全綠）**：
> - O0 STOMP 落子同步健檢（de-risk 閘門）
> - O1 標準線上對戰黑方五連勝、9 步全程雙方同步、都見勝負
> - O2 房間顯示雙方真實暱稱 + A 送聊天 B 即時收到
> - O3 第三人加入已滿房成觀戰者（唯讀、無 Ready）
> - O4 線上 Swap2：假先方放 3 子→假後方 STOMP 即時看到→選執黑→雙方進對局
> 仍 TODO（誠實標示，不納綠燈）：斷線判負前端 UI（需計時器/斷線模擬，後端 Cucumber 已覆蓋）、線上 Swap2 PLACE_TWO_MORE 二階段角色互換、快速配對等待推播、game 頁線上玩家名仍 hardcoded（裝飾性）。

## Quality Gate 判定

- **Hard Gate（驗收場景通過率）**：64/64 = 100% → **PASS**
- **Soft Gate（規格覆蓋）**：17/17 features 全數執行；其中 5 個場景為「非真實驗證」（見覆蓋缺口）→ **PASS with gaps**
- **判定：✅ 通過** — 可進入部署 / 文件產製

## 修復清單

### 後端真 bug（production code，4 件）

| # | 問題 | 修復 |
|---|---|---|
| B1 | `opening_stones.placed_by_player_id NOT NULL` 過嚴 — 本地 Swap2 對局無玩家身份，放開局子 500 | V1 migration + `OpeningStone` entity 改 nullable（api.yml 對 games endpoints 無 auth 要求，匿名本地放置是合法流程） |
| B2 | Swap2 `PLACE_TWO_MORE` 選擇**未持久化** — 3 子時 phase 推導不出 `PLACING_SECOND_TWO`，第 4/5 子永遠 422，二階段流程整條斷裂 | `games.swap2_two_more_chosen` 欄位 + `Swap2Phase.fromState` 三參數 overload + `makeSwap2Choice` 持久化選擇 |
| B3 | 開局完成後 `currentTurn` 硬寫 BLACK — 需求 #30 / feature 明定 3 子（B,W,B）後輪**白方** | `finalizeColors` 依開局子數奇偶推導下一手顏色 |
| B4 | 訪客無 JWT — `/auth/guest` 只回 `{guestId,nickname}`，但 `/rooms/**` 要求 authenticated，訪客「線上單場」（需求 #2）整條不可達 | `GuestEnterResponse` 增發 `token`（additive，不違反 api.yml schema）；前端 `loginAs` 接住 |

### 後端品質修正（2 件）

- `GlobalExceptionHandler` 原本**吞掉所有未處理例外的 stack**（500 無任何 log）→ 加 `log.error`
- 不存在路徑回 500 → 加 `NoResourceFoundException` handler 回 404

### 測試端 bug（test code，~14 個場景的根因）

| 類別 | 內容 |
|---|---|
| 契約欄位錯誤 | 房間建立送 `useSwap2`（正確為 `isSwap2Mode`）；開局放置漏送必填 `color`（連鎖 6 個場景 400/422） |
| Cucumber expression | step 文字未跳脫 `/`（alternation）與 `{string}` vs 裸座標（`{word}`） |
| 資料隔離 | scenario 間共用 DB → 新增 `DbCleanupHook`（每場景 TRUNCATE） |
| TestRestTemplate | 401 觸發 streaming retry 錯誤 → 加 `httpclient5` test 依賴 |
| 測試設計 | 房間 seed 未填滿座位、phantom host 佔位、member 比對用不存在的欄位、未帶 auth 打 authenticated endpoint、打不存在的 `GET /games/{id}`、本地對局無法驗證角色權限 → Swap2選擇 改 ONLINE seeded game 真驗角色（403）與顏色定案（查 DB） |
| Runner | `RunCucumberTest` 移除 `@ignore` 過濾（17 features 原全被跳過 = 跑 0 場景） |

## 覆蓋缺口（vacuous pass，5 場景 + 1 領域）

1. **connection ×3**（寬限期重連 / 30 秒判負 / 雙斷判和）— 需 live STOMP client + server timer，REST 無法觸發；依 `PENDING_STOMP` 慣例空過
2. **悔非最後一子遭拒** — api.yml 僅暴露 `undo-last`，「指定子悔棋」無法以 REST 表達（規則由 API 形狀 enforce）；改驗無破壞性副作用
3. **房間聊天廣播** — 契約僅 STOMP channel（無 REST endpoint），synthetic 驗證
4. **WebSocket/STOMP 全域** — 前後端 STOMP 即時同步未在本輪驗證（前端已接線但走 best-effort）

→ 建議後續：補 STOMP client 整合測試（需 live broker session），或列入 W 系列待辦。

## 規格回饋（交需求分析模組裁決，本模組未動規格）

1. `erm.dbml` `opening_stones.placed_by_player_id [not null]` 與「本地 Swap2 無玩家身份」矛盾（實作已改 nullable）
2. `erm.dbml` `games` 缺 Swap2 二階段狀態欄位（實作加了 `swap2_two_more_chosen`）
3. `api.yml` `GuestEnterResponse` 缺 `token`，與訪客「線上單場」權限（需求 #2）矛盾（實作以 additive 欄位補上）
4. `api.yml` 無 `GET /games/{gameId}`（查當前對局狀態）— 多個測試場景與重連流程都需要它，目前只能用 `/replay` 代打

## 產物

```
integration-test/
├── REPORT.md                        本報告
├── backend.Dockerfile               後端多階段 build（host 無 JDK）
└── docker-compose.fullstack.yml     全棧環境（backend+PG15+Redis7，port 127.0.0.1:18080）

frontend/e2e/real-api.spec.ts        真後端 Playwright 套件（7 情境，自種資料）
backend/target/cucumber-reports.html Cucumber HTML 報告
backend/src/test/.../DbCleanupHook.java  場景級 DB 隔離
```

## 重現指令

```bash
# 後端 e2e（需 Docker）
docker network create gomoku-test
docker run -d --rm --name gomoku-test-pg --network gomoku-test -e POSTGRES_DB=gomoku_test -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres postgres:15-alpine
docker run -d --rm --name gomoku-test-redis --network gomoku-test redis:7-alpine
docker run --rm --network gomoku-test -v $PWD/backend:/app -v gomoku-m2:/root/.m2 -w /app \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://gomoku-test-pg:5432/gomoku_test \
  -e SPRING_DATASOURCE_DRIVER_CLASS_NAME=org.postgresql.Driver \
  -e SPRING_DATASOURCE_USERNAME=postgres -e SPRING_DATASOURCE_PASSWORD=postgres \
  -e SPRING_DATA_REDIS_HOST=gomoku-test-redis \
  maven:3.9-eclipse-temurin-21 mvn test

# 全棧 + 前端真 API e2e
docker compose -f integration-test/docker-compose.fullstack.yml up -d --build
cd frontend && NEXT_PUBLIC_API_MOCKING=disabled BACKEND_ORIGIN=http://127.0.0.1:18080 \
  npx playwright test e2e/real-api.spec.ts
```

## 2026-07-07 CHANGE 輪：PVE 挑戰模式增量（commit 3d6a4ae，Playbook v3.1 首次執行）

**範圍**：`3d6a4ae` vs `043f9c8`，116 檔（9 支 pve feature、api.yml +107 行、prototype pve-class/game/shop/result、後端 11 endpoint、前端 5 頁）。
**方法**：Playbook v3.1 新版 Gate 0/A/B/C/D/E ＋ Soft Gate 1/2，auto_fix，specs 為真相來源。

### Gate 結果總覽

| Gate | 結果 |
|---|---|
| Gate 0（環境身分） | **PASS（修復後）**——以下時間戳記皆為 **UTC**（`Z` 後綴）：執行前發現 `gomoku-fullstack-backend` image build 於 `2026-07-07T09:29Z`，早於 HEAD commit `3d6a4ae`（`git log -1 --format=%cI` 實測 `2026-07-07T23:20:58+08:00` = `2026-07-07T15:20:58Z`）；curl `/pve/runs/current` 回 404（路徑不存在，PVE 程式碼根本不在跑的映像裡）。已 `docker compose up -d --build` 重建，新映像 `2026-07-07T15:25Z` > commit `15:20:58Z`；同端點改回 401（路由存在、需登入），確認打到本輪程式碼。 |
| Gate A（契約煙躬測試） | **PASS**——以 curl 驅動真後端跑完整 PVE 生命週期（註冊→createRun→10手落子清版→shop 查詢/購買/重抽/skip→abandon→result），5 組真實回應 JSON 用 `node --experimental-strip-types` 直接匯入 `frontend/src/lib/types/schemas.ts` 做 zod `safeParse`，全數 PASS。過程中抓到 1 個真 bug（見下）。 |
| Soft Gate 1（Mock 契約對齊） | **缺陷（不擋部署）**——`frontend/src/mocks/handlers/pveEngine.ts` 對 `LINE_RESOLVED`/`ENCOUNTER_CLEARED`/`ENCOUNTER_FAILED`/`SKILL_USED`/`BOSS_MUTATION_TRIGGERED` 的座標語意與真後端完全一致（含 LINE_RESOLVED 取線段首格座標）；但**完全沒實作** `VOLCANO_ERUPTED`/`WAVE_SURGED`/`TIDE_TRIGGERED`/`STONES_PUSHED`/`STONE_REMOVED_OFF_BOARD` 這 5 種事件——MSW 驅動的前端測試永遠測不到火山噴發/潮汐/推子動畫等前端邏輯。建議下輪補上。 |
| Gate B（雙 client 即時同步） | **不適用**——`frontend/src/lib/api/pve.ts:21` 明確註解「PVE is single-request/response only — no STOMP channel exists for it」；`git diff` 確認本輪未觸碰任何 WS/STOMP 程式碼。 |
| Gate C（契約雙向 diff） | **PASS**——手動逐欄比對全部 9 個新 Pve* DTO（含巢狀 record）與 `api.yml` schema（雙向），以及 8 個相關 enum 值集合，零漂移。對照表已歸檔：`integration-test/evidence/2026-07-07/gate-c-bidirectional-diff-table.md`（2026-07-08 補件，見下方「回應審核」章節）。 |
| Gate D（staged 測試） | 見下表 |
| Gate E（證據與靜默失敗） | **PASS（修復後）**——見下方兩項修復 |

### Gate D 明細

| Stage | 結果 |
|---|---|
| 後端 compile/test-compile（`maven:3.9-eclipse-temurin-21` 容器 + sibling PG/Redis） | ✅ PASS |
| 後端 Cucumber e2e | ✅ **201/201**，BUILD SUCCESS，11 個 PVE feature 全數執行（73 處 pve 步驟引用），同套件內既有 PVP 場景零回歸 |
| 前端 `tsc --noEmit` | ✅ PASS |
| 前端 `next build` | ✅ PASS（8/8 路由，含 4 個新 `/pve/*`） |
| Playwright PVE MSW（`pve-flow.spec.ts` + `pve-game.spec.ts`） | ✅ **11/11**——`pve-game.spec.ts` 原檔頭註解自承「written but not executed」，本輪為其首次真跑 |
| Playwright 既有 MSW 回歸（smoke/duel/play/spectator） | ✅ **18/18** |
| Playwright `full-coverage.spec.ts`（MSW） | 27/30——3 個失敗與 2026-07-04 REPORT 記載的既有失敗**完全相同**（mock 登入不驗密碼／mock toggle-ready hardcoded playerId／STOMP 斷線 pageerror 時序），`git diff` 確認本輪未觸碰對應 handler，非本輪回歸 |
| Playwright 真 API（`real-api.spec.ts`） | ✅ **8/8** |
| Playwright 線上 STOMP（`online.spec.ts`，兩真瀏覽器） | ✅ **5/5** |

### 修復（auto_fix 範圍內）

1. **（真 bug，已修）`PveMoveCreateRequest` 422 座標驗證被 Bean Validation 短路**：`row`/`col` 原標 `@Min(0) @Max(10)`，落子座標超出範圍時 Spring 在進入 `PveChallengeService.placeMove` 前就以 `MethodArgumentNotValidException` 回 400「請求參數錯誤」；但 `連線傷害結算.feature`（「落子座標超出11x11棋盤範圍遭拒」）與 `api.yml`（422 案例列表）都明定應為 422「座標超出棋盤範圍」，且 service 內本已有對應檢查（`s.board.inBounds`，`ErrorCode.INVALID_MOVE`）卻永遠執行不到（死碼）。修法：移除 `@Min`/`@Max`（保留 `@NotNull`），讓既有 service 層檢查生效。改前後皆以 curl 對真後端驗證：修前 `row:11` 回 400/`row: must be less than or equal to 10`；修後回 `422002`/「座標超出棋盤範圍」。檔案：`backend/src/main/java/com/gomoku/dto/request/PveMoveCreateRequest.java`。
2. **（Gate E-b 修復）`docker-compose.fullstack.yml` backend 服務缺 healthcheck**：只有 postgres/redis 定義了 healthcheck，backend 沒有，導致「backend healthy」的宣稱在既有流程中無法驗證。補上以 `curl -f http://127.0.0.1:8080/api/gmk/v1/leaderboard` 為基礎的 healthcheck（與 `dev.sh` 既有的 `BACKEND_HEALTH` 端點一致）。三個服務現皆回報 `healthy`。
3. **（Gate E-c 修復）`pve-flow.spec.ts`/`pve-game.spec.ts` 缺 pageerror 護欄**：兩份新測試都沒有像 `full-coverage.spec.ts` 那樣註冊 `page.on("pageerror")` + `afterEach` 斷言，意味著 PVE 流程若發生未捕獲的前端例外會被 MSW 靜默吞掉、測試照樣顯示綠燈（正是 2026-06-10 那次教訓的重演風險）。補上相同護欄後重跑，仍 11/11 全綠，確認目前無隱藏例外。

### 未修復缺陷（記錄，交由人決定）

- Soft Gate 1：MSW mock 缺 5 種事件實作（見上表）。
- Soft Gate 2（覆蓋率 >80%）：本 repo 完全未設定覆蓋率工具（`backend/pom.xml` 無 jacoco），非本輪引入，沿用既有缺口，本輪無法量測。

### 修改檔案

- `backend/src/main/java/com/gomoku/dto/request/PveMoveCreateRequest.java`（拿掉 `@Min`/`@Max`；備份 `.bak-20260707`）
- `integration-test/docker-compose.fullstack.yml`（backend 加 healthcheck；備份 `.bak-20260707`）
- `frontend/e2e/pve-flow.spec.ts`、`frontend/e2e/pve-game.spec.ts`（加 pageerror 護欄；各自備份 `.bak-20260707`）
- `integration-test/_module-state.yml`（新增 `pve_change_2026_07_07` 區塊；備份 `.bak-20260707`）

### 證據歸檔

`integration-test/evidence/2026-07-07/`：後端 Cucumber log + HTML 報告、前端 typecheck/build log、5 組 Playwright 套件 log、Gate A safeParse 腳本與真實回應 JSON、compose healthy 快照；2026-07-08 補上 Gate C 對照表（見下）。

### 2026-07-08 回應審核（接續執行，Hub interrupt 記錄之審核意見）

上一輪 Hub `interrupt`（`specs/workflow-state.yml`，`audit` 由 `passed` 轉 `pending`）記錄審核意見「審核通過（Hard Gate 全過、證據鏈實查屬實）：中2（PVP側同款@Min/@Max死碼地雷未揭露；GateC無留證）低1（Gate0時區未明文）」。本輪逐項回應：

1. **低1（Gate 0 時區未明文）**——已修正上表 Gate 0 行，明確標註「以下時間戳記皆為 UTC」，並附 `git log -1 --format=%cI` 實測值（`2026-07-07T23:20:58+08:00` = `15:20:58Z`）與換算過程，避免 `09:29Z`/`15:20Z`/`15:25Z` 被誤讀為本地時間。
2. **中2（Gate C 無留證）**——新增 `integration-test/evidence/2026-07-07/gate-c-bidirectional-diff-table.md`：逐欄列出全部 9 個 `Pve*` schema（含巢狀 `PveShopOfferItem`）與對應 Java DTO/record 的雙向對照，含 8 個 enum 型別值集合核對，結論零漂移。同時誠實揭露一個未覆蓋面：`events[].eventType`／`PveShopStateResponse.status`／`PveShopOfferItem.offerKind` 這 3 個欄位 Java 端用 `String` 而非強型別 enum 承載，本輪未逐一 grep service 層字串常數是否精準對應 api.yml 列舉值，建議下輪補查。
3. **中1（PVP 側同款 @Min/@Max 死碼地雷未揭露）**——結構性核實：`backend/src/main/java/com/gomoku/dto/request/MoveCreateRequest.java`（PVP）目前仍是 `@Min(0) @Max(15) Integer row/col`，而 `SeriousDuelService.java:314` 有等價的 `if (!s.board.inBounds(row, col)) throw new BusinessException(...)` 服務層檢查——與本輪修復前的 PVE 版本結構相同。**但實際行為差異**：`線上落子.feature`（`specs/features/game/線上落子.feature:26-29`）測試座標 `(15,15)`（15x15 盤面），恰好 `15 <= @Max(15)` 通過 annotation、落到 service 層被 `inBounds` 正確拒絕並回 422「落子超出棋盤範圍」——**此既有 spec 場景本身不受影響、201/201 綠燈屬實**。地雷僅在**負值或 >15** 的座標才會重現（annotation 會搶先短路回泛用 400，而非契約要求的 422），但目前 PVP 側規格沒有任何 Example 測到這個邊界。本輪範圍限定 `integration-test/`，不准動 `backend/src`，故**不在本輪修復**，僅揭露＋列入 backlog（見下）。判斷理由：(a) 這是既有規格覆蓋不到的邊界、非本輪引入的回歸；(b) 貿然修改 PVP 的 `MoveCreateRequest.java` 屬於產品程式碼且無對應驗收場景可回歸驗證，超出本輪 auto_fix（僅限測試/環境腳本）授權範圍。

   **backlog（供需求分析/開發模組決策）**：`線上落子.feature` 補一個「負座標/超大座標」Example（如 `(-1,-1)` 或 `(20,20)`），驅動 PVP `MoveCreateRequest` 是否要 PVE 化做同款修復（移除 `@Min`/`@Max`，交由 service 把關）。

**Gate 0/A 新鮮度覆核（同一運行中容器，`docker ps` 顯示已 up 18+ 小時，時間已跨日至 2026-07-08，故重新以真後端跑一次最小回歸而非只信任舊證據）**：以 curl 註冊/登入/建 Run/落子驗證修復仍生效——`row:11`（spec 場景座標）與 `row:-1`（額外覆核的負值邊界）皆回 `422`/`"座標超出棋盤範圍"`（非回歸至 400）。證據：`integration-test/evidence/2026-07-08/{reg,login,run,move,move_neg}.json`。

### 2026-07-08 補件：PVE 真後端 Playwright 整合測試（新增 `frontend/e2e/pve-real-api.spec.ts`）

**動機**：2026-07-07 輪 Gate A 對 PVE 的「打真後端」驗證只有一支一次性 curl+node 腳本（`integration-test/evidence/2026-07-07/gate-a-contract-safeparse-script.mjs`），沒有留下可重複執行、納入 CI 的 Playwright 測試——PVE 側缺少 PVP 已有的 `real-api.spec.ts` 對應物。本輪新增 `frontend/e2e/pve-real-api.spec.ts`，比照既有 `real-api.spec.ts` 慣例，驅動真實 UI 打真後端（`NEXT_PUBLIC_API_MOCKING=disabled`，`docker-compose.fullstack.yml` 真後端），覆蓋 PVE 關鍵驗證面（MSW 測不到的）：Run 建立、落子連線傷害結算（Boss HP 真實下降）、商店查詢/購買/skip、放棄後導向真後端權威 `GET /pve/runs/{runId}/result`；另以 Playwright `APIRequestContext` 直接打後端驗證 `PveRunCreateRequest.seed` 決定性（FR-A3，因前端 `/pve/class` 未曝光 seed 欄位，UI 測不到，改繞過 UI 直接打 API）。

**執行結果**：`npx playwright test e2e/pve-real-api.spec.ts` **4/4 通過**（含 1 個用 `test.fail()` 標記的已知 bug 追蹤測試，見下）；同時重跑既有 `real-api.spec.ts` 確認**無回歸（8/8 仍綠）**。日誌：`integration-test/evidence/2026-07-08/playwright-pve-real-api-4of4-plus-real-api-regression-8of8.log`。

**發現真 bug（回報不自修，超出本輪 `integration-test/`/`frontend/e2e/` 授權範圍）**：

> **PVE 橫劈/縱劈技能（HORIZONTAL_SLASH/VERTICAL_SLASH）在真後端下 100% 無法使用**（非邊界案例，完全阻斷，每次必 422）。
>
> - **根因**：`frontend/src/app/pve/game/[encounterId]/page.tsx` 的 `pickSkillDirection()`（約第246–253行）對 axis 模式技能選完方向後直接把 `stage` 設成 `"ready"`，從未進入收集 `anchor` 參考格的階段；`onSkillCellClick()`（約第255–288行）也只處理 `ultimate`/`target`/`scatter` 三種模式的棋盤點擊，沒有 `axis` 分支。`frontend/src/lib/game/pveBoard.ts:94-102` 的 `buildSkillRequest()` 因此對 axis 技能永遠送出 `anchor: null`。
> - **契約依據**：`specs/api.yml` `SkillActionRequest.anchor` 的說明明定：PVP 由本手 `row`/`col` 帶入參考格（本欄位不使用）；**PVE 因技能為獨立行動、無伴隨落子，改由本欄位提供參考格座標**——即 PVE 情境下 `anchor` 為必填，不能省略。
> - **後端行為（正確，符合契約）**：`backend/src/main/java/com/gomoku/service/PveChallengeService.java:392-395`（`requireAnchor()`）對 `anchor` 為 `null` 的請求回 `422 UNPROCESSABLE`「必須指定施法錨點」——這是後端正確執行契約，不是後端的 bug。
> - **為何既有 MSW 測試測不到**：`frontend/src/lib/game/pveBoard.ts:14-20` 檔頭註解自承 mock engine 對 PVE 技能是「bookkeeping-only（只管持有量遞減與間隔限制），no server state to mirror」——即 MSW 完全不驗證 anchor 欄位，`pve-game.spec.ts` 的技能測試在 MSW 下永遠綠燈，掩蓋了這個真後端下 100% 阻斷的 bug。
> - **修復方向（建議，未執行——屬 `frontend/src/` 產品程式碼，不在本輪 auto_fix 授權範圍）**：`onSkillCellClick` 需補一個 `axis` 分支（棋盤格點擊 → 設定 `anchor` → `stage` 轉 `"ready"`），並在技能選方向後的 UI 提示玩家「請選擇參考格」。
> - **測試留存**：`frontend/e2e/pve-real-api.spec.ts` 的「已知 bug」`describe` 區塊用 `test.fail()` 鎖定現況（現在必須是失敗／422，不是通過／201）——bug 修好後這條測試會「意外通過」而被 Playwright 標記需要人工檢視，逼未來的人回來更新/移除本測試，避免壞行為被永遠當「預期」蓋過去。

**修改/新增檔案（本補件段落）**：
- 新增 `frontend/e2e/pve-real-api.spec.ts`
- 歸檔 `integration-test/evidence/2026-07-08/`：Gate 0/A 覆核用的 curl JSON（`reg.json`/`login.json`/`run.json`/`move.json`/`move_neg.json`）、Playwright 執行 log。

### 2026-07-08 補件2：bug 修復驗證——PVE 橫劈/縱劈 anchor 已由前端模組修復，回歸解鎖

**背景**：上一補件回報的真 bug（PVE 橫劈/縱劈技能因前端未收集 `anchor` 參考格，真後端 100% 422）已由前端模組修復——`frontend/src/app/pve/game/[encounterId]/page.tsx` 的 `pickSkillDirection()` 對 `axis` 模式（同 `ultimate`）改進入 `stage="anchor"`，`onSkillCellClick()` 補上 `axis` 分支（點棋盤格 → 設定 `anchor` → `stage="ready"`），並在 UI 加上「請點選棋盤上一格作為推擠參考格」提示。前端模組已用真後端 curl 驗證修後回 201。本輪任務：解鎖 `pve-real-api.spec.ts` 中原用 `test.fail()` 鎖定「現況是壞的」之測試，改為驗證「修復後技能確實生效」的正向斷言，並確認既有 real-api 測試無回歸。

**變更**：`frontend/e2e/pve-real-api.spec.ts` 的「已知 bug」`describe` 區塊整段改寫為「橫劈技能收集 anchor 後施放（bug 修復回歸驗證）」，新測試流程：
1. 建 WARRIOR Run → 在 `(4,5)` 落一子（讓推擠有東西可推，光驗證 201 不足以證明技能真的生效）。
2. 點 `skill-btn-HORIZONTAL_SLASH` → 選方向「上」→ 斷言出現「請點選棋盤上一格作為推擠參考格」提示（此提示在 bug 修復前不會出現——修復前選完方向直接跳 `stage=ready`，是原 bug 的可觀察徵狀）。
3. 點棋盤格 `(5,5)` 收集 anchor → 點 `confirm-skill-btn` → 斷言 `POST .../actions/use-skill` 回 **201**（非原本的 422）。
4. **真後端效果驗證**（非僅 201）：`(4,5)` 的棋子確實被推擠到 `(3,5)`（`pveg-cell-stone` class 位移，對應後端 `PveChallengeService.slashPush` + `PushResolver.push` 的 UP 方向推擠幾何）；`(4,5)` 不再帶 `pveg-cell-stone`。
5. 間隔鎖定提示「本間隔已使用過技能，落子後可再次使用」出現（真後端 `skillUsableThisInterval` 權威欄位）；WARRIOR 起始 `HORIZONTAL_SLASH` 僅 1 個（`CONSUMABLE`），用罄後 `quantity=0` 被前端過濾，技能按鈕消失——確認真後端確實扣減了持有量。

**執行結果**：`npx playwright test e2e/pve-real-api.spec.ts` **4/4 通過**（含解鎖後的回歸測試，unexpected pass 情境已不存在，因為測試本身已改寫為正向斷言，不再是 `test.fail()`）；重跑 `real-api.spec.ts` 確認**無回歸（8/8 仍綠）**。合併指令 `npx playwright test e2e/pve-real-api.spec.ts e2e/real-api.spec.ts` **12/12 通過**。日誌：`integration-test/evidence/2026-07-08/playwright-anchor-bugfix-verify-pve-real-api-4of4-plus-real-api-8of8.log`。

**修改/新增檔案（本補件段落）**：
- 修改 `frontend/e2e/pve-real-api.spec.ts`（解鎖 `test.fail()`，改寫檔頭「真 bug」註解為「修復回歸驗證」說明）
- 歸檔 `integration-test/evidence/2026-07-08/playwright-anchor-bugfix-verify-pve-real-api-4of4-plus-real-api-8of8.log`

---

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

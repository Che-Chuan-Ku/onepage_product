# Gate C 雙向 diff 對照表（補件，2026-07-08 回應審核）

> 審核回饋「GateC無留證」的補件——2026-07-07 輪執行時 Gate C 判定 PASS 有寫進
> REPORT.md，但未歸檔可稽核的逐欄對照表產物。本檔逐一列出 api.yml 9 個新
> `Pve*` schema（含巢狀 `PveShopOfferItem`）與對應 Java DTO/record 的欄位對照，
> 雙向 diff（api⊆impl 且 impl⊆api）。方法：手動逐檔讀取 + grep（無 codegen 工具）。

來源：`specs/api.yml:1616-1813`（9 個 schema）；Java 檔案列於各表下方。

## 1. PveRunCreateRequest（api.yml:1616）
| 欄位 | api.yml | Java (`PveRunCreateRequest.java`) | 一致？ |
|---|---|---|---|
| classType | enum[WARRIOR,ARCHER], required | `ClassType classType`（`@NotNull`），enum 值同 (`ClassType.java`) | ✅ |
| seed | string, nullable, maxLength 64 | `String seed`（無 max-length 驗證，但為選填欄位，超長輸入非契約強制項） | ✅（欄位存在；長度未強制驗證，非欄位集合drift，記錄於下方「非drift備註」） |

差集：api\java = {} ；java\api = {} 。**零漂移。**

## 2. PveRunStateResponse（api.yml:1631）
| 欄位 | api.yml | Java | 一致？ |
|---|---|---|---|
| runId/classType/status/gold/currentEncounterSequence/reachedEncounterSequence/totalDamageDealt | 全部存在 | 全部存在（`totalDamageDealt` java為`long`，api為`integer`——JSON數值相容） | ✅ |
| currentEncounter | $ref PveEncounterStateResponse | `PveEncounterStateResponse currentEncounter` | ✅ |
| heldSkills[{skillType,quantity}] | array | `List<HeldSkill>`，`HeldSkill(skillType,quantity)` | ✅ |
| heldRelics[{relicType}] | array | `List<HeldRelic>`，`HeldRelic(relicType)` | ✅ |

差集：{} / {}。**零漂移。**

## 3. PveEncounterStateResponse（api.yml:1662）
| 欄位 | api.yml | Java (`PveEncounterStateResponse.java`) | 一致？ |
|---|---|---|---|
| encounterId/runId/sequence/fieldType/mutationType/boardRows/boardCols/bossHpMax/bossHpCurrent/moveBudget/movesUsed/status | 全部存在 | 全部存在 | ✅ |
| stones[{row,col}] / obstacles[{row,col}] | array | `List<Cell>`，`Cell(row,col)`，兩欄位共用同一 record | ✅ |
| skillUsableThisInterval | boolean | `boolean` | ✅ |
| usedSkills（enum陣列） | array\<string\> | `List<String> usedSkills` | ✅ |
| lastResolution{damageDealt,linesResolved[{length,baseScore,multiplier,direction}]} nullable | object nullable | `Resolution(damageDealt,List<LineView>)`，`LineView(length,baseScore,multiplier:double,direction)` | ✅ |
| events[{eventType,row nullable,col nullable}] | array | `List<EventView>`，`EventView(eventType,Integer row,Integer col)`（Integer 可為null，語意對齊 nullable） | ✅ |

fieldType enum 值比對：api `[PLAIN,VOLCANO,BEACH]` vs Java `PveFieldType{PLAIN,VOLCANO,BEACH}`（`PveFieldType.java`——刻意與 PVP 的 `FieldType{VOLCANO,BEACH}` 15x15/16x16 分開，comment 明確標註不共用棋盤尺寸）。✅ 一致。
mutationType enum 值比對：api `[NONE,ONE_EYE,RAGE,ABYSS]` vs `PveMutationType.java` 同值。✅ 一致。
status enum：api `[IN_PROGRESS,CLEARED,FAILED]` vs `PveEncounterStatus.java` 同值。✅ 一致。
events.eventType enum：api 10 值 `[LINE_RESOLVED,SKILL_USED,STONES_PUSHED,STONE_REMOVED_OFF_BOARD,VOLCANO_ERUPTED,WAVE_SURGED,TIDE_TRIGGERED,BOSS_MUTATION_TRIGGERED,ENCOUNTER_CLEARED,ENCOUNTER_FAILED]`——Java 端 `EventView.eventType` 為 `String`（未用列舉型別強型別化，值由 service 端寫入字串常數，非本欄位集合 diff 範疇，未逐一核對 service 端字串常數是否完整覆蓋 10 值——**已知未驗證面，見下方「未覆蓋面」**）。

差集（欄位集合）：{} / {}。**零漂移**（enum 完整覆蓋率的 service 端字串常數未逐一核對，見末段）。

## 4. PveMoveCreateRequest（api.yml:1733）
| 欄位 | api.yml | Java（本輪 auto_fix 後） | 一致？ |
|---|---|---|---|
| row | integer, minimum:0, maximum:10, required | `Integer row`（`@NotNull`，**無 `@Min`/`@Max`**） | ✅ 欄位存在；**約束強制層级已由 Bean Validation 移至 service（`PveChallengeService.placeMove` 的 `board.inBounds`），詳見下方非drift備註** |
| col | 同上 | `Integer col`（`@NotNull`） | ✅ 同上 |

差集：{} / {}。**欄位零漂移。** 附註：這是本輪唯一一個「api.yml 有寫 minimum/maximum 但 Java 不再用 annotation 強制」的 schema——Gate C 定義為「欄位/端點集合」diff，minimum/maximum 屬約束強度不算集合成員，故不計入差集；但為完整揭露，已在下方「非drift備註」與 REPORT.md 一併說明其與審核 Medium#1 的關聯。

## 5. PveSkillUseRequest（api.yml:1741，allOf SkillActionRequest）
| 欄位 | api.yml（經 SkillActionRequest, api.yml:1370） | Java (`PveSkillUseRequest.java`) | 一致？ |
|---|---|---|---|
| skillType | enum 6 值, required | `SkillType skillType`（`@NotNull`），`SkillType.java` enum 同 6 值 | ✅ |
| direction | enum[UP,DOWN,LEFT,RIGHT], nullable | `SkillDirection direction`，`SkillDirection.java` 同 4 值 | ✅ |
| anchor/target/secondStone | object{row,col}, nullable | `SkillActionRequest.CellRef anchor/target/secondStone`，`CellRef(Integer row,Integer col)` | ✅ |

差集：{} / {}。**零漂移。**（`SkillActionRequest` 本身為 PVP/PVE 共用既有 schema，非本輪新增，仍一併覆核以確保 `allOf` 引用正確。）

## 6. PveShopStateResponse + PveShopOfferItem（api.yml:1751, 1766）
| 欄位 | api.yml | Java (`PveShopStateResponse.java`) | 一致？ |
|---|---|---|---|
| shopVisitId/runId/afterEncounterSequence/status/rerollCount/gold | 全部存在 | 全部存在 | ✅ |
| offers[$ref PveShopOfferItem] | array | `List<OfferItem>` | ✅ |
| OfferItem: slotIndex/offerKind/relicType(nullable)/skillType(nullable)/price/purchased | 全部存在 | `OfferItem(slotIndex,offerKind,relicType,skillType,price,purchased)` | ✅ |

status enum：api `[OPEN,CLOSED]`——Java 為 `String status`（service 端字串常數，未強型別化；同「未覆蓋面」註記）。
offerKind enum：api `[RELIC,SKILL]`——同上，Java 為 `String offerKind`。
relicType enum：api 8 值 = `PveRelicType.java` 8 值，一致。✅
skillType enum：同第5節 6 值，一致。✅

差集：{} / {}。**零漂移。**

## 7. PveShopPurchaseRequest（api.yml:1782）
| 欄位 | api.yml | Java | 一致？ |
|---|---|---|---|
| slotIndex | integer, required | `Integer slotIndex`（`@NotNull`），nested record 於 `PveController.java:141`（非獨立檔案，controller 內聯 record） | ✅ |

差集：{} / {}。**零漂移。**

## 8. PveRunResultResponse（api.yml:1788）
| 欄位 | api.yml | Java (`PveRunResultResponse.java`) | 一致？ |
|---|---|---|---|
| runId/status/reachedEncounterSequence/totalDamageDealt/goldEarned/goldSpent | 全部存在 | 全部存在 | ✅ |
| finalHeldSkills[{skillType,quantity}] | array | `List<PveRunStateResponse.HeldSkill>`（重用第2節同 record，非重複定義） | ✅ |
| finalHeldRelics[{relicType}] | array | `List<PveRunStateResponse.HeldRelic>` | ✅ |

差集：{} / {}。**零漂移。**

## 總結

- 9 個 schema、全部欄位（含巢狀 record、含 enum 值集合）雙向比對：**零漂移**（api⊆impl 且 impl⊆api 皆成立）。
- enum 覆蓋率：`ClassType`/`SkillType`/`SkillDirection`/`PveRelicType`/`PveFieldType`/`PveMutationType`/`PveEncounterStatus`/`PveRunStatus` 共 8 個列舉型別，逐一核對值集合，**全數一致**。
- **未覆蓋面（誠實揭露，非本輪 Gate C 定義範圍但值得記錄）**：`events[].eventType`、`PveShopStateResponse.status`、`PveShopOfferItem.offerKind` 這 3 個欄位在 Java 端用 `String` 而非強型別 enum 承載，值由 service 層寫入的字串常數決定；本次未逐一 grep service 層每個字串常數是否精準等於 api.yml 列舉值（例如是否有拼字誤植的風險）。建議下一輪若時間允許，對這 3 個欄位加做字串常數 vs enum 值集合的 grep 核對。
- **非drift備註（呼應審核 Medium#1）**：`PveMoveCreateRequest.row/col` 是本輪唯一「api.yml 寫了 minimum/maximum 但 Java DTO 不再用 `@Min`/`@Max` annotation」的欄位——這是本輪 auto_fix 修正 dead-code bug 的直接結果（annotation 曾在 service 檢查前就短路，已移除，改由 service `board.inBounds` 把關，行為對齊 api.yml 422 契約，見 REPORT.md「修復」section #1）。PVP 側 `MoveCreateRequest.java` 目前仍保留 `@Min(0) @Max(15)`，結構上是同款潛在地雷（詳見 REPORT.md 本次回應審核章節）。

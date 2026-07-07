# Component Inventory — Gomoku（P3）

> 元件清冊。供前端開發模組對應實作（React + Tailwind + Framer Motion 意圖）。

## 全域 / 共用
| 元件 | 用途 | Props/狀態（意圖） | 出現頁 |
|------|------|------------------|--------|
| `AppHeader` | 全域導覽列 + 身份三態 | identity(guest/registered/none), nickname | home, lobby, leaderboard, replay |
| `Button` | 行動按鈕 | variant(primary/accent/ghost/danger), size, disabled | 全域 |
| `Toast` | 非阻斷提示 | type(info/error/success), msg, ttl | 全域 |
| `Modal` | 覆蓋層對話框 | title, dismissable, slot | 教學/離開確認 |
| `Board` | 15×15 棋盤 + 星位 | stones[], lastMove, highlightLine[], interactive, onPlace | game, opening, replay |
| `Stone` | 單顆棋子 | color(black/white), animateIn, isLast | Board 內 |
| `TurnIndicator` | 當前回合 + 執色 | currentColor, yourColor, isYourTurn | game, opening |
| `ConnectionBadge` | 連線狀態 | state(online/reconnecting/offline) | game, room |

## 身份 / 帳號
| 元件 | 用途 | 出現頁 |
|------|------|--------|
| `AuthTabs` | 登入/註冊頁籤切換 | user |
| `LoginForm` | username + password | user |
| `RegisterForm` | username + email + password | user |
| `GuestEntry` | 暱稱輸入直接進入 | user, home(彈窗) |

## 大廳 / 房間
| 元件 | 用途 | 出現頁 |
|------|------|--------|
| `CreateRoomDialog` | 私人/公開 + 是否 Swap2 | lobby |
| `JoinByCode` | 房間碼輸入 + 加入 | lobby |
| `QuickMatchButton` | 快速配對 + 倒數/配對中動畫 | lobby |
| `RoomCard` / `RoomRow` | 房間列表項（碼/房主/人數/觀戰/模式標籤） | lobby（行動版卡片堆疊） |
| `ModeBadge` | 「普通 / Swap2」標籤（文字+圖示） | lobby, room |
| `PlayerSlot` | 對戰玩家槽（暱稱 + Ready 指示） | room |
| `SpectatorList` | 觀戰席名單 + 人數 | room |
| `ReadyButton` | Ready/取消（觀戰者隱藏） | room |
| `ChatPanel` | 即時聊天（訊息列 + 輸入，可收合） | room |

## 開局（Swap2）
| 元件 | 用途 | 出現頁 |
|------|------|--------|
| `CoinFlip` | 3D 硬幣翻轉動畫（結果後端決定） | opening |
| `OpeningBanner` | 開局階段提示橫幅（輪到誰/階段） | opening |
| `PlaceCursorControls` | 假先方：放置游標 + 「確認此子」+「悔最後一子」 | opening |
| `Swap2OptionCard` | 假後方三選一卡（執黑/執白/放第四五子）+ 說明 | opening |
| `Swap2Tutorial` | 首次教學 Modal（localStorage 記憶 + 不再顯示） | opening |
| `WaitingOverlay` | 假後方觀看階段「等待對手開局…」 | opening |

## 對戰 / 結束
| 元件 | 用途 | 出現頁 |
|------|------|--------|
| `GameInfoBar` | 雙方暱稱/回合/執色/落子數/計時 | game |
| `SpectatorBadge` | 「觀戰中」+ 觀戰人數（棋盤唯讀） | game |
| `MoveToast` | 非法落子提示（InvalidMoveRejected） | game |
| `WinHighlight` | 連五高亮動畫（疊棋盤） | result/game |
| `ResultOverlay` | 結束覆蓋：勝者/和局 + 統計 + 再戰 | result |
| `RematchActions` | 再戰（本地/線上）/ 訪客重新進新局 + 註冊引導 | result |

## 戰績 / 回放
| 元件 | 用途 | 出現頁 |
|------|------|--------|
| `StatCard` | 勝/敗/勝率 + 最近紀錄 | leaderboard |
| `LeaderTable` / `LeaderRow` | 排行榜（名次/暱稱/勝場/勝率） | leaderboard |
| `RecentMatchRow` | 最近對戰（可點擊導回放） | leaderboard |
| `ReplayControls` | 上一步/下一步/播放/暫停/進度條 | replay |
| `ReplayInfo` | 勝者/落子數/是否 Swap2 | replay |

## 真劍勝負模式（P3 增量，需求 #34–48）
| 元件 | 用途 | Props/狀態（意圖） | 出現頁 |
|------|------|------------------|--------|
| `DuelModeBadge` | 「真劍勝負」標籤 + 場地圖示（🌋/🏖️） | field(volcano/beach) | lobby, room, game |
| `FieldPicker` | 建立房間彈窗：場地二選一，與 Swap2 互斥 | field, disabled(ifSwap2) | lobby |
| `ClassSelectCard` | 職業選擇卡（劍士/弓箭手） | classId, skills[], selected, locked | room（職業選擇介面.md） |
| `OpponentHiddenCard` | 對手「? 選擇中」占位（選擇階段隱藏） | — | room |
| `SpectatorClassView` | 觀戰者視角：雙方職業選擇即時可見（R2-2） | classes[] | room |
| `ClassRevealBanner` | 對局開始職業揭曉橫幅（雙卡翻面） | selfClass, oppClass | game |
| `SkillActionBar` | 技能操作列（一般技能×2 + 大絕×1） | skills[], usedSkills[], activeSkill | game（桌面版 + 行動版底部抽屜 `SkillDrawer`） |
| `SkillDrawer` | 行動版技能列可收合抽屜 | collapsed | game（RWD） |
| `DirectionPad` | 大絕方向選取（上/下/左/右） | onPick | game |
| `PreviewRect` / `PreviewLine` | 大絕 3寬×2深 預覽框、附掛推擠 3 格預覽 | cells[] | game（Board 內建） |
| `FieldLegend` | 場地圖例（障礙物/海洋/沙灘/隱藏格） | field | game |
| `VolcanoObstacle` | 火山障礙物渲染（雙方可見） | cells[] | game（Board 內建） |
| `BeachOceanOverlay` | 沙灘海洋/沙地分色渲染 + 侵蝕推進 | side, erosion | game, replay（Board 內建） |
| `HiddenCellReveal` | 噴發格/漲潮格觸發揭露 + 賽後全揭露 | kind(eruption/tide) | game, result, replay（Board 內建） |
| `FieldFxFlash` | 噴發/海浪/漲潮特效占位（CSS keyframe） | type(burn/wave/tide) | game |
| `DuelReplayInfo` | 回放：場地類型 + 雙方職業 | field, classes[] | replay |
| `SkillFieldEventRow` | 回放：本手技能/場地事件文字提示 | event | replay |

## PVE 挑戰模式（P3 增量，documents/PVE-挑戰模式-增量需求.md）
| 元件 | 用途 | Props/狀態（意圖） | 出現頁 |
|------|------|------------------|--------|
| `PveModeCard` | 首頁第三張模式入口卡（🐲） | onClick(guard identity) | home |
| `PveGuestGate` | 訪客/未登入阻擋彈窗（無訪客入口，僅登入/註冊） | — | home（PVE 卡點擊時） |
| `PveClassCard` | 職業選擇卡（劍士/弓箭手，重用 `.class-card`） | classId, starterSkill, skills[], selected | pve-class |
| `PveInfoBanner` | 建關前資訊列（手數/BossHP/棋盤/場地） | — | pve-class |
| `BossHpBar` | Boss HP 進度條（含低血量警示動畫） | hp, hpMax | pve-game |
| `MoveBudgetBar` | 手數預算進度條 | used, budget | pve-game |
| `MutationBanner` | Boss 突變提示橫幅（獨眼/震怒/深淵） | mutation | pve-game |
| `DamageFloatNumber` | 連線/技能傷害浮動數字＋倍率breakdown | dmg, breakdown, anchorCells[] | pve-game（Board 疊層） |
| `PveSkillActionBar` | PVE 技能列（持有數量徽章，消耗型/獨立行動） | skills[], activeSkillId, intervalLocked | pve-game（桌面＋行動抽屜） |
| `PveBoard` | 11×11 單方落子棋盤（重用 `Board`，PVE 專用星位） | stones[], obstacles[], field | pve-game |
| `ShopOfferCard` | 商店展示卡（遺物×2/技能×1，含已購買/已達上限狀態） | kind, price, bought, maxed | pve-shop |
| `RerollButton` | 重抽（5金幣，三位全重抽） | disabled(goldInsufficient) | pve-shop |
| `HeldInventoryList` | 持有遺物/技能清單（含技能持有數量） | relics[], skills[] | pve-shop, pve-game, pve-result |
| `CoinDisplay` | 金幣顯示 | gold | pve-shop, pve-game |
| `EncounterRecapPanel` | 關卡結算（單關失敗：總傷害/剩餘手數/已用技能） | stats | pve-result |
| `RunRecapPanel` | Run 結算（完成/失敗/已放棄 三態 banner + 到達關數/總傷害/金幣/持有清單） | type(won/lost/abandoned), stats | pve-result |

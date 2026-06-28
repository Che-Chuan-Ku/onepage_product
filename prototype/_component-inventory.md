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

# Execution Plan — Gomoku 五子棋對戰平台

模式：KICKOFF（Greenfield，specs/ 原無規格檔案）
來源知識庫：documents/需求明細.csv（33 條需求）
推導：每個需求皆為 create 操作。

## 概覽
| 類型 | 數量 |
|------|------|
| Create | 全部 |
| Modify | 0 |
| Delete | 0 |

## Phase 01: Requirement Analysis（本模組已產出）
| 操作 | 目標 | 說明 |
|------|------|------|
| create | activities/使用者管理.mmd | #1 #2 #3 |
| create | activities/線上連線對戰.mmd | #4~#9 #15 #16 #20 #21 #24 #26~#30 |
| create | activities/本地雙人對戰.mmd | #13 #14 #25 |
| create | actors/註冊玩家.md, 訪客玩家.md | #1 #2 |
| create | features/**（13 個 .feature） | #1~#33 行為 |
| create | ui/**（11 頁） | 涵蓋所有使用者可見頁面（前台） |

## Phase 02: Entity Modeling
| 操作 | 目標 | 說明 |
|------|------|------|
| create | erm.dbml | players / player_stats / game_rooms / room_members / room_chat_messages / games / moves / opening_stones |

## Phase 03: BDD Analysis
| 操作 | 目標 | 說明 |
|------|------|------|
| create | features/系統抽象.md | web-backend boundary + STOMP realtime |
| create | features/**/*.feature Examples | 已隨 feature 一併產出（Rule 皆已確認） |

## Phase 04: API Contract
| 操作 | 目標 | 說明 |
|------|------|------|
| create | api.yml | auth / players / rooms / games / history REST 端點 + x-stomp-channels |

## Phase 05-08: Implementation（不在本模組範圍）
| 操作 | 目標 | 說明 |
|------|------|------|
| red-green-refactor | 全部 feature | Java Spring Boot E2E（後端模組執行） |
| build | frontend/ | React/Next.js（前端模組執行） |

## 中介軟體依賴（infrastructure.yml）
- Redis：線上單場狀態 / 排行榜快取 / Sticky Session（#3 #22）
- PostgreSQL：帳號、戰績、歷史回放（#1 #3 #17 #32）

## 需求覆蓋對照（33/33）
- #1 登入註冊 → features/user/{註冊帳號,登入取得JWT}.feature, api auth/*
- #2 訪客 → features/user/訪客模式進入.feature, actors/訪客玩家.md
- #3 戰績排行 → features/user/查看戰績與排行榜.feature, ui/排行榜頁.md
- #4 模式選擇 → ui/模式選擇首頁.md
- #5 房間 → features/room/{建立房間,加入房間}.feature
- #6 配對 → features/room/快速配對.feature
- #7 準備聊天 → features/room/標記準備與聊天.feature, ui/房間頁.md
- #8 #19 #27 硬幣 → features/game/投擲硬幣決定先手.feature, ui/硬幣投擲動畫.md
- #9 #11 #16 #20 線上落子/驗證/廣播/防作弊 → features/game/線上落子.feature
- #10 棋盤 → ui/棋盤對局頁.md
- #12 結束畫面 → ui/對局結束畫面.md
- #13 #14 本地 → features/game/{本地落子,開始本地遊戲,本地再戰重置}.feature
- #15 #21 連線管理/斷線判負 → features/connection/連線管理與斷線判負.feature
- #17 #32 歷史回放 → features/history/查看遊戲歷史與回放.feature, ui/回放頁.md
- #18 RWD → 各 ui/*.md RWD 區段
- #22 效能擴展 → infrastructure.yml dependencies (Redis)
- #23 錯誤處理 UX → ui/{棋盤對局頁,登入註冊頁}.md, api 422/4xx
- #24 #28 #29 #30 #31 Swap2 → features/opening/{Swap2開局放置,Swap2選擇}.feature, ui/Swap2開局介面.md
- #25 本地 Swap2 → features/game/開始本地遊戲.feature
- #26 線上 Swap2 房間 → features/room/建立房間.feature (isSwap2Mode)
- #33 Swap2 教學 → ui/Swap2教學提示.md

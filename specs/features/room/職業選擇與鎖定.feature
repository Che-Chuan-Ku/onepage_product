@ignore @command
Feature: 職業選擇與鎖定
  # 來源：需求 #35（職業選擇與鎖定）
  # 事件：ClassSelected, ClassesRevealed
  # 規則（Q8 已定）：進房後 Ready 前可自選職業（劍士/弓箭手，可同職業）；Ready 即鎖定；
  #      選擇階段對手不可見（僅限對戰雙方彼此之間，觀戰者不受限，見 R2-2）；
  #      對局開始（games.status 轉為 PLAYING，非第一次放技能時）才揭曉雙方職業

  Background:
    Given 房間 "ABC123" 為真劍勝負模式
    And 對戰玩家為 "alice" 與 "bob"

  Rule: 前置（狀態）- 僅 Ready 前可選擇或變更職業

    Example: 玩家於 Ready 前選擇劍士
      When 玩家 "alice" 選擇職業 "WARRIOR"
      Then 操作成功
      And 系統發布 ClassSelected 事件

    Example: 玩家於 Ready 前變更職業選擇
      Given 玩家 "alice" 已選擇職業 "WARRIOR"
      When 玩家 "alice" 改選職業 "ARCHER"
      Then 操作成功
      And 玩家 "alice" 的職業更新為 "ARCHER"

    Example: 玩家 Ready 後嘗試變更職業時遭拒
      Given 玩家 "alice" 已標記 Ready 且職業已鎖定
      When 玩家 "alice" 嘗試變更職業
      Then 操作失敗
      And 錯誤為 "職業已鎖定，無法變更"

  Rule: 前置（狀態）- 雙方可選擇相同職業

    Example: 雙方皆選擇劍士時允許
      When 玩家 "alice" 選擇職業 "WARRIOR"
      And 玩家 "bob" 選擇職業 "WARRIOR"
      Then 兩者皆操作成功

  Rule: 前置（可見性）- 選擇階段對手職業不可見（僅限對戰雙方彼此之間）

    Example: 選擇階段查詢房間資訊時看不到對手職業
      Given 玩家 "alice" 已選擇職業 "WARRIOR"
      When 玩家 "bob" 查詢房間資訊
      Then "alice" 的職業欄位對 "bob" 顯示為隱藏（null）

  Rule: 前置（可見性）- 觀戰者不受「選擇階段對手不可見」限制，任何階段皆可見雙方職業（R2-2）

    Example: 觀戰者於選擇階段查詢房間資訊時可見雙方職業
      Given "carol" 為房間 "ABC123" 的觀戰者
      And 玩家 "alice" 已選擇職業 "WARRIOR"，玩家 "bob" 尚未選擇
      When "carol" 查詢房間資訊
      Then "carol" 可見 "alice" 的職業為 "WARRIOR"
      And 「選擇階段對手不可見」（Q8）僅適用於對戰雙方彼此之間，不適用於觀戰者

  Rule: 後置（狀態）- 對局開始（games.status 轉為 PLAYING，非第一次放技能時）即同時揭曉雙方職業

    Example: 雙方 Ready 且對局開始時揭曉雙方職業
      Given 玩家 "alice" 選擇 "WARRIOR"、玩家 "bob" 選擇 "ARCHER"
      When 雙方皆標記 Ready 且對局進入 PLAYING 狀態
      Then 系統發布 ClassesRevealed 事件
      And 雙方玩家皆可見對方最終職業
      And 觀戰者亦同時可見雙方最終職業（R2-2）

  # Q8 已定（B修改版）：可同職業；Ready 鎖定；選擇階段對手不可見；對局開始（非第一次放技能）即揭曉。
  # R2-2 已定：觀戰者同玩家視角看不到隱藏格，但職業與技能使用狀態不受選擇階段限制、任何階段皆可見。

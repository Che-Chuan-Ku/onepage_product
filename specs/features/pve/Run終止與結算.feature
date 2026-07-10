@ignore @command
Feature: Run終止與結算
  # 來源：PVE 增量 FR-C7（documents/PVE-挑戰模式-增量需求.md）
  # 事件：PveRunEnded
  # 規則：任一關失敗→Run終止；玩家亦可主動放棄（視同失敗）；
  #   Run結算畫面顯示：到達關數、全Run總傷害、獲得與花費金幣、最終持有遺物/技能。

  Background:
    Given 玩家 "alice" 一個PVE Run進行中，classType為 "WARRIOR"

  Rule: 後置（狀態）- 任一關失敗即整個Run終止

    Example: 第4關Boss連五時Run狀態變為LOST
      # documents/PVE-全對弈階梯設計-2026-07-10.md §1: 全8關皆為DUEL——手數
      # 用盡本身不再判定失敗（那是DRAW，見魔王對弈.feature），唯有Boss完成
      # 連五才會使整個Run終止。刻意選第4關而非第3關：第3關「不可橫向」
      # （§4.1）雙方對稱，橫向連五對Boss也不算勝，本情境用的是一條橫向四連
      # 種子，換一個沒有該限制的關卡驗證。
      Given 玩家 "alice" 於第4關Boss即將完成連五
      When 系統判定該關失敗（Boss連五）
      Then Run狀態變為 "LOST"
      And 系統發布 PveRunEnded 事件，reachedEncounterSequence為3

  Rule: 後置（狀態）- 玩家可主動放棄，視同失敗

    Example: 玩家於第4關中途主動放棄
      Given 玩家 "alice" 於第4關進行中
      When 玩家 "alice" 主動放棄Run
      Then Run狀態變為 "ABANDONED"
      And 系統發布 PveRunEnded 事件

  Rule: 後置（狀態）- 通過全部8關時Run狀態為WON

    Example: 通過第8關後Run結算為WON
      Given 玩家 "alice" 通過第8關
      When 系統結算Run
      Then Run狀態變為 "WON"
      And reachedEncounterSequence為8

  Rule: 後置（狀態）- Run結算顯示到達關數、總傷害、金幣收支、最終持有遺物與技能

    Example: 失敗Run的結算內容
      # totalDamageDealt 欄位保留（api.yml additive philosophy，不刪除既有
      # 欄位）；全對弈化後真實對局中這個值恆為0（DUEL無傷害概念），此處數值
      # 純粹測試「欄位正確透傳到結算回應」這條資料管線本身，非真實玩法示例。
      Given 玩家 "alice" 於第3關失敗，全Run總傷害累計640，共獲得90金幣、花費60金幣
      And 玩家 "alice" 最終持有遺物 "SHARP_BLADE"、技能 "HORIZONTAL_SLASH" 數量2
      When 玩家 "alice" 查看Run結算
      Then 系統顯示 reachedEncounterSequence為2、totalDamageDealt為640
      And 系統顯示 goldEarned為90、goldSpent為60
      And 系統顯示最終持有遺物與技能清單

  Rule: 後置（查詢）- Run自然結束（通關/失敗）後可另行查詢權威結算資料

    Example: 通過第8關後查詢Run結算資料
      Given 玩家 "alice" 已通過第8關，Run狀態為 "WON"
      When 玩家 "alice" 查詢該Run的結算
      Then 系統回傳 status為 "WON"、reachedEncounterSequence為8
      And 系統回傳權威的 goldEarned 與 goldSpent，不需前端自行推算

    Example: 因手數用盡於某關失敗後查詢Run結算資料
      Given 玩家 "alice" 於第5關手數用盡失敗，Run狀態為 "LOST"
      When 玩家 "alice" 查詢該Run的結算
      Then 系統回傳 status為 "LOST"、reachedEncounterSequence為4
      And 系統回傳權威的 goldEarned 與 goldSpent

    Example: 查詢仍進行中的Run結算時遭拒
      Given 玩家 "alice" 一個PVE Run進行中
      When 玩家 "alice" 查詢該Run的結算
      Then 操作失敗
      And 錯誤為 "Run仍進行中，尚未結束"

  # FR-C7 已定：任一關失敗或主動放棄→Run終止(LOST/ABANDONED)；8關全通過→WON；
  # 結算顯示到達關數/總傷害/金幣收支/最終持有遺物技能。
  # 本輪新增 GET /pve/runs/{runId}/result（api.yml）：Run自然結束（WON/LOST）時，
  # abandon/shop-skip 的當下回應不會再次觸發，前端需要事後查詢的權威取得方式；
  # 原本前端只能以 sessionStorage 合成結算，goldEarned/goldSpent 記0（首輪審核已列問題）。

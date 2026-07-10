@ignore @command
Feature: 魔王對弈
  # 來源：documents/PVE-全對弈階梯設計-2026-07-10.md（全8關皆為DUEL魔王對弈
  # encounter，取代僅第4/8關為DUEL的2026-07-09版）。
  # 事件：BossMovePlaced、EncounterCleared、EncounterFailed、EncounterDrawn
  # 規則：玩家＝黑子先手，Boss＝白子後手；玩家每落一手，Boss於同一次請求內立即
  #   回應一手（不佔玩家手數配額）；玩家連五＝過關；Boss連五＝敗（可重試，整個
  #   Run判負）；手數用盡且雙方皆未連五＝和局DRAW（不沒收Run、不計敗，可原地
  #   無限次重試，每次重試盤面重新開始、Boss AI重新播種）；DUEL關無BossHP/傷害/
  #   消線機制；技能可用且不觸發Boss回手；Boss第一手依開局腳本（L2花月/L7、L8
  #   浦月）由玩家第一手座標推導，其後轉純AI政策（BossAiPolicy §2）。
  #   L3額外規則：橫向連五不算勝（雙方對稱，全遊戲僅此關）。L5額外規則：開局
  #   一次性靜態岩石障礙（無隱藏噴發）。L6額外規則：每10手（雙方合計）推浪一次。
  #   L8額外規則：Boss持有精準狙擊/散射/開拓之星各一次charge，會在其AI決策的
  #   對應優先層插入施放（§3）。

  Background:
    Given 玩家 "alice" 一個PVE Run進行中

  Rule: 後置（狀態）- 玩家連五即過關，傷害/消線機制完全停用

    Example: 玩家於第4關連五達成過關
      Given 玩家位於第4關魔王對弈
      And 玩家已有橫向四連 (0,0)-(0,3)
      When 玩家落子於 (0,4) 完成連五
      Then 關卡狀態為 "CLEARED"
      And 系統發布 EncounterCleared 事件
      And 本次結算傷害為 0（DUEL無傷害概念）

  Rule: 後置（狀態）- Boss連五即判定玩家敗，Run判負可重試

    Example: Boss回手完成連五後關卡判定失敗
      Given 玩家位於第4關魔王對弈
      And Boss已有橫向四連 (2,2)-(2,5)，且已有過1手回手紀錄
      When 玩家於無關位置落子 (9,9)
      Then 關卡狀態為 "FAILED"
      And Run狀態變為 "LOST"
      And 系統發布 EncounterFailed 事件，原因為 "BOSS_FIVE"

  Rule: 後置（狀態）- 玩家手數用盡且雙方皆未連五即判定和局

    Example: 手數預算為1且未連五時判定為DRAW，Run不受影響
      Given 玩家位於第4關魔王對弈，手數預算設為 1
      When 玩家於 (5,5) 落子且未連五
      Then 關卡狀態為 "DRAW"
      And Run狀態仍為 "IN_PROGRESS"
      And 系統發布 EncounterDrawn 事件

    Example: 和局後呼叫重試，原地重開同一關，Run不受影響
      Given 玩家位於第4關魔王對弈，手數預算設為 1
      And 玩家於 (5,5) 落子且未連五，關卡狀態為 "DRAW"
      When 玩家對該關卡呼叫重試
      Then 系統回傳一個新的第4關魔王對弈關卡，狀態為 "IN_PROGRESS"、手數已用為 0
      And Run狀態仍為 "IN_PROGRESS"
      And 原關卡不再可查詢（已標記刪除）

    Example: DRAW可無限次重試，重試不消耗任何Run層級資源
      Given 玩家位於第4關魔王對弈，手數預算設為 1
      When 玩家連續 3 次「落子且未連五(DRAW)後立即重試」
      Then Run狀態仍為 "IN_PROGRESS"
      And Run金幣與已抵達關卡序號皆與流程開始前相同

    Example: 非DRAW狀態的關卡呼叫重試會被拒絕
      Given 玩家位於第4關魔王對弈，關卡狀態為 "IN_PROGRESS"
      When 玩家對該關卡呼叫重試
      Then 系統回傳422錯誤

  Rule: 前置（參數）- Boss第一手依開局腳本（花月/浦月）由玩家第一手推導，其後轉AI

    Example: 第2關花月開局 — Boss第一手為玩家第一手右下方(r+1,c)
      Given 玩家位於第2關魔王對弈
      When 玩家第一手落子於 (5,5)
      Then Boss第一手回應座標為 (6,5)

    Example: 第2關花月開局越界 — 玩家第一手於最後一行時鏡射
      Given 玩家位於第2關魔王對弈
      When 玩家第一手落子於 (10,3)
      Then Boss第一手回應座標為 (9,3)

    Example: 第7關浦月開局 — Boss第一手為玩家第一手右下斜方(r+1,c+1)
      Given 玩家位於第7關魔王對弈
      When 玩家第一手落子於 (5,5)
      Then Boss第一手回應座標為 (6,6)

    Example: 第8關浦月開局（與第7關同款腳本）— 兩軸各自獨立鏡射
      Given 玩家位於第8關魔王對弈
      When 玩家第一手落子於 (10,10)
      Then Boss第一手回應座標為 (9,9)

  Rule: 後置（狀態）- Boss的棋子在API回應中標示為ENEMY_STONE，非岩石障礙

    Example: Boss第一手回應後obstacles[]標示kind為ENEMY_STONE
      Given 玩家位於第4關魔王對弈
      When 玩家第一手落子於 (5,5)
      Then obstacles中恰有1個座標且kind為 "ENEMY_STONE"

  Rule: 前置（狀態）- 技能於對弈關可用，且不觸發Boss回手（智取路徑）

    Example: 精準狙擊將Boss棋子策反為己方
      Given 玩家位於第4關魔王對弈，Boss於 (4,4) 已有一子
      When 玩家使用精準狙擊策反 (4,4)
      Then (4,4) 變為玩家棋子
      And 本次操作不觸發Boss回手（BossMovePlaced事件數不變）

    Example: 橫劈推動Boss正在排列的連線
      Given 玩家位於第4關魔王對弈，Boss於 (5,4)(5,5)(5,6) 已有連續三子
      When 玩家使用橫劈技能推擠涵蓋這排Boss棋子
      Then Boss於該排的棋子依推擠解算器規則被推移
      And 本次操作不觸發Boss回手（BossMovePlaced事件數不變）

    Example: 開拓之星清空Boss即將成型的雙威脅棋子
      Given 玩家位於第4關魔王對弈，Boss於 (4,4)(5,4) 已有兩子
      When 玩家使用開拓之星清除該範圍
      Then (4,4) 與 (5,4) 皆不再有棋子
      And 本次操作不觸發Boss回手（BossMovePlaced事件數不變）

  Rule: 前置（狀態）- 第4關進場保底補足橫劈技能至2個

    Example: 第4關進場時橫劈技能補到至少2個
      Given 玩家位於第4關魔王對弈
      Then 玩家 "alice" 持有技能 "HORIZONTAL_SLASH" 數量為 2

  Rule: 後置（狀態）- L3 不可橫向：雙方皆無法僅靠橫向連五取勝，全遊戲僅此關

    Example: 玩家於第3關橫向連五不算勝，關卡仍進行中
      Given 玩家位於第3關魔王對弈
      And 玩家已有橫向四連 (5,2)-(5,5)
      When 玩家落子於 (5,6) 完成連五
      Then 關卡狀態為 "IN_PROGRESS"

  Rule: 前置（參數）- L5 火山：開局一次性、全局確定性靜態岩石障礙（無隱藏噴發）

    Example: 第5關存在5至8格岩石障礙
      Given 玩家位於第5關魔王對弈
      Then 該關障礙格（kind為ROCK）數量介於5至8之間

  Rule: 前置（參數）- L6 海浪：沿用既有BEACH場地與每10手推浪機制

    Example: 第6關場地類型為BEACH
      Given 玩家位於第6關魔王對弈
      Then 該關場地類型為 "BEACH"

    # §7.6 第二批 polish item #5（L6 邊緣推浪案例）：海側固定北（海區列0-4、
    # 推浪方向向南），推浪計數器預置 9，玩家下一手即第 10 手觸發推浪。
    # 相間棋子鏈（黑白交錯）刻意避免推擠後湊出任一方五連，隔離「邊緣行為」變因。
    Example: 推浪將貼緣棋子鏈推擠出界——底緣棋子移除、其餘遞補、盤面重建合法
      # 鏈佈滿列4(海區源頭)至列10(底緣)：推浪後整鏈南移1格，(10,2)出界移除，
      # (4,2)的黑子遞補至(5,2)；總數 = 7(鏈) - 1(出界) + 1(玩家觸發手) + 1(Boss回手) = 8。
      Given 玩家位於第6關魔王對弈，海側為北且推浪計數器為 9
      And 第 2 直行的列 4 至列 10 佈有黑白相間棋子鏈（起自玩家黑子）
      When 玩家於無關位置落子 (9,9)
      Then 系統發布本關推浪 StonesPushed 事件
      And 系統發布 StoneRemovedOffBoard 事件於 (10,2)
      And 重建盤面後 (5,2) 為玩家黑子
      And 重建盤面後 (10,2) 為Boss白子
      And 重建盤面後棋子總數為 8

    Example: 推浪將距底緣1格的棋子擠壓至邊緣但不出界——無出界移除、盤面重建合法
      # 鏈只到列9（距底緣1格）：推浪後尾端白子恰好落在底緣(10,2)，無任何出界；
      # 總數 = 6(鏈) + 1(玩家觸發手) + 1(Boss回手) = 8。
      Given 玩家位於第6關魔王對弈，海側為北且推浪計數器為 9
      And 第 2 直行的列 4 至列 9 佈有黑白相間棋子鏈（起自玩家黑子）
      When 玩家於無關位置落子 (9,9)
      Then 系統發布本關推浪 StonesPushed 事件
      And 本次推浪未發布 StoneRemovedOffBoard 事件
      And 重建盤面後 (5,2) 為玩家黑子
      And 重建盤面後 (10,2) 為Boss白子
      And 重建盤面後棋子總數為 8

  Rule: 後置（狀態）- L8「反技能」：Boss持有三個弓箭手技能各一次charge，會插入AI決策對應優先層

    Example: 玩家形成活三時，Boss以精準狙擊拆解中間格
      # §3.3 MIN_SKILL_TRIGGER_TURN 校準（本session N=200實測發現）：精準狙擊/
      # 散射僅在Boss第10手回應起才會觸發（見BossAiPolicy javadoc），故此處需
      # 先鋪墊9手散落無關紀錄，而非僅1手。
      Given 玩家位於第8關魔王對弈，Boss已有9手散落無關紀錄
      And 玩家已有橫向三連（活三）(5,5)-(5,7)
      When 玩家於無關位置落子 (6,8)
      Then Boss使用精準狙擊將 (5,6) 轉為Boss棋子

    Example: Boss施放技能後，玩家仍可於本間隔使用自己的技能（bug fix：舊版冷卻未分caster）
      # 修法前：eventRepository.existsBy...(SKILL_USED, movesUsed) 不分caster，
      # Boss這次施法會與玩家共用同一個「本間隔」鎖，導致玩家的技能被誤鎖。
      Given 玩家位於第8關魔王對弈，Boss已有9手散落無關紀錄
      And 玩家已有橫向三連（活三）(5,5)-(5,7)
      When 玩家於無關位置落子 (6,8)
      Then Boss使用精準狙擊將 (5,6) 轉為Boss棋子
      And 玩家仍可於本間隔使用自己的技能

    Example: 玩家已有活四時，Boss以開拓之星清空該區域
      Given 玩家位於第8關魔王對弈，Boss於 (10,10) 已有一子
      And 玩家已有橫向四連 (5,2)-(5,5)
      When 玩家於無關位置落子 (0,0)
      Then Boss使用開拓之星清空玩家的活四，其中 (5,3) 與 (5,4) 不再有棋子

  # 已定：全8關皆為DUEL；玩家黑先手、Boss白後手；玩家連五過關／Boss連五敗／
  # 手數用盡且雙方皆未連五＝DRAW（不沒收Run、可原地無限次重試）；無HP/傷害/
  # 消線機制；技能可用不觸發Boss回手；開局腳本化(L2花月/L7L8浦月)首手，其後
  # 轉BossAiPolicy純AI。L3不可橫向、L5火山岩石、L6海浪、L8弓箭手技能各一次。
  # Boss AI 四檔決策表單元案例見 BossAiPolicyTest；統計勝率驗收見
  # Boss對弈統計驗證.feature。

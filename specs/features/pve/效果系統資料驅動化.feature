@ignore @query
Feature: 效果系統資料驅動化
  # 來源：PVE 增量 FR-A1 FR-A2 FR-A3（documents/PVE-挑戰模式-增量需求.md）
  # 事件：無新使用者事件；本 feature 驗證引擎內部資料結構與決定性，作為回歸測試基準
  # 規則：現有 6 技能（HORIZONTAL_SLASH/VERTICAL_SLASH/HEAVEN_EARTH_REVERSAL/
  #   PRECISION_SNIPE/SCATTER_SHOT/PIONEER_STAR）與 2 場地效果（火山噴發/海灘漲潮）
  #   改為「觸發器+條件+原子操作序列+數值參數」資料定義；引擎僅實作原子操作集：
  #   落子(PLACE)、移除(REMOVE)、推移(PUSH)、變換(TRANSFORM)、生成(GENERATE)、
  #   數值修飾(MODIFY_VALUE)。使用限制（每場一次/消耗型/充能型）與行動型態
  #   （附加於落子/取代落子/獨立行動）皆由資料欄位宣告，PVP/PVE 可分別宣告不同型態。
  #   場地生成與所有隨機效果統一使用注入的 seed，同 seed+同操作序列必得同結果。

  Rule: 前置（狀態）- 現有 6 技能與 2 場地效果皆有對應的資料驅動定義

    Example: 查詢橫劈技能的 PVP 效果定義
      When 查詢 effectKey "HORIZONTAL_SLASH"、applicableMode "PVP" 的效果定義
      Then 系統回傳 actionType 為 "ATTACHED_TO_MOVE"
      And usageLimitType 為 "ONCE_PER_GAME"

    Example: 查詢大絕天地反轉的 PVP 效果定義
      When 查詢 effectKey "HEAVEN_EARTH_REVERSAL"、applicableMode "PVP" 的效果定義
      Then 系統回傳 actionType 為 "REPLACE_MOVE"
      And usageLimitType 為 "ONCE_PER_GAME"

  Rule: 前置（狀態）- 同一技能在 PVE 宣告為獨立行動且消耗型，不寫死於程式碼

    Example: 查詢橫劈技能的 PVE 效果定義
      When 查詢 effectKey "HORIZONTAL_SLASH"、applicableMode "PVE" 的效果定義
      Then 系統回傳 actionType 為 "INDEPENDENT"
      And usageLimitType 為 "CONSUMABLE"

    Example: 查詢大絕天地反轉的 PVE 效果定義（PVP 的「取代落子」不適用於 PVE）
      When 查詢 effectKey "HEAVEN_EARTH_REVERSAL"、applicableMode "PVE" 的效果定義
      Then 系統回傳 actionType 為 "INDEPENDENT"
      And usageLimitType 為 "CONSUMABLE"

  Rule: 後置（回歸）- 效果系統重構後現有 PVP 行為完全不變

    Example: PVP 真劍勝負對局行為與重構前一致
      Given 現有 PVP 回歸測試套件（劍士技能組/弓箭手技能組/推擠解算器/火山場地/沙灘場地/海浪與漲潮結算）
      When 效果系統改為資料驅動後重新執行
      Then 全部測試維持綠燈，行為零變化（NFR-3）

  Rule: 後置（狀態）- 同一 seed 加同一操作序列必得同一結果

    Example: 相同 seed 建立兩次 Run，第5關（VOLCANO）岩石障礙位置相同
      # 2026-07-10 全對弈階梯改版：L2 固定 PLAIN（花月開局教學關），不再有隨機
      # VOLCANO/BEACH 判定；本例改用 L5（documents/PVE-全對弈階梯設計-2026-07-10.md
      # §4.2 一次性靜態岩石，經 PveRandoms.forPurpose(seed,"volcano-l5") 播種）
      # 驗證同一決定性論證。
      Given 使用 seed "abc123" 建立第一個 PVE Run
      And 使用相同 seed "abc123" 建立第二個 PVE Run
      When 比對兩個 Run 第 5 關的岩石障礙格位置
      Then 兩者完全相同（FR-A3 NFR-1）

  # FR-A1/A2/A3 已定：原子操作集=落子/移除/推移/變換/生成/數值修飾；
  # PVP=一般技能ATTACHED_TO_MOVE、大絕REPLACE_MOVE，皆ONCE_PER_GAME；
  # PVE=全部INDEPENDENT+CONSUMABLE；同seed+同操作序列必得同結果。

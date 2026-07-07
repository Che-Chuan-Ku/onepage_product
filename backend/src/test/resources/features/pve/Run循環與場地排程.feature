@ignore @command
Feature: Run循環與場地排程
  # 來源：PVE 增量 FR-C1 FR-C2（documents/PVE-挑戰模式-增量需求.md）
  # 事件：PveEncounterCreated
  # 規則：8關依固定順序，手數預算每關固定30；BossHP依1.6倍曲線：
  #   100/160/260/420/670/1070/1710/2740；第1/3/4/6/8關為PLAIN；
  #   第2/5/7關由seed各自50%機率決定VOLCANO或BEACH的11×11變體
  #   （可見障礙格3–5個、隱藏格至多3個；BEACH沿用每10手結算一次海浪，
  #   海側5行、沙側6行）。

  Background:
    Given 一個PVE Run進行中

  Rule: 後置（狀態）- BossHP依1.6倍曲線隨關次遞增

    Example: 各關BossHP符合固定曲線
      When Run依序建立第1至8關
      Then 各關bossHpMax依序為 100,160,260,420,670,1070,1710,2740

  Rule: 前置（參數）- 第1/3/4/6/8關固定為PLAIN場地

    Example: 第1關為PLAIN場地
      When Run建立第1關
      Then fieldType為 "PLAIN"，該關無任何場地效果

    Example: 第3、4、6、8關皆為PLAIN場地
      When Run依序建立第3、4、6、8關
      Then 各關fieldType皆為 "PLAIN"

  Rule: 前置（參數）- 第2/5/7關由seed各自50%機率決定VOLCANO或BEACH

    Example: 相同seed下第2關場地判定具決定性
      Given 使用相同seed的兩個Run
      When 兩個Run分別建立第2關
      Then 兩者fieldType判定結果相同（FR-A3決定性）

    Example: VOLCANO 11x11變體的障礙格與隱藏格數量
      Given 第2關由seed判定為 "VOLCANO"
      When 系統生成該關場地
      Then 系統生成 3 至 5 個可見障礙格
      And 系統生成至多 3 個隱藏噴發格（server-only）

    Example: BEACH 11x11變體的海沙切分
      Given 第5關由seed判定為 "BEACH"
      When 系統生成該關場地
      Then 海側起始為5行，沙側為6行（⌊11/2⌋=5）
      And 海浪每10手落子結算一次（沿用推擠解算器規則）

  Rule: 後置（狀態）- 通過一關後依固定順序建立下一關

    Example: 通過第1關後建立第2關
      Given 玩家已通過第1關
      When 系統推進至下一關（商店結束後）
      Then 系統建立第2關，currentEncounterSequence為2
      And 系統發布 PveEncounterCreated 事件

  # FR-C1/FR-C2 已定：BossHP曲線100/160/260/420/670/1070/1710/2740；
  # 手數預算固定30；1/3/4/6/8=PLAIN；2/5/7=seed 50%機率VOLCANO/BEACH(11x11新幾何)；
  # VOLCANO障礙3-5可見/隱藏<=3；BEACH海5沙6、每10手海浪。

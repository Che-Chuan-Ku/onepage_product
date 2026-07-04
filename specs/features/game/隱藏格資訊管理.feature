@ignore @query
Feature: 隱藏格資訊管理
  # 來源：需求 #44（隱藏格資訊管理）
  # 事件：VolcanoErupted, TideTriggered
  # 規則：噴發格 / 漲潮格位置僅存 server 端，不下發給任一玩家；
  #   觀戰者視角與玩家相同，同樣看不到隱藏格（R2-2）。

  Background:
    Given 一場真劍勝負對局進行中，場地含隱藏格（噴發格或漲潮格）

  Rule: 前置（狀態）- 隱藏格位置不下發給任一對戰玩家

    Example: 查詢對局狀態時不含隱藏格位置
      When 玩家查詢目前對局狀態
      Then 回應中不包含尚未觸發的隱藏格位置

  Rule: 前置（狀態）- 觀戰者視角同玩家，同樣看不到隱藏格

    Example: 觀戰者查詢對局狀態時亦看不到隱藏格
      Given "carol" 為該對局的觀戰者
      When "carol" 查詢對局狀態
      Then 回應中不包含尚未觸發的隱藏格位置

  Rule: 後置（狀態）- 隱藏格觸發後才對外揭露該格資訊（透過對應事件）

    Example: 隱藏噴發格觸發後才廣播其位置
      Given (7,7) 為隱藏噴發格且尚未觸發
      When 玩家於 (7,7) 落子觸發噴發
      Then 系統發布 VolcanoErupted 事件，內含 (7,7) 位置
      And 該格位置自此對雙方與觀戰者皆可見

  # R2-2 已定：觀戰者同玩家視角，看不到隱藏格（server-only）。

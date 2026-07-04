@ignore @command
Feature: 技能與場地特效
  # 來源：需求 #45（技能與場地特效）
  # 事件：對應各結算事件（SkillUsed / VolcanoErupted / WaveSurged / TideTriggered 等）
  # 規則（R2-1 已定）：需求僅標「有特效」，具體動畫留待 UI 設計階段定案；
  #   本層僅驗證「特效觸發旗標／事件確有發布」，不驗證動畫實作細節。

  Rule: 後置（狀態）- 劈砍/狙擊/散射/大絕/噴發/海浪/漲潮結算時皆附帶特效觸發旗標

    Example: 橫劈結算時事件附帶特效觸發旗標
      When 玩家使用技能 "HORIZONTAL_SLASH" 完成結算
      Then 系統發布 SkillUsed 事件，且事件包含 effectTriggered 為 true

    Example: 火山噴發結算時事件附帶特效觸發旗標
      When 火山噴發完成結算
      Then 系統發布 VolcanoErupted 事件，且事件包含 effectTriggered 為 true

    Example: 海浪與漲潮結算時事件附帶特效觸發旗標
      When 海浪或漲潮完成結算
      Then 系統發布對應事件，且事件包含 effectTriggered 為 true

  # R2-1 已定：具體動畫/音效於 UI 設計階段定案，本層僅要求事件觸發旗標存在。

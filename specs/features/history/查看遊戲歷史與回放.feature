@ignore @query
Feature: 查看遊戲歷史與回放
  # 來源：需求 #17（遊戲歷史與回放）、#32（開局記錄與重播支援）
  # 事件：GameEnded（保存來源）

  Background:
    Given 系統中有一場已結束的對局：
      | gameId | winner | moveCount | useSwap2 |
      | g-001  | alice  | 42        | true     |

  Rule: 後置（狀態）- 對局結束後保存完整落子序列（含開局 stones）

    Example: 對局結束後落子序列被保存
      Given 對局 "g-001" 已發布 GameEnded
      Then 系統保存該局完整落子序列
      And 落子序列包含開局 openingStones

  Rule: 後置（回應）- 查詢歷史對局可取得可重播的完整落子序列

    Example: 查詢對局 g-001 取得回放資料
      When 查詢對局 "g-001" 的回放
      Then 操作成功
      And 查詢結果應包含：
        | gameId | winner | moveCount |
        | g-001  | alice  | 42        |
      And 回放序列依 moveNumber 排序，開局子可被識別

  # ASM(A4 已確認): 開局 stones 採「獨立 opening_stones 表」記錄（見 erm.dbml），非 moveNumber<0。

  Rule: 後置（狀態）- 真劍勝負對局回放需包含技能事件與場地事件（需求 #47）

    Example: 真劍勝負對局回放包含技能與場地事件
      Given 對局 "g-002" 為真劍勝負模式（場地 "BEACH"）並已結束
      When 查詢對局 "g-002" 的回放
      Then 操作成功
      And 回放資料包含技能事件（如 SkillUsed / StonesPushed / ColorsSwapped）
      And 回放資料包含場地事件（如 WaveSurged / TideTriggered / SandEroded）
      And 賽後回放可完整重現對局，隱藏格（漲潮/噴發）位置於回放中可被揭露

  # 需求 #47 已定（R2-4）：回放記錄技能事件與場地事件；隱藏格賽後可揭露。

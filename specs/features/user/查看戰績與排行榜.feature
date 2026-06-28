@ignore @query
Feature: 查看個人戰績與排行榜
  # 來源：需求 #3（個人戰績與排行榜）
  # 事件：GameEnded（戰績累積來源）

  Background:
    Given 系統中有以下玩家戰績：
      | username | wins | losses |
      | alice    | 8    | 2      |
      | bob      | 5    | 5      |
      | carol    | 4    | 3      |

  Rule: 後置（回應）- 個人戰績應包含勝場、敗場、勝率與最近對戰紀錄

    Example: 查詢 alice 的個人戰績
      When 查詢 username "alice" 的個人戰績
      Then 操作成功
      And 查詢結果應包含：
        | wins | losses | winRate |
        | 8    | 2      | 0.80    |
      And 查詢結果包含最近對戰紀錄列表

  Rule: 後置（回應）- 排行榜以勝場數為主鍵由高到低排序，並列以勝率為次鍵

    Example: 查詢排行榜時 alice（勝場多）排在 bob 之前
      When 查詢排行榜
      Then 操作成功
      And 排行榜第一名為 "alice"
      And 排行榜第二名為 "bob"

    Example: 勝場相同時以勝率高者在前
      Given 系統中有以下玩家戰績：
        | username | wins | losses |
        | dave     | 6    | 4      |
        | erin     | 6    | 14     |
      When 查詢排行榜
      Then "dave" 排在 "erin" 之前

  Rule: 前置（門檻）- 累計對局數（勝+敗）達 10 場才列入排行榜

    Example: 對局數不足 10 場的玩家不上榜
      When 查詢排行榜
      Then 排行榜不包含 "carol"

  # 排行榜規則（Q2 已定）：主排序鍵 wins DESC、次鍵 win_rate DESC；
  #   上榜門檻 wins+losses >= 10。
  # ASM(A5)：排行榜以 Redis 快取（需求 #3 技術建議），快取失效/刷新策略待 Tactical 補。

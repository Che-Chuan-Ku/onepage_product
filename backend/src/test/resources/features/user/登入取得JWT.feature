@ignore @command
Feature: 登入取得 JWT
  # 來源：需求 #1
  # 事件：PlayerLoggedIn

  Background:
    Given 系統中已存在以下玩家：
      | username | password   |
      | alice    | P@ssw0rd1  |

  Rule: 前置（參數）- 帳號與密碼必須與既有玩家相符

    Example: 密碼錯誤時登入失敗
      When 玩家以 username "alice" 與密碼 "wrong" 登入
      Then 操作失敗，錯誤為 "帳號或密碼錯誤"

    Example: 帳號不存在時登入失敗
      When 玩家以 username "ghost" 與密碼 "P@ssw0rd1" 登入
      Then 操作失敗，錯誤為 "帳號或密碼錯誤"

  Rule: 後置（回應）- 登入成功後回傳可用於後續請求的 JWT

    Example: 以正確帳密登入後取得 JWT
      When 玩家以 username "alice" 與密碼 "P@ssw0rd1" 登入
      Then 操作成功
      And 回應包含一個 JWT token
      And 系統發布 PlayerLoggedIn 事件

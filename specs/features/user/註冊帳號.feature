@ignore @command
Feature: 註冊帳號
  # 來源：需求 #1（使用者管理 / 註冊·登入 JWT）
  # 事件：PlayerRegistered

  Background:
    Given 系統中已存在以下玩家：
      | username | email             |
      | alice    | alice@example.com |

  Rule: 前置（參數）- username 必須唯一

    Example: 使用已存在的 username 註冊時操作失敗
      When 訪客以 username "alice" 與 email "new@example.com" 註冊
      Then 操作失敗，錯誤為 "username 已被使用"

  Rule: 前置（參數）- email 必須唯一且格式合法

    Example: 使用已存在的 email 註冊時操作失敗
      When 訪客以 username "bob" 與 email "alice@example.com" 註冊
      Then 操作失敗，錯誤為 "email 已被註冊"

    Example: 使用格式不合法的 email 註冊時操作失敗
      When 訪客以 username "bob" 與 email "not-an-email" 註冊
      Then 操作失敗，錯誤為 "email 格式不正確"

  Rule: 前置（參數）- 密碼至少 8 碼且須同時含英文小寫字母與數字

    Example: 密碼少於 8 碼註冊時操作失敗
      When 訪客以 username "carol" 與 email "carol@example.com" 與密碼 "ab12" 註冊
      Then 操作失敗，錯誤為 "密碼至少需 8 碼"

    Example: 密碼缺少數字註冊時操作失敗
      When 訪客以 username "carol" 與 email "carol@example.com" 與密碼 "abcdefgh" 註冊
      Then 操作失敗，錯誤為 "密碼須同時包含英文小寫字母與數字"

    Example: 密碼缺少英文小寫字母註冊時操作失敗
      When 訪客以 username "carol" 與 email "carol@example.com" 與密碼 "12345678" 註冊
      Then 操作失敗，錯誤為 "密碼須同時包含英文小寫字母與數字"

  Rule: 後置（狀態）- 註冊成功後系統建立玩家帳號並發布 PlayerRegistered 事件

    Example: 以全新帳號註冊後建立成功
      When 訪客以 username "carol" 與 email "carol@example.com" 與密碼 "P@ssw0rd1" 註冊
      Then 操作成功
      And 系統中存在 username 為 "carol" 的玩家
      And 密碼以雜湊形式儲存，不以明文保存

  # 密碼規則（Q3 已定）：最短 8 碼；硬性要求至少含英文小寫字母 + 數字；
  #   允許大小寫字母、數字、符號（不限制更高複雜度）。

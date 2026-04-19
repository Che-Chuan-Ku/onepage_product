@ignore @command
Feature: RBAC 資料隔離

  Background:
    Given 管理員已登入後台

  Rule: 約束（RBAC 資料隔離）- 一般使用者只看到自己的資料（REQ-034）
  Rule: 約束（RBAC 資料隔離）- 管理員可查看所有使用者的全部資料（REQ-034）

  # ═══ Scenario Examples ═══

  Scenario: 一般使用者只看到自己的網站
    Given 一般使用者 "shop1@example.com" 已登入後台
    And 該使用者已建立網站 "我的水果店"
    And 系統中另有其他使用者建立的網站
    When 一般使用者查詢網站清單
    Then 清單中只包含自己的網站

  Scenario: 一般使用者只看到自己的商品
    Given 一般使用者 "shop1@example.com" 已登入後台
    And 該使用者已建立商品 "我的芒果"
    When 一般使用者查詢商品清單
    Then 清單中只包含自己的商品

  Scenario: 管理員可查看所有使用者的網站
    Given 管理員已登入後台
    And 系統中有多位使用者各自建立的網站
    When 管理員查詢網站清單
    Then 清單包含所有使用者建立的網站

  Scenario: 一般使用者查詢訂單只看自己網站的訂單
    Given 一般使用者 "shop1@example.com" 已登入後台
    When 一般使用者查詢訂單清單
    Then 訂單清單只包含自己網站的訂單

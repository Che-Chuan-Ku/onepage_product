# language: zh-TW
功能: 後台登入

  場景: 管理員成功登入
    假設 使用者在後台登入頁
    當 使用者輸入 Email "admin@onepage.tw"
    且 使用者輸入密碼 "admin123"
    且 使用者點擊登入按鈕
    那麼 使用者應被導向後台管理頁面

  場景: 輸入錯誤密碼
    假設 使用者在後台登入頁
    當 使用者輸入 Email "admin@onepage.tw"
    且 使用者輸入密碼 "wrongpassword"
    且 使用者點擊登入按鈕
    那麼 使用者應看到錯誤訊息 "帳號或密碼錯誤"

  場景: 輸入無效 Email 格式
    假設 使用者在後台登入頁
    當 使用者輸入 Email "not-an-email"
    且 使用者輸入密碼 "admin123"
    且 使用者點擊登入按鈕
    那麼 使用者應看到 Email 格式驗證錯誤

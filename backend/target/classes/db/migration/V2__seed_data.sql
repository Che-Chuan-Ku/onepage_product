-- ══════════════════════════════════════════════════════
-- V2: 初始種子資料
-- ══════════════════════════════════════════════════════

-- ── 預設管理員帳號 ────────────────────────────────────
-- 密碼: correct_password（BCrypt hash）
INSERT INTO users (email, password_hash, name, role)
VALUES (
    'admin@example.com',
    '$2b$10$AjJoi3VI1xXqwgiaLDWSA.PHuAtiXMykJOS9B7olGgQYRawiBmkC2',
    '系統管理員',
    'ADMIN'
);

-- ── 預設一般使用者 ────────────────────────────────────
INSERT INTO users (email, password_hash, name, role)
VALUES (
    'user@example.com',
    '$2b$10$AjJoi3VI1xXqwgiaLDWSA.PHuAtiXMykJOS9B7olGgQYRawiBmkC2',
    '一般使用者',
    'GENERAL_USER'
);

-- ── 商品類型（分類） ──────────────────────────────────
INSERT INTO product_categories (id, name, parent_id) VALUES (1, '水果類', NULL);
INSERT INTO product_categories (id, name, parent_id) VALUES (2, '南北乾貨', NULL);
INSERT INTO product_categories (id, name, parent_id) VALUES (3, '台灣產', 1);
INSERT INTO product_categories (id, name, parent_id) VALUES (4, '進口', 1);
INSERT INTO product_categories (id, name, parent_id) VALUES (5, '台灣產', 2);
INSERT INTO product_categories (id, name, parent_id) VALUES (6, '進口', 2);

-- ── Email 通知模板 ────────────────────────────────────
INSERT INTO email_templates (template_type, subject, body_html) VALUES
(
    'ORDER_CONFIRMED',
    '【OnePage】訂單確認通知 - {{orderNumber}}',
    '<h2>感謝您的訂購！</h2><p>親愛的 {{customerName}}，</p><p>您的訂單 <strong>{{orderNumber}}</strong> 已成功建立。</p><p>訂單金額：NT$ {{totalAmount}}</p><p>我們將盡快為您處理。</p>'
),
(
    'PAYMENT_SUCCESS',
    '【OnePage】付款成功通知 - {{orderNumber}}',
    '<h2>付款成功！</h2><p>親愛的 {{customerName}}，</p><p>您的訂單 <strong>{{orderNumber}}</strong> 已付款成功。</p><p>訂單金額：NT$ {{totalAmount}}</p>'
),
(
    'PAYMENT_FAILED',
    '【OnePage】付款失敗通知 - {{orderNumber}}',
    '<h2>付款失敗</h2><p>親愛的 {{customerName}}，</p><p>您的訂單 <strong>{{orderNumber}}</strong> 付款未成功，請重新付款。</p>'
),
(
    'SHIPPED',
    '【OnePage】出貨通知 - {{orderNumber}}',
    '<h2>您的訂單已出貨！</h2><p>親愛的 {{customerName}}，</p><p>您的訂單 <strong>{{orderNumber}}</strong> 已出貨，請耐心等候收貨。</p>'
);

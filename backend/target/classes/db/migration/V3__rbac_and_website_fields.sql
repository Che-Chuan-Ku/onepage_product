-- ══════════════════════════════════════════════════════
-- V3: RBAC 資料隔離欄位 + 網站設定擴充 + email_templates 重構
-- REQ-029, REQ-034
-- ══════════════════════════════════════════════════════

-- ── 商品類型加入 owner_user_id（REQ-034）────────────────
ALTER TABLE product_categories
    ADD COLUMN owner_user_id BIGINT REFERENCES users(id);

-- 補齊現有資料（指向第一位管理員）
UPDATE product_categories SET owner_user_id = (SELECT id FROM users WHERE role = 'ADMIN' ORDER BY id LIMIT 1)
    WHERE owner_user_id IS NULL;

ALTER TABLE product_categories ALTER COLUMN owner_user_id SET NOT NULL;

-- ── 商品加入 owner_user_id（REQ-034）────────────────────
ALTER TABLE products
    ADD COLUMN owner_user_id BIGINT REFERENCES users(id);

UPDATE products SET owner_user_id = (SELECT id FROM users WHERE role = 'ADMIN' ORDER BY id LIMIT 1)
    WHERE owner_user_id IS NULL;

ALTER TABLE products ALTER COLUMN owner_user_id SET NOT NULL;

-- ── 網站加入 owner_user_id（REQ-034）────────────────────
ALTER TABLE websites
    ADD COLUMN owner_user_id BIGINT REFERENCES users(id);

UPDATE websites SET owner_user_id = (SELECT id FROM users WHERE role = 'ADMIN' ORDER BY id LIMIT 1)
    WHERE owner_user_id IS NULL;

ALTER TABLE websites ALTER COLUMN owner_user_id SET NOT NULL;

-- ── 網站新增 REQ-029 欄位 ────────────────────────────────
ALTER TABLE websites
    ADD COLUMN title VARCHAR(255),
    ADD COLUMN subtitle VARCHAR(255),
    ADD COLUMN browser_title VARCHAR(255),
    ADD COLUMN footer_title VARCHAR(255),
    ADD COLUMN footer_subtitle TEXT;

-- 補齊現有資料（以 name 作為 title 預設值）
UPDATE websites SET title = name WHERE title IS NULL;

ALTER TABLE websites ALTER COLUMN title SET NOT NULL;

-- ── email_templates 加入 owner_user_id（REQ-034）─────────
-- 先移除原有的 UNIQUE 約束
ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_template_type_key;

-- 新增 owner_user_id 欄位
ALTER TABLE email_templates
    ADD COLUMN owner_user_id BIGINT REFERENCES users(id);

-- 現有模板改為屬於第一位管理員
UPDATE email_templates SET owner_user_id = (SELECT id FROM users WHERE role = 'ADMIN' ORDER BY id LIMIT 1)
    WHERE owner_user_id IS NULL;

ALTER TABLE email_templates ALTER COLUMN owner_user_id SET NOT NULL;

-- 為每位使用者的模板類型建立唯一索引（REQ-034）
CREATE UNIQUE INDEX idx_email_templates_owner_type ON email_templates(owner_user_id, template_type);

-- ── 索引補強 ────────────────────────────────────────────
CREATE INDEX idx_product_categories_owner ON product_categories(owner_user_id);
CREATE INDEX idx_products_owner ON products(owner_user_id);
CREATE INDEX idx_websites_owner ON websites(owner_user_id);
CREATE INDEX idx_email_templates_owner ON email_templates(owner_user_id);

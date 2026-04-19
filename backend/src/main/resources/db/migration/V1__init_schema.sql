-- ══════════════════════════════════════════════════════
-- V1: 初始化 OnePage 電商平台資料庫結構
-- ══════════════════════════════════════════════════════

-- ── 使用者認證與權限 ──────────────────────────────────
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'GENERAL_USER',
    locked_until TIMESTAMP,
    failed_login_count INT DEFAULT 0,
    last_login_at TIMESTAMP,
    last_login_ip VARCHAR(45),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 商品類型（分類） ──────────────────────────────────
CREATE TABLE product_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id BIGINT REFERENCES product_categories(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 商品 ──────────────────────────────────────────────
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    price_unit VARCHAR(10) NOT NULL,
    packaging VARCHAR(255),
    category_id BIGINT NOT NULL REFERENCES product_categories(id),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    is_bundle BOOLEAN NOT NULL DEFAULT FALSE,
    bundle_discount_percent DECIMAL(5,2),
    is_preorder BOOLEAN NOT NULL DEFAULT FALSE,
    preorder_start_date DATE,
    preorder_end_date DATE,
    preorder_discount_percent DECIMAL(5,2),
    shipping_deadline DATE,
    stock_quantity INT NOT NULL DEFAULT 0,
    low_stock_threshold INT NOT NULL DEFAULT 10,
    low_stock_alerted BOOLEAN NOT NULL DEFAULT FALSE,
    version INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 商品圖片 ──────────────────────────────────────────
CREATE TABLE product_images (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    image_url VARCHAR(500) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 組合包包含商品 ────────────────────────────────────
CREATE TABLE bundle_items (
    id BIGSERIAL PRIMARY KEY,
    bundle_product_id BIGINT NOT NULL REFERENCES products(id),
    included_product_id BIGINT NOT NULL REFERENCES products(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 網站 ──────────────────────────────────────────────
CREATE TABLE websites (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subscription_plan TEXT,
    publish_start_at TIMESTAMP,
    publish_end_at TIMESTAMP,
    banner_image_url VARCHAR(500),
    promo_image_url VARCHAR(500),
    free_shipping_threshold DECIMAL(10,2) NOT NULL DEFAULT 1500.00,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 網站商品關聯 ──────────────────────────────────────
CREATE TABLE website_products (
    id BIGSERIAL PRIMARY KEY,
    website_id BIGINT NOT NULL REFERENCES websites(id),
    product_id BIGINT NOT NULL REFERENCES products(id),
    publish_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(website_id, product_id)
);

-- ── 訂單 ──────────────────────────────────────────────
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    website_id BIGINT NOT NULL REFERENCES websites(id),
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    shipping_address TEXT,
    shipping_method VARCHAR(20) NOT NULL,
    shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    note TEXT,
    tax_id VARCHAR(8),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_PAYMENT',
    is_preorder BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 訂單明細 ──────────────────────────────────────────
CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    product_id BIGINT NOT NULL REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    product_price DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 付款 ──────────────────────────────────────────────
CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    payment_method VARCHAR(20) NOT NULL,
    ecpay_trade_no VARCHAR(50),
    ecpay_payment_url VARCHAR(500),
    expire_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    paid_at TIMESTAMP,
    raw_callback TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 發票 ──────────────────────────────────────────────
CREATE TABLE invoices (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id),
    invoice_number VARCHAR(20),
    random_code VARCHAR(4),
    invoice_date DATE,
    amount DECIMAL(10,2) NOT NULL,
    invoice_type VARCHAR(20) NOT NULL,
    carrier_type VARCHAR(20),
    carrier_number VARCHAR(20),
    buyer_tax_id VARCHAR(8),
    status VARCHAR(20) NOT NULL DEFAULT 'SYNCING',
    void_reason TEXT,
    voided_at TIMESTAMP,
    allowance_amount DECIMAL(10,2),
    allowance_number VARCHAR(50),
    allowanced_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Email 通知模板 ────────────────────────────────────
CREATE TABLE email_templates (
    id BIGSERIAL PRIMARY KEY,
    template_type VARCHAR(50) NOT NULL UNIQUE,
    subject VARCHAR(255) NOT NULL,
    body_html TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 低庫存警示紀錄 ────────────────────────────────────
CREATE TABLE low_stock_alerts (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    alerted_at TIMESTAMP NOT NULL,
    resolved_at TIMESTAMP,
    stock_at_alert INT NOT NULL,
    threshold_at_alert INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Email 通知紀錄 ────────────────────────────────────
CREATE TABLE email_notifications (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id),
    template_type VARCHAR(50) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    sent_at TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SENT',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 索引 ──────────────────────────────────────────────
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_website ON orders(website_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_website_products_website ON website_products(website_id);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_invoices_order ON invoices(order_id);
CREATE INDEX idx_low_stock_alerts_product ON low_stock_alerts(product_id);

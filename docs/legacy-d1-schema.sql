-- D1 Schema for The Break Surf
-- Migrated from JSON files + SQLite

-- Products (from data/products.json)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Events (from data/events.json)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Heroes (from data/heroes.json)
CREATE TABLE IF NOT EXISTS heroes (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Posts (from data/posts.json + content/posts/*.md)
CREATE TABLE IF NOT EXISTS posts (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  image TEXT,
  excerpt TEXT,
  content TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Reviews (from data/reviews.json)
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  date TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);

-- Promotions (from data/promotions.json)
CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Orders (from data/orders.json)
CREATE TABLE IF NOT EXISTS orders (
  session_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  data TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Settings (from data/settings.json - key-value store)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Item categories (from data/item-categories.json)
CREATE TABLE IF NOT EXISTS item_categories (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Item images (from data/item-images.json)
CREATE TABLE IF NOT EXISTS item_images (
  item_code TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Nesting sheets (from data/nesting-sheets.json)
CREATE TABLE IF NOT EXISTS nesting_sheets (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Designs (from data/designs.json)
CREATE TABLE IF NOT EXISTS designs (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tag prints (from data/tag-prints.json)
CREATE TABLE IF NOT EXISTS tag_prints (
  serial TEXT PRIMARY KEY,
  printed_at TEXT NOT NULL
);

-- Post redirects (from data/postRedirects.json)
CREATE TABLE IF NOT EXISTS post_redirects (
  old_slug TEXT PRIMARY KEY,
  new_slug TEXT NOT NULL
);

-- Stats (from data/stats.json)
CREATE TABLE IF NOT EXISTS stats (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

-- System stats history (from data/system-stats-history.json)
CREATE TABLE IF NOT EXISTS system_stats_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  t INTEGER NOT NULL,
  cpu_percent REAL,
  mem_used_percent REAL,
  temp_c REAL,
  latency_ms REAL
);
CREATE INDEX IF NOT EXISTS idx_stats_time ON system_stats_history(t);

-- Users (from data/users.json)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Passkeys (from data/passkeys.json)
CREATE TABLE IF NOT EXISTS passkeys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_passkeys_user ON passkeys(user_id);

-- Login log (from data/login-log.json)
CREATE TABLE IF NOT EXISTS login_log (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_log_time ON login_log(occurred_at);

-- Email messages (from data/email-messages.json)
CREATE TABLE IF NOT EXISTS email_messages (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Email contacts (from data/email-contacts.json)
CREATE TABLE IF NOT EXISTS email_contacts (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Email push subscriptions (from data/email-push-subscriptions.json)
CREATE TABLE IF NOT EXISTS email_push_subscriptions (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Email settings (from data/email-settings.json)
CREATE TABLE IF NOT EXISTS email_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Agent settings (from data/agent-settings.json)
CREATE TABLE IF NOT EXISTS agent_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Outreach (from data/outreach.json)
CREATE TABLE IF NOT EXISTS outreach (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Outreach leads (from data/outreach-leads.json)
CREATE TABLE IF NOT EXISTS outreach_leads (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Assistant tasks (from data/assistant-tasks.json)
CREATE TABLE IF NOT EXISTS assistant_tasks (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Receipt settings (from data/receipt-settings.json)
CREATE TABLE IF NOT EXISTS receipt_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Finance remark rules (from data/finance-remark-rules.json)
CREATE TABLE IF NOT EXISTS finance_remark_rules (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Supplier aliases (from data/supplier-aliases.json)
CREATE TABLE IF NOT EXISTS supplier_aliases (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Supplier item mappings (from data/supplier-item-mappings.json)
CREATE TABLE IF NOT EXISTS supplier_item_mappings (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Attachment downloads (from data/attachment-downloads.json)
CREATE TABLE IF NOT EXISTS attachment_downloads (
  token TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_downloads_expires ON attachment_downloads(expires_at);

-- Social posts (from data/social.json)
CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Meetings (from data/meetings.json)
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tasks (from data/tasks.json)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- People (from data/people.json)
CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Whiteboards (from data/whiteboards/*.json)
CREATE TABLE IF NOT EXISTS whiteboards (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- University submissions (from data/university-submissions/*.json)
CREATE TABLE IF NOT EXISTS university_submissions (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pending checkouts (from data/pending-checkouts/*.json)
CREATE TABLE IF NOT EXISTS pending_checkouts (
  session_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Receipts (from data/receipts.db - migrated from SQLite)
CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  source_email_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'needs_review', 'matched', 'used', 'failed')),
  original_filename TEXT NOT NULL,
  original_path TEXT NOT NULL,
  derived_path TEXT,
  content_type TEXT NOT NULL,
  supplier TEXT,
  receipt_date TEXT,
  currency TEXT DEFAULT 'GBP',
  subtotal REAL,
  shipping REAL,
  vat REAL,
  total REAL,
  item_descriptions TEXT,
  suggested_account TEXT,
  hmrc_allowable INTEGER,
  line_items TEXT,
  confidence REAL,
  field_confidence TEXT,
  critical_fields_missing TEXT,
  extracted_at TEXT,
  extraction_error TEXT,
  raw_model_response TEXT,
  model_id TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  cost_estimate REAL,
  processing_started_at TEXT,
  matched_transaction_id TEXT,
  used_je_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_fingerprint ON receipts(fingerprint);
CREATE INDEX IF NOT EXISTS idx_receipts_source ON receipts(source_email_id);
CREATE INDEX IF NOT EXISTS idx_receipts_total ON receipts(total);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(receipt_date);
CREATE INDEX IF NOT EXISTS idx_receipts_supplier ON receipts(supplier);

-- Stock snapshot (from data/stock-snapshot.json)
CREATE TABLE IF NOT EXISTS stock_snapshot (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

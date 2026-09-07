-- Admin tables for thebreaksurf-site (thebreaksite admin service).
-- Same VPS MariaDB as the public tables (001_init.sql).
-- Run: npm run db:migrate (applies all db/migrations/*.sql in order)

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(191) PRIMARY KEY,
  data LONGTEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS passkeys (
  id VARCHAR(191) PRIMARY KEY,
  user_id VARCHAR(191) NOT NULL,
  data LONGTEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_passkeys_user ON passkeys(user_id);

CREATE TABLE IF NOT EXISTS login_log (
  id VARCHAR(191) PRIMARY KEY,
  data LONGTEXT NOT NULL,
  occurred_at VARCHAR(64) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_log_time ON login_log(occurred_at);

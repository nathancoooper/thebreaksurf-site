-- Newsletter capture: subscribers, single-use discount codes, rate-limit
-- ledger (see the subscribe pop-up plan in the Operations channel).
--
-- Manual apply on KVM2 — the db:migrate script only loads 001:
--   mysql -h 127.0.0.1 -u tbs -p thebreaksite < db/migrations/007_subscribers.sql

CREATE TABLE IF NOT EXISTS subscribers (
  email VARCHAR(255) NOT NULL,
  brand VARCHAR(32) NOT NULL DEFAULT 'break',
  source VARCHAR(64) NOT NULL DEFAULT 'homepage-popup',
  consent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unsubscribe_token CHAR(32) NOT NULL,
  unsubscribed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (email),
  KEY idx_subscribers_token (unsubscribe_token)
);

-- One row per issued code. The email column is the capture address — a code
-- is only redeemable when the buyer supplies BOTH the code and that address.
CREATE TABLE IF NOT EXISTS discount_codes (
  code VARCHAR(32) NOT NULL,
  email VARCHAR(255) NOT NULL,
  percent TINYINT UNSIGNED NOT NULL DEFAULT 10,
  used_at TIMESTAMP NULL DEFAULT NULL,
  used_session_id VARCHAR(128) NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (code),
  KEY idx_discount_codes_email (email)
);

-- Sliding-window rate limiting for /api/subscribe and /api/validate-code.
-- Durable in the datastore (not process memory) so a restart can't clear it.
CREATE TABLE IF NOT EXISTS rate_limits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bucket VARCHAR(32) NOT NULL,
  rate_key VARCHAR(191) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rate_limits_lookup (bucket, rate_key, created_at)
);

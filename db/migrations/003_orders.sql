-- Order fulfilment state (Stripe session id -> status/tracking).
-- Read by GET /api/admin/orders, written by PATCH /api/admin/orders/[id].

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(191) PRIMARY KEY,
  data LONGTEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

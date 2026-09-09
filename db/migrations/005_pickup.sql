-- 005: university pickup slots for the AUB embroidery collab.
-- Run manually against the live DB (same pattern as 002-004):
--   mysql -h 127.0.0.1 -u tbs -p thebreaksite < db/migrations/005_pickup.sql
-- Bookings live on university_submissions rows (pickup_slot_id in the JSON
-- doc); this table holds the slot definitions only.

CREATE TABLE IF NOT EXISTS pickup_slots (
  id VARCHAR(191) PRIMARY KEY,
  data LONGTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pickup_slots_created ON pickup_slots(created_at);

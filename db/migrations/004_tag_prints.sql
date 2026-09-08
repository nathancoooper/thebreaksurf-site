-- Tag-printer serial registry.

CREATE TABLE IF NOT EXISTS tag_prints (
  serial VARCHAR(191) PRIMARY KEY,
  printed_at VARCHAR(64) NOT NULL
);

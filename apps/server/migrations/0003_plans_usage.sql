-- Billing plan per app (limits live in src/plans.ts).
ALTER TABLE apps ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';

-- Monthly active devices: one row per (app, month, hashed device id), written in batches.
CREATE TABLE active_devices (
  app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  month TEXT NOT NULL,          -- "YYYY-MM" (UTC)
  device TEXT NOT NULL,         -- hex SHA-256(appId:deviceId), truncated
  PRIMARY KEY (app_id, month, device)
) WITHOUT ROWID;

-- Stored files per app, for storage quotas and cleanup.
CREATE TABLE assets (
  app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  hash TEXT NOT NULL,
  stored_bytes INTEGER NOT NULL,  -- gzip size in R2
  created_at INTEGER NOT NULL,
  PRIMARY KEY (app_id, hash)
) WITHOUT ROWID;

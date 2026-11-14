-- Apps are the unit of isolation: one per mobile app (both platforms share an app).
CREATE TABLE apps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  -- Optional base64 uncompressed P-256 point. Informational for the server; the
  -- device enforces the key that is baked into the binary.
  signing_public_key TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE TABLE updates (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  runtime_version TEXT NOT NULL,
  message TEXT,
  mandatory INTEGER NOT NULL DEFAULT 0,
  rollout_percentage INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  -- JSON: { launchAsset, assets, signature }
  manifest TEXT NOT NULL,
  total_size INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX updates_lookup
  ON updates (app_id, channel, platform, runtime_version, created_at DESC);

-- Aggregated counters; cheap to write from hot paths and enough for a dashboard.
CREATE TABLE update_stats (
  update_id TEXT NOT NULL REFERENCES updates(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (update_id, type)
);

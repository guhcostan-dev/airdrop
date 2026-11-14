-- API tokens can be scoped to one app (customer tokens). NULL = full access (operator tokens).
ALTER TABLE api_tokens ADD COLUMN app_id TEXT REFERENCES apps(id) ON DELETE CASCADE;

-- Early-access requests from the website.
CREATE TABLE waitlist (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  app_name TEXT,
  mau TEXT,
  created_at INTEGER NOT NULL
);

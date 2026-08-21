CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL,
  anonymous_id TEXT,
  session_id TEXT,
  occurred_at TEXT NOT NULL,
  path TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  device TEXT,
  language TEXT,
  product_id TEXT,
  source_product_id TEXT,
  category TEXT,
  brand TEXT,
  platform TEXT,
  query TEXT,
  list_type TEXT,
  position INTEGER,
  properties_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_occurred_at ON analytics_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_product ON analytics_events(product_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_platform ON analytics_events(platform);
CREATE INDEX IF NOT EXISTS idx_analytics_events_category ON analytics_events(category);

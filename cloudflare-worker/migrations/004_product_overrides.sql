-- ProductSite batch catalog updates.
-- Additive migration: keeps the bundled catalog as the fallback and stores only administrator-confirmed overrides.
CREATE TABLE IF NOT EXISTS product_overrides (
  product_id VARCHAR(191) PRIMARY KEY,
  source_product_id VARCHAR(191),
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_product_overrides_source_product_id ON product_overrides(source_product_id);

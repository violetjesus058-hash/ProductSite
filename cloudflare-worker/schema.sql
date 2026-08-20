CREATE TABLE IF NOT EXISTS product_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  contact TEXT,
  product_url TEXT,
  image_url TEXT,
  description TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Received' CHECK (status IN ('Received', 'Reviewing', 'Accepted', 'Closed')),
  admin_reply TEXT,
  ip_address TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  device_type TEXT,
  browser TEXT,
  operating_system TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_requests_status ON product_requests(status);
CREATE INDEX IF NOT EXISTS idx_product_requests_created_at ON product_requests(created_at DESC);

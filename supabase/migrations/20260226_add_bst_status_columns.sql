ALTER TABLE orders ADD COLUMN IF NOT EXISTS wc_status text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS wc_status_date timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS lpp_status text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS lpp_status_date timestamptz;
CREATE INDEX IF NOT EXISTS idx_orders_wc_status ON orders (wc_status);
CREATE INDEX IF NOT EXISTS idx_orders_lpp_status ON orders (lpp_status);

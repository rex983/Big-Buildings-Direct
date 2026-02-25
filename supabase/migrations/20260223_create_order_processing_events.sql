CREATE TABLE order_processing_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB DEFAULT '{}',
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes for fast lookups
CREATE INDEX idx_ope_order_id ON order_processing_events(order_id);
CREATE INDEX idx_ope_event_type ON order_processing_events(event_type);
CREATE INDEX idx_ope_status ON order_processing_events(status);

-- Enable Realtime on this table
ALTER PUBLICATION supabase_realtime ADD TABLE order_processing_events;

-- RLS: service role can do everything, anon can read (for Realtime subscriptions)
ALTER TABLE order_processing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON order_processing_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Anon can read events" ON order_processing_events
  FOR SELECT USING (true);

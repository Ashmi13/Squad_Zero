-- ========================================
-- PAYHERE PLANS & SUBSCRIPTIONS (idempotent)
-- ========================================
-- Root-cause fix for "payment completes but plan stays free":
-- the PayHere notify webhook and workspace/storage-usage both read/write the
-- `plans` and `subscriptions` tables through the Supabase client, but those
-- tables were never defined in any schema file. Paste this whole block into
-- the Supabase SQL Editor and RUN it. Safe to re-run (all IF NOT EXISTS).
--
-- Values MUST match hard-coded checks in:
--   app/services/payhere_service.py       (PRO_AMOUNT, PRO_CURRENCY, PRO_STORAGE_LIMIT_BYTES)
--   app/api/v1/endpoints/payments.py      (plan validation)
--   app/services/workspace_service.py     (storage limit lookups)

CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    storage_limit_bytes BIGINT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'LKR',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    status TEXT NOT NULL DEFAULT 'active',
    starts_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    provider TEXT,
    provider_reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_provider_reference
    ON subscriptions(provider, provider_reference)
    WHERE provider_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status_expiry
    ON subscriptions(user_id, status, expires_at);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS plans_service_role ON plans
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS subscriptions_service_role ON subscriptions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS subscriptions_self_access ON subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS subscriptions_self_insert ON subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS subscriptions_self_update ON subscriptions
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Seed plans (values MUST match the backend hard-checks).
INSERT INTO plans (code, name, storage_limit_bytes, price, currency, active)
VALUES
  ('free', 'Free', 104857600, 0.00, 'LKR', true),
  ('pro',  'Pro',  5368709120, 600.00, 'LKR', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  storage_limit_bytes = EXCLUDED.storage_limit_bytes,
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  active = EXCLUDED.active;
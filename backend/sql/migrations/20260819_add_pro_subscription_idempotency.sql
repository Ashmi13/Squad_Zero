-- PayHere Pro subscription fields and callback idempotency.
-- Apply after the existing plans and subscriptions tables are present.

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_reference TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_provider_reference
    ON subscriptions(provider, provider_reference)
    WHERE provider_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status_expiry
    ON subscriptions(user_id, status, expires_at);
-- Supabase PostgreSQL Schema for Simplified Backend

-- Create users table (extends Supabase auth.users)
-- We rename it to 'users' but it still refers to auth.users(id)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create password_reset_tokens table for custom reset flow
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

-- Enable RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Simple RLS Policies for users - users can read and update their own data
-- No recursion, just direct check against auth.uid()
CREATE POLICY users_self_access ON users
    FOR ALL USING (auth.uid() = id);

-- Allow service role to do everything
CREATE POLICY service_role_access ON users
    FOR ALL USING (true) 
    WITH CHECK (true);
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- For password reset tokens
CREATE POLICY tokens_self_access ON password_reset_tokens
    FOR ALL USING (auth.uid() = user_id);
CREATE POLICY tokens_service_role ON password_reset_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);


CREATE POLICY module_progress_update ON module_progress
    FOR UPDATE USING (
        auth.uid() = user_id OR
        CURRENT_SETTING('request.jwt.claims')::json->>'role' = 'service_role'
    )
    WITH CHECK (
        auth.uid() = user_id OR
        CURRENT_SETTING('request.jwt.claims')::json->>'role' = 'service_role'
    );

-- RLS Policies for password_reset_tokens - admin and service role only
CREATE POLICY password_reset_tokens_select ON password_reset_tokens
    FOR SELECT USING (
        CURRENT_SETTING('request.jwt.claims')::json->>'role' = 'service_role'
    );

-- RLS Policies for uploads - users can manage their own, admins all
CREATE POLICY uploads_select ON uploads
    FOR SELECT USING (
        auth.uid() = user_id OR
        CURRENT_SETTING('request.jwt.claims')::json->>'role' = 'service_role'
    );

CREATE POLICY uploads_insert ON uploads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY uploads_update ON uploads
    FOR UPDATE USING (
        auth.uid() = user_id OR
        CURRENT_SETTING('request.jwt.claims')::json->>'role' = 'service_role'
    )
    WITH CHECK (
        auth.uid() = user_id OR
        CURRENT_SETTING('request.jwt.claims')::json->>'role' = 'service_role'
    );

CREATE POLICY uploads_delete ON uploads
    FOR DELETE USING (
        auth.uid() = user_id OR
        CURRENT_SETTING('request.jwt.claims')::json->>'role' = 'service_role'
    );

-- ========================================
-- Supabase PostgreSQL Schema for SquadZero
-- Includes M1 base schema + M5 Tasks table
-- ========================================

-- Create users table (extends Supabase auth.users)
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
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

-- Enable RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY IF NOT EXISTS users_self_access ON users
    FOR ALL USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS service_role_access ON users
    FOR ALL USING (true)
    WITH CHECK (true);

ALTER TABLE users FORCE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS service_role_all ON users
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- RLS Policies for password_reset_tokens
CREATE POLICY IF NOT EXISTS tokens_self_access ON password_reset_tokens
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS tokens_service_role ON password_reset_tokens
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS password_reset_tokens_select ON password_reset_tokens
    FOR SELECT USING (
        CURRENT_SETTING('request.jwt.claims')::json->>'role' = 'service_role'
    );

-- ========================================
-- M5 TASKS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_date TIMESTAMP WITH TIME ZONE,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for tasks
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

-- Enable RLS for tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own tasks
CREATE POLICY IF NOT EXISTS tasks_self_access ON tasks
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Service role can access all tasks
CREATE POLICY IF NOT EXISTS tasks_service_role ON tasks
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ========================================
-- RLS Policies for uploads (M1)
-- ========================================

CREATE POLICY IF NOT EXISTS uploads_select ON uploads
    FOR SELECT USING (
        auth.uid() = user_id OR
        CURRENT_SETTING('request.jwt.claims')::json->>'role' = 'service_role'
    );

CREATE POLICY IF NOT EXISTS uploads_insert ON uploads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS uploads_update ON uploads
    FOR UPDATE USING (
        auth.uid() = user_id OR
        CURRENT_SETTING('request.jwt.claims')::json->>'role' = 'service_role'
    )
    WITH CHECK (
        auth.uid() = user_id OR
        CURRENT_SETTING('request.jwt.claims')::json->>'role' = 'service_role'
    );

CREATE POLICY IF NOT EXISTS uploads_delete ON uploads
    FOR DELETE USING (
        auth.uid() = user_id OR
        CURRENT_SETTING('request.jwt.claims')::json->>'role' = 'service_role'
    );
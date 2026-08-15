========================================
-- Supabase PostgreSQL Schema for SquadZero
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

-- Synchronize users table with Supabase Auth
-- This ensures when a user signs up via OAuth or email, they are added to 'users' automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'User'),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run the function above
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

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

-- ========================================
-- MINDMAPS & MINDMAP_NODES TABLES
-- ========================================

CREATE TABLE IF NOT EXISTS mindmaps (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    source_filename VARCHAR(255),
    source_text TEXT,
    status VARCHAR(50) DEFAULT 'draft' NOT NULL,
    ai_model VARCHAR(50) DEFAULT 'gpt-3.5-turbo' NOT NULL,
    estimated_cost DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS mindmap_nodes (
    id SERIAL PRIMARY KEY,
    mindmap_id INTEGER NOT NULL REFERENCES mindmaps(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES mindmap_nodes(id) ON DELETE CASCADE,
    content VARCHAR(500) NOT NULL,
    notes TEXT,
    color VARCHAR(7) DEFAULT '#6366f1' NOT NULL,
    position_x DOUBLE PRECISION DEFAULT 0 NOT NULL,
    position_y DOUBLE PRECISION DEFAULT 0 NOT NULL,
    is_expanded BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mindmaps_user_id ON mindmaps(user_id);
CREATE INDEX IF NOT EXISTS idx_mindmap_nodes_mindmap_id ON mindmap_nodes(mindmap_id);
CREATE INDEX IF NOT EXISTS idx_mindmap_nodes_parent_id ON mindmap_nodes(parent_id);

-- Enable RLS
ALTER TABLE mindmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE mindmap_nodes ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own mind maps
CREATE POLICY IF NOT EXISTS mindmaps_self_access ON mindmaps
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Service role can access all mind maps
CREATE POLICY IF NOT EXISTS mindmaps_service_role ON mindmaps
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can only manage nodes of their own mind maps
CREATE POLICY IF NOT EXISTS mindmap_nodes_self_access ON mindmap_nodes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM mindmaps 
            WHERE mindmaps.id = mindmap_nodes.mindmap_id 
            AND mindmaps.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM mindmaps 
            WHERE mindmaps.id = mindmap_nodes.mindmap_id 
            AND mindmaps.user_id = auth.uid()
        )
    );

-- Service role can access all mind map nodes
CREATE POLICY IF NOT EXISTS mindmap_nodes_service_role ON mindmap_nodes
    FOR ALL TO service_role USING (true) WITH CHECK (true);


-- Workspace schema updates (folders/files/profile)
-- Run this in Supabase SQL editor before production rollout.

-- 1) Ensure folders table exists with nested folder support
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    parent_folder_id UUID NULL REFERENCES folders(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2) Ensure files table exists with storage metadata
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id UUID NULL REFERENCES folders(id) ON DELETE CASCADE,
    parent_file_id UUID NULL REFERENCES files(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    original_filename TEXT,
    file_type TEXT,
    mime_type TEXT,
    size_bytes BIGINT,
    file_content TEXT,
    storage_path TEXT,
    storage_url TEXT,
    last_accessed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3) Add missing columns safely for existing projects
ALTER TABLE folders ADD COLUMN IF NOT EXISTS parent_folder_id UUID NULL REFERENCES folders(id) ON DELETE CASCADE;
ALTER TABLE files ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS storage_url TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMP WITH TIME ZONE;
ALTER TABLE files ADD COLUMN IF NOT EXISTS original_filename TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS parent_file_id UUID NULL REFERENCES files(id) ON DELETE CASCADE;
ALTER TABLE files ADD COLUMN IF NOT EXISTS file_content TEXT;

-- 3b) Productivity sessions
CREATE TABLE IF NOT EXISTS focus_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    focus_duration INTEGER NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS focus_duration INTEGER NOT NULL DEFAULT 25;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_id ON focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_date ON focus_sessions(date);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_completed_at ON focus_sessions(completed_at);

-- 4) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_folder_id ON folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_parent_file_id ON files(parent_file_id);
CREATE INDEX IF NOT EXISTS idx_files_storage_path ON files(storage_path);

-- 5) RLS policies
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS folders_self_access ON folders
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS files_self_access ON files
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS folders_service_role_access ON folders
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS files_service_role_access ON files
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS focus_sessions_self_access ON focus_sessions
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS focus_sessions_service_role_access ON focus_sessions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

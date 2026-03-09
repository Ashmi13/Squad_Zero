import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def init_db():
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            port=os.getenv('DB_PORT', '5432')
        )
        cur = conn.cursor()

        # 0. Enable pgvector extension
        print("Enabling 'vector' extension...")
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

        # 1. Create notes table if not exists
        print("Creating 'notes' table if not exists...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                note_id UUID PRIMARY KEY,
                user_id VARCHAR(255),
                title TEXT,
                content TEXT,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                note_type VARCHAR(50),
                is_in_folder BOOLEAN DEFAULT FALSE,
                has_embeddings BOOLEAN DEFAULT FALSE,
                folder_id UUID -- Ensure column exists in create statement for fresh installs
            );
        """)

        # 2. Create folders table
        print("Creating 'folders' table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS folders (
                id UUID PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, name)
            );
        """)

        # 3. Create document_chunks table for pgvector
        print("Creating 'document_chunks' table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS document_chunks (
                id UUID PRIMARY KEY,
                pdf_id VARCHAR(255) NOT NULL,
                chunk_index INTEGER NOT NULL,
                content TEXT NOT NULL,
                embedding vector(384), -- Dimension for all-MiniLM-L6-v2
                metadata JSONB
            );
        """)
        
        # Create an HNSW index for faster similarity search
        print("Creating HNSW index on document_chunks...")
        cur.execute("""
            CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
            ON document_chunks USING hnsw (embedding vector_cosine_ops);
        """)

        # 4. Add folder_id to notes table if it doesn't exist (Migration step for existing DBs)
        print("Checking 'notes' table for 'folder_id' column...")
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                               WHERE table_name='notes' AND column_name='folder_id') THEN
                    ALTER TABLE notes ADD COLUMN folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
                    RAISE NOTICE 'Added folder_id column to notes table';
                ELSE
                    RAISE NOTICE 'folder_id column already exists';
                END IF;
            END $$;
        """)

        # 5. Insert default folders for demo if they don't exist
        print("Inserting default folders...")
        default_folders = [
            ('44b24a92-5d5e-424b-8e3c-a21f32e104c4', 'test_user', 'AI'),
            ('dcb09c95-30ab-458c-8209-4d84c32c124c', 'test_user', 'Physics'),
            ('f07b6768-05ab-41fd-a72a-e932820c580d', 'test_user', 'Chemistry'),
            ('e93301ce-6997-48a9-ab3c-f37734b28924', 'test_user', 'Biology')
        ]
        for f_id, u_id, name in default_folders:
            cur.execute("""
                INSERT INTO folders (id, user_id, name)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, name) DO NOTHING;
            """, (f_id, u_id, name))

        conn.commit()
        cur.close()
        conn.close()
        print("Database schema updated successfully!")

    except Exception as e:
        print(f"Error updating database schema: {e}")

if __name__ == "__main__":
    init_db()

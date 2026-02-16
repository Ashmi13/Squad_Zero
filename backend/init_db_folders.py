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

        # 0. Create notes table if not exists (adding this because original backend might assume it exists)
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
                has_embeddings BOOLEAN DEFAULT FALSE
            );
        """)

        # 1. Create folders table
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

        # 2. Add folder_id to notes table if it doesn't exist
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

        conn.commit()
        cur.close()
        conn.close()
        print("Database schema updated successfully!")

    except Exception as e:
        print(f"Error updating database schema: {e}")

if __name__ == "__main__":
    init_db()

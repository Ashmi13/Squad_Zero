import os
import psycopg2
import sys

# To allow importing settings
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from config.config import settings

def create_tables():
    db_url = settings.DATABASE_URL
    print(f"Connecting to database to create M3 tables...")
    try:
        if "neon.tech" in db_url or "supabase" in db_url:
            conn = psycopg2.connect(db_url, sslmode='require')
        else:
            conn = psycopg2.connect(db_url)
        
        cur = conn.cursor()
        print("Creating pgvector extension...")
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        
        print("Creating document_chunks table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS document_chunks (
                id UUID PRIMARY KEY,
                pdf_id TEXT,
                chunk_index INTEGER,
                content TEXT,
                embedding VECTOR(384),
                metadata JSONB
            );
        """)
        
        print("Creating notes table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                note_id TEXT PRIMARY KEY,
                user_id TEXT,
                title TEXT,
                content TEXT,
                folder_id TEXT,
                pdf_id TEXT,
                note_type TEXT,
                is_in_folder BOOLEAN DEFAULT FALSE,
                has_embeddings BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        print("Creating folders table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS folders (
                folder_id TEXT PRIMARY KEY,
                user_id TEXT,
                name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        conn.commit()
        cur.close()
        conn.close()
        print("M3 Tables created successfully!")
    except Exception as e:
        print(f"Error creating tables: {e}")

if __name__ == "__main__":
    create_tables()

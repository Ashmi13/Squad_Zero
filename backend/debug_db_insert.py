
import os
import psycopg2
import uuid
from dotenv import load_dotenv

load_dotenv()

def debug_insert():
    try:
        print("--- Connecting to DB ---")
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            port=os.getenv('DB_PORT', '5432')
        )
        cur = conn.cursor()
        
        note_id = str(uuid.uuid4())
        print(f"--- Attempting to insert Note ID: {note_id} ---")
        
        cur.execute("""
            INSERT INTO notes (note_id, user_id, title, content, created_date, updated_date, note_type, is_in_folder, has_embeddings)
            VALUES (%s, 'test_user', 'Debug Note', 'This is a test note from debug script.', NOW(), NOW(), 'debug', FALSE, FALSE)
        """, (note_id,))
        
        conn.commit()
        print("--- Insert Committed ---")
        
        # Verify immediately
        cur.execute("SELECT note_id, title FROM notes WHERE note_id = %s", (note_id,))
        row = cur.fetchone()
        if row:
            print(f"✅ SUCCESS! Found inserted note: {row}")
        else:
            print("❌ FAILURE! Inserted note NOT found.")
            
        cur.close()
        conn.close()
            
    except Exception as e:
        print(f"❌ ERROR: {e}")

if __name__ == "__main__":
    debug_insert()

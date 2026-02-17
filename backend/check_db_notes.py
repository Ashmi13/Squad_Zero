
import os
import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

load_dotenv()

def check_notes():
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            port=os.getenv('DB_PORT', '5432')
        )
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        print("\n--- Checking 'notes' table ---")
        cur.execute("SELECT note_id, title, created_date, content FROM notes ORDER BY created_date DESC LIMIT 5")
        notes = cur.fetchall()
        
        if not notes:
            print("No notes found in the database.")
        else:
            for note in notes:
                content_preview = note['content'][:50].replace('\n', ' ') + "..." if note['content'] else "No Content"
                print(f"✅ ID: {note['note_id']} | Title: {note['title']} | Date: {note['created_date']} | Preview: {content_preview}")
                
        cur.close()
        conn.close()
            
    except Exception as e:
        print(f"Error connecting to DB: {e}")

if __name__ == "__main__":
    check_notes()

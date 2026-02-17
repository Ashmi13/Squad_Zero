
import os
import psycopg2
from dotenv import load_dotenv
from init_db_folders import init_db

load_dotenv()

def fix_table():
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            port=os.getenv('DB_PORT', '5432')
        )
        cur = conn.cursor()
        
        print("--- Fixing Schema ---")
        # Drop the incorrect table
        print("Dropping 'notes' table...")
        cur.execute("DROP TABLE IF EXISTS notes;")
        
        conn.commit()
        cur.close()
        conn.close()
        
        print("Table dropped. Re-initializing...")
        # Re-run init_db to create it correctly
        init_db()
        print("✅ Success! Table recreated with correct schema.")
            
    except Exception as e:
        print(f"Error fixing table: {e}")

if __name__ == "__main__":
    fix_table()

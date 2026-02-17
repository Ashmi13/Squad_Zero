
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def check_schema():
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            port=os.getenv('DB_PORT', '5432')
        )
        cur = conn.cursor()
        
        print("--- Checking 'notes' table schema ---")
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'notes';
        """)
        columns = cur.fetchall()
        for col in columns:
            print(f"Column: {col[0]} | Type: {col[1]}")
            
        cur.close()
        conn.close()
            
    except Exception as e:
        print(f"Error checking schema: {e}")

if __name__ == "__main__":
    check_schema()

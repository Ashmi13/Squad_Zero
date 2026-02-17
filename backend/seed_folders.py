
import os
import psycopg2
import uuid
from dotenv import load_dotenv

load_dotenv()

def seed_folders():
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            port=os.getenv('DB_PORT', '5432')
        )
        cur = conn.cursor()
        
        user_id = "test_user"
        folders = ["AI", "Physics", "Chemistry", "Biology"]
        
        print(f"Seeding folders for user: {user_id}")
        
        for name in folders:
            # Check if exists
            cur.execute("SELECT id FROM folders WHERE user_id = %s AND name = %s", (user_id, name))
            if cur.fetchone():
                print(f"Folder '{name}' already exists.")
            else:
                folder_id = str(uuid.uuid4())
                cur.execute(
                    "INSERT INTO folders (id, user_id, name) VALUES (%s, %s, %s)",
                    (folder_id, user_id, name)
                )
                print(f"Created folder: '{name}'")
        
        conn.commit()
        cur.close()
        conn.close()
        print("Folder seeding complete! ✅")
            
    except Exception as e:
        print(f"Error seeding folders: {e}")

if __name__ == "__main__":
    seed_folders()

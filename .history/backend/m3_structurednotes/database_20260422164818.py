import os
import psycopg2
from config.config import settings

def get_db_connection():
    """
    Returns a raw psycopg2 connection for M3 services.
    Uses DATABASE_URL from settings.
    """
    db_url = settings.DATABASE_URL
    
    try:
        # Handle sslmode requirement for cloud databases
        if "neon.tech" in db_url or "supabase" in db_url:
            conn = psycopg2.connect(db_url, sslmode='require')
        else:
            conn = psycopg2.connect(db_url)
            
        return conn
    except Exception as e:
        print(f"Database connection blocked (likely pending correct password): {e}")
        return None


#functionto conneect to su
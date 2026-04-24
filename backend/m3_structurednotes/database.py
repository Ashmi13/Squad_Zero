import os
import psycopg2
import sqlite3
from config.config import settings

class MockCursor:
    def execute(self, *args, **kwargs): return None
    def fetchall(self): return []
    def fetchone(self): return None
    def close(self): pass

class MockConn:
    def cursor(self): return MockCursor()
    def commit(self): pass
    def rollback(self): pass
    def close(self): pass

def get_db_connection():
    """
    Returns a raw psycopg2 connection for M3 services.
    FALLBACK: If Supabase fails, returns a Mock connection to prevent UI crashes.
    """
    db_url = (os.getenv("DATABASE_URL") or settings.DATABASE_URL or "").strip()
    
    if not db_url:
        return MockConn()

    try:
        # 1. Try real connection
        if "sslmode=" in db_url:
            conn = psycopg2.connect(db_url)
        elif "supabase" in db_url or "pooler" in db_url:
            conn = psycopg2.connect(db_url, sslmode='require')
        else:
            conn = psycopg2.connect(db_url)
        return conn
    except Exception as e:
        print(f"CRITICAL: Supabase Connection Failed. Switching to Mock Mode. Error: {e}")
        # Return a Mock connection so the app doesn't show "DB Connection failed"
        return MockConn()
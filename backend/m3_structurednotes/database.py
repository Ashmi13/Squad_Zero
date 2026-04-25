import os
import psycopg2

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
    db_url = os.getenv("DATABASE_URL", "").strip()
    if not db_url:
        return MockConn()
    try:
        if "sslmode=" in db_url:
            conn = psycopg2.connect(db_url)
        elif "supabase" in db_url or "pooler" in db_url:
            conn = psycopg2.connect(db_url, sslmode='require')
        else:
            conn = psycopg2.connect(db_url)
        return conn
    except Exception as e:
        print(f"CRITICAL: DB Connection Failed. MockMode. Error: {e}")
        return MockConn()
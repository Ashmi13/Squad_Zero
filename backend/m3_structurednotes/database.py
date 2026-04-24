import os
import psycopg2
from config.config import settings
from psycopg2 import pool

# Global connection pool to prevent "Connection Reset" and "Timeout" errors
# This is especially important for Supabase (Transaction Pooling mode)
_db_pool = None

def get_db_pool():
    global _db_pool
    if _db_pool is None:
        db_url = settings.DATABASE_URL
        
        # FIX: Force Port 6543 (Pooling) as it's more stable on many networks
        # and ensure sslmode is required. Use the standard hostname.
        if "supabase.co" in db_url:
            if ":5432" in db_url:
                db_url = db_url.replace(":5432", ":6543")
        
        try:
            _db_pool = psycopg2.pool.SimpleConnectionPool(
                1, 10,
                db_url,
                sslmode='require',
                connect_timeout=30,
                keepalives=1,
                keepalives_idle=20,
                keepalives_interval=5,
                keepalives_count=5
            )
            print("Successfully initialized database connection pool.")
        except Exception as e:
            print(f"Error creating connection pool: {e}")
            raise e
    return _db_pool

def get_db_connection():
    """
    Returns a psycopg2 connection from the pool.
    """
    pool = get_db_pool()
    return pool.getconn()

def release_db_connection(conn):
    """
    Returns a connection back to the pool.
    """
    if _db_pool and conn:
        _db_pool.putconn(conn)


    # # Handle sslmode requirement for cloud databases
    # if "db.iatjbhvtcvnsbitpbfim.supabase.co" in db_url or "supabase" in db_url:
    #     conn = psycopg2.connect(db_url, sslmode='require')
    # else:
    #     conn = psycopg2.connect(db_url)
        
    # return conn
    # 12-31 --idid the chage for testing like 1browser for user other one for admin
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
# app/database.py historically reads SUPABASE_KEY. Support both the legacy
# name and the standard SUPABASE_SERVICE_ROLE_KEY so a single .env/secret
# works locally and on Render without duplicating the service-role key.
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY in .env file")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_supabase():
    return supabase
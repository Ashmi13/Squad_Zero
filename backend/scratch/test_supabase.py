import os
import sys
from dotenv import load_dotenv

# Load env
load_dotenv()
sys.path.append('.')

from app.db.supabase import get_supabase

def test_insert_node():
    try:
        supabase = get_supabase().service_client
        print("[DEBUG] Fetching users...")
        users_res = supabase.table("users").select("id").limit(1).execute()
        user_id = users_res.data[0]["id"]
        
        # 1. Insert mindmap
        mindmap_payload = {
            "user_id": user_id,
            "title": "Test Mindmap with Nodes",
            "status": "completed"
        }
        res = supabase.table("mindmaps").insert(mindmap_payload).execute()
        mm_id = res.data[0]["id"]
        print(f"[DEBUG] Mindmap inserted, ID: {mm_id}")
        
        # 2. Insert node
        node_payload = {
            "mindmap_id": mm_id,
            "content": "Root Node Content",
            "notes": "Some notes for the node",
            "color": "#6366f1",
            "position_x": 0.0,
            "position_y": 0.0,
            "is_expanded": True
        }
        print("[DEBUG] Inserting node...")
        node_res = supabase.table("mindmap_nodes").insert(node_payload).execute()
        print(f"[SUCCESS] Node inserted: {node_res.data}")
        
        # Cleanup
        print("[DEBUG] Cleaning up...")
        supabase.table("mindmaps").delete().eq("id", mm_id).execute()
        print("[SUCCESS] Cleanup complete")
        
    except Exception as e:
        print(f"[FAIL] Exception: {type(e).__name__}: {str(e)}")

if __name__ == "__main__":
    test_insert_node()

from fastapi import APIRouter, HTTPException
from datetime import datetime
from models.schemas import HighlightCreate, HighlightResponse, HighlightsList

router = APIRouter(tags=["highlights"])

@router.post("/create")
async def create_highlight(highlight: HighlightCreate):
    """
    Save a highlighted text selection.
    """
    
    try:
        # Supabase operations commented out for now (M1 handles database)
        # supabase = get_supabase()
        # file_response = supabase.table("files").select("id").eq("id", highlight.file_id).eq("user_id", highlight.user_id).execute()
        
        highlight_data = {
            "file_id": highlight.file_id,
            "user_id": highlight.user_id,
            "selected_text": highlight.selected_text,
            "start_index": highlight.start_index,
            "end_index": highlight.end_index,
            "created_at": datetime.utcnow().isoformat()
        }
        
        return {
            "file_id": highlight.file_id,
            "selected_text": highlight.selected_text,
            "message": "Highlight created successfully"
        }
    
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/file/{file_id}")
async def get_file_highlights(file_id: int, user_id: str = None):
    """
    Get all highlights for a file.
    """
    
    try:
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id required")
        
        # Supabase operations commented out for now
        return {"highlights": []}
    
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{highlight_id}")
async def delete_highlight(highlight_id: int, user_id: str = None):
    """
    Delete a highlight.
    """
    
    try:
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id required")
        
        # Supabase operations commented out for now
        return {"message": "Highlight deleted successfully"}
    
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
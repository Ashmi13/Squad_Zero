from fastapi import APIRouter, HTTPException
from models.schemas import ResummarizeRequest, SummaryResponse
from app.services.openai_service import generate_summary

router = APIRouter(prefix="/summary", tags=["summary"])

VALID_STYLES = ["default", "bullet", "short"]

@router.post("/regenerate")
async def regenerate_summary(request: ResummarizeRequest):
    """
    Generate a new summary with a different style without re-uploading the file.
    """
    
    try:
        # Validate style
        if request.style not in VALID_STYLES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid style. Must be one of: {', '.join(VALID_STYLES)}"
            )
        
        # Supabase operations commented out for now (M1 handles database)
        # supabase = get_supabase()
        # file_response = supabase.table("files").select("*").eq("id", request.file_id).eq("user_id", request.user_id).execute()
        
        # For now, just generate summary with requested style
        try:
            new_summary = generate_summary("Sample text content", style=request.style)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error generating summary: {str(e)}")
        
        return {
            "summary": new_summary,
            "summary_style": request.style,
            "message": "Summary regenerated successfully"
        }
    
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@router.get("/{file_id}")
async def get_summary(file_id: int, user_id: str = None):
    """
    Get the current summary of a file.
    """
    
    try:
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id required")
        
        # Supabase operations commented out for now
        return {
            "summary": "Sample summary",
            "summary_style": "default"
        }
    
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
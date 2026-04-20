from fastapi import APIRouter, HTTPException
from datetime import datetime

# from supabase import create_client  # M1 - Supabase handled by teammate
# from app.core.config import settings  # M1
from app.services.openai_service import answer_question
from models.schemas import ChatCreate  # adjust if needed

router = APIRouter(prefix="/chat", tags=["chat"])

# Create Supabase client (commented out for now)
# supabase = create_client(
#     settings.supabase_url,
#     settings.supabase_key
# )


@router.post("/ask")
async def ask_question(chat: ChatCreate):
    """
    Ask a question about a file and get an answer from OpenAI.
    """
    try:
        # Supabase operations commented out for now
        # Get file data
        # file_response = supabase.table("files") \
        #     .select("*") \
        #     .eq("id", chat.file_id) \
        #     .eq("user_id", chat.user_id) \
        #     .execute()

        # For now, just generate answer from context
        answer = answer_question(
            question=chat.question,
            context="Sample context",
            highlighted_text=chat.selected_text
        )

        return {
            "question": chat.question,
            "answer": answer,
            "message": "Answer generated successfully"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/file/{file_id}")
async def get_chat_history(file_id: int, user_id: str):
    """
    Get chat history for a file.
    """
    try:
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id required")
        
        # Supabase operations commented out for now
        return {"chat_history": []}

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/chat/{chat_id}")
async def delete_chat(chat_id: int, user_id: str):
    """
    Delete a chat message.
    """
    try:
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id required")

        return {"message": "Chat deleted successfully"}

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
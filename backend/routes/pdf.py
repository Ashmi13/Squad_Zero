from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends
from pydantic import BaseModel
from typing import Optional
from app.services.pdf_reader import extract_text_from_pdf, validate_pdf
from app.services.openai_service import generate_summary as generate_summary_openai, answer_question
from app.api.deps import get_current_user_id, get_supabase_service_client
from app.services.workspace_service import WorkspaceService
import logging
from supabase import Client

router = APIRouter(tags=["pdf"])
logger = logging.getLogger(__name__)


def _fallback_summary(text: str) -> str:
    """Produce a deterministic fallback summary when AI provider fails."""
    cleaned = " ".join((text or "").split())
    if not cleaned:
        return "No content available to summarize."

    max_chars = 16000
    excerpt = cleaned[:max_chars]
    sentences = [s.strip() for s in excerpt.replace("\n", " ").split(".") if s.strip()]
    if not sentences:
        return excerpt[:2000]

    # Build a broader fallback summary by sampling across the document slice.
    if len(sentences) <= 14:
        picked = sentences
    else:
        interval = max(1, len(sentences) // 12)
        picked = [sentences[i] for i in range(0, len(sentences), interval)][:12]

    key_points = "\n".join([f"- {item.strip()}" + ("" if item.strip().endswith(".") else ".") for item in picked])
    summary = "\n".join([
        "## Overview",
        "",
        "### Key Points",
        key_points,
        "",
       
    ])
    return summary


def _resolve_source_context(
    supabase: Client,
    source_file_id: str,
    folder_id: Optional[str],
    source_file_name: Optional[str],
) -> tuple[Optional[str], Optional[str]]:
    """Best-effort resolution of folder/name from source file metadata."""
    if folder_id and source_file_name:
        return folder_id, source_file_name

    try:
        row = (
            supabase.table("files")
            .select("*")
            .eq("id", source_file_id)
            .limit(1)
            .execute()
        ).data
        if not row:
            return folder_id, source_file_name
        record = row[0]
        resolved_folder = folder_id or record.get("folder_id")
        resolved_name = source_file_name or record.get("name") or record.get("original_filename")
        return resolved_folder, resolved_name
    except Exception:
        return folder_id, source_file_name

# CHANGED: Added Pydantic model for summary generation request
class TextSummaryRequest(BaseModel):
    text: str
    source_file_id: Optional[str] = None
    folder_id: Optional[str] = None
    source_file_name: Optional[str] = None


class ContextQuestionRequest(BaseModel):
    question: str
    context: str
    highlighted_text: Optional[str] = None


# CHANGED: Endpoint to extract text from uploaded PDF file
@router.post("/extract-text")
async def extract_text(
    file: UploadFile = File(...),
    source_file_id: str = Form(...),
    folder_id: str = Form(...),
    source_file_name: str = Form(...),
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service_client),
):

    try:
        if not source_file_id:
            raise HTTPException(status_code=400, detail="source_file_id is required")

        folder_id, source_file_name = _resolve_source_context(
            supabase=supabase,
            source_file_id=source_file_id,
            folder_id=folder_id,
            source_file_name=source_file_name,
        )
        if not folder_id or not source_file_name:
            raise HTTPException(status_code=400, detail="folder_id/source_file_name could not be resolved")

        logger.info(f"Extracting text from: {file.filename}")
        print(f"DEBUG: extract_text called with file: {file.filename}, content_type: {file.content_type}")
        
        # Step 1: Validate file type
        if file.content_type != "application/pdf" and not file.filename.endswith('.pdf'):
            print(f"DEBUG: File type validation failed - content_type: {file.content_type}")
            raise HTTPException(status_code=400, detail="Only PDF files allowed")
        
        # Step 2: Read file bytes from upload
        print(f"DEBUG: Reading file bytes...")
        file_bytes = await file.read()
        print(f"DEBUG: File size: {len(file_bytes)} bytes")
        
        # Step 3: Validate PDF is actually a valid PDF file
        print(f"DEBUG: Validating PDF...")
        if not validate_pdf(file_bytes):
            print(f"DEBUG: PDF validation failed")
            raise HTTPException(status_code=400, detail="Invalid or corrupted PDF")
        
        print(f"DEBUG: PDF validation passed, extracting text...")
        # Step 4: Extract text using PyMuPDF

        extracted_text = extract_text_from_pdf(file_bytes)
        
        print(f"DEBUG: Text extraction successful, length: {len(extracted_text)}")
        logger.info(f"Successfully extracted {len(extracted_text)} characters from PDF")
        
        # Step 5: Return extracted text to frontend
        service = WorkspaceService(supabase)
        generated = service.create_generated_text_file(
            user_id=user_id,
            folder_id=folder_id,
            parent_file_id=source_file_id,
            name=f"{source_file_name} - Extracted Text",
            content=extracted_text,
            file_type="TXT",
            original_filename=f"{source_file_name} - Extracted Text.txt",
        )

        return {
            "status": "success",
            "text": extracted_text,
            "filename": file.filename,
            "file": generated,
        }
        
    except HTTPException as e:
        print(f"DEBUG: HTTPException: {e.detail}")
        logger.error(f"HTTP Exception: {e.detail}")
        raise
    except Exception as e:
        print(f"DEBUG: Unexpected exception - {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        logger.error(f"Error extracting text: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error extracting text: {str(e)}")


# CHANGED: Endpoint to generate summary from extracted text
@router.post("/generate-summary")
async def generate_summary(
    request: TextSummaryRequest,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service_client),
):
    
    try:
        if not request.source_file_id:
            raise HTTPException(status_code=400, detail="source_file_id is required")

        resolved_folder_id, resolved_source_name = _resolve_source_context(
            supabase=supabase,
            source_file_id=request.source_file_id,
            folder_id=request.folder_id,
            source_file_name=request.source_file_name,
        )
        if not resolved_folder_id or not resolved_source_name:
            raise HTTPException(status_code=400, detail="folder_id/source_file_name could not be resolved")

        if not request.text or not request.text.strip():
            raise HTTPException(status_code=400, detail="Text content required")
        
        logger.info(f"Generating summary from {len(request.text)} characters of text")
        
        # Step 1: Call OpenAI API to generate summary
        # This calls app/services/openai_service.py generate_summary()
        # which uses OpenAI API (gpt-3.5-turbo model) to create a summary
        try:
            summary_text = generate_summary_openai(request.text)
        except Exception as ai_exc:
            logger.warning(f"Primary summary generation failed, using fallback: {str(ai_exc)}")
            summary_text = _fallback_summary(request.text)
        
        logger.info(f"Successfully generated summary ({len(summary_text)} characters)")
        
        # Step 2: Return generated summary to frontend
        service = WorkspaceService(supabase)
        generated = service.create_generated_text_file(
            user_id=user_id,
            folder_id=resolved_folder_id,
            parent_file_id=request.source_file_id,
            name=(resolved_source_name or "File") + " - Summary",
            content=summary_text,
            file_type="TXT",
            original_filename=(resolved_source_name or "File") + " - Summary.txt",
        )

        return {
            "status": "success",
            "summary": summary_text,
            "file": generated,
        }
        
    except HTTPException as e:
        logger.error(f"HTTP Exception: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"Error generating summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating summary: {str(e)}")


@router.post("/ask-context")
async def ask_context_question(
    request: ContextQuestionRequest,
    _user_id: str = Depends(get_current_user_id),
):
    """Answer a question using selected summary snippet + full summary context."""
    try:
        if not request.question or not request.question.strip():
            raise HTTPException(status_code=400, detail="Question is required")
        if not request.context or not request.context.strip():
            raise HTTPException(status_code=400, detail="Context is required")

        answer = answer_question(
            question=request.question.strip(),
            context=request.context,
            highlighted_text=request.highlighted_text,
        )
        return {"status": "success", "answer": answer}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error answering context question: {str(exc)}")
        detail = str(exc).strip()
        prefix = "Error answering question:"
        if detail.lower().startswith(prefix.lower()):
            detail = detail[len(prefix):].strip()
        raise HTTPException(status_code=500, detail=f"Error answering question: {detail}")

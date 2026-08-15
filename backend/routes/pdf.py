import os
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


def _base_name(value: Optional[str]) -> str:
    candidate = (value or "").strip()
    if not candidate:
        return "Document"
    return os.path.splitext(candidate)[0] or candidate


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

        service = WorkspaceService(supabase)
        file_bytes = None
        if file is not None and getattr(file, "filename", None):
            logger.info(f"Extracting text from uploaded file: {file.filename}")
            if file.content_type != "application/pdf" and not file.filename.endswith('.pdf'):
                raise HTTPException(status_code=400, detail="Only PDF files allowed")
            file_bytes = await file.read()
        else:
            file_bytes = service.get_file_object_bytes(user_id=user_id, file_id=source_file_id)

        if not file_bytes:
            raise HTTPException(status_code=400, detail="PDF content is empty")

        if not validate_pdf(file_bytes):
            raise HTTPException(status_code=400, detail="Invalid or corrupted PDF")

        extracted_text = extract_text_from_pdf(file_bytes)
        logger.info(f"Successfully extracted {len(extracted_text)} characters from PDF")

        base_name = _base_name(source_file_name)
        generated = service.create_generated_pdf_file(
            user_id=user_id,
            folder_id=folder_id,
            parent_file_id=source_file_id,
            name=f"{base_name} - Extracted",
            content=extracted_text,
            original_filename=f"{base_name} - Extracted.pdf",
            title=f"{base_name} - Extracted Text",
        )

        return {
            "status": "success",
            "text": extracted_text,
            "filename": file.filename if file is not None and getattr(file, "filename", None) else base_name + ".pdf",
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

        service = WorkspaceService(supabase)
        text_to_summarize = request.text or ""
        if not text_to_summarize.strip():
            original_bytes = service.get_file_object_bytes(user_id=user_id, file_id=request.source_file_id)
            text_to_summarize = extract_text_from_pdf(original_bytes)
        
        logger.info(f"Generating summary from {len(text_to_summarize)} characters of text")
        
        try:
            summary_text = generate_summary_openai(text_to_summarize)
        except Exception as ai_exc:
            logger.error(f"Summary generation failed: {str(ai_exc)}")
            raise HTTPException(status_code=500, detail=f"Summary generation failed: {str(ai_exc)}") from ai_exc

        if not summary_text or not str(summary_text).strip():
            raise HTTPException(status_code=500, detail="Summary generation returned empty content")

        logger.info(f"Successfully generated summary ({len(summary_text)} characters)")

        base_name = _base_name(resolved_source_name)
        generated = service.create_generated_pdf_file(
            user_id=user_id,
            folder_id=resolved_folder_id,
            parent_file_id=request.source_file_id,
            name=f"{base_name} - Summary",
            content=summary_text,
            original_filename=f"{base_name} - Summary.pdf",
            title=f"{base_name} - Summary",
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

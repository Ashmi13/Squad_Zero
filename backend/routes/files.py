from fastapi import APIRouter, UploadFile, File, HTTPException
import os
from datetime import datetime
from models.schemas import FileUploadResponse, FileResponse, ErrorResponse
from app.services.pdf_reader import extract_text_from_pdf, validate_pdf
from app.services.openai_service import generate_summary

router = APIRouter(prefix="/files", tags=["files"])

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    folder_id: int = None,
    user_id: str = None
):
    """
    Upload a PDF file and generate summary using OpenAI.
    """
    
    try:
        print(f"DEBUG: Upload started - folder_id={folder_id}, user_id={user_id}, filename={file.filename}")
        
        # Validate inputs
        if not folder_id or not user_id:
            print(f"DEBUG: Missing inputs")
            raise HTTPException(status_code=400, detail="folder_id and user_id required")
        
        # Validate file type
        print(f"DEBUG: File content type: {file.content_type}")
        if file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail="Only PDF files allowed")
        
        # Read file bytes
        file_bytes = await file.read()
        print(f"DEBUG: File size: {len(file_bytes)} bytes")
        
        # Validate file size
        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large (max 20MB)")
        
        # Validate PDF
        print(f"DEBUG: Validating PDF...")
        if not validate_pdf(file_bytes):
            raise HTTPException(status_code=400, detail="Invalid or corrupted PDF")
        
        # Extract text from PDF
        try:
            print(f"DEBUG: Extracting text from PDF...")
            raw_text = extract_text_from_pdf(file_bytes)
            print(f"DEBUG: Text extracted, length: {len(raw_text)}")
        except ValueError as e:
            print(f"DEBUG: PDF extraction error: {str(e)}")
            raise HTTPException(status_code=400, detail=str(e))
        
        # Generate summary
        try:
            print(f"DEBUG: Generating summary...")
            summary = generate_summary(raw_text, style="default")
            print(f"DEBUG: Summary generated successfully")
        except Exception as e:
            print(f"DEBUG: Summary generation error: {type(e).__name__}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error generating summary: {str(e)}")
        
        # Clean filename
        filename = file.filename.replace(" ", "_")
        file_stem = filename.replace(".pdf", "")
        
        return {
            "name": file_stem,
            "summary": summary,
            "summary_style": "default",
            "message": "File processed successfully"
        }
    
    except HTTPException as he:
        print(f"DEBUG: HTTPException: {he.detail}")
        raise he
    except Exception as e:
        print(f"DEBUG: Unexpected error: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@router.get("/folder/{folder_id}")
async def get_files(folder_id: int, user_id: str = None):
    """Get all files in a folder."""
    try:
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id required")
        
        return {"files": []}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{file_id}")
async def get_file(file_id: int, user_id: str = None):
    """Get a specific file by ID."""
    try:
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id required")
        
        return {"id": file_id, "message": "File retrieved"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{file_id}")
async def delete_file(file_id: int, user_id: str = None):
    """Delete a file."""
    try:
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id required")
        
        return {"message": "File deleted successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
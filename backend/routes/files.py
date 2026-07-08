from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from supabase import Client
import os
from datetime import datetime
from models.schemas import FileUploadResponse, FileResponse, ErrorResponse
from app.services.pdf_reader import extract_text_from_pdf, validate_pdf
from app.services.openai_service import generate_summary
from app.api.deps import get_current_user_id, get_supabase_service_client

# Storage bucket name - should be configured in settings
SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "files")

# Database session dependency - placeholder for now
async def get_db():
    """Placeholder for database session dependency"""
    # TODO: Implement with actual database session management
    yield None

# Database models - placeholders for now
class FolderModel:
    id: int
    user_id: str
    name: str
    def to_dict(self):
        return {}

class FileModel:
    id: int
    folder_id: int
    user_id: str
    name: str
    def to_dict(self):
        return {}

router = APIRouter(tags=["files"])

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
async def get_files(
    folder_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get all files in a folder.
    
    USER_EXPERIENCE:
    1. User opens a folder from frontend
    2. Frontend calls this endpoint
    3. Backend verifies user owns this folder
    4. Backend queries database for all files in folder
    5. Frontend displays list of files
    """
    try:
        # Verify folder belongs to user
        folder = db.query(FolderModel).filter(
            FolderModel.id == folder_id,
            FolderModel.user_id == user_id
        ).first()
        
        if not folder:
            raise HTTPException(status_code=403, detail="Folder not found or not yours")
        
        # Get all files in folder
        files = db.query(FileModel).filter(
            FileModel.folder_id == folder_id,
            FileModel.user_id == user_id
        ).all()
        
        # Convert to dictionaries
        files_data = [f.to_dict() for f in files]
        
        return {
            "folder_id": folder_id,
            "folder_name": folder.name,
            "files": files_data,
            "total_files": len(files_data)
        }
    
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"DEBUG: Error getting files: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{file_id}")
async def get_file(
    file_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get a specific file by ID.
    
    USER_EXPERIENCE:
    1. User clicks on a file in the file list
    2. Frontend calls this endpoint to get file details
    3. Backend verifies user owns this file
    4. Backend returns file info (including storage URL to display)
    5. Frontend displays the file preview
    """
    try:
        # Get file and verify it belongs to user
        file = db.query(FileModel).filter(
            FileModel.id == file_id,
            FileModel.user_id == user_id
        ).first()
        
        if not file:
            raise HTTPException(status_code=404, detail="File not found or not yours")
        
        return file.to_dict()
    
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"DEBUG: Error getting file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{file_id}")
async def rename_file(
    file_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Rename a file.
    """
    try:
        new_name = payload.get('name') if isinstance(payload, dict) else None
        if not new_name or not str(new_name).strip():
            raise HTTPException(status_code=400, detail='New name is required')

        file = db.query(FileModel).filter(
            FileModel.id == file_id,
            FileModel.user_id == user_id
        ).first()

        if not file:
            raise HTTPException(status_code=404, detail='File not found or not yours')

        file.name = str(new_name).strip()
        db.add(file)
        db.commit()

        return {"message": "File renamed successfully", "file_id": file_id, "name": file.name}

    except HTTPException as he:
        raise he
    except Exception as e:
        try:
            db.rollback()
        except:
            pass
        print(f"DEBUG: Error renaming file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{file_id}")
async def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service_client)
):
    """
    Delete a file permanently.
    
    USER_EXPERIENCE:
    1. User clicks delete button on a file
    2. Frontend shows confirmation dialog
    3. If confirmed, frontend calls this endpoint
    4. Backend deletes file from Supabase storage
    5. Backend deletes file record from database
    6. Backend also deletes any child files (extracted text, summaries)
    7. Frontend removes file from display
    """
    try:
        # Get file and verify it belongs to user
        file = db.query(FileModel).filter(
            FileModel.id == file_id,
            FileModel.user_id == user_id
        ).first()
        
        if not file:
            raise HTTPException(status_code=404, detail="File not found or not yours")
        
        # Delete from Supabase storage
        try:
            supabase.storage.from_(SUPABASE_STORAGE_BUCKET).remove([file.storage_path])
            print(f"DEBUG: Deleted from Supabase: {file.storage_path}")
        except Exception as e:
            print(f"DEBUG: Warning - couldn't delete from Supabase: {str(e)}")
            # Continue - still delete from database even if storage deletion fails
        
        # Delete any child files (extracted text, summaries) first
        child_files = db.query(FileModel).filter(
            FileModel.parent_file_id == file_id,
            FileModel.user_id == user_id
        ).all()
        
        for child in child_files:
            try:
                supabase.storage.from_(SUPABASE_STORAGE_BUCKET).remove([child.storage_path])
            except Exception as e:
                print(f"DEBUG: Warning - couldn't delete child from Supabase: {str(e)}")
            db.delete(child)
        
        # Delete the file from database
        db.delete(file)
        db.commit()
        
        print(f"DEBUG: File {file_id} deleted from database")
        
        return {
            "message": "File deleted successfully",
            "file_id": file_id
        }
    
    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        print(f"DEBUG: Error deleting file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
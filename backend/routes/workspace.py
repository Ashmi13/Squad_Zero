"""Workspace routes for persistent folders and S3-backed files."""

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel
from supabase import Client

from app.api.deps import get_current_user_id, get_supabase_service_client
from app.services.workspace_service import WorkspaceService


router = APIRouter(tags=["workspace"])


class CreateFolderRequest(BaseModel):
    name: str
    parent_folder_id: Optional[str] = None


class RenameFolderRequest(BaseModel):
    name: str


class MoveFileRequest(BaseModel):
    folder_id: str


@router.get("/folders")
async def get_folders(
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service_client),
):
    service = WorkspaceService(supabase)
    return service.list_folders(user_id)


@router.post("/folders")
async def create_folder(
    payload: CreateFolderRequest,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service_client),
):
    service = WorkspaceService(supabase)
    folder = service.create_folder(user_id=user_id, name=payload.name, parent_folder_id=payload.parent_folder_id)
    return {"folder": folder}


@router.patch("/folders/{folder_id}")
async def rename_folder(
    folder_id: str,
    payload: RenameFolderRequest,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service_client),
):
    service = WorkspaceService(supabase)
    folder = service.rename_folder(user_id=user_id, folder_id=folder_id, new_name=payload.name)
    return {"folder": folder}


@router.delete("/folders/{folder_id}")
async def delete_folder(
    folder_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service_client),
):
    service = WorkspaceService(supabase)
    result = service.delete_folder(user_id=user_id, folder_id=folder_id)
    return {"status": "success", **result}


@router.get("/files")
async def get_files(
    folder_id: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service_client),
):
    service = WorkspaceService(supabase)
    return service.list_files(user_id=user_id, folder_id=folder_id)


@router.get("/files/recent")
async def get_recent_files(
    limit: int = 5,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service_client),
):
    service = WorkspaceService(supabase)
    return service.list_recent_files(user_id=user_id, limit=limit)


@router.patch("/files/{file_id}/access")
async def mark_file_accessed(
    file_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service_client),
):
    service = WorkspaceService(supabase)
    file_row = service.update_file_access(user_id=user_id, file_id=file_id)
    return {"file": file_row}


@router.get("/files/{file_id}/preview")
async def get_file_preview(
    file_id: str,
    expires_in: int = 3600,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service_client),
):
    service = WorkspaceService(supabase)
    preview = service.get_file_preview(user_id=user_id, file_id=file_id, expires_in=expires_in)
    return {"preview": preview}


@router.post("/files/upload")
async def upload_file(
    folder_id: str = Form(...),
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service_client),
):
    service = WorkspaceService(supabase)
    uploaded = await service.upload_file(user_id=user_id, folder_id=folder_id, file=file)
    return {"file": uploaded}


@router.patch("/files/{file_id}/move")
async def move_file(
    file_id: str,
    payload: MoveFileRequest,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service_client),
):
    service = WorkspaceService(supabase)
    moved = service.move_file(user_id=user_id, file_id=file_id, folder_id=payload.folder_id)
    return {"file": moved}


@router.delete("/files/{file_id}")
async def delete_file(
    file_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service_client),
):
    service = WorkspaceService(supabase)
    result = service.delete_file(user_id=user_id, file_id=file_id)
    return {"status": "success", **result}


@router.get("/files/search")
async def search_files(
    query: str = "",
    file_type: Optional[str] = None,
    limit: int = 20,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service_client),
):
    """
    Search for files by name or type for cross-module access.
    Used by Quiz, Structured Notes, and other modules to discover available files.
    
    Query parameters:
    - query: Search by file name (partial match, case-insensitive)
    - file_type: Filter by file type (PDF, TXT, DOCX, etc.)
    - limit: Maximum number of results
    
    Returns: List of files matching search criteria
    """
    service = WorkspaceService(supabase)
    return service.search_files(user_id=user_id, query=query, file_type=file_type, limit=limit)


@router.post("/files/{file_id}/export-to-module")
async def export_file_to_module(
    file_id: str,
    module_name: str = Form(...),
    module_ref_id: Optional[str] = Form(None),
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service_client),
):
    """
    Export/link a workspace file to another module (Quiz, Structured Notes, etc.).
    Creates a reference in the target module without copying or moving the file.
    
    Parameters:
    - file_id: ID of the file to export
    - module_name: Target module name (quiz, structured_notes, etc.)
    - module_ref_id: Optional reference ID in the target module
    
    Returns: Export/reference information
    """
    service = WorkspaceService(supabase)
    return service.export_file_to_module(
        user_id=user_id,
        file_id=file_id,
        module_name=module_name,
        module_ref_id=module_ref_id,
    )

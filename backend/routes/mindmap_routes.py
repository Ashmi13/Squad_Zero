from typing import List, Optional
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile

from app.api.deps import get_current_user
from app.db.supabase import get_supabase
from schemas.mindmap_schemas import (
    NodeCreate,
    NodeUpdate,
    NodeResponse,
    MindMapResponse,
    MindMapGenerationResponse,
)
from services.mindmap_service import MindMapService

router = APIRouter(prefix="/api/mindmaps", tags=["mindmaps"])


@router.post("/generate", response_model=MindMapGenerationResponse)
async def generate_mindmap(
    file: UploadFile,
    title: str = Form(..., min_length=1, max_length=255, description="The title of the mind map"),
    description: Optional[str] = Form(None, description="Optional description or context for generation"),
    current_user: dict = Depends(get_current_user)
):
    """Upload PDF and generate mind map using OpenAI GPT."""
    supabase_client = get_supabase().service_client
    service = MindMapService(supabase_client)
    user_id = current_user.get("sub")
    result = await service.generate_from_pdf(
        file=file,
        user_id=user_id,
        title=title,
        description=description
    )
    return result


@router.get("/{mindmap_id}", response_model=MindMapResponse)
def get_mindmap(
    mindmap_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get full mind map details including a tree structure of all nodes."""
    supabase_client = get_supabase().service_client
    service = MindMapService(supabase_client)
    user_id = current_user.get("sub")
    mindmap = service.get_mindmap(mindmap_id=mindmap_id, user_id=user_id)
    return mindmap


@router.post("/{mindmap_id}/nodes", response_model=NodeResponse)
def create_node(
    mindmap_id: int,
    node_in: NodeCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new node within a mind map."""
    supabase_client = get_supabase().service_client
    service = MindMapService(supabase_client)
    user_id = current_user.get("sub")
    node = service.create_node(mindmap_id=mindmap_id, user_id=user_id, node_in=node_in)
    return node


@router.put("/nodes/{node_id}", response_model=NodeResponse)
def update_node(
    node_id: int,
    node_in: NodeUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an existing mind map node's attributes."""
    supabase_client = get_supabase().service_client
    service = MindMapService(supabase_client)
    user_id = current_user.get("sub")
    node = service.update_node(node_id=node_id, user_id=user_id, node_in=node_in)
    return node


@router.delete("/nodes/{node_id}")
def delete_node(
    node_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete a node and all of its descendant nodes."""
    supabase_client = get_supabase().service_client
    service = MindMapService(supabase_client)
    user_id = current_user.get("sub")
    result = service.delete_node(node_id=node_id, user_id=user_id)
    return result


@router.get("/", response_model=List[MindMapResponse])
def list_mindmaps(
    skip: int = 0,
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """List all mind maps belonging to the authenticated user with pagination."""
    supabase_client = get_supabase().service_client
    service = MindMapService(supabase_client)
    user_id = current_user.get("sub")
    mindmaps = service.list_user_mindmaps(user_id=user_id, skip=skip, limit=limit)
    return mindmaps


@router.delete("/{mindmap_id}")
def delete_mindmap(
    mindmap_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete an entire mind map and all its associated nodes."""
    supabase_client = get_supabase().service_client
    service = MindMapService(supabase_client)
    user_id = current_user.get("sub")
    result = service.delete_mindmap(mindmap_id=mindmap_id, user_id=user_id)
    return result


@router.get("/{user_id}/stats")
def get_usage_stats(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get usage statistics for the user's mind maps."""
    current_user_id = current_user.get("sub")
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access statistics for this user")
    supabase_client = get_supabase().service_client
    service = MindMapService(supabase_client)
    stats = service.get_usage_stats(user_id=user_id)
    return stats

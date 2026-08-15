from __future__ import annotations
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class NodeCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=500, description="Node content text")
    parent_id: Optional[int] = Field(default=None, description="Parent node ID if nested")
    notes: Optional[str] = Field(default=None, description="Optional notes or description for the node")
    color: Optional[str] = Field(default="#6366f1", description="HEX color code for the node")

    class Config:
        from_attributes = True


class NodeUpdate(BaseModel):
    content: Optional[str] = Field(default=None, min_length=1, max_length=500, description="Updated node content text")
    notes: Optional[str] = Field(default=None, description="Updated notes or description")
    color: Optional[str] = Field(default=None, description="Updated HEX color code")
    position_x: Optional[float] = Field(default=None, description="X coordinate of node position")
    position_y: Optional[float] = Field(default=None, description="Y coordinate of node position")
    is_expanded: Optional[bool] = Field(default=None, description="Whether children are expanded/visible")

    class Config:
        from_attributes = True


class MindMapCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Mind map title")
    description: Optional[str] = Field(default=None, description="Optional description of the mind map")

    class Config:
        from_attributes = True


class NodeResponse(BaseModel):
    id: int
    content: str
    notes: Optional[str] = None
    color: str
    position_x: float
    position_y: float
    is_expanded: bool
    parent_id: Optional[int] = None
    children: List[NodeResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


class MindMapResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: str
    source_filename: Optional[str] = None
    nodes: List[NodeResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MindMapGenerationResponse(BaseModel):
    mindmap_id: int
    title: str
    status: str
    nodes_count: int
    source_filename: Optional[str] = None
    ai_model: str
    estimated_cost: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MindMapGenerationRequest(BaseModel):
    title: str = Field(..., description="Mind map title")
    description: Optional[str] = Field(default=None, description="Optional context or description to guide generation")

    class Config:
        from_attributes = True


# Rebuild the NodeResponse model to resolve the recursive children list forward reference
NodeResponse.model_rebuild()

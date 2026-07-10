from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class MindMap(Base):
    __tablename__ = "mindmaps"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    source_filename = Column(String(255), nullable=True)
    source_text = Column(Text, nullable=True)
    status = Column(String(50), default="draft", nullable=False)
    ai_model = Column(String(50), default="gpt-3.5-turbo", nullable=False)
    estimated_cost = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), default=func.now(), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=func.now(), server_default=func.now(), onupdate=func.now(), nullable=False)

    # One-to-many relationship with MindMapNode
    nodes = relationship("MindMapNode", back_populates="mindmap", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "description": self.description,
            "source_filename": self.source_filename,
            "source_text": self.source_text,
            "status": self.status,
            "ai_model": self.ai_model,
            "estimated_cost": self.estimated_cost,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "nodes": [node.to_dict() for node in self.nodes] if self.nodes else []
        }


class MindMapNode(Base):
    __tablename__ = "mindmap_nodes"

    id = Column(Integer, primary_key=True, index=True)
    mindmap_id = Column(Integer, ForeignKey("mindmaps.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey("mindmap_nodes.id", ondelete="CASCADE"), nullable=True)
    content = Column(String(500), nullable=False)
    notes = Column(Text, nullable=True)
    color = Column(String(7), default="#6366f1", nullable=False)
    position_x = Column(Float, default=0.0, nullable=False)
    position_y = Column(Float, default=0.0, nullable=False)
    is_expanded = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), default=func.now(), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=func.now(), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    mindmap = relationship("MindMap", back_populates="nodes")
    
    # Self-referential relationship
    parent = relationship("MindMapNode", remote_side=[id], back_populates="children")
    children = relationship("MindMapNode", back_populates="parent", cascade="all, delete-orphan")

    def to_dict(self, include_children=False):
        node_dict = {
            "id": self.id,
            "mindmap_id": self.mindmap_id,
            "parent_id": self.parent_id,
            "content": self.content,
            "notes": self.notes,
            "color": self.color,
            "position_x": self.position_x,
            "position_y": self.position_y,
            "is_expanded": self.is_expanded,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_children:
            node_dict["children"] = [child.to_dict(include_children=True) for child in self.children]
        return node_dict

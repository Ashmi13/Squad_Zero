import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship

from .db import Base


def _id():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc)


note_tags = Table(
    "second_brain_note_tags",
    Base.metadata,
    Column(
        "note_id",
        String(36),
        ForeignKey("second_brain_notes.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "tag_id",
        String(36),
        ForeignKey("second_brain_tags.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

class Note(Base):
    __tablename__ = "second_brain_notes"

    id = Column(String(36), primary_key=True, default=_id)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False, default="")
    # Link back to the uploaded file (member 2's domain). Stored as a plain
    # string so this module never imports their code.
    source_file_id = Column(String(255), nullable=True, index=True)
    color = Column(String(7), nullable=False, server_default="#6366f1")
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    tags = relationship("Tag", secondary=note_tags, back_populates="notes")
    outgoing_links = relationship(
        "Link",
        foreign_keys="Link.source_note_id",
        back_populates="source_note",
        cascade="all, delete-orphan",
    )
    incoming_links = relationship(
        "Link",
        foreign_keys="Link.target_note_id",
        back_populates="target_note",
        cascade="all, delete-orphan",
    )


class Tag(Base):
    __tablename__ = "second_brain_tags"

    id = Column(String(36), primary_key=True, default=_id)
    name = Column(String(100), unique=True, nullable=False, index=True)

    notes = relationship("Note", secondary=note_tags, back_populates="tags")


class Link(Base):
    __tablename__ = "second_brain_links"

    id = Column(String(36), primary_key=True, default=_id)
    source_note_id = Column(String(36), ForeignKey("second_brain_notes.id", ondelete="CASCADE"), nullable=False, index=True)
    target_note_id = Column(String(36), ForeignKey("second_brain_notes.id", ondelete="CASCADE"), nullable=False, index=True)
    context = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now)

    source_note = relationship("Note", foreign_keys=[source_note_id], back_populates="outgoing_links")
    target_note = relationship("Note", foreign_keys=[target_note_id], back_populates="incoming_links")
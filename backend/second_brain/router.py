from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from . import extract, models, services
from .db import get_db

router = APIRouter(prefix="/api/second-brain", tags=["second-brain"])


class NoteCreate(BaseModel):
    title: str
    content: str = ""
    source_file_id: Optional[str] = None


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class TagUpdate(BaseModel):
    tags: List[str]


class BacklinkCreate(BaseModel):
    target_note_id: str
    context: Optional[str] = None


@router.post("/notes")
def create_note(payload: NoteCreate, db: Session = Depends(get_db)):
    """Create a note directly from title+content (e.g. pasted text, no file)."""
    note = services.create_note_from_drop(
        db,
        title=payload.title,
        content=payload.content,
        source_file_id=payload.source_file_id,
    )
    return services.note_view(db, note)


@router.post("/notes/from-upload")
async def create_note_from_upload(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    source_file_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Create a note from a dropped file (tree drag or local file explorer).
    Frontend sends the raw file bytes here either way — see note below on
    tree-drop needing to fetch bytes first."""
    raw = await file.read()
    content = extract.get_text(file.filename, raw)
    note = services.create_note_from_drop(
        db,
        title=title or file.filename,
        content=content,
        source_file_id=source_file_id,
    )
    return services.note_view(db, note)


@router.get("/notes")
def list_notes(db: Session = Depends(get_db)):
    notes = db.query(models.Note).order_by(models.Note.updated_at.desc()).all()
    return [services.note_view(db, n) for n in notes]


@router.get("/notes/{note_id}")
def get_note(note_id: str, db: Session = Depends(get_db)):
    note = db.get(models.Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")
    return services.note_view(db, note)


@router.patch("/notes/{note_id}")
def update_note(note_id: str, payload: NoteUpdate, db: Session = Depends(get_db)):
    note = db.get(models.Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")
    if payload.title is not None:
        note.title = payload.title
    if payload.content is not None:
        note.content = payload.content
    db.commit()
    db.refresh(note)
    return services.note_view(db, note)


@router.delete("/notes/{note_id}")
def delete_note(note_id: str, db: Session = Depends(get_db)):
    note = db.get(models.Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")
    db.delete(note)
    db.commit()
    return {"ok": True}


@router.post("/notes/{note_id}/tags")
def add_tags(note_id: str, payload: TagUpdate, db: Session = Depends(get_db)):
    note = db.get(models.Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")
    note = services.add_tags(db, note, payload.tags)
    return services.note_view(db, note)

@router.delete("/notes/{note_id}/tags/{tag_name}")
def remove_tag(
    note_id: str,
    tag_name: str,
    db: Session = Depends(get_db),
):
    note = db.get(models.Note, note_id)

    if not note:
        raise HTTPException(404, "Note not found")

    note = services.remove_tag(db, note, tag_name)

    return services.note_view(db, note)

@router.delete("/notes/{note_id}/tags/{tag_name}")
def remove_tag(note_id: str, tag_name: str, db: Session = Depends(get_db)):
    note = db.get(models.Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")

    note = services.remove_tag(db, note, tag_name)
    return services.note_view(db, note)

@router.post("/notes/{note_id}/backlinks")
def add_backlink(note_id: str, payload: BacklinkCreate, db: Session = Depends(get_db)):
    note = db.get(models.Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")
    try:
        services.add_backlink(db, note, payload.target_note_id, payload.context)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return services.note_view(db, note)

@router.delete("/notes/{note_id}/backlinks/{target_note_id}")
def remove_backlink(
    note_id: str,
    target_note_id: str,
    db: Session = Depends(get_db),
):
    note = db.get(models.Note, note_id)

    if not note:
        raise HTTPException(404, "Note not found")

    try:
        note = services.remove_backlink(
            db,
            note,
            target_note_id,
        )
    except ValueError as e:
        raise HTTPException(404, str(e))

    return services.note_view(db, note)

@router.delete("/notes/{note_id}/backlinks/{target_note_id}")
def remove_backlink(
    note_id: str,
    target_note_id: str,
    db: Session = Depends(get_db),
):
    note = db.get(models.Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")

    try:
        note = services.remove_backlink(db, note, target_note_id)
    except ValueError as e:
        raise HTTPException(404, str(e))

    return services.note_view(db, note)

@router.get("/tags")
def list_tags(db: Session = Depends(get_db)):
    tags = db.query(models.Tag).order_by(models.Tag.name).all()
    return [{"id": t.id, "name": t.name, "note_count": len(t.notes)} for t in tags]


@router.get("/graph")
def get_graph(db: Session = Depends(get_db)):
    return services.graph(db)
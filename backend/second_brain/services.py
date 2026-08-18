import re
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from . import models

WIKILINK_RE = re.compile(r"\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]")
WORD_RE = re.compile(r"[a-z0-9]{3,}")

STOPWORDS = {
    "the", "and", "for", "are", "but", "not", "you", "all", "any", "can",
    "her", "was", "one", "our", "out", "has", "had", "his", "how", "its",
    "may", "get", "got", "put", "set", "use", "using", "used", "will", "with",
    "that", "this", "they", "then", "than", "these", "those", "from", "into",
    "have", "here", "been", "being", "were", "when", "what", "where", "which",
    "while", "who", "whom", "why", "about", "after", "before", "between",
    "during", "through", "without", "also", "each", "more", "most", "some",
    "such", "other", "only", "own", "same", "too", "very", "just", "your",
    "their", "there", "should", "would", "could", "does", "did", "done",
    "note", "notes", "page", "text", "like", "make", "made", "making",
}


def create_note_from_drop(
    db: Session,
    title: str,
    content: str,
    source_file_id: Optional[str] = None,
) -> models.Note:
    """Create a note (called when a file is dropped into the notes section),
    then auto-generate backlinks and tags for it."""
    note = models.Note(
        title=title.strip(),
        content=content or "",
        source_file_id=source_file_id,
    )
    db.add(note)
    db.flush()  # assigns note.id

    _auto_backlinks(db, note)          # links this note -> notes it references
    _auto_incoming_backlinks(db, note)  # links other notes -> this note
    _auto_tags(db, note)

    db.commit()
    db.refresh(note)
    return note


# ---------------------------------------------------------------------------
# Auto backlinks
# ---------------------------------------------------------------------------
def _auto_backlinks(db: Session, note: models.Note) -> None:
    """Link this note to notes it references.

    Detects references two ways:
      1. Explicit wikilink  [[Note Title]]
      2. Another note's title appearing verbatim in this note's content.
    """
    content_lower = note.content.lower()

    for raw in WIKILINK_RE.findall(note.content):
        _link_to_title(db, note, raw.strip())

    others = db.query(models.Note).filter(models.Note.id != note.id).all()
    for other in others:
        if other.title and other.title.strip().lower() in content_lower:
            _link_to_title(db, note, other.title)


def _link_to_title(db: Session, source: models.Note, target_title: str) -> None:
    target_title = target_title.strip()
    if not target_title:
        return
    target = (
        db.query(models.Note)
        .filter(models.Note.title.ilike(target_title))
        .filter(models.Note.id != source.id)
        .first()
    )
    if not target:
        return
    exists = (
        db.query(models.Link)
        .filter(
            models.Link.source_note_id == source.id,
            models.Link.target_note_id == target.id,
        )
        .first()
    )
    if not exists:
        db.add(models.Link(source_note_id=source.id, target_note_id=target.id))


def _auto_incoming_backlinks(db: Session, note: models.Note) -> None:
    """Resolve backlinks in the REVERSE direction.

    Fixes the drop-order problem: if note A is created before the note B it
    references via [[B]], no link existed at A's creation time. When B is later
    created, this scans existing notes and links any of them that reference
    B's title (as a wikilink or verbatim) -> B.
    """
    if not note.title:
        return
    title_lower = note.title.strip().lower()
    others = db.query(models.Note).filter(models.Note.id != note.id).all()
    for other in others:
        if not other.content:
            continue
        content_lower = other.content.lower()
        referenced = False
        if title_lower in content_lower:
            referenced = True
        else:
            for raw in WIKILINK_RE.findall(other.content):
                if raw.strip().lower() == title_lower:
                    referenced = True
                    break
        if referenced:
            _link_to_title(db, other, note.title)


# ---------------------------------------------------------------------------
# Auto tags
# ---------------------------------------------------------------------------
def _auto_tags(db: Session, note: models.Note) -> None:
    text = (note.title + "\n" + note.content).lower()

    # 1. Reuse existing tags that already appear in the note.
    for tag in db.query(models.Tag).all():
        if tag.name.lower() in text and tag not in note.tags:
            note.tags.append(tag)

    # 2. Create new tags from frequent meaningful words.
    freq: Dict[str, int] = {}
    for w in WORD_RE.findall(text):
        if w not in STOPWORDS:
            freq[w] = freq.get(w, 0) + 1
    for w, count in sorted(freq.items(), key=lambda kv: (-kv[1], kv[0]))[:5]:
        if count >= 2:
            _add_tag(db, note, w)


def _add_tag(db: Session, note: models.Note, name: str) -> None:
    name = name.strip().lower()
    if not name:
        return
    tag = db.query(models.Tag).filter(models.Tag.name == name).first()
    if not tag:
        tag = models.Tag(name=name)
        db.add(tag)
        db.flush()
    if tag not in note.tags:
        note.tags.append(tag)


# ---------------------------------------------------------------------------
# Explicit (post-drop) operations for the "add tag / add backlink" UI
# ---------------------------------------------------------------------------
def add_tags(db: Session, note: models.Note, names: List[str]) -> models.Note:
    for name in names:
        _add_tag(db, note, name)
    db.commit()
    db.refresh(note)
    return note

def remove_tag(
    db: Session,
    note: models.Note,
    name: str,
) -> models.Note:
    name = name.strip().lower()

    note.tags = [
        tag
        for tag in note.tags
        if tag.name.lower() != name
    ]

    db.commit()
    db.refresh(note)

    return note

def remove_tag(db: Session, note: models.Note, name: str) -> models.Note:
    name = name.strip().lower()

    note.tags = [
        tag for tag in note.tags
        if tag.name.lower() != name
    ]

    db.commit()
    db.refresh(note)
    return note


def add_backlink(
    db: Session,
    source: models.Note,
    target_note_id: str,
    context: Optional[str] = None,
) -> models.Link:
    target = db.get(models.Note, target_note_id)
    if not target or target.id == source.id:
        raise ValueError("Invalid target note")
    exists = (
        db.query(models.Link)
        .filter(
            models.Link.source_note_id == source.id,
            models.Link.target_note_id == target.id,
        )
        .first()
    )
    if exists:
        return exists
    link = models.Link(
        source_note_id=source.id,
        target_note_id=target.id,
        context=context,
    )
    db.add(link)
    db.commit()
    return link
def remove_backlink(
    db: Session,
    source: models.Note,
    target_note_id: str,
) -> models.Note:
    link = (
        db.query(models.Link)
        .filter(
            models.Link.source_note_id == source.id,
            models.Link.target_note_id == target_note_id,
        )
        .first()
    )

    if not link:
        raise ValueError("Link does not exist")

    db.delete(link)
    db.commit()
    db.refresh(source)
    return source
def remove_backlink(
    db: Session,
    source: models.Note,
    target_note_id: str,
) -> models.Note:
    link = (
        db.query(models.Link)
        .filter(
            models.Link.source_note_id == source.id,
            models.Link.target_note_id == target_note_id,
        )
        .first()
    )

    if not link:
        raise ValueError("Link does not exist")

    db.delete(link)
    db.commit()
    db.refresh(source)

    return source
# ---------------------------------------------------------------------------
# Read helpers
# ---------------------------------------------------------------------------
def note_view(db: Session, note: models.Note) -> dict:
    """Everything the sidebar / note panel needs for one note."""
    return {
        "id": note.id,
        "title": note.title,
        "content": note.content,
        "source_file_id": note.source_file_id,
        "created_at": note.created_at.isoformat() if note.created_at else None,
        "updated_at": note.updated_at.isoformat() if note.updated_at else None,
        "tags": sorted(t.name for t in note.tags),
        "backlinks": [
            {
                "from_note_id": l.source_note_id,
                "from_title": l.source_note.title if l.source_note else None,
                "context": l.context,
            }
            for l in note.incoming_links
        ],
        "outgoing_links": [
            {
                "to_note_id": l.target_note_id,
                "to_title": l.target_note.title if l.target_note else None,
            }
            for l in note.outgoing_links
        ],
    }


def graph(db: Session) -> dict:
    notes = db.query(models.Note).all()
    links = db.query(models.Link).all()
    return {
        "nodes": [
            {"id": n.id, "title": n.title, "tags": sorted(t.name for t in n.tags)}
            for n in notes
        ],
        "edges": [
            {"source": l.source_note_id, "target": l.target_note_id}
            for l in links
        ],
    }

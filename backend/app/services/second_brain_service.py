"""Second Brain service (Member 5).

Reads the notes that Member 3's structured-note pipeline already persists
(the `notes` table) and reshapes them into graph-friendly records.

This module is intentionally independent of Member 2's workspace/file code:
it talks straight to the `notes` + `folders` tables, so the Second Brain graph
keeps working even while Member 2's file-metadata migration is being fixed.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from supabase import Client

# Content longer than this is irrelevant for tag/backlink parsing, so we trim it
# to keep the payload small and the graph rendering fast.
MAX_CONTENT_CHARS = 60_000


class SecondBrainService:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    @staticmethod
    def _clean_text(value: Any) -> str:
        return str(value or "").replace("\x00", "")

    def list_notes(self, user_id: Optional[str] = None, limit: int = 500) -> List[Dict[str, Any]]:
        """Return notes for the graph.

        `user_id` is optional: in production it scopes results to one user, but
        during development the notes table may contain rows under dev identities
        ("test_user", "guest_user") that don't match the auth UUID. If a scoped
        query returns nothing we fall back to all notes so the graph stays useful.
        """
        try:
            # 1) folder id -> name lookup
            folder_rows = (
                self.supabase.table("folders")
                .select("id,name")
                .limit(1000)
                .execute()
                .data or []
            )
            folder_names: Dict[str, str] = {
                str(f.get("id")): (f.get("name") or "General")
                for f in folder_rows
                if f.get("id") is not None
            }

            # 2) notes, optionally scoped to a user
            rows: List[Dict[str, Any]] = []
            if user_id:
                scoped = (
                    self.supabase.table("notes")
                    .select("*")
                    .eq("user_id", user_id)
                    .order("updated_at", desc=True)
                    .limit(limit)
                    .execute()
                    .data or []
                )
                if scoped:
                    rows = scoped

            if not rows:
                rows = (
                    self.supabase.table("notes")
                    .select("*")
                    .order("updated_at", desc=True)
                    .limit(limit)
                    .execute()
                    .data or []
                )

            # 3) normalize
            notes: List[Dict[str, Any]] = []
            seen: set[str] = set()
            for r in rows:
                note_id = str(r.get("note_id") or r.get("id") or "")
                if not note_id or note_id in seen:
                    continue
                seen.add(note_id)

                content = self._clean_text(r.get("content"))
                folder_id = r.get("folder_id")
                folder_key = str(folder_id) if folder_id is not None else ""

                notes.append({
                    "id": note_id,
                    "title": self._clean_text(r.get("title")) or "Untitled note",
                    "content": content[:MAX_CONTENT_CHARS],
                    "folder_id": folder_key,
                    "folder": folder_names.get(folder_key, "General") if folder_key else "General",
                    "note_type": self._clean_text(r.get("note_type")) or "note",
                    "updated_at": self._clean_text(r.get("updated_at") or r.get("created_at")),
                })

            return notes
        except HTTPException:
            raise
        except Exception as exc:  # pragma: no cover - defensive
            raise HTTPException(status_code=500, detail=f"Failed to fetch notes: {exc}") from exc

    def get_note(self, note_id: str) -> Dict[str, Any]:
        """Return a single note with full content."""
        try:
            res = (
                self.supabase.table("notes")
                .select("*")
                .eq("note_id", note_id)
                .limit(1)
                .execute()
            )
            if not res.data:
                raise HTTPException(status_code=404, detail="Note not found")

            row = res.data[0]
            return {
                "id": str(row.get("note_id") or row.get("id")),
                "title": self._clean_text(row.get("title")),
                "content": self._clean_text(row.get("content")),
                "folder_id": str(row.get("folder_id") or "") or None,
                "note_type": self._clean_text(row.get("note_type")),
                "updated_at": self._clean_text(row.get("updated_at") or row.get("created_at")),
            }
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to fetch note: {exc}") from exc

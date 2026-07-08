"""Workspace service for persistent folder hierarchy and Supabase-backed files."""

from __future__ import annotations

import os
import uuid
import base64
from datetime import datetime, timezone
from urllib.parse import unquote, urlparse
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, UploadFile
from supabase import Client

from app.core.config import settings

# Module-level cache for column detection — persists for the lifetime of the process.
# This avoids re-probing 18 columns on EVERY request (was the main performance bottleneck).
_COLUMNS_CACHE: Dict[str, Optional[bool]] = {}
_PARENT_COLUMN_CACHE: Optional[str] = None
_COLUMNS_DETECTED: bool = False


class WorkspaceService:
    """Handles folder and file operations using Supabase database + storage."""

    def __init__(self, supabase: Client):
        self.supabase = supabase

    # ------------------------------------------------------------------
    # Column-detection helpers — use module-level cache so probes only
    # happen ONCE per process lifetime (not on every request).
    # ------------------------------------------------------------------

    def _column_exists(self, table: str, column: str) -> bool:
        """Check whether a column exists by probing with a safe select."""
        try:
            self.supabase.table(table).select(f"id,{column}").limit(1).execute()
            return True
        except Exception:
            return False

    def _detect_files_columns(self) -> None:
        """Populate the module-level column cache (runs exactly once per process)."""
        global _COLUMNS_DETECTED, _COLUMNS_CACHE
        if _COLUMNS_DETECTED:
            return

        columns = [
            "storage_path", "storage_url", "file_url", "size_bytes", "mime_type",
            "original_filename", "file_type", "user_id", "folder_id", "name",
            "parent_file_id", "file_content", "raw_text", "summary",
            "content", "text", "last_accessed", "updated_at",
        ]

        try:
            res = self.supabase.table("files").select("*").limit(1).execute()
            if res.data:
                row_keys = set(res.data[0].keys())
                for col in columns:
                    _COLUMNS_CACHE[col] = col in row_keys
                _COLUMNS_DETECTED = True
                return
        except Exception:
            pass

        import concurrent.futures
        def check_col(col: str) -> Tuple[str, bool]:
            return col, self._column_exists("files", col)

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            for col, exists in executor.map(check_col, columns):
                _COLUMNS_CACHE[col] = exists

        _COLUMNS_DETECTED = True

    # Convenience properties that read from the module-level cache.
    @property
    def _files_has_storage_path(self) -> bool: return _COLUMNS_CACHE.get("storage_path", False)
    @property
    def _files_has_storage_url(self) -> bool: return _COLUMNS_CACHE.get("storage_url", False)
    @property
    def _files_has_file_url(self) -> bool: return _COLUMNS_CACHE.get("file_url", False)
    @property
    def _files_has_size_bytes(self) -> bool: return _COLUMNS_CACHE.get("size_bytes", False)
    @property
    def _files_has_mime_type(self) -> bool: return _COLUMNS_CACHE.get("mime_type", False)
    @property
    def _files_has_original_filename(self) -> bool: return _COLUMNS_CACHE.get("original_filename", False)
    @property
    def _files_has_file_type(self) -> bool: return _COLUMNS_CACHE.get("file_type", False)
    @property
    def _files_has_user_id(self) -> bool: return _COLUMNS_CACHE.get("user_id", False)
    @property
    def _files_has_folder_id(self) -> bool: return _COLUMNS_CACHE.get("folder_id", False)
    @property
    def _files_has_name(self) -> bool: return _COLUMNS_CACHE.get("name", False)
    @property
    def _files_has_parent_file_id(self) -> bool: return _COLUMNS_CACHE.get("parent_file_id", False)
    @property
    def _files_has_file_content(self) -> bool: return _COLUMNS_CACHE.get("file_content", False)
    @property
    def _files_has_raw_text(self) -> bool: return _COLUMNS_CACHE.get("raw_text", False)
    @property
    def _files_has_summary(self) -> bool: return _COLUMNS_CACHE.get("summary", False)
    @property
    def _files_has_content(self) -> bool: return _COLUMNS_CACHE.get("content", False)
    @property
    def _files_has_text(self) -> bool: return _COLUMNS_CACHE.get("text", False)
    @property
    def _files_has_last_accessed(self) -> bool: return _COLUMNS_CACHE.get("last_accessed", False)
    @property
    def _files_has_updated_at(self) -> bool: return _COLUMNS_CACHE.get("updated_at", False)

    def _extract_storage_key(self, file_row: Dict[str, Any]) -> Optional[str]:
        """Derive object key from known metadata fields."""
        _, storage_key = self._extract_storage_location(file_row)
        return storage_key

    @staticmethod
    def _extract_bucket_and_key_from_url(value: str) -> Tuple[Optional[str], Optional[str]]:
        parsed = urlparse(str(value))
        path = parsed.path or ""
        for marker in (
            "/storage/v1/object/public/",
            "/storage/v1/object/sign/",
            "/storage/v1/object/authenticated/",
        ):
            if marker in path:
                object_path = unquote(path.split(marker, 1)[1].lstrip("/"))
                parts = object_path.split("/", 1)
                if len(parts) == 2 and parts[0] and parts[1]:
                    return parts[0], parts[1]
        return None, None

    def _normalize_storage_reference(self, value: Any) -> Tuple[Optional[str], Optional[str]]:
        """Normalize storage metadata into (bucket, object_key) when possible."""
        normalized = str(value or "").strip()
        if not normalized:
            return None, None

        if normalized.startswith("data:"):
            return None, normalized

        if normalized.startswith("http://") or normalized.startswith("https://"):
            bucket, object_key = self._extract_bucket_and_key_from_url(normalized)
            if object_key:
                return bucket, object_key

        path = normalized
        if "?" in path:
            path = path.split("?", 1)[0]
        if "#" in path:
            path = path.split("#", 1)[0]
        path = unquote(path).lstrip("/")

        if not path:
            return None, None

        if path.startswith("storage/v1/object/"):
            parts = path.split("/")
            if len(parts) >= 6:
                bucket = parts[4].strip()
                object_key = "/".join(parts[5:]).strip("/")
                if bucket and object_key:
                    return bucket, object_key

        for bucket in self._candidate_buckets(parsed_bucket=None):
            prefix = f"{bucket}/"
            if path.startswith(prefix):
                object_key = path[len(prefix):].strip("/")
                if object_key:
                    return bucket, object_key

        return None, path

    def _extract_storage_location(self, file_row: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
        """Derive (bucket, object_key) from common metadata patterns."""
        for key_field in ("storage_path", "s3_key", "object_key", "path"):
            value = file_row.get(key_field)
            if not value:
                continue

            bucket, object_key = self._normalize_storage_reference(value)
            if object_key:
                return bucket, object_key

        storage_url = file_row.get("storage_url")
        if storage_url:
            bucket, object_key = self._normalize_storage_reference(storage_url)
            if object_key:
                return bucket, object_key

        return None, None

    def _candidate_buckets(self, parsed_bucket: Optional[str]) -> List[str]:
        buckets: List[str] = []
        for candidate in (
            parsed_bucket,
            self._workspace_bucket_name(),
            str(settings.supabase_storage_bucket or "").strip() or None,
            "workspace-files",
            "files",
        ):
            if candidate and candidate not in buckets:
                buckets.append(candidate)
        return buckets

    def _row_matches_folder(self, row: Dict[str, Any], folder_id: str) -> bool:
        """Best-effort folder match for schemas missing folder_id."""
        if str(row.get("folder_id") or "") == str(folder_id):
            return True

        storage_path = str(row.get("storage_path") or "")
        if storage_path and f"/{folder_id}/" in storage_path:
            return True

        return False

    def _workspace_bucket_name(self) -> str:
        return str(settings.supabase_storage_bucket or "workspace-files").strip() or "workspace-files"

    def _create_workspace_bucket_if_missing(self, bucket: str) -> None:
        try:
            self.supabase.storage.create_bucket(bucket, options={"public": True})
        except Exception as exc:
            details = str(exc).lower()
            if "already" in details and "exist" in details:
                return
            raise

    def _upload_to_supabase_storage(self, bucket: str, object_key: str, content: bytes, mime_type: str) -> str:
        try:
            self.supabase.storage.from_(bucket).upload(
                path=object_key,
                file=content,
                file_options={"content-type": mime_type, "upsert": "false"},
            )
        except Exception as exc:
            details = str(exc).lower()
            if "bucket" in details and "not found" in details:
                self._create_workspace_bucket_if_missing(bucket)
                self.supabase.storage.from_(bucket).upload(
                    path=object_key,
                    file=content,
                    file_options={"content-type": mime_type, "upsert": "false"},
                )
            else:
                raise

        return self.supabase.storage.from_(bucket).get_public_url(object_key)

    def _delete_from_supabase_storage(self, bucket: str, object_key: Optional[str]) -> None:
        if not object_key:
            return
        if isinstance(object_key, str) and object_key.startswith("data:"):
            return
        try:
            self.supabase.storage.from_(bucket).remove([object_key])
        except Exception:
            # Continue DB cleanup even when storage object is already gone.
            pass

    def _signed_url_from_supabase_storage(self, bucket: str, object_key: str, expires_in: int) -> Optional[str]:
        try:
            normalized_key = str(object_key or "").strip().lstrip("/")
            if not normalized_key:
                return None

            signed = self.supabase.storage.from_(bucket).create_signed_url(normalized_key, expires_in)
            if isinstance(signed, dict):
                signed_url = signed.get("signedURL") or signed.get("signedUrl") or signed.get("signed_url")
                if signed_url:
                    return signed_url
            if isinstance(signed, str) and signed:
                return signed
        except Exception:
            return None
        return None

    @staticmethod
    def _build_tree(flat_folders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        lookup: Dict[str, Dict[str, Any]] = {}
        roots: List[Dict[str, Any]] = []

        for folder in flat_folders:
            node = dict(folder)
            node["children"] = []
            lookup[str(node["id"])] = node

        for node in lookup.values():
            parent_id = node.get("parent_folder_id") or node.get("parent_id")
            if parent_id:
                parent = lookup.get(str(parent_id))
                if parent:
                    parent["children"].append(node)
                else:
                    roots.append(node)
            else:
                roots.append(node)

        return roots

    def _detect_parent_column(self) -> Optional[str]:
        """Detect which parent folder column exists in the folders table."""
        global _PARENT_COLUMN_CACHE
        if _PARENT_COLUMN_CACHE is not None:
            return _PARENT_COLUMN_CACHE if _PARENT_COLUMN_CACHE != "__none__" else None

        try:
            res = self.supabase.table("folders").select("*").limit(1).execute()
            if res.data:
                keys = set(res.data[0].keys())
                if "parent_folder_id" in keys:
                    _PARENT_COLUMN_CACHE = "parent_folder_id"
                    return _PARENT_COLUMN_CACHE
                if "parent_id" in keys:
                    _PARENT_COLUMN_CACHE = "parent_id"
                    return _PARENT_COLUMN_CACHE
                _PARENT_COLUMN_CACHE = "__none__"
                return None
        except Exception:
            pass

        try:
            self.supabase.table("folders").select("id,parent_folder_id").limit(1).execute()
            _PARENT_COLUMN_CACHE = "parent_folder_id"
            return _PARENT_COLUMN_CACHE
        except Exception:
            pass

        try:
            self.supabase.table("folders").select("id,parent_id").limit(1).execute()
            _PARENT_COLUMN_CACHE = "parent_id"
            return _PARENT_COLUMN_CACHE
        except Exception:
            _PARENT_COLUMN_CACHE = "__none__"
            return None

    def list_folders(self, user_id: str) -> Dict[str, Any]:
        try:
            response = (
                self.supabase.table("folders")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", desc=False)
                .execute()
            )
            flat = response.data or []
            return {"folders": self._build_tree(flat), "flat_folders": flat}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to fetch folders: {exc}") from exc

    def create_folder(self, user_id: str, name: str, parent_folder_id: Optional[str] = None) -> Dict[str, Any]:
        if not name or not name.strip():
            raise HTTPException(status_code=400, detail="Folder name is required")

        parent_column = self._detect_parent_column()

        payload = {
            "name": name.strip(),
            "user_id": user_id,
        }
        if parent_column:
            payload[parent_column] = parent_folder_id
        elif parent_folder_id:
            raise HTTPException(
                status_code=400,
                detail="Nested folders are not enabled in your database schema (missing parent folder column).",
            )

        try:
            if parent_folder_id:
                parent = (
                    self.supabase.table("folders")
                    .select("id")
                    .eq("id", parent_folder_id)
                    .eq("user_id", user_id)
                    .limit(1)
                    .execute()
                )
                if not parent.data:
                    raise HTTPException(status_code=404, detail="Parent folder not found")

            created = self.supabase.table("folders").insert(payload).execute()
            if not created.data:
                raise HTTPException(status_code=500, detail="Folder creation returned no data")
            return created.data[0]
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to create folder: {exc}") from exc

    def rename_folder(self, user_id: str, folder_id: str, new_name: str) -> Dict[str, Any]:
        if not new_name or not new_name.strip():
            raise HTTPException(status_code=400, detail="New folder name is required")

        try:
            updated = (
                self.supabase.table("folders")
                .update({"name": new_name.strip()})
                .eq("id", folder_id)
                .eq("user_id", user_id)
                .execute()
            )
            if not updated.data:
                raise HTTPException(status_code=404, detail="Folder not found")
            return updated.data[0]
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to rename folder: {exc}") from exc

    def delete_folder(self, user_id: str, folder_id: str) -> Dict[str, Any]:
        try:
            self._detect_files_columns()

            folder = (
                self.supabase.table("folders")
                .select("id")
                .eq("id", folder_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if not folder.data:
                raise HTTPException(status_code=404, detail="Folder not found")

            all_folders = self.supabase.table("folders").select("*").eq("user_id", user_id).execute().data or []

            child_map: Dict[str, List[str]] = {}
            for item in all_folders:
                parent = item.get("parent_folder_id") or item.get("parent_id")
                if parent:
                    child_map.setdefault(str(parent), []).append(str(item["id"]))

            to_delete = [str(folder_id)]
            stack = [str(folder_id)]
            while stack:
                current = stack.pop()
                for child in child_map.get(current, []):
                    to_delete.append(child)
                    stack.append(child)

            files_query = self.supabase.table("files").select("*")
            if self._files_has_user_id:
                files_query = files_query.eq("user_id", user_id)
            if self._files_has_folder_id:
                files_query = files_query.in_("folder_id", to_delete)
            files = files_query.execute().data or []

            if not self._files_has_folder_id:
                files = [
                    row for row in files
                    if any(self._row_matches_folder(row, candidate) for candidate in to_delete)
                ]

            bucket = self._workspace_bucket_name()
            for file_row in files:
                parsed_bucket, storage_key = self._extract_storage_location(file_row)
                for candidate_bucket in self._candidate_buckets(parsed_bucket):
                    self._delete_from_supabase_storage(candidate_bucket, storage_key)

            # Never run an unscoped DELETE; delete by explicit IDs if available.
            file_ids_to_delete = [str(row.get("id")) for row in files if row.get("id")]
            if file_ids_to_delete:
                delete_files_query = self.supabase.table("files").delete().in_("id", file_ids_to_delete)
                if self._files_has_user_id:
                    delete_files_query = delete_files_query.eq("user_id", user_id)
                delete_files_query.execute()
            self.supabase.table("folders").delete().eq("user_id", user_id).in_("id", to_delete).execute()

            return {"deleted_folder_ids": to_delete, "deleted_files": len(files)}
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to delete folder: {exc}") from exc

    async def upload_file(self, user_id: str, folder_id: str, file: UploadFile) -> Dict[str, Any]:
        if not file.filename:
            raise HTTPException(status_code=400, detail="File name is required")

        try:
            folder = (
                self.supabase.table("folders")
                .select("id,name")
                .eq("id", folder_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if not folder.data:
                raise HTTPException(status_code=404, detail="Folder not found")

            content = await file.read()
            if not content:
                raise HTTPException(status_code=400, detail="Uploaded file is empty")

            ext = os.path.splitext(file.filename)[1].lower()
            file_key = f"workspace/{user_id}/{folder_id}/{uuid.uuid4().hex}{ext}"
            mime_type = file.content_type or "application/octet-stream"
            bucket = self._workspace_bucket_name()
            storage_url: Optional[str] = None
            storage_upload_error: Optional[str] = None

            try:
                storage_url = self._upload_to_supabase_storage(
                    bucket=bucket,
                    object_key=file_key,
                    content=content,
                    mime_type=mime_type,
                )
            except Exception as exc:
                storage_upload_error = str(exc)

            self._detect_files_columns()

            metadata = {}

            if self._files_has_user_id:
                metadata["user_id"] = user_id
            if self._files_has_folder_id:
                metadata["folder_id"] = folder_id
            if self._files_has_name:
                metadata["name"] = os.path.splitext(file.filename)[0]

            if self._files_has_original_filename:
                metadata["original_filename"] = file.filename
            if self._files_has_mime_type:
                metadata["mime_type"] = file.content_type
            if self._files_has_size_bytes:
                metadata["size_bytes"] = len(content)
            if self._files_has_file_type:
                metadata["file_type"] = ext.replace(".", "").upper() if ext else "FILE"
            if self._files_has_storage_path:
                metadata["storage_path"] = file_key
            now_iso = datetime.now(timezone.utc).isoformat()
            if self._files_has_last_accessed:
                metadata["last_accessed"] = now_iso
            if self._files_has_updated_at:
                metadata["updated_at"] = now_iso
            if storage_url:
                if self._files_has_storage_url:
                    metadata["storage_url"] = storage_url
                elif self._files_has_file_url:
                    metadata["file_url"] = storage_url
            if self._files_has_file_content and file.content_type and file.content_type.startswith("text/"):
                metadata["file_content"] = content.decode("utf-8", errors="ignore")
            elif self._files_has_file_content and ext in {".txt", ".md", ".csv", ".json", ".log"}:
                metadata["file_content"] = content.decode("utf-8", errors="ignore")
            elif self._files_has_file_content and not storage_url:
                mime_type = file.content_type or "application/octet-stream"
                encoded = base64.b64encode(content).decode("ascii")
                metadata["file_content"] = f"data:{mime_type};base64,{encoded}"

            # Storage fallback: ensure at least one previewable payload exists in DB metadata.
            if not storage_url:
                mime_type = file.content_type or "application/octet-stream"
                encoded = base64.b64encode(content).decode("ascii")
                data_url = f"data:{mime_type};base64,{encoded}"

                if "file_content" not in metadata and self._files_has_file_content:
                    metadata["file_content"] = data_url
                elif self._files_has_storage_url and not metadata.get("storage_url"):
                    metadata["storage_url"] = data_url
                elif self._files_has_file_url and not metadata.get("file_url"):
                    metadata["file_url"] = data_url
                elif self._files_has_storage_path and not self._files_has_storage_url and not self._files_has_file_content and not self._files_has_file_url:
                    # Some schemas only expose storage_path. Persist a data URL there in no-AWS mode
                    # so preview remains available until cloud storage is configured.
                    metadata["storage_path"] = data_url
                elif self._files_has_storage_path and not metadata.get("storage_path"):
                    # Final fallback for schemas without file_content/storage_url columns.
                    metadata["storage_path"] = data_url
                elif self._files_has_summary and not metadata.get("summary"):
                    # Extreme fallback if only summary column exists
                    metadata["summary"] = data_url

            if not metadata:
                metadata["name"] = os.path.splitext(file.filename)[0]

            saved = self.supabase.table("files").insert(metadata).execute()
            if not saved.data:
                raise HTTPException(status_code=500, detail="File metadata insert failed")
            inserted = saved.data[0]

            # Surface storage failures explicitly in response without breaking core upload.
            if storage_upload_error:
                inserted = {
                    **inserted,
                    "storage_warning": f"Supabase Storage upload fallback used: {storage_upload_error}",
                }

            return inserted
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"File upload failed: {exc}") from exc

    def list_files(self, user_id: str, folder_id: Optional[str] = None) -> Dict[str, Any]:
        try:
            self._detect_files_columns()

            sort_column = "created_at"
            if self._files_has_last_accessed:
                sort_column = "last_accessed"
            elif self._files_has_updated_at:
                sort_column = "updated_at"

            columns_to_select = []
            skip_columns = {"file_content", "raw_text", "summary", "content", "text"}
            for col, exists in _COLUMNS_CACHE.items():
                if exists and col not in skip_columns:
                    columns_to_select.append(col)
            
            if "id" not in columns_to_select: columns_to_select.append("id")
            if "created_at" not in columns_to_select: columns_to_select.append("created_at")

            select_str = ",".join(set(columns_to_select))

            query = (
                self.supabase.table("files")
                .select(select_str)
                .order(sort_column, desc=True)
            )
            if self._files_has_user_id:
                query = query.eq("user_id", user_id)
            if folder_id:
                if self._files_has_folder_id:
                    query = query.eq("folder_id", folder_id)

            response = query.execute()
            rows = response.data or []

            if folder_id and not self._files_has_folder_id:
                rows = [row for row in rows if self._row_matches_folder(row, folder_id)]

            return {"files": rows}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to fetch files: {exc}") from exc

    def update_file_access(self, user_id: str, file_id: str) -> Dict[str, Any]:
        try:
            self._detect_files_columns()

            existing_query = self.supabase.table("files").select("*").eq("id", file_id).limit(1)
            if self._files_has_user_id:
                existing_query = existing_query.eq("user_id", user_id)
            existing = existing_query.execute()
            if not existing.data:
                raise HTTPException(status_code=404, detail="File not found")

            payload: Dict[str, Any] = {}
            now = datetime.now(timezone.utc).isoformat()
            if self._files_has_last_accessed:
                payload["last_accessed"] = now
            elif self._files_has_updated_at:
                payload["updated_at"] = now
            else:
                return existing.data[0]

            update_query = self.supabase.table("files").update(payload).eq("id", file_id)
            if self._files_has_user_id:
                update_query = update_query.eq("user_id", user_id)
            updated = update_query.execute()
            if not updated.data:
                raise HTTPException(status_code=404, detail="File not found")
            return updated.data[0]
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to update file access: {exc}") from exc

    @staticmethod
    def _parse_timestamp(value: Any) -> Optional[datetime]:
        if not value:
            return None
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except Exception:
            return None

    @classmethod
    def _row_recent_timestamp(cls, row: Dict[str, Any]) -> datetime:
        for key in ("last_accessed", "updated_at", "created_at"):
            parsed = cls._parse_timestamp(row.get(key))
            if parsed:
                return parsed
        return datetime.fromtimestamp(0, tz=timezone.utc)

    @staticmethod
    def _build_folder_path(folder_lookup: Dict[str, Dict[str, Any]], folder_id: Optional[str]) -> Optional[str]:
        if not folder_id:
            return None

        parts: List[str] = []
        current = folder_lookup.get(str(folder_id))
        while current:
            name = current.get("name")
            if name:
                parts.append(str(name))
            parent_id = current.get("parent_folder_id") or current.get("parent_id")
            current = folder_lookup.get(str(parent_id)) if parent_id else None

        if not parts:
            return None

        return " → ".join(reversed(parts))

    def list_recent_files(self, user_id: str, limit: int = 5) -> Dict[str, Any]:
        try:
            self._detect_files_columns()

            columns_to_select = []
            skip_columns = {"file_content", "raw_text", "summary", "content", "text"}
            for col, exists in _COLUMNS_CACHE.items():
                if exists and col not in skip_columns:
                    columns_to_select.append(col)
            
            if "id" not in columns_to_select: columns_to_select.append("id")
            if "created_at" not in columns_to_select: columns_to_select.append("created_at")

            select_str = ",".join(set(columns_to_select))

            sort_column = "created_at"
            if self._files_has_last_accessed:
                sort_column = "last_accessed"
            elif self._files_has_updated_at:
                sort_column = "updated_at"

            safe_limit = max(1, min(int(limit or 5), 50))
            
            files_query = (
                self.supabase.table("files")
                .select(select_str)
                .order(sort_column, desc=True)
                .limit(safe_limit)
            )
            
            if self._files_has_user_id:
                files_query = files_query.eq("user_id", user_id)
            files = files_query.execute().data or []

            folders_query = self.supabase.table("folders").select("*").eq("user_id", user_id)
            folders = folders_query.execute().data or []
            folder_lookup = {str(folder["id"]): folder for folder in folders if folder.get("id")}
            bucket = self._workspace_bucket_name()

            # Since we sorted in DB, we can just use the results directly, but we sort locally again just in case the DB sort column didn't exactly match _row_recent_timestamp
            limited = sorted(files, key=self._row_recent_timestamp, reverse=True)
            recent_files = []
            for row in limited:
                folder_id = row.get("folder_id")
                folder = folder_lookup.get(str(folder_id)) if folder_id else None
                parent_id = folder.get("parent_folder_id") if folder else None
                _, storage_key = self._extract_storage_location(row)
                preview_available = bool(
                    row.get("storage_url")
                    or row.get("file_url")
                    or (isinstance(row.get("storage_path"), str) and str(row.get("storage_path")).startswith("data:"))
                    or storage_key
                    or self._files_has_file_content
                )
                recent_files.append({
                    **row,
                    "folder_name": folder.get("name") if folder else None,
                    "folder_path": self._build_folder_path(folder_lookup, folder_id),
                    "parent_folder_path": self._build_folder_path(folder_lookup, parent_id),
                    "recent_timestamp": self._row_recent_timestamp(row).isoformat(),
                    "preview_available": preview_available,
                })

            return {"files": recent_files}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to fetch recent files: {exc}") from exc

    def get_file_preview(self, user_id: str, file_id: str, expires_in: int = 3600) -> Dict[str, Any]:
        """Resolve a preview URL (or text content fallback) for a file."""
        try:
            self._detect_files_columns()

            file_query = self.supabase.table("files").select("*").eq("id", file_id).limit(1)
            if self._files_has_user_id:
                file_query = file_query.eq("user_id", user_id)
            existing = file_query.execute()
            if not existing.data:
                raise HTTPException(status_code=404, detail="File not found")

            row = existing.data[0]

            def _first_non_empty(*keys: str) -> Any:
                for key in keys:
                    value = row.get(key)
                    if isinstance(value, str):
                        if value.strip():
                            return value
                    elif value is not None:
                        return value
                return None

            text_content = _first_non_empty("file_content", "raw_text", "summary", "content", "text")
            if text_content is not None:
                content = text_content
                if isinstance(content, str) and content.startswith("data:"):
                    return {
                        "file_id": file_id,
                        "preview_url": content,
                        "content": None,
                        "mime_type": row.get("mime_type"),
                        "source": "database_data_url",
                    }
                return {
                    "file_id": file_id,
                    "preview_url": None,
                    "content": content,
                    "mime_type": row.get("mime_type"),
                    "source": "database",
                }

            parsed_bucket, storage_key = self._extract_storage_location(row)
            if storage_key and isinstance(storage_key, str) and storage_key.startswith("data:"):
                return {
                    "file_id": file_id,
                    "preview_url": storage_key,
                    "content": None,
                    "mime_type": row.get("mime_type"),
                    "source": "storage_path_data_url",
                }

            if storage_key:
                safe_expiry = max(60, min(int(expires_in or 3600), 86400))
                for candidate_bucket in self._candidate_buckets(parsed_bucket):
                    preview_url = self._signed_url_from_supabase_storage(candidate_bucket, storage_key, safe_expiry)
                    if not preview_url:
                        try:
                            preview_url = self.supabase.storage.from_(candidate_bucket).get_public_url(storage_key)
                        except Exception:
                            preview_url = None

                    if preview_url:
                        return {
                            "file_id": file_id,
                            "preview_url": preview_url,
                            "content": None,
                            "mime_type": row.get("mime_type"),
                            "source": "supabase_storage",
                        }

            storage_url = _first_non_empty("storage_url", "file_url", "url", "public_url")
            if storage_url:
                return {
                    "file_id": file_id,
                    "preview_url": storage_url,
                    "content": None,
                    "mime_type": row.get("mime_type"),
                    "source": "storage_url",
                }

            # DEBUG LOGGING to diagnose why file has no content
            import logging
            logger = logging.getLogger(__name__)
            keys = ["file_content", "raw_text", "summary", "content", "text", "storage_url", "storage_path"]
            found = {k: bool(row.get(k)) for k in keys}
            logger.error(f"Preview 404 for file {file_id}. Name: {row.get('name')}. Found keys: {found}")

            raise HTTPException(
                status_code=404,
                detail="Preview not available: file has no readable content or storage URL.",
            )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to resolve file preview: {exc}") from exc

    def move_file(self, user_id: str, file_id: str, folder_id: str) -> Dict[str, Any]:
        try:
            self._detect_files_columns()

            folder = (
                self.supabase.table("folders")
                .select("id")
                .eq("id", folder_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if not folder.data:
                raise HTTPException(status_code=404, detail="Target folder not found")

            if not self._files_has_folder_id:
                raise HTTPException(
                    status_code=400,
                    detail="This database schema does not support moving files between folders (missing files.folder_id).",
                )

            if self._files_has_user_id:
                updated = (
                    self.supabase.table("files")
                    .update({"folder_id": folder_id})
                    .eq("id", file_id)
                    .eq("user_id", user_id)
                    .execute()
                )
            else:
                updated = (
                    self.supabase.table("files")
                    .update({"folder_id": folder_id})
                    .eq("id", file_id)
                    .execute()
                )
            if not updated.data:
                raise HTTPException(status_code=404, detail="File not found")
            return updated.data[0]
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to move file: {exc}") from exc

    def delete_file(self, user_id: str, file_id: str) -> Dict[str, Any]:
        try:
            self._detect_files_columns()

            existing = (
                self.supabase.table("files")
                .select("*")
                .eq("id", file_id)
                .limit(1)
                .execute()
            )
            if self._files_has_user_id:
                existing = (
                    self.supabase.table("files")
                    .select("*")
                    .eq("id", file_id)
                    .eq("user_id", user_id)
                    .limit(1)
                    .execute()
                )
            if not existing.data:
                raise HTTPException(status_code=404, detail="File not found")

            all_files_query = self.supabase.table("files").select("*")
            if self._files_has_user_id:
                all_files_query = all_files_query.eq("user_id", user_id)
            all_files = all_files_query.execute().data or []

            child_map: Dict[str, List[str]] = {}
            if self._files_has_parent_file_id:
                for item in all_files:
                    parent_file_id = item.get("parent_file_id")
                    if parent_file_id:
                        child_map.setdefault(str(parent_file_id), []).append(str(item["id"]))

            to_delete = [str(file_id)]
            stack = [str(file_id)]
            while stack:
                current = stack.pop()
                for child_id in child_map.get(current, []):
                    to_delete.append(child_id)
                    stack.append(child_id)

            parsed_bucket, storage_key = self._extract_storage_location(existing.data[0])
            for candidate_bucket in self._candidate_buckets(parsed_bucket):
                self._delete_from_supabase_storage(candidate_bucket, storage_key)

            delete_query = self.supabase.table("files").delete().in_("id", to_delete)
            if self._files_has_user_id:
                delete_query = delete_query.eq("user_id", user_id)
            delete_query.execute()
            return {"deleted_file_id": file_id, "deleted_child_file_ids": [fid for fid in to_delete if fid != str(file_id)]}
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {exc}") from exc

    def create_generated_text_file(
        self,
        user_id: str,
        folder_id: str,
        parent_file_id: str,
        name: str,
        content: str,
        file_type: str = "TXT",
        original_filename: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Persist an extracted text or summary file as a child file row.
        
        Files are stored both in the database (file_content column) AND in
        Supabase Storage, ensuring they survive across logins without expiry issues.
        """
        self._detect_files_columns()

        safe_content = str(content or "").replace("\x00", "")
        content_bytes = safe_content.encode("utf-8")

        metadata: Dict[str, Any] = {}
        if self._files_has_user_id:
            metadata["user_id"] = user_id
        if self._files_has_folder_id:
            metadata["folder_id"] = folder_id
        if self._files_has_parent_file_id:
            metadata["parent_file_id"] = parent_file_id
        if self._files_has_name:
            metadata["name"] = name
        if self._files_has_original_filename and original_filename:
            metadata["original_filename"] = original_filename
        if self._files_has_file_type:
            metadata["file_type"] = file_type
        if self._files_has_mime_type:
            metadata["mime_type"] = "text/plain"
        if self._files_has_size_bytes:
            metadata["size_bytes"] = len(content_bytes)

        # Always store content in DB columns for instant preview without needing storage
        if self._files_has_file_content:
            metadata["file_content"] = safe_content
        elif self._files_has_raw_text:
            metadata["raw_text"] = safe_content
        elif self._files_has_text:
            metadata["text"] = safe_content
        elif self._files_has_content:
            metadata["content"] = safe_content
        elif self._files_has_summary:
            metadata["summary"] = safe_content

        # ALSO upload to Supabase Storage for persistent URL access across sessions
        safe_filename = (original_filename or name or "file").replace(" ", "_").replace("/", "_")
        storage_key = f"workspace/{user_id}/{folder_id}/{uuid.uuid4().hex}_{safe_filename}"
        bucket = self._workspace_bucket_name()

        storage_url: Optional[str] = None
        try:
            storage_url = self._upload_to_supabase_storage(
                bucket=bucket,
                object_key=storage_key,
                content=content_bytes,
                mime_type="text/plain",
            )
        except Exception as storage_exc:
            # Storage upload failure is non-fatal — content is still in DB
            import logging
            logging.getLogger(__name__).warning(
                f"Storage upload for generated file failed (content saved in DB): {storage_exc}"
            )

        if storage_url:
            if self._files_has_storage_url:
                metadata["storage_url"] = storage_url
            elif self._files_has_file_url:
                metadata["file_url"] = storage_url
            if self._files_has_storage_path:
                metadata["storage_path"] = storage_key

        # Last-resort fallback: no content column AND no storage → encode as data URL
        content_saved = any(
            k in metadata for k in ("file_content", "raw_text", "text", "content", "summary", "storage_url", "storage_path", "file_url")
        )
        if not content_saved:
            data_url = f"data:text/plain;base64,{base64.b64encode(content_bytes).decode('ascii')}"
            if self._files_has_storage_url:
                metadata["storage_url"] = data_url
            elif self._files_has_file_url:
                metadata["file_url"] = data_url
            elif self._files_has_storage_path:
                metadata["storage_path"] = data_url
            elif self._files_has_summary:
                metadata["summary"] = data_url

        if not metadata:
            raise HTTPException(status_code=500, detail="No writable file metadata columns found")

        try:
            saved = self.supabase.table("files").insert(metadata).execute()
            if not saved.data:
                raise HTTPException(status_code=500, detail="Generated file insert failed")
            return saved.data[0]
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to save generated file: {exc}") from exc


    def search_files(
        self, user_id: str, query: str = "", file_type: Optional[str] = None, limit: int = 20
    ) -> Dict[str, Any]:
        """Search for files by name or type for cross-module access."""
        try:
            self._detect_files_columns()

            # Build base query
            q = self.supabase.table("files").select("*").eq("user_id", user_id).limit(limit)

            # Apply filters
            if query and query.strip():
                # Search by name using ilike for case-insensitive partial matching
                q = q.ilike("name", f"%{query}%")

            if file_type and file_type.strip():
                # Filter by file type
                q = q.ilike("file_type", file_type.strip())

            result = q.execute()
            return {"files": result.data or [], "count": len(result.data or [])}
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Search failed: {exc}") from exc

    def export_file_to_module(
        self,
        user_id: str,
        file_id: str,
        module_name: str,
        module_ref_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a reference to a workspace file in another module without copying it."""
        try:
            self._detect_files_columns()

            # Verify file exists and belongs to user
            file_query = self.supabase.table("files").select("*").eq("id", file_id)
            if self._files_has_user_id:
                file_query = file_query.eq("user_id", user_id)
            
            file_result = file_query.limit(1).execute()
            if not file_result.data:
                raise HTTPException(status_code=404, detail="File not found")

            file_data = file_result.data[0]

            # Create module reference table entry if it doesn't exist
            try:
                ref_metadata = {
                    "workspace_file_id": file_id,
                    "user_id": user_id,
                    "module_name": module_name,
                    "module_ref_id": module_ref_id,
                    "file_name": file_data.get("name", ""),
                    "file_type": file_data.get("file_type", ""),
                    "storage_url": file_data.get("storage_url"),
                    "storage_path": file_data.get("storage_path"),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }

                # Try to insert into module_file_references table
                # This table should be created by each module or shared infrastructure
                ref_result = self.supabase.table("module_file_references").insert(ref_metadata).execute()
                
                if ref_result.data:
                    return {
                        "status": "success",
                        "message": f"File exported to {module_name}",
                        "reference": ref_result.data[0],
                    }
            except Exception as ref_exc:
                # If module_file_references table doesn't exist, return the file data directly
                # Modules can access files directly via the files endpoint
                pass

            return {
                "status": "success",
                "message": f"File can be accessed by {module_name}",
                "file": {
                    "id": file_data.get("id"),
                    "name": file_data.get("name"),
                    "file_type": file_data.get("file_type"),
                    "storage_url": file_data.get("storage_url"),
                    "storage_path": file_data.get("storage_path"),
                    "created_at": file_data.get("created_at"),
                },
            }
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Export failed: {exc}") from exc

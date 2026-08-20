"""Backfill file ownership and S3 object sizes without changing S3 objects."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

import boto3
import psycopg2
from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

MIGRATION_PATH = BACKEND_DIR / "sql" / "migrations" / "20260819_add_file_ownership_and_sizes.sql"


def parse_s3_key(value: Any, bucket: str) -> Optional[str]:
    """Extract an S3 object key from the stored file_url value."""
    raw = str(value or "").strip()
    if not raw or raw.startswith("data:"):
        return None

    if raw.startswith("s3://"):
        remainder = raw[5:]
        parts = remainder.split("/", 1)
        return parts[1] if len(parts) == 2 and parts[0] == bucket else None

    if raw.startswith("http://") or raw.startswith("https://"):
        parsed = urlparse(raw)
        path = parsed.path.lstrip("/")
        if parsed.netloc.startswith(f"{bucket}."):
            return path or None
        if path.startswith(f"{bucket}/"):
            return path[len(bucket) + 1:] or None
        return None

    prefix = f"{bucket}/"
    if raw.startswith(prefix):
        return raw[len(prefix):] or None

    return raw


def run() -> None:
    database_url = os.environ["DATABASE_URL"]
    bucket = os.environ["AWS_S3_BUCKET"]
    region = os.environ.get("AWS_REGION") or "us-east-1"
    access_key = os.environ["AWS_ACCESS_KEY_ID"]
    secret_key = os.environ["AWS_SECRET_ACCESS_KEY"]

    s3 = boto3.client(
        "s3",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region,
    )

    with psycopg2.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(MIGRATION_PATH.read_text(encoding="utf-8"))
            connection.commit()

            cursor.execute(
                """
                UPDATE public.files AS files
                SET user_id = folders.user_id::uuid
                FROM public.folders AS folders
                WHERE files.user_id IS NULL
                  AND files.folder_id = folders.id
                  AND folders.user_id IS NOT NULL
                                    AND folders.user_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                """
            )
            connection.commit()

            cursor.execute(
                """
                SELECT id, user_id, file_url, size_bytes
                FROM public.files
                ORDER BY id
                """
            )
            rows = cursor.fetchall()

            matched = 0
            updated = 0
            unmatched = []
            errors = []

            for file_id, user_id, file_url, current_size in rows:
                key = parse_s3_key(file_url, bucket)
                if not key:
                    unmatched.append({"file_id": str(file_id), "reason": "missing or unsupported file_url"})
                    continue

                try:
                    head = s3.head_object(Bucket=bucket, Key=key)
                    content_length = int(head["ContentLength"])
                    matched += 1

                    if current_size != content_length:
                        cursor.execute(
                            "UPDATE public.files SET size_bytes = %s WHERE id = %s",
                            (content_length, file_id),
                        )
                        updated += 1
                except Exception as exc:
                    errors.append({"file_id": str(file_id), "key": key, "error": str(exc)})

            connection.commit()

            cursor.execute("SELECT COUNT(*) FROM public.files")
            file_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM public.files WHERE user_id IS NOT NULL")
            user_id_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM public.files WHERE size_bytes IS NOT NULL")
            size_count = cursor.fetchone()[0]

            print({
                "file_count": file_count,
                "user_id_populated": user_id_count,
                "size_bytes_populated": size_count,
                "s3_objects_matched": matched,
                "size_rows_updated": updated,
                "unmatched_files": unmatched,
                "s3_head_errors": errors,
            })


if __name__ == "__main__":
    run()

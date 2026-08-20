from pathlib import Path


def get_text(filename: str, raw: bytes) -> str:
    """Return plain text for a dropped file. Empty string if unreadable
    (e.g. a scanned PDF with no text layer) — caller still creates the note,
    and the user can add tags/backlinks manually."""
    ext = Path(filename).suffix.lower()

    if ext in (".txt", ".md"):
        return raw.decode("utf-8", errors="replace")

    if ext == ".pdf":
        try:
            import io
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(raw))
            return "\n".join(page.extract_text() or "" for page in reader.pages).strip()
        except Exception:
            return ""

    return ""
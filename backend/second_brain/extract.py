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
            from utils.pdf_text_sanity import looks_like_garbage, ocr_pdf_bytes, safe_strip_leaked_pdf_objects

            reader = PdfReader(io.BytesIO(raw))
            text = "\n".join(page.extract_text() or "" for page in reader.pages).strip()

            # pypdf can leak raw PDF object-dictionary structure (/Type,
            # /Catalog, endobj, ...) instead of real content on certain
            # malformed/unusually-encoded PDFs. OCR sidesteps the parser.
            if text and looks_like_garbage(text):
                ocr_text = ocr_pdf_bytes(raw)
                if ocr_text.strip():
                    return safe_strip_leaked_pdf_objects(ocr_text.strip())

            # Unconditional final step: strip any leaked object blocks that
            # are too small to have tripped the whole-document check above.
            return safe_strip_leaked_pdf_objects(text)
        except Exception:
            return ""

    return ""
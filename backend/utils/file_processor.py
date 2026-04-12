# backend/utils/file_processor.py
import hashlib
from io import BytesIO
from typing import List
from fastapi import UploadFile
import PyPDF2
import docx
from config.config import settings


# ── Optimization #5: in-memory extraction cache ──────────────────────────────
# Key: sha256(file bytes)  →  Value: extracted text string
# Lives for the duration of the server process; resets on restart.
# For a study-material workflow this is ideal — users frequently re-upload the
# same file when regenerating quizzes at a different difficulty or question type.
_EXTRACTION_CACHE: dict[str, str] = {}

def _file_cache_key(content: bytes) -> str:
    """SHA-256 of raw bytes — collision-proof and fast for files up to 25 MB."""
    return hashlib.sha256(content).hexdigest()


class FileProcessor:
    """Utility for processing uploaded files and extracting text"""

    async def process_files(self, files: List[UploadFile]) -> str:
        """Process uploaded files and extract text from each"""
        combined_text = ""

        for file in files:
            try:
                ext = file.filename.split('.')[-1].lower()

                # Read bytes once — needed for both caching and extraction
                content = await file.read()

                # #5 — check cache before doing expensive parsing
                cache_key = _file_cache_key(content)
                if cache_key in _EXTRACTION_CACHE:
                    print(f"📋 Cache hit for {file.filename}")
                    text = _EXTRACTION_CACHE[cache_key]
                else:
                    if ext == 'pdf':
                        text = self._extract_from_pdf_bytes(content)
                    elif ext in ['doc', 'docx']:
                        text = self._extract_from_docx_bytes(content)
                    elif ext == 'txt':
                        text = content.decode('utf-8', errors='ignore')
                    elif ext in ['xlsx', 'xls']:
                        text = self._extract_from_excel_bytes(content)
                    else:
                        text = ""

                    # Store in cache (only non-empty results worth caching)
                    if text:
                        _EXTRACTION_CACHE[cache_key] = text
                        print(f"📥 Cached extraction for {file.filename} ({len(text):,} chars)")

                if text:
                    combined_text += f"\n\n--- {file.filename} ---\n{text}"

            except Exception as e:
                print(f"⚠️  Could not extract text from {file.filename}: {e}")
                continue

        return combined_text.strip()

    # ── Sync extractors (work on bytes, no awaiting needed) ──────────────────

    def _extract_from_pdf_bytes(self, content: bytes) -> str:
        pdf_buffer = BytesIO(content)
        reader = PyPDF2.PdfReader(pdf_buffer)
        text = ""
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
        return text

    def _extract_from_docx_bytes(self, content: bytes) -> str:
        doc_buffer = BytesIO(content)
        doc = docx.Document(doc_buffer)
        return "\n".join(
            paragraph.text for paragraph in doc.paragraphs
            if paragraph.text.strip()
        )

    def _extract_from_excel_bytes(self, content: bytes) -> str:
        try:
            import openpyxl
            xl_buffer = BytesIO(content)
            wb = openpyxl.load_workbook(xl_buffer, read_only=True, data_only=True)
            text = ""
            for sheet in wb.worksheets:
                text += f"\nSheet: {sheet.title}\n"
                for row in sheet.iter_rows(values_only=True):
                    row_text = " | ".join(str(cell) for cell in row if cell is not None)
                    if row_text:
                        text += row_text + "\n"
            return text
        except Exception as e:
            print(f"⚠️  Excel extraction failed: {e}")
            return ""

    # ── Cache management helpers (optional, exposed for admin use) ────────────

    @staticmethod
    def cache_size() -> int:
        return len(_EXTRACTION_CACHE)

    @staticmethod
    def clear_cache() -> None:
        _EXTRACTION_CACHE.clear()
        print("🗑️  File extraction cache cleared")

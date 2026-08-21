import os
import io
import pytest
import fitz
from PIL import Image

from m3_structurednotes.services import (
    extract_text_from_file,
    note_service,
    resolve_image_tokens_to_static_urls
)

def create_mock_pdf(pdf_path: str):
    """Create a temporary PDF with text and a real image using fitz."""
    doc = fitz.open()
    page = doc.new_page()
    
    # Create a small red image
    img = Image.new("RGB", (200, 200), color="red")
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_bytes = img_byte_arr.getvalue()
    
    # Insert image and text
    page.insert_image(fitz.Rect(10, 10, 210, 210), stream=img_bytes)
    page.insert_text((10, 230), "This is a mock stack text page.")
    
    doc.save(pdf_path)
    doc.close()

def test_pdf_image_extraction_and_resolution():
    pdf_path = "test_temp_sample.pdf"
    file_id = "testfile123"
    
    # Generate mock PDF
    create_mock_pdf(pdf_path)
    
    try:
        # 1. Assert parser returns inline token
        text, images = extract_text_from_file(pdf_path, file_id)
        assert len(images) == 1
        assert images[0]["id"] == f"doctestfile123_p1_img1"
        assert f"[IMAGE:doctestfile123_p1_img1|caption:" in text
        
        # 2. Assert image resolution works with static URLs
        raw_markdown = (
            "## Summary\n"
            "Here is the stack concept diagram:\n"
            "[IMAGE:doctestfile123_p1_img1|caption: \"Red square diagram\"]\n"
            "This concludes the explanation."
        )
        resolved = resolve_image_tokens_to_static_urls(raw_markdown)
        assert "![Red square diagram](/api/m3/images/doctestfile123_p1_img1.png)" in resolved
        assert "[IMAGE:doctestfile123_p1_img1]" not in resolved
        
    finally:
        # Cleanup
        if os.path.exists(pdf_path):
            os.remove(pdf_path)


def test_full_pipeline_image_resolution():
    pdf_path = "test_temp_pipeline.pdf"
    file_id = "pipe123"
    
    create_mock_pdf(pdf_path)
    
    try:
        with open(pdf_path, "rb") as f:
            file_bytes = f.read()
            
        # 1. process_file should populate document_images and document_chunks
        res = note_service.process_file(file_bytes, file_id, "test_temp_pipeline.pdf")
        assert res["status"] == "success"
        
        # 2. save_note_to_db should resolve placeholders to markdown images
        raw_llm_markdown = (
            "## Lecture Summary\n"
            "Please review this image:\n"
            "[IMAGE:docpipe123_p1_img1|caption: \"Mock image caption\"]\n"
            "End of document."
        )
        
        note_id = note_service.save_note_to_db(
            user_id="test_user",
            pdf_id=None,
            title="Pipeline Note Test",
            content=raw_llm_markdown
        )
        assert note_id is not None
        
        # Retrieve the note content from the database and verify it has resolved ![alt](url)
        conn = note_service._connect()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT content FROM notes WHERE note_id = %s", (note_id,))
                row = cur.fetchone()
                db_content = row['content'] if row else ""
        finally:
            conn.close()
            
        assert "![Mock image caption](/api/m3/images/docpipe123_p1_img1.png)" in db_content
        assert "[IMAGE:docpipe123_p1_img1" not in db_content
        
    finally:
        # Cleanup S3/local images written on disk
        if os.path.exists(pdf_path):
            os.remove(pdf_path)
        stable_id = f"doc{file_id}_p1_img1"
        for ext in ("png", "jpg", "jpeg"):
            local_img = os.path.join("documents", "images", f"{stable_id}.{ext}")
            if os.path.exists(local_img):
                try:
                    os.remove(local_img)
                except OSError:
                    pass
            frontend_img = os.path.join("frontend", "public", "notes-assets", f"{stable_id}.{ext}")
            if os.path.exists(frontend_img):
                try:
                    os.remove(frontend_img)
                except OSError:
                    pass

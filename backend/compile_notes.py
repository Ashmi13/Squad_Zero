import os
import sys

# Load env variables from backend/.env or .env
for env_path in (".env", "backend/.env", "../.env"):
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip().strip('"').strip("'")

import argparse
import tempfile
import shutil
import logging

# Ensure python can locate local modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from m3_structurednotes.compiler import (
    ingest_pdf, ingest_pptx, ingest_docx, ingest_folder, compile_notes_to_pdf
)
from m3_structurednotes.openai_client import ask_llm
from m3_structurednotes.services import (
    UNIFIED_CHEATSHEET_SYSTEM, UNIFIED_CHEATSHEET_USER, clean_note_formatting, count_source_items
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("compile_notes_cli")

def main():
    parser = argparse.ArgumentParser(
        description="Automated Structured Study Notes PDF Compiler"
    )
    parser.add_argument(
        "-i", "--input", required=True,
        help="Path to source material (PDF, PPTX, DOCX, or a folder of images + text)"
    )
    parser.add_argument(
        "-o", "--output", default="compiled_notes.pdf",
        help="Target output PDF path (default: compiled_notes.pdf)"
    )
    parser.add_argument(
        "--skip-vision", action="store_true",
        help="Skip calling the Vision LLM for image descriptions to save quota (uses placeholder titles instead)"
    )
    parser.add_argument(
        "--language", default="English",
        help="Generation target language (default: English)"
    )
    
    args = parser.parse_args()
    
    input_path = args.input
    output_pdf = args.output
    skip_vision = args.skip_vision
    language = args.language
    
    if not os.path.exists(input_path):
        logger.error("Input path does not exist: %s", input_path)
        sys.exit(1)
        
    # Setup temporary directory for image extraction/cropping
    temp_img_dir = tempfile.mkdtemp(prefix="compiler_assets_")
    logger.info("Assets extraction folder created: %s", temp_img_dir)
    
    try:
        # 1. INGEST & INVENTORY THE SOURCE
        inventory = None
        if os.path.isdir(input_path):
            inventory = ingest_folder(input_path, temp_img_dir, skip_vision=skip_vision)
        else:
            ext = os.path.splitext(input_path)[1].lower()
            if ext == ".pdf":
                inventory = ingest_pdf(input_path, temp_img_dir, skip_vision=skip_vision)
            elif ext == ".pptx":
                inventory = ingest_pptx(input_path, temp_img_dir, skip_vision=skip_vision)
            elif ext == ".docx":
                inventory = ingest_docx(input_path, temp_img_dir, skip_vision=skip_vision)
            else:
                logger.error("Unsupported file format: %s. Supported formats: .pdf, .pptx, .docx or folder", ext)
                sys.exit(1)
                
        if not inventory or not inventory.all_text.strip():
            logger.error("No text or content could be ingested from the source.")
            sys.exit(1)
            
        logger.info("Ingestion complete! Extracted file ID: %s", inventory.file_id)
        
        # 2. GENERATE NOTE CONTENT VIA LLM
        logger.info("Generating study notes via LLM (single-shot unified sheets)...")
        source_counts = count_source_items(inventory.all_text)
        
        accountability_parts = []
        if source_counts["code_blocks"] > 0:
            accountability_parts.append(
                f"## ⚠️ ACCOUNTABILITY: The source text contains EXACTLY "
                f"**{source_counts['code_blocks']} code blocks**. You MUST include ALL of them. "
                f"Do NOT skip or paraphrase any code block."
            )
        if source_counts["exercises"] > 0:
            accountability_parts.append(
                f"## ⚠️ ACCOUNTABILITY: The source text contains EXACTLY "
                f"**{source_counts['exercises']} exercises**. You MUST solve ALL of them step-by-step."
            )
        accountability_note = "\n\n".join(accountability_parts)
        
        prompt_body = UNIFIED_CHEATSHEET_USER.format(
            content=inventory.all_text,
            accountability_note=accountability_note,
        )
        prompt = (
            f"The source material comes from: {os.path.basename(input_path)}.\n"
            f"Language: {language}.\n\n" + prompt_body
        )
        
        try:
            markdown = ask_llm(
                prompt,
                system=UNIFIED_CHEATSHEET_SYSTEM,
                temperature=0.1,
                max_tokens=16384
            )
            markdown = clean_note_formatting(markdown)
            logger.info("Cheatsheet generated successfully: %d characters.", len(markdown))
        except Exception as llm_err:
            logger.error("LLM Note generation failed: %s. Falling back to direct Markdown layout.", llm_err)
            # Safe markdown outline fallback if LLM offline / API keys missing
            fallback_md = []
            fallback_md.append(f"# Structured Notes - {os.path.basename(input_path)}")
            for page_num, page_text in inventory.text_by_page.items():
                fallback_md.append(f"## Page {page_num}")
                fallback_md.append(page_text)
            markdown = "\n\n".join(fallback_md)
            
        # 3. ASSEMBLY & CLOSED-LOOP VALIDATION
        logger.info("Compiling to ReportLab PDF and running closed-loop visual checks...")
        compile_notes_to_pdf(markdown, output_pdf, temp_img_dir)
        
        logger.info("=== SUCCESS ===")
        logger.info("Structured Study Notes compiled successfully!")
        logger.info("Output PDF: %s", os.path.abspath(output_pdf))
        
    finally:
        # Clean up temp assets folder
        logger.info("Cleaning up temp assets directory: %s", temp_img_dir)
        shutil.rmtree(temp_img_dir, ignore_errors=True)

if __name__ == "__main__":
    main()

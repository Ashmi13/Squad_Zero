"""
PDF Reader Service - Handles PDF Text Extraction

ROLE IN INTEGRATION:
This service is called by backend/routes/pdf.py when frontend requests text extraction.
It uses PyMuPDF (fitz) library to read PDF files and extract all text.

HOW IT WORKS:
1. Receives PDF file as bytes (from frontend via routes/pdf.py)
2. Opens PDF using PyMuPDF (fitz.open)
3. Iterates through each page of the PDF
4. Extracts text from each page using page.get_text()
5. Combines all text and returns to frontend

LIBRARY USED:
- PyMuPDF (fitz) - Fast PDF reading library
- Installed via: pip install PyMuPDF>=1.23.8

WHAT IT DOES:
- extract_text_from_pdf(pdf_bytes) - Main function to extract text
- validate_pdf(pdf_bytes) - Checks if PDF is valid
"""

import fitz  # PyMuPDF - Library for reading PDF files
from io import BytesIO

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extract all text from a PDF file.
    
    This function is called by routes/pdf.py when frontend sends a PDF for text extraction.
    
    INTEGRATION POINT:
    - Called from: backend/routes/pdf.py extract_text() endpoint
    - Receives: PDF file as bytes (from frontend upload)
    - Returns: Extracted text string (sent back to frontend)
    
    HOW IT EXTRACTS TEXT:
    1. Opens PDF from bytes using PyMuPDF (fitz)
    2. Checks PDF has at least 1 page
    3. Loops through each page in the PDF
    4. Extracts text from each page using PyMuPDF's get_text() function
    5. Combines text from all pages with newlines between pages
    6. Returns complete text string
    
    Args:
        pdf_bytes: PDF file as bytes
        
    Returns:
        Extracted text as string
        
    Raises:
        ValueError: If PDF is empty, unreadable, or has no extractable text
    """
    try:
        print(f"DEBUG pdf_reader: Opening PDF from {len(pdf_bytes)} bytes")
        # Step 1: Open PDF from bytes
        # PyMuPDF (fitz) can read PDF directly from bytes without saving to disk
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        print(f"DEBUG pdf_reader: PDF opened, page count: {pdf_document.page_count}")
        # Step 2: Check if PDF has at least 1 page
        if pdf_document.page_count == 0:
            raise ValueError("PDF has no pages")
        
        extracted_text = ""
        
        # Step 3: Extract text from each page
        print(f"DEBUG pdf_reader: Starting text extraction from {pdf_document.page_count} pages")
        for page_num in range(pdf_document.page_count):
            page = pdf_document[page_num]
            text = page.get_text()  # PyMuPDF method to extract text from page
            extracted_text += text + "\n"  # Add newline between pages
            print(f"DEBUG pdf_reader: Extracted {len(text)} chars from page {page_num + 1}")
        
        pdf_document.close()
        
        # Step 4: Check if text was actually extracted
        if not extracted_text.strip():
            raise ValueError("PDF appears to be scanned or has no readable text")
        
        print(f"DEBUG pdf_reader: Total extracted: {len(extracted_text)} characters")
        # Step 5: Return extracted text to caller (routes/pdf.py)
        return extracted_text.strip()
    
    except Exception as e:
        print(f"DEBUG pdf_reader: Error - {type(e).__name__}: {str(e)}")
        raise ValueError(f"Error extracting text from PDF: {str(e)}")


def validate_pdf(pdf_bytes: bytes) -> bool:
    """
    Check if PDF is valid and readable.
    
    This function is called by routes/pdf.py to validate PDF before extraction.
    Prevents attempting to extract from corrupted or invalid PDF files.
    
    Args:
        pdf_bytes: PDF file as bytes
        
    Returns:
        True if valid PDF with at least 1 page, False otherwise
    """
    try:
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        is_valid = pdf_document.page_count > 0
        pdf_document.close()
        return is_valid
    except:
        return False
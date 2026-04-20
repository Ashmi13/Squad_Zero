import fitz  # PyMuPDF
from io import BytesIO

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extract text from PDF file.
    
    Args:
        pdf_bytes: PDF file as bytes
        
    Returns:
        Extracted text as string
        
    Raises:
        ValueError: If PDF is empty or unreadable
    """
    try:
        # Open PDF from bytes
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        if pdf_document.page_count == 0:
            raise ValueError("PDF has no pages")
        
        extracted_text = ""
        
        # Extract text from each page
        for page_num in range(pdf_document.page_count):
            page = pdf_document[page_num]
            text = page.get_text()
            extracted_text += text + "\n"
        
        pdf_document.close()
        
        # Check if text was actually extracted
        if not extracted_text.strip():
            raise ValueError("PDF appears to be scanned or has no readable text")
        
        return extracted_text.strip()
    
    except Exception as e:
        raise ValueError(f"Error extracting text from PDF: {str(e)}")


def validate_pdf(pdf_bytes: bytes) -> bool:
    """
    Check if PDF is valid and readable.
    
    Args:
        pdf_bytes: PDF file as bytes
        
    Returns:
        True if valid, False otherwise
    """
    try:
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        is_valid = pdf_document.page_count > 0
        pdf_document.close()
        return is_valid
    except:
        return False
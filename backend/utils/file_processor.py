# backend/utils/file_processor.py
from typing import List
from fastapi import UploadFile
import PyPDF2
import docx
from config.config import settings

class FileProcessor:
    """Utility for processing uploaded files"""
    
    async def process_files(self, files: List[UploadFile]) -> str:
        """Process uploaded files and extract text"""
        combined_text = ""
        
        for file in files:
            file_extension = file.filename.split('.')[-1].lower()
            
            if file_extension == 'pdf':
                text = await self._extract_from_pdf(file)
            elif file_extension in ['doc', 'docx']:
                text = await self._extract_from_docx(file)
            elif file_extension == 'txt':
                content = await file.read()
                text = content.decode('utf-8')
            else:
                text = ""
            
            combined_text += text + "\n\n"
        
        return combined_text
    
    async def _extract_from_pdf(self, file: UploadFile) -> str:
        """Extract text from PDF"""
        content = await file.read()
        pdf_reader = PyPDF2.PdfReader(content)
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text()
        return text
    
    async def _extract_from_docx(self, file: UploadFile) -> str:
        """Extract text from DOCX"""
        content = await file.read()
        doc = docx.Document(content)
        text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        return text

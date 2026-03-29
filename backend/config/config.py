# backend/config/config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    """Application settings and configuration"""
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://postgres:neuranote123@localhost:5432/neuranote_db"
    )
    
    # OpenAI
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    
    # App Settings
    APP_NAME: str = "NeuraNote Quiz API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # CORS Origins
    CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ]
    
    # File Upload Settings
    MAX_FILE_SIZE: int = 25 * 1024 * 1024  # 25MB
    MAX_FILES: int = 20
    ALLOWED_EXTENSIONS: set = {
        'pdf', 'doc', 'docx', 'txt', 'xlsx', 'xls',
        'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'epub'
    }
    
    # Quiz Settings
    MIN_QUESTIONS: int = 1
    MAX_QUESTIONS: int = 25
    MIN_TIME_LIMIT: int = 1
    MAX_TIME_LIMIT: int = 180
    
    # AI Settings
    AI_MODEL: str = "gpt-3.5-turbo"
    AI_TEMPERATURE: float = 0.7

settings = Settings()

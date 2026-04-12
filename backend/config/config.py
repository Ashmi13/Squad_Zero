# backend/config/config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    """Application settings and configuration"""
    
    # Database — reads from .env, falls back to local default
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:neuranote123@localhost:5432/neuranote_db"
    )
    
    # OpenAI (legacy)
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    # OpenRouter — used for Nvidia Nemotron via OpenRouter
    # Falls back to OPENAI_API_KEY if OPENROUTER_API_KEY not set (they use the same sk-or-v1 format)
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY", "")
    
    # App Settings
    APP_NAME: str = "NeuraNote Quiz API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # CORS Origins — includes all common dev ports
    CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",   # Vite default
        "http://localhost:5174",   # Vite alternate
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
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

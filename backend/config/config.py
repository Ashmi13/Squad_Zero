import os
from dotenv import load_dotenv

load_dotenv()

# Pass threshold for quiz scoring
PASS_THRESHOLD = 50  # percentage required to pass and unlock next level


class Settings:
    """Application settings and configuration"""

    # Database URL
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # OpenAI / OpenRouter API keys
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY", "")

    # App settings
    APP_NAME: str = "NeuraNote Quiz API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"

    # CORS origins
    CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # File upload limits
    MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100 MB
    MAX_FILES: int = 20
    ALLOWED_EXTENSIONS: set = {
        "pdf", "doc", "docx", "txt", "md", "rtf",
        "xlsx", "xls", "ppt", "pptx",
        "jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "epub",
    }

    # Quiz constraints
    MIN_QUESTIONS: int = 1
    MAX_QUESTIONS: int = 100
    MIN_TIME_LIMIT: int = 1
    MAX_TIME_LIMIT: int = 180

    # Pass threshold
    PASS_THRESHOLD: int = PASS_THRESHOLD

    # AI model settings
    AI_MODEL: str = "google/gemini-2.5-flash"
    AI_MODEL: str = "google/gemini-3.1-flash-lite-preview"
    AI_TEMPERATURE: float = 0.5


settings = Settings()

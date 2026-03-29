# backend/middleware/cors_middleware.py
from fastapi.middleware.cors import CORSMiddleware
from config.config import settings

def setup_cors(app):
    """Configure CORS middleware"""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

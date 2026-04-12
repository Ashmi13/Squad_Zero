# app/core/config.py
"""Application configuration using pydantic-settings"""
from typing import List, Optional
from pathlib import Path
import os
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):

    # Application
    app_name: str = Field(default="SquadZero API", env="APP_NAME")
    debug: bool = Field(default=False, env="DEBUG")
    environment: str = Field(default="development", env="ENVIRONMENT")

    # Server
    api_version: str = Field(default="v1", env="API_VERSION")
    backend_url: str = Field(default="http://localhost:8000", env="BACKEND_URL")

    # Supabase — Optional so backend starts without keys in dev
    supabase_url: Optional[str] = Field(default=None, env="SUPABASE_URL")
    supabase_anon_key: Optional[str] = Field(default=None, env="SUPABASE_ANON_KEY")
    supabase_service_role_key: Optional[str] = Field(default=None, env="SUPABASE_SERVICE_ROLE_KEY")

    # JWT and Session
    secret_key: str = Field(default="dev-secret-change-me", env="SECRET_KEY")
    algorithm: str = Field(default="HS256", env="ALGORITHM")
    access_token_expire_minutes: int = Field(default=30, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=7, env="REFRESH_TOKEN_EXPIRE_DAYS")

    # Cookie
    cookie_name: str = Field(default="session", env="COOKIE_NAME")
    cookie_secure: bool = Field(default=True, env="COOKIE_SECURE")
    cookie_httponly: bool = Field(default=True, env="COOKIE_HTTPONLY")
    cookie_samesite: str = Field(default="lax", env="COOKIE_SAMESITE")
    cookie_domain: Optional[str] = Field(default=None, env="COOKIE_DOMAIN")

    # CORS
    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:5173",
        env="CORS_ORIGINS"
    )
    allow_credentials: bool = Field(default=True, env="ALLOW_CREDENTIALS")

    # Admin
    admin_email: str = Field(default="admin@university.com", env="ADMIN_EMAIL")

    # AWS S3 — Optional so backend starts without keys in dev
    aws_s3_bucket: Optional[str] = Field(default=None, env="AWS_S3_BUCKET")
    aws_access_key_id: Optional[str] = Field(default=None, env="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: Optional[str] = Field(default=None, env="AWS_SECRET_ACCESS_KEY")
    aws_region: str = Field(default="us-east-1", env="AWS_REGION")

    # Password Reset
    password_reset_token_expire_minutes: int = Field(
        default=60, env="PASSWORD_RESET_TOKEN_EXPIRE_MINUTES"
    )

    # OpenAI (legacy)
    OPENAI_API_KEY: str = Field(default=os.getenv("OPENAI_API_KEY", ""), env="OPENAI_API_KEY")

    # OpenRouter — used for Nvidia Nemotron via OpenRouter
    OPENROUTER_API_KEY: str = Field(default=os.getenv("OPENROUTER_API_KEY", ""), env="OPENROUTER_API_KEY")

    class Config:
        env_file = str(Path(__file__).parent.parent.parent / ".env")
        case_sensitive = False
        # ↓ This allows extra fields in .env without crashing
        extra = "ignore"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()
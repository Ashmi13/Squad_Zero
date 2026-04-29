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
    backend_url: str = Field(default="http://127.0.0.1:8000", env="BACKEND_URL")

    # Supabase — Optional
    supabase_url: Optional[str] = Field(default=None, env="SUPABASE_URL")
    supabase_anon_key: Optional[str] = Field(default=None, env="SUPABASE_ANON_KEY")
    supabase_service_role_key: Optional[str] = Field(default=None, env="SUPABASE_SERVICE_ROLE_KEY")

    # JWT and Session
    secret_key: str = Field(default="dev-secret-change-me", env="SECRET_KEY")
    algorithm: str = Field(default="HS256", env="ALGORITHM")
    access_token_expire_minutes: int = Field(default=30, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=7, env="REFRESH_TOKEN_EXPIRE_DAYS")

    from pydantic import field_validator

    @field_validator("secret_key")
    def secret_key_must_be_set(cls, v):
        if v == "dev-secret-change-me":
            import warnings
            warnings.warn("SECRET_KEY is using the insecure default. Set it in .env!")
        return v

    # Cookie
    cookie_name: str = Field(default="session", env="COOKIE_NAME")
    cookie_secure: bool = Field(default=False, env="COOKIE_SECURE")
    cookie_httponly: bool = Field(default=True, env="COOKIE_HTTPONLY")
    cookie_samesite: str = Field(default="lax", env="COOKIE_SAMESITE")
    cookie_domain: Optional[str] = Field(default=None, env="COOKIE_DOMAIN")

    # CORS
    cors_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:5175,http://127.0.0.1:5175",
        env="CORS_ORIGINS"
    )
    allow_credentials: bool = Field(default=True, env="ALLOW_CREDENTIALS")

    # Admin
    admin_email: str = Field(default="admin@university.com", env="ADMIN_EMAIL")
    super_admin_id: str = Field(default="b422ac95-a9dd-4aa0-ab5c-54c09fa58267", env="SUPER_ADMIN_ID")

    # Google OAuth
    google_client_id: Optional[str] = Field(default=None, env="GOOGLE_CLIENT_ID")
    google_client_secret: Optional[str] = Field(default=None, env="GOOGLE_CLIENT_SECRET")
    google_redirect_uri: str = Field(
        default="http://127.0.0.1:8000/api/v1/auth/google/callback",
        env="GOOGLE_REDIRECT_URI"
    )

    # AWS S3 — Optional
    aws_s3_bucket: Optional[str] = Field(default=None, env="AWS_S3_BUCKET")
    aws_access_key_id: Optional[str] = Field(default=None, env="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: Optional[str] = Field(default=None, env="AWS_SECRET_ACCESS_KEY")
    aws_region: str = Field(default="us-east-1", env="AWS_REGION")

    # Password Reset
    password_reset_token_expire_minutes: int = Field(
        default=60, env="PASSWORD_RESET_TOKEN_EXPIRE_MINUTES"
    )

 OPENAI_API_KEY: str = Field(default="", env="OPENAI_API_KEY")
    # OpenRouter
    OPENROUTER_API_KEY: str = Field(default="", env="OPENROUTER_API_KEY")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()

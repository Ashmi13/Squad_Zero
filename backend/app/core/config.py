"""Application configuration using pydantic-settings"""
from typing import List
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Application
    app_name: str = Field(default="SquadZero API", env="APP_NAME")
    debug: bool = Field(default=False, env="DEBUG")
    environment: str = Field(default="development", env="ENVIRONMENT")

    # Server
    api_version: str = Field(default="v1", env="API_VERSION")
    backend_url: str = Field(default="http://localhost:8000", env="BACKEND_URL")

    # Supabase Configuration
    supabase_url: str = Field(..., env="SUPABASE_URL")
    supabase_anon_key: str = Field(..., env="SUPABASE_ANON_KEY")
    supabase_service_role_key: str = Field(..., env="SUPABASE_SERVICE_ROLE_KEY")

    # JWT and Session Configuration
    secret_key: str = Field(..., env="SECRET_KEY")
    algorithm: str = Field(default="HS256", env="ALGORITHM")
    access_token_expire_minutes: int = Field(default=30, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=7, env="REFRESH_TOKEN_EXPIRE_DAYS")

    # Cookie Configuration
    cookie_name: str = Field(default="session", env="COOKIE_NAME")
    cookie_secure: bool = Field(default=True, env="COOKIE_SECURE")
    cookie_httponly: bool = Field(default=True, env="COOKIE_HTTPONLY")
    cookie_samesite: str = Field(default="lax", env="COOKIE_SAMESITE")
    cookie_domain: str | None = Field(default=None, env="COOKIE_DOMAIN")

    # CORS Configuration
    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:5173",
        env="CORS_ORIGINS"
    )
    allow_credentials: bool = Field(default=True, env="ALLOW_CREDENTIALS")

    # Admin Configuration
    admin_email: str = Field(default="admin@university.com", env="ADMIN_EMAIL")

    # AWS S3 Configuration
    aws_s3_bucket: str = Field(..., env="AWS_S3_BUCKET")
    aws_access_key_id: str = Field(..., env="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str = Field(..., env="AWS_SECRET_ACCESS_KEY")
    aws_region: str = Field(default="us-east-1", env="AWS_REGION")

    # Password Reset Configuration
    password_reset_token_expire_minutes: int = Field(default=60, env="PASSWORD_RESET_TOKEN_EXPIRE_MINUTES")

    class Config:
        # Look for .env file in the backend root directory
        env_file = str(Path(__file__).parent.parent.parent / ".env")
        case_sensitive = False

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins string into list"""
        return [origin.strip() for origin in self.cors_origins.split(",")]


# Global settings instance
settings = Settings()

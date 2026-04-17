"""Supabase client initialization and access helpers"""
from supabase import create_client, Client
from app.core.config import settings


class SupabaseManager:
    """Manages Supabase clients for user and admin contexts"""
    
    _instance: "SupabaseManager | None" = None
    _anon_client: Client | None = None
    _service_client: Client | None = None
    
    def __new__(cls):
        """Singleton pattern for client initialization"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize Supabase clients if not already done"""
        if self._anon_client is None:
            self._anon_client = create_client(
                settings.supabase_url,
                settings.supabase_anon_key
            )
        if self._service_client is None:
            self._service_client = create_client(
                settings.supabase_url,
                settings.supabase_service_role_key
            )
    
    @property
    def anon_client(self) -> Client:
        """Get the anonymous (user-context) Supabase client"""
        if self._anon_client is None:
            self._anon_client = create_client(
                settings.supabase_url,
                settings.supabase_anon_key
            )
        return self._anon_client
    
    @property
    def service_client(self) -> Client:
        """Get the service-role (admin-context) Supabase client"""
        if self._service_client is None:
            self._service_client = create_client(
                settings.supabase_url,
                settings.supabase_service_role_key
            )
        return self._service_client


def get_supabase() -> SupabaseManager:
    """Dependency-injectable function to get Supabase manager"""
    return SupabaseManager()

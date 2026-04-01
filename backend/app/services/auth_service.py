"""Authentication service for Supabase Auth integration"""
from typing import Optional, Dict, Any
from supabase import Client
from app.core.security import hash_password, verify_password
from app.core.config import settings


class AuthService:
    """Service for handling authentication operations"""
    
    def __init__(self, supabase_client: Client):
        """Initialize auth service with Supabase client
        
        Args:
            supabase_client: Supabase client instance
        """
        self.db = supabase_client
    
    async def signup(
        self,
        email: str,
        password: str,
        full_name: str
    ) -> Dict[str, Any]:
        """Sign up a new user with Supabase Auth
        
        Args:
            email: User email
            password: User password
            full_name: User full name
            
        Returns:
            Dictionary with user data
        """
        try:
            # Create user in Supabase Auth
            auth_response = self.db.auth.sign_up(
                {"email": email, "password": password}
            )
            
            if not auth_response.user:
                raise Exception("Failed to create auth user")
            
            user_id = auth_response.user.id
            
            # Create entry in users table
            user_response = self.db.table("users").insert({
                "id": user_id,
                "email": email,
                "full_name": full_name,
            }).execute()
            
            if not user_response.data:
                raise Exception("Failed to create user record")
            
            return {
                "id": user_id,
                "email": email,
                "full_name": full_name,
            }
            
        except Exception as e:
            raise Exception(f"Signup failed: {str(e)}")
    
    async def signin(
        self,
        email: str,
        password: str
    ) -> Dict[str, Any]:
        """Sign in a user with Supabase Auth
        
        Args:
            email: User email
            password: User password
            
        Returns:
            Dictionary with user data, access token, and refresh token
        """
        try:
            # Authenticate with Supabase Auth
            auth_response = self.db.auth.sign_in_with_password(
                {"email": email, "password": password}
            )
            
            if not auth_response.user or not auth_response.session:
                raise Exception("Invalid credentials")
            
            # Fetch user record
            user_response = self.db.table("users").select("*").eq(
                "id", auth_response.user.id
            ).single().execute()
            
            user = user_response.data if user_response.data else {}
            
            return {
                "user": {
                    "id": auth_response.user.id,
                    "email": auth_response.user.email,
                    "full_name": user.get("full_name"),
                    "avatar_url": user.get("avatar_url"),
                },
                "access_token": auth_response.session.access_token,
                "refresh_token": auth_response.session.refresh_token,
            }
            
        except Exception as e:
            raise Exception(f"Signin failed: {str(e)}")
    
    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID
        
        Args:
            user_id: User UUID
            
        Returns:
            User data or None if not found
        """
        try:
            response = self.db.table("users").select("*").eq(
                "id", user_id
            ).single().execute()
            
            return response.data if response.data else None
            
        except Exception:
            return None
    
    async def update_password(
        self,
        user_id: str,
        new_password: str
    ) -> bool:
        """Update user password in Supabase Auth
        
        Args:
            user_id: User UUID
            new_password: New password
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.db.auth.admin.update_user_by_id(
                user_id,
                {"password": new_password}
            )
            return True
        except Exception:
            return False

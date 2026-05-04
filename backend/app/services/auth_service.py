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
            # Adding specific redirect URL for email verification
            auth_response = self.db.auth.sign_up(
                {
                    "email": email, 
                    "password": password,
                    "options": {
                        "email_redirect_to": "http://localhost:5173/account-verified"
                    }
                }
            )
            
            if not auth_response.user:
                raise Exception("Failed to create auth user")
            
            user_id = auth_response.user.id
            
            # Use UPSERT logic or check existence to prevent "duplicate key" error
            # This handles cases where the SQL trigger might have already created the record
            user_data = {
                "id": user_id,
                "email": email,
                "full_name": full_name,
            }
            
            # UPSERT: Insert or update if exists
            user_response = self.db.table("users").upsert(user_data).execute()
            
            if not user_response.data:
                # If upsert fails but no exception, try selecting
                user_record = await self.get_user_by_id(user_id)
                if not user_record:
                    raise Exception("Failed to create/retrieve user record")
                return user_record
            
            return user_response.data[0]
            
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
                    "role": user.get("role", "user"),
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

    async def get_or_create_google_user(
        self,
        google_user_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get or create a user from Google OAuth profile
        
        Args:
            google_user_info: User profile data from Google (id, email, name, picture)
            
        Returns:
            Dictionary with user data
        """
        try:
            email = google_user_info.get("email")
            full_name = google_user_info.get("name")
            avatar_url = google_user_info.get("picture")
            
            # 1. Search for existing user in our users table
            user_response = self.db.table("users").select("*").eq("email", email).execute()
            
            if user_response.data and len(user_response.data) > 0:
                user = user_response.data[0]
                # Sync info from Google if missing
                update_data = {}
                if not user.get("avatar_url"):
                    update_data["avatar_url"] = avatar_url
                if not user.get("full_name") or user.get("full_name") == "User":
                    update_data["full_name"] = full_name
                
                if update_data:
                    self.db.table("users").update(update_data).eq("id", user["id"]).execute()
                    user.update(update_data)
                
                return user
            
            # 2. If user doesn't exist in users table, search in Supabase Auth
            auth_users_res = self.db.auth.admin.list_users()
            existing_auth_user = next((u for u in auth_users_res if u.email == email), None)
            
            if existing_auth_user:
                # User exists in Auth, but not in our 'users' table. Create it nicely.
                new_user_data = {
                    "id": existing_auth_user.id,
                    "email": email,
                    "full_name": full_name or "User",
                    "avatar_url": avatar_url
                }
                create_res = self.db.table("users").upsert(new_user_data).execute()
                return create_res.data[0]

            # 3. Create a new user in Auth if not found (Manual flow for Google)
            # This follows your existing trigger setup
            import secrets
            import string
            random_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for i in range(20))
            
            new_auth = self.db.auth.admin.create_user({
                "email": email,
                "password": random_password,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": full_name,
                    "avatar_url": avatar_url
                }
            })
            
            if new_auth and new_auth.user:
                # The trigger handle_new_user() will likely build the users profile, 
                # but we'll return it manually to be safe.
                return {
                    "id": new_auth.user.id,
                    "email": email,
                    "full_name": full_name,
                    "avatar_url": avatar_url
                }
                
            raise Exception(f"Failed to create Auth user for {email}")
            
        except Exception as e:
            raise Exception(f"Google OAuth user integration failed: {str(e)}")

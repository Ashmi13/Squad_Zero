from pymongo import MongoClient
from pymongo.errors import PyMongoError
from app.core.config import settings
from datetime import datetime
from app.core.security import pwd_context

# In-memory fallback for local testing
fake_users_db = {
    "test@example.com": {
        "id": "user-123",
        "email": "test@example.com",
        "full_name": "Test User",
        "hashed_password": pwd_context.hash("password123"),
        "created_at": datetime.now(),
        "failed_attempts": 0,
        "lockout_until": None,
        "refresh_token_hash": None,
        "provider": "local"
    }
}

use_mongo = settings.DATABASE_URL.strip() != ""
mongo_client = None
users_collection = None

if use_mongo:
    try:
        mongo_client = MongoClient(settings.DATABASE_URL)
        users_collection = mongo_client[settings.DATABASE_NAME]["users"]
        users_collection.create_index("email", unique=True)
    except PyMongoError:
        use_mongo = False

def get_user(email: str):
    """Get user from database"""
    if use_mongo and users_collection is not None:
        return users_collection.find_one({"email": email})
    return fake_users_db.get(email)

def create_user(user_data: dict):
    """Create user in database"""
    if use_mongo and users_collection is not None:
        users_collection.insert_one(user_data)
        return user_data
    fake_users_db[user_data["email"]] = user_data
    return user_data

def update_user(email: str, updates: dict):
    """Update user record"""
    if use_mongo and users_collection is not None:
        users_collection.update_one({"email": email}, {"$set": updates})
        return
    if email in fake_users_db:
        fake_users_db[email].update(updates)

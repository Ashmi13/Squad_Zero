"""Test configuration and fixtures"""
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    """Create a test client"""
    return TestClient(app)


@pytest.fixture
def test_user_data():
    """Test user for signup"""
    return {
        "email": "test@example.com",
        "password": "TestPassword123",
        "full_name": "Test User",
    }


@pytest.fixture
def admin_user_data():
    """Admin test user"""
    return {
        "email": "admin@university.com",
        "password": "AdminPassword123",
        "full_name": "Admin User",
    }

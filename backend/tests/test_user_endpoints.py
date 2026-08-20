from fastapi.testclient import TestClient

def test_get_current_user_profile_unauthenticated(client: TestClient):
    """Test that GET /api/v1/users/me returns 401 when no credentials are provided"""
    response = client.get("/api/v1/users/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"

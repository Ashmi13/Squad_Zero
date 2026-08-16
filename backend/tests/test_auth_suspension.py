import asyncio
from unittest.mock import Mock

import pytest

from app.services.auth_service import AuthService


def test_signin_rejects_suspended_user():
    db = Mock()
    db.auth.sign_in_with_password.return_value = Mock(
        user=Mock(id="user-123", email="suspended@example.com"),
        session=Mock(access_token="acc", refresh_token="ref"),
    )
    db.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "id": "user-123",
        "email": "suspended@example.com",
        "full_name": "Suspended User",
        "is_suspended": True,
        "role": "user",
    }

    service = AuthService(db)

    with pytest.raises(Exception, match="suspended"):
        asyncio.run(service.signin("suspended@example.com", "secret123"))

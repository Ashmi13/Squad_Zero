"""PayHere checkout preparation."""
import hashlib
import hmac
import re
import uuid
from decimal import Decimal
from typing import Any, Dict, Mapping, Optional
from urllib.parse import urljoin

from app.core.config import settings


PAYHERE_SANDBOX_URL = "https://sandbox.payhere.lk/pay/checkout"
PAYHERE_PRODUCTION_URL = "https://www.payhere.lk/pay/checkout"
PRO_AMOUNT = Decimal("600.00")
PRO_CURRENCY = "LKR"
PRO_STORAGE_LIMIT_BYTES = 5368709120
PAYHERE_SUCCESS_STATUS = "2"


def _format_amount(amount: Decimal) -> str:
    return f"{amount:.2f}"


def _merchant_secret_hash() -> str:
    secret_hash = hashlib.md5(settings.payhere_merchant_secret.encode("utf-8")).hexdigest().upper()
    return secret_hash


def _checkout_hash(merchant_id: str, order_id: str, amount: str, currency: str) -> str:
    secret_hash = _merchant_secret_hash()
    payload = f"{merchant_id}{order_id}{amount}{currency}{secret_hash}"
    return hashlib.md5(payload.encode("utf-8")).hexdigest().upper()


def _notification_hash(
    merchant_id: str,
    order_id: str,
    amount: str,
    currency: str,
    status_code: str,
) -> str:
    payload = f"{merchant_id}{order_id}{amount}{currency}{status_code}{_merchant_secret_hash()}"
    return hashlib.md5(payload.encode("utf-8")).hexdigest().upper()


def build_pro_order_id(user_id: str) -> str:
    """Create a PayHere order ID that can be resolved from a notification."""
    return f"PRO-{user_id}-{uuid.uuid4().hex[:8].upper()}"


def user_id_from_order_id(order_id: str) -> Optional[str]:
    match = re.fullmatch(
        r"PRO-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})-[0-9A-F]{8}",
        order_id,
    )
    return match.group(1) if match else None


def verify_notification(notification: Mapping[str, str]) -> str:
    """Verify PayHere notification fields and return the normalized status code."""
    required_fields = ("merchant_id", "order_id", "payhere_amount", "payhere_currency", "status_code")
    missing_fields = [field for field in required_fields if not notification.get(field)]
    if missing_fields:
        raise ValueError(f"Missing PayHere notification fields: {', '.join(missing_fields)}")

    merchant_id = notification["merchant_id"]
    order_id = notification["order_id"]
    amount = notification["payhere_amount"]
    currency = notification["payhere_currency"]
    status_code = notification["status_code"]
    received_signature = (notification.get("md5sig") or notification.get("signature") or "").upper()

    if merchant_id != settings.payhere_merchant_id:
        raise ValueError("Invalid PayHere merchant ID")
    if not received_signature:
        raise ValueError("Missing PayHere notification signature")

    try:
        if Decimal(amount).quantize(Decimal("0.01")) != PRO_AMOUNT:
            raise ValueError("Invalid PayHere payment amount")
    except Exception as exc:
        if isinstance(exc, ValueError) and str(exc) == "Invalid PayHere payment amount":
            raise
        raise ValueError("Invalid PayHere payment amount") from exc

    if currency != PRO_CURRENCY:
        raise ValueError("Invalid PayHere payment currency")

    expected_signature = _notification_hash(merchant_id, order_id, amount, currency, status_code)
    if not hmac.compare_digest(received_signature, expected_signature):
        raise ValueError("Invalid PayHere notification signature")

    return status_code


def prepare_pro_checkout(user: Dict[str, Any], order_id: str) -> Dict[str, Any]:
    """Build a PayHere checkout without changing the user's plan."""
    if not settings.payhere_merchant_id or not settings.payhere_merchant_secret:
        raise RuntimeError("PayHere credentials are not configured")

    amount = _format_amount(PRO_AMOUNT)
    currency = PRO_CURRENCY
    backend_url = settings.backend_url.rstrip("/") + "/"
    frontend_url = settings.frontend_url.rstrip("/") + "/"
    full_name = (user.get("full_name") or "").strip().split(maxsplit=1)
    first_name = full_name[0] if full_name else "NeuraNote"
    last_name = full_name[1] if len(full_name) > 1 else "User"

    fields = {
        "merchant_id": settings.payhere_merchant_id,
        "return_url": urljoin(frontend_url, "payment/success"),
        "cancel_url": urljoin(frontend_url, "payment/cancel"),
        "notify_url": urljoin(backend_url, "api/v1/payments/payhere/notify"),
        "order_id": order_id,
        "items": "NeuraNote Pro Upgrade",
        "currency": currency,
        "amount": amount,
        "first_name": first_name,
        "last_name": last_name,
        "email": user.get("email", ""),
        "address": user.get("address") or "Not provided",
        "city": user.get("city") or "Not provided",
        "country": user.get("country") or "Sri Lanka",
    }
    fields["hash"] = _checkout_hash(settings.payhere_merchant_id, order_id, amount, currency)
    return {
        "checkout_url": PAYHERE_SANDBOX_URL if settings.payhere_sandbox else PAYHERE_PRODUCTION_URL,
        "fields": fields,
    }
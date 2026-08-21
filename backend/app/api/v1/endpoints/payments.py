"""Payment initiation and PayHere notification endpoints."""
import logging
from calendar import monthrange
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request
from supabase import Client

from app.api.deps import get_current_user_id, get_supabase_service_client
from app.services.payhere_service import (
    PAYHERE_SUCCESS_STATUS,
    PRO_CURRENCY,
    PRO_AMOUNT,
    PRO_STORAGE_LIMIT_BYTES,
    build_pro_order_id,
    prepare_pro_checkout,
    user_id_from_order_id,
    verify_notification,
)


router = APIRouter(prefix="/payments", tags=["payments"])
logger = logging.getLogger(__name__)


def _get_active_pro_subscription(supabase_client: Client, user_id: str, now: datetime):
    subscription_response = (
        supabase_client.table("subscriptions")
        .select("id,plan_id,expires_at")
        .eq("user_id", user_id)
        .eq("status", "active")
        .lte("starts_at", now.isoformat())
        .gt("expires_at", now.isoformat())
        .order("expires_at", desc=True)
        .limit(1)
        .execute()
    )
    subscription = (subscription_response.data or [None])[0]
    if not subscription or not subscription.get("plan_id"):
        return None

    plan_response = (
        supabase_client.table("plans")
        .select("code")
        .eq("id", subscription["plan_id"])
        .eq("code", "pro")
        .limit(1)
        .execute()
    )
    return subscription if plan_response.data else None


@router.post("/payhere/checkout")
async def create_payhere_checkout(
    user_id: str = Depends(get_current_user_id),
    supabase_client: Client = Depends(get_supabase_service_client),
) -> Dict[str, Any]:
    """Prepare the PayHere Pro checkout fields for the current user."""
    try:
        now = datetime.now(timezone.utc)
        active_subscription = _get_active_pro_subscription(supabase_client, user_id, now)
        if active_subscription:
            expires_at = active_subscription.get("expires_at")
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "active_pro_subscription",
                    "message": "You already have an active Pro account.",
                    "expires_at": expires_at,
                },
            )

        response = (
            supabase_client.table("users")
            .select("email,full_name")
            .eq("id", user_id)
            .single()
            .execute()
        )
        user = response.data or {}
        if not user.get("email"):
            raise HTTPException(status_code=404, detail="User profile not found")
        return prepare_pro_checkout(user, build_pro_order_id(user_id))
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unable to prepare PayHere checkout") from exc


def _add_one_month(value: datetime) -> datetime:
    month = value.month % 12 + 1
    year = value.year + (value.month // 12)
    day = min(value.day, monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


@router.post("/payhere/notify")
async def receive_payhere_notification(
    request: Request,
    supabase_client: Client = Depends(get_supabase_service_client),
) -> Dict[str, str]:
    """Verify a PayHere notification and activate the existing Pro plan."""
    form = await request.form()
    notification = {key: str(value) for key, value in form.items()}
    logger.info(
        "PayHere notification received order_id=%s status_code=%s",
        notification.get("order_id", "unknown"),
        notification.get("status_code", "unknown"),
    )

    try:
        status_code = verify_notification(notification)
    except ValueError as exc:
        logger.warning(
            "PayHere notification rejected order_id=%s reason=%s",
            notification.get("order_id", "unknown"),
            str(exc),
        )
        raise HTTPException(status_code=400, detail="Invalid PayHere notification") from exc

    order_id = notification["order_id"]
    if status_code != PAYHERE_SUCCESS_STATUS:
        logger.info("PayHere payment failed order_id=%s status_code=%s", order_id, status_code)
        return {"status": "payment_failed"}

    try:
        payment_reference = order_id
        duplicate = (
            supabase_client.table("subscriptions")
            .select("id")
            .eq("provider_reference", payment_reference)
            .limit(1)
            .execute()
        )
        if duplicate.data:
            logger.info("Duplicate PayHere notification order_id=%s", order_id)
            return {"status": "already_processed"}

        user_id = user_id_from_order_id(order_id)
        if not user_id:
            raise ValueError("PayHere order is not associated with a user")

        user_response = (
            supabase_client.table("users")
            .select("id")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        if not user_response.data:
            raise ValueError("PayHere order user was not found")

        plan_response = (
            supabase_client.table("plans")
            .select("id,code,storage_limit_bytes,price,currency,active")
            .eq("code", "pro")
            .eq("active", True)
            .limit(1)
            .execute()
        )
        plan = (plan_response.data or [None])[0]
        if not plan or plan.get("code") != "pro":
            raise ValueError("Active Pro plan was not found")
        if int(plan.get("storage_limit_bytes") or 0) != PRO_STORAGE_LIMIT_BYTES:
            raise ValueError("Pro plan storage limit is invalid")
        if Decimal(str(plan.get("price"))).quantize(Decimal("0.01")) != PRO_AMOUNT:
            raise ValueError("Pro plan price is invalid")
        if plan.get("currency") != PRO_CURRENCY:
            raise ValueError("Pro plan currency is invalid")

        now = datetime.now(timezone.utc)
        active_subscription = _get_active_pro_subscription(supabase_client, user_id, now)
        if active_subscription:
            logger.info("PayHere payment ignored for active Pro user order_id=%s", order_id)
            return {"status": "already_active"}

        subscription_payload = {
            "user_id": user_id,
            "plan_id": plan["id"],
            "status": "active",
            "starts_at": now.isoformat(),
            "expires_at": _add_one_month(now).isoformat(),
            "provider": "payhere",
            "provider_reference": order_id,
        }
        existing_subscription = (
            supabase_client.table("subscriptions")
            .select("id")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        logger.info("PayHere subscription payload order_id=%s payload=%s", order_id, subscription_payload)
        try:
            if existing_subscription.data:
                subscription_id = existing_subscription.data[0]["id"]
                logger.info(
                    "PayHere subscription write branch=update order_id=%s subscription_id=%s",
                    order_id,
                    subscription_id,
                )
                write_response = (
                    supabase_client.table("subscriptions")
                    .update(subscription_payload)
                    .eq("id", subscription_id)
                    .execute()
                )
            else:
                logger.info("PayHere subscription write branch=insert order_id=%s", order_id)
                write_response = (
                    supabase_client.table("subscriptions")
                    .insert(subscription_payload)
                    .execute()
                )

            logger.info(
                "PayHere subscription write response order_id=%s response=%r data=%s error=%s",
                order_id,
                write_response,
                getattr(write_response, "data", None),
                getattr(write_response, "error", None),
            )
        except Exception as exc:
            # The unique provider/reference index makes concurrent callbacks safe.
            if "duplicate key" in str(exc).lower() or "unique constraint" in str(exc).lower():
                logger.info("Duplicate PayHere notification order_id=%s", order_id)
                return {"status": "already_processed"}
            raise

        logger.info("PayHere payment successful and Pro activated order_id=%s user_id=%s", order_id, user_id)
        return {"status": "activated"}
    except ValueError as exc:
        logger.error("PayHere activation rejected order_id=%s reason=%s", order_id, str(exc))
        raise HTTPException(status_code=400, detail="Unable to activate PayHere subscription") from exc
    except Exception as exc:
        logger.exception("PayHere activation failed order_id=%s", order_id)
        raise HTTPException(status_code=500, detail="Unable to process PayHere notification") from exc
from fastapi import APIRouter, Depends
from supabase import Client

from app.api.deps import get_current_user_id, get_supabase_service_client

router = APIRouter(tags=["notifications"])


@router.get("/admin-alerts")
async def get_admin_alerts(
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service_client),
):
    """Return admin alerts for the current user.

    The query is best-effort to remain compatible with evolving schemas.
    If the expected columns are unavailable, it gracefully returns an empty list.
    """
    try:
        response = (
            supabase.table("notifications")
            .select("id,message,sent_at,is_read")
            .eq("user_id", user_id)
            .order("sent_at", desc=True)
            .limit(50)
            .execute()
        )

        rows = response.data or []
        alerts = [
            {
                "id": row.get("id"),
                "title": "Admin Alert",
                "message": row.get("message") or "",
                "sent_at": row.get("sent_at"),
                "is_read": bool(row.get("is_read", False)),
            }
            for row in rows
        ]
        return {"alerts": alerts}
    except Exception:
        return {"alerts": []}

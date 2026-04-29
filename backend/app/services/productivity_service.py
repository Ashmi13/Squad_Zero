"""Productivity service for Pomodoro sessions and streak calculations."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set

from fastapi import HTTPException
from supabase import Client


class ProductivityService:
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self._has_user_id: Optional[bool] = None
        self._has_focus_duration: Optional[bool] = None
        self._has_completed_at: Optional[bool] = None
        self._has_date: Optional[bool] = None
        self._has_created_at: Optional[bool] = None

    def _column_exists(self, table: str, column: str) -> bool:
        try:
            self.supabase.table(table).select(f"id,{column}").limit(1).execute()
            return True
        except Exception:
            return False

    def _detect_columns(self) -> None:
        if self._has_user_id is not None:
            return

        self._has_user_id = self._column_exists("focus_sessions", "user_id")
        self._has_focus_duration = self._column_exists("focus_sessions", "focus_duration")
        self._has_completed_at = self._column_exists("focus_sessions", "completed_at")
        self._has_date = self._column_exists("focus_sessions", "date")
        self._has_created_at = self._column_exists("focus_sessions", "created_at")

    @staticmethod
    def _parse_timestamp(value: Any) -> Optional[datetime]:
        if not value:
            return None
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except Exception:
            return None

    def _session_day(self, row: Dict[str, Any]) -> Optional[datetime.date]:
        for key in ("completed_at", "created_at"):
            parsed = self._parse_timestamp(row.get(key))
            if parsed:
                return parsed.astimezone().date()
        date_value = row.get("date")
        if date_value:
            try:
                return datetime.fromisoformat(str(date_value)).date()
            except Exception:
                return None
        return None

    def log_focus_session(
        self,
        user_id: str,
        focus_duration: int,
        completed_at: Optional[str] = None,
        session_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        self._detect_columns()

        if focus_duration <= 0:
            raise HTTPException(status_code=400, detail="focus_duration must be greater than zero")

        payload: Dict[str, Any] = {}
        if self._has_user_id:
            payload["user_id"] = user_id
        if self._has_focus_duration:
            payload["focus_duration"] = focus_duration
        if self._has_completed_at:
            payload["completed_at"] = completed_at or datetime.now(timezone.utc).isoformat()
        if self._has_date:
            if session_date:
                payload["date"] = session_date
            else:
                payload["date"] = datetime.now(timezone.utc).date().isoformat()
        if self._has_created_at and "completed_at" not in payload:
            payload["completed_at"] = datetime.now(timezone.utc).isoformat()

        if not payload:
            raise HTTPException(status_code=500, detail="focus_sessions table is missing the expected columns")

        try:
            saved = self.supabase.table("focus_sessions").insert(payload).execute()
            if not saved.data:
                raise HTTPException(status_code=500, detail="Failed to save focus session")
            return saved.data[0]
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to save focus session: {exc}") from exc

    def get_dashboard(self, user_id: str) -> Dict[str, Any]:
        self._detect_columns()

        query = self.supabase.table("focus_sessions").select("*")
        if self._has_user_id:
            query = query.eq("user_id", user_id)

        try:
            rows = query.execute().data or []
        except Exception as exc:
            return {
                "today_minutes": 0,
                "yesterday_minutes": 0,
                "week_minutes": 0,
                "current_streak_days": 0,
                "best_streak_days": 0,
                "motivational_message": "Focus insights will appear after your first completed session.",
                "table_missing": True,
            }

        if not rows:
            return {
                "today_minutes": 0,
                "yesterday_minutes": 0,
                "week_minutes": 0,
                "current_streak_days": 0,
                "best_streak_days": 0,
                "motivational_message": "Focus insights will appear after your first completed session.",
            }

        today = datetime.now().astimezone().date()
        yesterday = today - timedelta(days=1)
        week_start = today - timedelta(days=today.weekday())

        unique_days: Set[datetime.date] = set()
        totals = {
            "today_minutes": 0,
            "yesterday_minutes": 0,
            "week_minutes": 0,
        }

        for row in rows:
            day = self._session_day(row)
            if not day:
                continue

            unique_days.add(day)
            duration = int(row.get("focus_duration") or 0)
            if day == today:
                totals["today_minutes"] += duration
            if day == yesterday:
                totals["yesterday_minutes"] += duration
            if day >= week_start:
                totals["week_minutes"] += duration

        if unique_days:
            best_streak = self._calculate_best_streak(unique_days)
            if today in unique_days:
                current_streak = self._calculate_current_streak(unique_days, today)
            elif yesterday in unique_days:
                current_streak = self._calculate_current_streak(unique_days, yesterday)
            else:
                current_streak = 0
        else:
            best_streak = 0
            current_streak = 0

        motivational_message = self._build_message(totals, current_streak)
        return {
            **totals,
            "current_streak_days": current_streak,
            "best_streak_days": best_streak,
            "motivational_message": motivational_message,
        }

    @staticmethod
    def _calculate_best_streak(days: Set[datetime.date]) -> int:
        if not days:
            return 0

        ordered = sorted(days)
        best = 1
        streak = 1
        for previous, current in zip(ordered, ordered[1:]):
            if (current - previous).days == 1:
                streak += 1
            else:
                best = max(best, streak)
                streak = 1
        return max(best, streak)

    @staticmethod
    def _calculate_current_streak(days: Set[datetime.date], anchor_day: datetime.date) -> int:
        streak = 0
        current = anchor_day
        while current in days:
            streak += 1
            current -= timedelta(days=1)
        return streak

    @staticmethod
    def _build_message(totals: Dict[str, int], current_streak: int) -> str:
        if totals["today_minutes"] > totals["yesterday_minutes"] and totals["today_minutes"] > 0:
            return "Congratulations! You focused more today than yesterday."
        if current_streak >= 5:
            return "Great consistency this week. Keep your streak alive."
        if totals["week_minutes"] >= 300:
            return "You are building a strong study habit."
        return "Small, consistent sessions build big results."
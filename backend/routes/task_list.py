# backend/models/task_list.py  (renamed from tast_list.py — typo fix)
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from database import Base


class TaskList(Base):
    __tablename__ = "task_lists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    icon = Column(String(50), default="list")
    color = Column(String(7), default="#6366f1")
    order_number = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

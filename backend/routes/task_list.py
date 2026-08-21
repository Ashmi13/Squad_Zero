from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.task import Task

router = APIRouter(prefix="/task-lists", tags=["Task Lists"])

@router.get("/")
async def get_task_lists(db: Session = Depends(get_db)):
    """Get all task lists"""
    task_lists = db.query(TaskList).all()
    return task_lists

@router.get("/{task_list_id}")
async def get_task_list(task_list_id: int, db: Session = Depends(get_db)):
    """Get a specific task list"""
    task_list = db.query(TaskList).filter(TaskList.id == task_list_id).first()
    if not task_list:
        raise HTTPException(status_code=404, detail="Task list not found")
    return task_list

@router.post("/")
async def create_task_list(name: str, db: Session = Depends(get_db)):
    """Create a new task list"""
    new_task_list = TaskList(name=name)
    db.add(new_task_list)
    db.commit()
    db.refresh(new_task_list)
    return new_task_list

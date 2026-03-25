from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from middleware.auth import get_current_user

router = APIRouter()


@router.get("/")
def get_tasks(db: Session = Depends(get_db), user_id: int = Depends(get_current_user)):
    return {"message": "Tasks route working!", "user_id": user_id}

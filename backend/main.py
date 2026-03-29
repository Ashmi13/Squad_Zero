# backend/main.py
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError
from database import engine, Base
from dotenv import load_dotenv

from middleware.error_handler import (
    validation_exception_handler,
    database_exception_handler,
    general_exception_handler
)

load_dotenv()

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="NeuraNote API",
    version="1.0.0",
    debug=os.getenv("DEBUG", "False") == "True"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(SQLAlchemyError, database_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Routers
from routes.health_routes import router as health_router
from routes.quiz_routes import router as quiz_router
from routes.history_routes import router as history_router
# from routes.auth_routes import router as auth_router      # M1 - uncomment when ready
# from routes.notes_routes import router as notes_router    # M2 - uncomment when ready
# from routes.tasks_routes import router as tasks_router    # M5 - uncomment when ready

app.include_router(health_router)
app.include_router(quiz_router,    prefix="/api/quiz",    tags=["Quiz"])
app.include_router(history_router, prefix="/api/history", tags=["History"])

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
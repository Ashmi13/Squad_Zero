# backend/main.py
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from database import engine, Base
from config.config import settings
from middleware.cors_middleware import setup_cors
from middleware.error_handler import (
    validation_exception_handler,
    database_exception_handler,
    general_exception_handler
)
from routes.quiz_routes import router as quiz_router
from routes.history_routes import router as history_router
from routes.health_routes import router as health_router

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG
)

# Setup middleware
setup_cors(app)

# Setup exception handlers
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(SQLAlchemyError, database_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Include routers
app.include_router(health_router)
app.include_router(quiz_router)
app.include_router(history_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

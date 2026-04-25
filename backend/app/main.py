"""FastAPI application factory and CORS configuration"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from app.core.config import settings
from app.api.v1.router import router as v1_router


def create_app() -> FastAPI:
    """Create and configure FastAPI application"""
    
    app = FastAPI(
        title=settings.app_name,
        description="SquadZero Backend API with Supabase",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )
    
    # Add CORS middleware BEFORE other routes
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=settings.allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Total-Count", "X-Page", "X-Page-Size"],
    )
    
    # Add trusted host middleware
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["localhost", "127.0.0.1"]
    )
    
    # Include Core Team Routers
    app.include_router(v1_router)

    # Include Member 3 Router (Smart Note Management)
    from m3_structurednotes.router import router as m3_router
    app.include_router(m3_router, prefix="/api/m3")
    
    # Mount folders for serving files
    import os
    from fastapi.staticfiles import StaticFiles
    os.makedirs("documents", exist_ok=True)
    os.makedirs("images", exist_ok=True)
    app.mount("/documents", StaticFiles(directory="documents"), name="documents")
    app.mount("/images", StaticFiles(directory="images"), name="images")
    
    # Root health endpoint
    @app.get("/")
    async def root():
        """Root endpoint"""
        return {
            "message": f"Welcome to {settings.app_name}",
            "version": "1.0.0",
            "environment": settings.environment,
            "docs": "/docs",
            "redoc": "/redoc",
        }
    
    # Lifespan events (optional)
    @app.on_event("startup")
    async def startup_event():
        """Run on application startup"""
        print(f"[*] Starting {settings.app_name}")
        print(f"Environment: {settings.environment}")
    
    @app.on_event("shutdown")
    async def shutdown_event():
        """Run on application shutdown"""
        print(f"[X] Shutting down {settings.app_name}")
    
    return app


# Create the FastAPI app instance
app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
    )

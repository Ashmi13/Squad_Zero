
﻿"""
FastAPI Backend - Authentication Server
Main entry point delegator
"""
import uvicorn
import os
import sys

# Add the current directory to sys.path so "app" can be found
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="NeuraNote - Member 5 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Member 5 - Tasks & Calendar API is running!"}

@app.get("/health")
def health():
    return {"status": "ok"}


# FastAPI Backend Startup Script
# Run this script to start the FastAPI server

Write-Host "🚀 Starting FastAPI Backend..." -ForegroundColor Cyan
Write-Host ""

# Check if virtual environment exists
if (-not (Test-Path "venv")) {
    Write-Host "⚠️  Virtual environment not found. Creating one..." -ForegroundColor Yellow
    python -m venv venv
    Write-Host "✅ Virtual environment created!" -ForegroundColor Green
}

# Activate virtual environment
Write-Host "📦 Activating virtual environment..." -ForegroundColor Cyan
.\venv\Scripts\Activate.ps1

# Check if requirements are installed
Write-Host "📦 Checking dependencies..." -ForegroundColor Cyan
pip list | Select-String "fastapi" > $null
if (-not $?) {
    Write-Host "📥 Installing dependencies..." -ForegroundColor Yellow
    pip install -r requirements.txt
    Write-Host "✅ Dependencies installed!" -ForegroundColor Green
}

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  .env file not found!" -ForegroundColor Yellow
    Write-Host "📝 Creating .env from .env.example..." -ForegroundColor Cyan
    Copy-Item .env.example .env
    Write-Host "⚠️  Please edit .env and set your SECRET_KEY!" -ForegroundColor Red
    Write-Host '   Generate one with: python -c "import secrets; print(secrets.token_urlsafe(32))"' -ForegroundColor Yellow
    Write-Host ""
    pause
}

# Start FastAPI server
Write-Host ""
Write-Host "🌐 Starting FastAPI server on http://localhost:8000" -ForegroundColor Green
Write-Host "📖 API Documentation: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

python main.py

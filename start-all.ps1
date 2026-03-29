# Complete Startup Script - Runs Both Backend and Frontend
# Run this from the project root directory

Write-Host "======================================" -ForegroundColor Green
Write-Host "SquadZero - Full Stack Startup" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

# Check if root .env exists
if (-not (Test-Path ".env")) {
    Write-Host "NOTE: .env file not found!" -ForegroundColor Yellow
    Write-Host "Creating .env from .env.example..." -ForegroundColor Cyan
    Copy-Item .env.example .env
    Write-Host "SUCCESS: .env created!" -ForegroundColor Green
    Write-Host ""
    Write-Host "IMPORTANT: Please update .env file:" -ForegroundColor Red
    Write-Host "1. Set a strong SECRET_KEY" -ForegroundColor Yellow
    Write-Host "2. Review other settings" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Generate SECRET_KEY with:" -ForegroundColor Cyan
    Write-Host "python -c 'import secrets; print(secrets.token_urlsafe(32))'" -ForegroundColor White
    Write-Host ""
    Read-Host "Press Enter to continue after updating .env"
}

# Start Backend in new window
Write-Host "Starting FastAPI Backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-File", "start-backend.ps1"

# Wait a moment for backend to start
Start-Sleep -Seconds 3

# Start Frontend in new window  
Write-Host "Starting React Frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-File", "start-frontend.ps1"

Write-Host ""
Write-Host "Both servers are starting!" -ForegroundColor Green
Write-Host ""
Write-Host "Access Points:" -ForegroundColor Yellow
Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend:   http://localhost:8000" -ForegroundColor Cyan
Write-Host "  API Docs:  http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test Account:" -ForegroundColor Yellow
Write-Host "  Email:    test@example.com" -ForegroundColor White
Write-Host "  Password: password123" -ForegroundColor White
Write-Host ""
Write-Host "Project Structure:" -ForegroundColor Yellow
Write-Host "  frontend/  - React application" -ForegroundColor White
Write-Host "  backend/   - FastAPI server" -ForegroundColor White
Write-Host "  .env       - Configuration file" -ForegroundColor White
Write-Host ""

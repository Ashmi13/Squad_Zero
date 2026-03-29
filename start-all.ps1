# Complete Startup Script - Runs Both Backend and Frontend
# Run this from the project root directory

Write-Host "======================================" -ForegroundColor Green
Write-Host "SquadZero - Full Stack Startup" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

# Check backend env file
if (-not (Test-Path "backend/.env")) {
    Write-Host "NOTE: backend/.env file not found!" -ForegroundColor Yellow
    if (Test-Path "backend/.env.example") {
        Write-Host "Creating backend/.env from backend/.env.example..." -ForegroundColor Cyan
        Copy-Item "backend/.env.example" "backend/.env"
        Write-Host "SUCCESS: backend/.env created!" -ForegroundColor Green
    }
}

# Check frontend env file
if (-not (Test-Path "frontend/.env")) {
    Write-Host "NOTE: frontend/.env file not found!" -ForegroundColor Yellow
    if (Test-Path "frontend/.env.example") {
        Write-Host "Creating frontend/.env from frontend/.env.example..." -ForegroundColor Cyan
        Copy-Item "frontend/.env.example" "frontend/.env"
        Write-Host "SUCCESS: frontend/.env created!" -ForegroundColor Green
    }
}

if ((-not (Test-Path "backend/.env")) -or (-not (Test-Path "frontend/.env"))) {
    Write-Host ""
    Write-Host "IMPORTANT: Configure missing env files before continuing." -ForegroundColor Red
    Read-Host "Press Enter to continue after updating env files"
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
Write-Host "  backend/.env   - Backend configuration" -ForegroundColor White
Write-Host "  frontend/.env  - Frontend configuration" -ForegroundColor White
Write-Host ""

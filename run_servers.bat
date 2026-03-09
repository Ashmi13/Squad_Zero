@echo off
echo Starting NeuraNote Backend...
cd backend
start cmd /k "python -m uvicorn main:app --reload"

echo Starting NeuraNote Frontend...
cd ../frontend
start cmd /k "npm run dev"

echo.
echo Servers are starting in separate windows.
echo Please wait a few seconds, then visit:
echo Frontend: http://localhost:5173
echo Backend Documentation: http://127.0.0.1:8000/docs
echo.
pause

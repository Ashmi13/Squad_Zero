# 🚀 Quick Start Guide

Get up and running in 5 minutes!

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.8+
- **PowerShell** (Windows)

## 1. Setup Environment

```powershell
# Copy environment template
Copy-Item .env.example .env

# Generate a secure SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Edit .env and paste the SECRET_KEY
# The .env file is in the project root and used by both frontend and backend
```

## 2. Start Both Services

**Automatic (Recommended):**

```powershell
.\start-all.ps1
```

This will:

- Start FastAPI backend in one window
- Start React frontend in another window
- Set up .env file if missing
- Install dependencies if needed

**Manual:**

```powershell
# Terminal 1 - Backend
.\start-backend.ps1

# Terminal 2 - Frontend
.\start-frontend.ps1
```

## 3. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## 4. Test Login

Use the pre-configured test account:

- **Email**: `test@example.com`
- **Password**: `password123`

## 📁 Project Structure

```
project-root/
├── frontend/          # React app (Vite + Tailwind)
├── backend/           # FastAPI server
├── .env               # Single config file (both apps)
├── start-all.ps1      # Start everything
├── start-frontend.ps1 # Start frontend only
└── start-backend.ps1  # Start backend only
```

## 🔑 Key Environment Variables

**Backend (.env in root):**

```bash
SECRET_KEY=your-generated-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

**Frontend (.env in root):**

```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_APP_NAME="SquadZero"
```

## 🐛 Troubleshooting

### "Port already in use"

Kill processes using ports 3000 or 8000:

```powershell
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### "Module not found"

**Backend:**

```powershell
cd backend
pip install -r requirements.txt --upgrade
```

**Frontend:**

```powershell
npm install
```

### Scripts not running

Enable PowerShell scripts:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 📚 Full Documentation

- **Complete Guide**: [README_FULLSTACK.md](README_FULLSTACK.md)
- **Backend Docs**: [backend/README.md](backend/README.md)
- **Project Structure**: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)

---

**Happy Coding! 🚀**

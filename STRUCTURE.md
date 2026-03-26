# Project Structure

## Overview

This is a full-stack authentication application with a clean separation between frontend and backend.

```
project-root/
├── frontend/                    # React Frontend Application
│   ├── src/
│   │   ├── components/
│   │   │   └── auth/
│   │   │       ├── LoginCard.jsx       # Main login form
│   │   │       ├── OAuthButton.jsx     # Social login buttons
│   │   │       ├── InputField.jsx      # Form input component
│   │   │       ├── Button.jsx          # Reusable button
│   │   │       └── LoadingSpinner.jsx  # Loading indicator
│   │   ├── hooks/
│   │   │   └── useAuth.js              # Authentication hook
│   │   ├── lib/
│   │   │   └── axios.js                # Configured axios instance
│   │   ├── utils/
│   │   │   └── tokenStorage.js         # JWT token management
│   │   ├── config/
│   │   │   └── env.js                  # Environment config
│   │   ├── App.jsx                     # Root component
│   │   ├── main.jsx                    # React entry point
│   │   └── index.css                   # Global styles
│   ├── public/
│   │   └── Logo and images
│   ├── package.json                    # Frontend dependencies
│   ├── vite.config.js                  # Vite configuration
│   ├── tailwind.config.js              # Tailwind CSS config
│   ├── postcss.config.js               # PostCSS config
│   ├── .eslintrc.cjs                   # ESLint rules
│   ├── index.html                      # HTML template
│   └── .prettierrc                     # Code formatting
│
├── backend/                     # FastAPI Backend Application
│   ├── main.py                         # FastAPI app entry point
│   ├── requirements.txt                # Python dependencies
│   ├── start.ps1                       # Backend startup script
│   └── README.md                       # Backend documentation
│
├── .env                         # Environment variables (SINGLE FILE!)
├── .env.example                 # Environment template
├── .gitignore                   # Git ignore rules
├── start-all.ps1                # Start both frontend & backend
├── start-frontend.ps1           # Start frontend only
├── start-backend.ps1            # Start backend only
├── README_FULLSTACK.md          # Main documentation
├── QUICKSTART.md                # Quick setup guide
├── DESIGN_SYSTEM.md             # UI design specifications
└── STRUCTURE.md                 # This file

```

## Key Design Decisions

### Single `.env` File

Both frontend and backend read from a **single `.env` file in the project root**:

- **Frontend**: Vite configured with `envDir: '../'` to read from root
  - Variables prefixed with `VITE_*` are exposed to the client
  - Example: `VITE_API_BASE_URL=http://localhost:8000`

- **Backend**: FastAPI reads from `../env` (parent directory)
  - Variables for server configuration (SECRET_KEY, DATABASE_URL, etc.)
  - OAuth credentials, SMTP settings, CORS origins

### Frontend Structure

- **Components**: Modular, reusable React components
- **Hooks**: Custom hooks for authentication logic
- **Lib**: Third-party library configurations (axios)
- **Utils**: Helper functions (token storage)
- **Config**: Application configuration

### Backend Structure

- **Single File**: `main.py` contains all routes and logic
- **For Production**: Split into:
  - `routers/` - Route endpoints
  - `services/` - Business logic
  - `models/` - Database models
  - `schemas/` - Pydantic validation schemas
  - `core/` - Configuration and security

## Technology Stack

### Frontend

- **React 18.2** - UI library
- **Vite 5.0** - Build tool
- **Tailwind CSS 3.4** - Styling
- **React Hook Form 7.49** - Form validation
- **Zod 3.22** - Schema validation
- **Axios 1.6.5** - HTTP client
- **Lucide React 0.312** - Icons

### Backend

- **FastAPI 0.109** - Web framework
- **Uvicorn** - ASGI server
- **Python-JOSE** - JWT tokens
- **Passlib** - Password hashing
- **Pydantic** - Data validation

## Development Workflow

### Start Everything

```powershell
.\start-all.ps1
```

### Start Frontend Only

```powershell
.\start-frontend.ps1
```

### Start Backend Only

```powershell
.\start-backend.ps1
```

### Manual Setup

**Frontend:**

```powershell
cd frontend
npm install
npm run dev
```

**Backend:**

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

## Environment Variables

See [.env.example](.env.example) for a comprehensive list with comments.

### Critical Backend Variables

```bash
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Critical Frontend Variables

```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_APP_NAME="SquadZero"
```

## Port Configuration

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Test Credentials

- **Email**: test@example.com
- **Password**: password123

## Next Steps

1. **Review `.env`**: Copy `.env.example` to `.env` and update:
   ```powershell
   Copy-Item .env.example .env
   ```
2. **Generate SECRET_KEY**:

   ```python
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

3. **Install Dependencies**:
   - Frontend: `cd frontend && npm install`
   - Backend: `cd backend && pip install -r requirements.txt`

4. **Start Services**: `.\start-all.ps1`

## Production Checklist

- [ ] Move from mock database to real database (PostgreSQL/MongoDB)
- [ ] Set up OAuth app credentials (Google, GitHub)
- [ ] Configure email service (SMTP)
- [ ] Enable HTTPS
- [ ] Set strong SECRET_KEY
- [ ] Configure production CORS origins
- [ ] Set up environment-specific .env files
- [ ] Add rate limiting
- [ ] Implement logging and monitoring
- [ ] Set up CI/CD pipeline

## Documentation Links

- [README_FULLSTACK.md](README_FULLSTACK.md) - Complete guide
- [QUICKSTART.md](QUICKSTART.md) - Quick setup
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) - UI specifications
- [backend/README.md](backend/README.md) - Backend details

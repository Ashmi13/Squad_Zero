# 🚀 SquadZero Authentication - React (JavaScript) + FastAPI

Complete full-stack authentication system with React frontend and FastAPI backend.

## 📁 Project Structure

```
Uni/
├── frontend/                  # React Frontend Application
│   ├── src/
│   │   ├── components/auth/  # LoginCard, OAuthButton, InputField
│   │   ├── hooks/            # useAuth.js
│   │   ├── lib/              # axios.js
│   │   ├── utils/            # tokenStorage.js
│   │   ├── config/           # env.js
│   │   ├── App.jsx           # Main component
│   │   └── main.jsx          # Entry point
│   ├── public/               # Static assets
│   ├── package.json          # Frontend dependencies
│   ├── vite.config.js        # Vite config (reads root .env)
│   └── tailwind.config.js    # Tailwind config
│
├── backend/                   # FastAPI Backend Application
│   ├── main.py               # FastAPI app (reads root .env)
│   ├── requirements.txt      # Python dependencies
│   └── README.md             # Backend docs
│
├── .env                       # Single config file (BOTH apps)
├── .env.example              # Environment template with comments
├── start-all.ps1             # Start everything
├── start-frontend.ps1        # Start frontend only
├── start-backend.ps1         # Start backend only
├── README_FULLSTACK.md       # This file
├── QUICKSTART.md             # Quick setup guide
├── STRUCTURE.md              # Detailed structure
└── DESIGN_SYSTEM.md          # UI specifications
```

## 🔑 Single .env Configuration

**Both frontend and backend read from ONE `.env` file in the project root.**

- **Frontend**: Reads `VITE_*` prefixed variables
- **Backend**: Reads server configuration variables

Example `.env`:

```bash
# Backend Configuration
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Frontend Configuration
VITE_API_BASE_URL=http://localhost:8000
VITE_APP_NAME="SquadZero"
```

## 🎯 Features

✅ **Frontend (React + JavaScript)**

- Email/Password authentication with validation (React Hook Form + Zod)
- OAuth2 integration (Google/GitHub)
- JWT token management
- Loading, error, and success states
- Responsive design with Tailwind CSS
- Password show/hide toggle

✅ **Backend (FastAPI)**

- RESTful API endpoints
- JWT authentication (access + refresh tokens)
- Password hashing with bcrypt
- Email validation
- CORS configuration
- Mock database (easily replaceable)
- OAuth endpoints (placeholders)
- Automatic API documentation

## 🚀 Quick Start

### Easiest Way: Use Startup Scripts

```powershell
# Start both frontend and backend
.\start-all.ps1

# Or start individually
.\start-frontend.ps1  # Frontend only
.\start-backend.ps1   # Backend only
```

### Manual Setup

#### Step 1: Environment Configuration

```powershell
# Copy environment template
Copy-Item .env.example .env

# Generate SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Edit .env and paste the SECRET_KEY
# This single .env file is used by both frontend and backend
```

#### Step 2: Install Backend (FastAPI)

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

Backend runs at: **http://localhost:8000**

#### Step 3: Install Frontend (React)

```powershell
# In a new terminal
cd frontend
npm install
npm run dev
```

Frontend runs at: **http://localhost:3000**

```env
VITE_API_BASE_URL=http://localhost:8000
```

**Start React dev server:**

```powershell
npm run dev
```

Frontend will run at: **http://localhost:3000**

## 🧪 Testing

### Default Test Account

The backend comes with a pre-configured test account:

- **Email**: test@example.com
- **Password**: password123

### Test the Login Flow

1. Open http://localhost:3000
2. Enter test credentials
3. Click "Sign In"
4. Check browser console for JWT token

## 📚 API Documentation

FastAPI provides automatic interactive docs:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Key Endpoints

| Method | Endpoint           | Description                      |
| ------ | ------------------ | -------------------------------- |
| POST   | `/register`        | Register new user                |
| POST   | `/login`           | Login with email/password        |
| GET    | `/auth/google`     | Google OAuth redirect            |
| GET    | `/auth/github`     | GitHub OAuth redirect            |
| POST   | `/refresh-token`   | Refresh access token             |
| GET    | `/me`              | Get current user (auth required) |
| POST   | `/forgot-password` | Request password reset           |

## 🔐 Security Features

### Backend

- **Password Hashing**: bcrypt for secure password storage
- **JWT Tokens**: Access (30 min) + Refresh (7 days) tokens
- **Token Validation**: Automatic expiry checking
- **CORS**: Configured for frontend origins
- **Input Validation**: Pydantic models

### Frontend

- **Token Storage**: localStorage (secure in HTTPS)
- **Axios Interceptors**: Auto-attach JWT to requests
- **Form Validation**: Zod schema validation
- **Error Handling**: User-friendly error messages
- **Password Toggle**: Show/hide password

## 🔄 Data Flow

```
User Input → React Form → Validation → Axios Request
                                            ↓
                                    FastAPI Endpoint
                                            ↓
                                    Auth Logic + JWT
                                            ↓
                               Response with Tokens
                                            ↓
                               Store in localStorage
                                            ↓
                            Axios Interceptor (auto-attach)
                                            ↓
                               Authenticated Requests
```

## 🛠️ Available Scripts

### Frontend

```powershell
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### Backend

```powershell
python main.py   # Start FastAPI server
uvicorn main:app --reload  # Alternative start method
```

## 📝 Next Steps

### Backend Enhancements

1. **Database Integration**
   - Replace mock database with SQLAlchemy + PostgreSQL
   - Set up Alembic for migrations

2. **OAuth Implementation**
   - Configure Google OAuth credentials
   - Configure GitHub OAuth credentials
   - Implement callback handlers

3. **Email Service**
   - Set up SMTP for password reset
   - Create email templates

4. **Security**
   - Add rate limiting
   - Implement 2FA
   - Add logging

### Frontend Enhancements

1. **Routing**
   - Add React Router for navigation
   - Create Dashboard, Profile pages
   - Protected routes

2. **State Management**
   - Add Context API or Redux
   - Persist auth state

3. **Features**
   - Password strength meter
   - Remember me checkbox
   - Social login complete flow

## 🐛 Troubleshooting

### CORS Error

- Ensure backend CORS origins include frontend URL
- Check `main.py` CORS configuration

### Module Not Found (Backend)

```powershell
pip install -r requirements.txt --upgrade
```

### Module Not Found (Frontend)

```powershell
rm -rf node_modules
npm install
```

### Port Already in Use

**Backend (port 8000):**

```powershell
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

**Frontend (port 3000):**
Edit `vite.config.js` and change port to 3001

### Token Not Working

- Check browser localStorage in DevTools
- Verify JWT token is being sent in Authorization header
- Check backend logs for errors

## 📦 Technology Stack

### Frontend

- **React 18** - UI Library
- **JavaScript (ES6+)** - Programming Language
- **Vite** - Build Tool
- **Tailwind CSS** - Styling
- **React Hook Form** - Form Management
- **Zod** - Schema Validation
- **Axios** - HTTP Client
- **Lucide React** - Icons

### Backend

- **FastAPI** - Web Framework
- **Python 3.10+** - Programming Language
- **Pydantic** - Data Validation
- **Python-JOSE** - JWT Implementation
- **Passlib** - Password Hashing
- **Uvicorn** - ASGI Server

## 🔗 Useful Links

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [React Hook Form](https://react-hook-form.com/)
- [Zod Documentation](https://zod.dev/)

## 📄 License

MIT License - Free to use in your projects!

---

## 🎯 Quick Commands Summary

**Start Everything:**

Terminal 1 (Backend):

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python main.py
```

Terminal 2 (Frontend):

```powershell
npm run dev
```

**Test Account:**

- Email: test@example.com
- Password: password123

**Access Points:**

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

**Happy Coding! 🚀**

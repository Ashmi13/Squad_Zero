
# FastAPI Backend - SquadZero Authentication

Production-ready FastAPI backend with JWT authentication.

## 🚀 Quick Start

### 1. Install Python Dependencies

```powershell
cd backend
pip install -r requirements.txt
```

Or using virtual environment (recommended):

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Configure Environment

Create `.env` file:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set your SECRET_KEY:

```env
SECRET_KEY=your-super-secret-key-minimum-32-characters
```

Generate a secure SECRET_KEY:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 3. Run Development Server

```powershell
python main.py
```

Or using uvicorn directly:

```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at: **http://localhost:8000**

## 📚 API Documentation

FastAPI provides automatic interactive API documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 🔌 API Endpoints

### Authentication

#### POST `/register`

Register a new user

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe"
}
```

**Response:**

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": "user-1",
    "email": "user@example.com",
    "full_name": "John Doe"
  }
}
```

#### POST `/login`

Login with email and password

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** Same as register

#### GET `/auth/google`

Redirect to Google OAuth

#### GET `/auth/github`

Redirect to GitHub OAuth

#### POST `/refresh-token`

Refresh access token

**Request:**

```json
{
  "refresh_token": "eyJ..."
}
```

#### GET `/me`

Get current user (requires authentication)

**Headers:**

```
Authorization: Bearer <access_token>
```

#### POST `/forgot-password`

Request password reset

**Request:**

```json
{
  "email": "user@example.com"
}
```

## 🧪 Testing the API

### Using curl:

**Register:**

```powershell
curl -X POST "http://localhost:8000/register" `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"test@example.com\",\"password\":\"password123\",\"full_name\":\"Test User\"}'
```

**Login:**

```powershell
curl -X POST "http://localhost:8000/login" `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"test@example.com\",\"password\":\"password123\"}'
```

**Get Current User:**

```powershell
curl -X GET "http://localhost:8000/me" `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Default Test Account

For development, a test account is pre-configured:

- **Email**: test@example.com
- **Password**: password123

## 🔐 Security Features

✅ **Password Hashing** - bcrypt for secure password storage
✅ **JWT Tokens** - Access and refresh token support
✅ **Token Expiration** - Automatic token expiry
✅ **CORS Protection** - Configured for frontend origins
✅ **Input Validation** - Pydantic models for request validation
✅ **Email Validation** - Valid email format checking

## 📁 Project Structure

```
backend/
├── main.py              # Main FastAPI application
├── requirements.txt     # Python dependencies
├── .env.example        # Environment variables template
├── .env                # Your environment configuration (create this)
└── README.md           # This file
```

## 🔄 Integration with React Frontend

The backend is configured to work with the React frontend on:

- http://localhost:3000 (Create React App)
- http://localhost:5173 (Vite)

Update CORS origins in `main.py` if using different ports.

## 🚀 Production Deployment

### Using Gunicorn + Uvicorn

```powershell
pip install gunicorn
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Environment Variables

Set these in production:

- `SECRET_KEY` - Strong random key (32+ characters)
- `DATABASE_URL` - Production database connection string
- `CORS_ORIGINS` - Your frontend domain

### Security Checklist

- [ ] Change SECRET_KEY
- [ ] Use HTTPS in production
- [ ] Set up proper database (PostgreSQL/MySQL)
- [ ] Configure rate limiting
- [ ] Set up proper logging
- [ ] Use environment variables for sensitive data
- [ ] Enable OAuth providers
- [ ] Configure email service for password reset

## 📝 Next Steps

1. **Database Integration**
   - Replace mock database with SQLAlchemy + PostgreSQL
   - Set up migrations with Alembic

2. **OAuth Implementation**
   - Configure Google OAuth credentials
   - Configure GitHub OAuth credentials
   - Implement callback handlers

3. **Email Service**
   - Set up SMTP for password reset emails
   - Configure email templates

4. **Enhanced Security**
   - Add rate limiting (slowapi)
   - Implement 2FA support
   - Add IP whitelist/blacklist

## 🐛 Troubleshooting

### Port already in use

```powershell
# Find process using port 8000
netstat -ano | findstr :8000

# Kill the process (replace PID)
taskkill /PID <PID> /F
```

### Module not found

```powershell
pip install -r requirements.txt --upgrade
```

### CORS errors

Check CORS configuration in `main.py` and ensure frontend URL is in `allow_origins`

## 📚 Documentation

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [JWT.io](https://jwt.io/) - JWT debugger
- [Python-JOSE](https://python-jose.readthedocs.io/)

---

**Happy Coding! 🚀**


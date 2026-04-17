# Backend Quick Start Guide

Get the FastAPI backend running in 5 minutes.

## Quick Setup

### 1. Install Python Dependencies

```powershell
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Configure Environment

```powershell
# Copy and edit the root .env file
Copy-Item ..\.env.example ..\.env
# Edit ..\.env with your Supabase and AWS credentials
```

Required values:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
SECRET_KEY=generate-with: python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 3. Initialize Database

In Supabase dashboard SQL Editor, run `backend/sql/schema.sql` to create tables.

### 4. Start Backend

```powershell
# From backend directory
python -m app.main
```

Backend runs at: `http://localhost:8000`
Docs at: `http://localhost:8000/docs`

## Testing

```powershell
# Run all tests
pytest tests -v

# Run specific test file
pytest tests/test_auth.py -v

# With coverage
pytest tests --cov=app
```

## Common Issues

**ModuleNotFoundError**: Ensure you're in backend directory and venv is activated
```powershell
cd backend
venv\Scripts\Activate.ps1
```

**Supabase connection error**: Check `.env` file has correct URLs and keys

**Import errors after editing**: Python caches modules; restart the server

## Next Steps

1. **Connect Frontend**: Update `VITE_API_BASE_URL` in frontend to `http://localhost:8000`
2. **Test Auth Flow**: Try signup/signin at `http://localhost:8000/docs`
3. **Set Up Email**: Configure email service for password reset (replace console logging)
4. **Deploy**: See [DEPLOYMENT.md](DEPLOYMENT.md) for production setup

## Endpoint Quick Reference

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/v1/auth/signup` | No | Create account |
| POST | `/api/v1/auth/signin` | No | Login |
| POST | `/api/v1/auth/logout` | No | Logout |
| GET | `/api/v1/users/me` | Yes | User profile |
| GET | `/api/v1/admin/users` | Admin | List users |
| POST | `/api/v1/uploads/presigned-url` | Yes | Get S3 upload URL |

Full docs: `http://localhost:8000/docs`

## Documentation

- [Backend README](README.md) - Full documentation
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment
- [API Docs](http://localhost:8000/docs) - Interactive Swagger UI

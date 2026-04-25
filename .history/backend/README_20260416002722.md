# SquadZero Backend API

Production-grade FastAPI backend with Supabase authentication, PostgreSQL database, HttpOnly cookie sessions, and AWS S3 file storage.

## Overview

This backend provides:
- **Modular Architecture**: Separated concerns across config, core, endpoints, schemas, and services
- **Supabase Authentication**: User auth with email/password and OAuth support
- **Session Management**: Secure HttpOnly cookies for session persistence
- **Password Reset**: Custom token-based password reset flow
- **Role-Based Access Control**: Admin dashboard with admin@university.com restriction
- **File Uploads**: AWS S3 integration with presigned URLs and metadata tracking
- **Protected Endpoints**: /me endpoint for authenticated users with module progress
- **API Documentation**: Auto-generated Swagger UI and ReDoc

## Project Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI app factory
│   ├── core/
│   │   ├── config.py          # Pydantic settings
│   │   ├── security.py        # JWT, cookies, auth utils
│   │   └── __init__.py
│   ├── db/
│   │   ├── supabase.py        # Supabase client manager
│   │   └── __init__.py
│   ├── api/
│   │   ├── deps.py            # Dependency injection
│   │   ├── v1/
│   │   │   ├── router.py      # V1 router composition
│   │   │   ├── endpoints/
│   │   │   │   ├── auth.py    # Auth endpoints
│   │   │   │   ├── user.py    # User profile endpoints
│   │   │   │   ├── admin.py   # Admin management endpoints
│   │   │   │   ├── uploads.py # File upload endpoints
│   │   │   │   └── __init__.py
│   │   │   └── __init__.py
│   │   └── __init__.py
│   ├── schemas/
│   │   ├── auth.py            # Auth schemas
│   │   ├── user.py            # User schemas
│   │   ├── admin.py           # Admin schemas
│   │   ├── upload.py          # Upload schemas
│   │   └── __init__.py
│   ├── services/
│   │   ├── auth_service.py    # Supabase auth operations
│   │   ├── password_reset_service.py  # Reset token management
│   │   ├── upload_service.py  # AWS S3 operations
│   │   └── __init__.py
│   └── __init__.py
├── sql/
│   └── schema.sql             # PostgreSQL schema with RLS
├── tests/
│   ├── conftest.py            # Test fixtures
│   ├── test_auth.py           # Auth tests
│   ├── test_user.py           # User tests
│   ├── test_admin.py          # Admin tests
│   ├── test_uploads.py        # Upload tests
│   └── __init__.py
├── requirements.txt           # Python dependencies
└── README.md                  # This file
```

## Setup

### Prerequisites

- Python 3.10+
- Supabase account (https://supabase.com)
- AWS S3 bucket and credentials
- PostgreSQL database (via Supabase)

### 1. Environment Configuration

Copy the root `.env.example` and fill in your Supabase and AWS credentials:

```powershell
Copy-Item ..\.env.example ..\.env
```

Edit `.env` with:
- Supabase URL and keys
- AWS S3 credentials and bucket
- Admin email address
- Secret key for JWT

### 2. Install Dependencies

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 3. Initialize Database Schema

Run the SQL schema in your Supabase dashboard SQL editor:

1. Go to Supabase dashboard → SQL Editor
2. Create new query
3. Copy contents of `sql/schema.sql`
4. Execute

This creates:
- `profiles` table (user profiles)
- `modules` table (course modules)
- `module_progress` table (user progress tracking)
- `password_reset_tokens` table (reset token storage)
- `uploads` table (file metadata)
- RLS policies for data isolation

### 4. Run the Backend

Development:
```powershell
python -m app.main
```

Or with Uvicorn directly:
```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend runs at: **http://localhost:8000**

API Documentation: **http://localhost:8000/docs**

## API Endpoints

### Authentication (`/api/v1/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/signup` | Register new user |
| POST | `/signin` | Login user |
| POST | `/logout` | Logout (clear cookie) |
| POST | `/refresh-token` | Refresh access token |
| POST | `/request-password-reset` | Request password reset |
| POST | `/confirm-password-reset` | Confirm password reset |

### Users (`/api/v1/users`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/me` | Get current user profile + module progress |

**Protected**: Requires authentication (cookie or Bearer token)

### Admin (`/api/v1/admin`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | List all users (paginated) |
| GET | `/uploads` | List all uploads (paginated) |
| PATCH | `/uploads/{id}/status` | Update upload status |
| DELETE | `/uploads/{id}` | Delete upload |

**Protected**: Requires admin@university.com role

### Uploads (`/api/v1/uploads`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/presigned-url` | Get presigned S3 upload URL |
| POST | `/confirm/{id}` | Mark upload as completed |
| GET | `/my-uploads` | List user's uploads |
| DELETE | `/{id}` | Delete upload |

**Protected**: Requires authentication; users can only manage their own uploads

## Configuration

All configuration is loaded from `.env` file via `app/core/config.py`:

### Supabase
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Anonymous key (for user context)
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (for admin operations)

### JWT & Session
- `SECRET_KEY`: Secret for JWT signing (generate: `python -c "import secrets; print(secrets.token_urlsafe(32))"`)
- `ALGORITHM`: JWT algorithm (default: HS256)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Access token lifetime (default: 30)
- `REFRESH_TOKEN_EXPIRE_DAYS`: Refresh token lifetime (default: 7)

### Cookies
- `COOKIE_NAME`: Session cookie name (default: "session")
- `COOKIE_SECURE`: HTTPS only (default: true, set false in dev)
- `COOKIE_HTTPONLY`: Cannot be accessed by JavaScript (default: true)
- `COOKIE_SAMESITE`: CSRF protection level (default: "lax")

### CORS
- `CORS_ORIGINS`: Comma-separated list of allowed origins (default: http://localhost:3000,http://localhost:5173)
- `ALLOW_CREDENTIALS`: Allow credentials (default: true)

### Admin
- `ADMIN_EMAIL`: Email for admin access (default: admin@university.com)

### AWS S3
- `AWS_S3_BUCKET`: S3 bucket name
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_REGION`: AWS region (default: us-east-1)

## Security Features

### Authentication
- **Supabase Auth**: Enterprise-grade email/password authentication
- **JWT Tokens**: Access tokens with 30-minute expiry
- **Refresh Tokens**: 7-day refresh tokens for long-lived sessions

### Session Management
- **HttpOnly Cookies**: Session token stored securely, inaccessible to JavaScript
- **Secure Flag**: Cookies only sent over HTTPS (configurable)
- **SameSite Policy**: CSRF protection with Lax policy

### Password Reset
- **Custom Token Flow**: Secure one-time reset tokens
- **Token Expiry**: Configurable expiration (default: 60 minutes)
- **One-Time Use**: Tokens become invalid after first use
- **User Enumeration Protection**: Generic responses prevent email discovery

### Authorization
- **Role-Based Access Control**: Admin routes restricted to admin@university.com
- **Data Isolation**: RLS policies ensure users see only their data
- **Admin Context**: Service-role client for admin operations

### File Storage
- **AWS S3 Integration**: Secure cloud storage
- **Presigned URLs**: Direct client uploads without backend file handling
- **Metadata Tracking**: File ownership and audit trail
- **Cleanup**: Orphaned records can be cleaned up

## Testing

Run tests with pytest:

```powershell
pytest backend/tests -v
```

Run specific test file:
```powershell
pytest backend/tests/test_auth.py -v
```

With coverage:
```powershell
pytest backend/tests --cov=app
```

Current tests cover:
- Health checks and root endpoints
- Auth endpoint validation
- Unauthorized access detection
- Password reset flow
- Admin authorization
- Upload endpoint structure

**Note**: Full integration tests require Supabase credentials and will mock certain components.

## Development Notes

### Backend-Only Scope
This phase implements the backend with cookie-based session support. The frontend currently uses localStorage bearer tokens. Frontend migration to use cookies is left for a follow-up phase:

- Frontend cookie migration: `withCredentials: true`, remove localStorage flow
- Backend already supports both cookies and Bearer tokens for flexibility

### Password Reset Implementation
The current implementation logs reset tokens to console in development. For production:

1. Implement email service (SendGrid, Mailgun, etc.)
2. Create email template with reset link
3. Replace console logging with actual email sending
4. Set up email verification webhook

### S3 Presigned URLs
Uploads use presigned URLs for scalability:

1. Client requests presigned URL via `/presigned-url`
2. Backend generates time-limited URL (1 hour default)
3. Client uploads directly to S3
4. Client confirms upload completion via `/confirm/{id}`
5. Backend marks metadata as active

Benefits:
- No files pass through backend
- Faster uploads
- Automatic cleanup of incomplete uploads
- S3 handles multipart uploads

### Database Seeding
To create test data:

```sql
-- Insert test modules
INSERT INTO modules (title, description, code) VALUES
('Module 1', 'Introduction', 'MOD001'),
('Module 2', 'Advanced Topics', 'MOD002');
```

## Troubleshooting

### Import Errors
Ensure you're running from project root and have activated venv:
```powershell
Set-Location backend
.\venv\Scripts\Activate.ps1
```

### Supabase Connection Issues
Verify credentials in `.env`:
- URLs should include `https://`
- Keys should match your Supabase project
- Check firewall/VPN if in corporate environment

### S3 Configuration Issues
Verify AWS credentials:
- Access key and secret are correct
- Bucket exists and is in configured region
- IAM user has S3 permissions

### CORS Issues with Frontend
Check `.env`:
- `CORS_ORIGINS` matches frontend URL
- `ALLOW_CREDENTIALS` is true
- Frontend uses correct `VITE_API_BASE_URL`

## Production Deployment

### Environment
- Set `ENVIRONMENT=production`
- Set `DEBUG=false`
- Set `COOKIE_SECURE=true` (requires HTTPS)
- Generate strong `SECRET_KEY`
- Set `CORS_ORIGINS` to actual frontend domain

### Database
- Ensure RLS policies are enabled (default in schema.sql)
- Review RLS policies for your use case
- Set up automated backups
- Monitor database performance

### Security
- Use HTTPS only
- Rotate AWS credentials regularly
- Monitor Supabase audit logs
- Set up rate limiting (consider CloudFlare)
- Use environment-specific secrets

### Deployment Options
- **Docker**: Create Dockerfile and use container deployment
- **Railway/Render**: Deploy from GitHub with auto-deployment
- **AWS Elastic Beanstalk**: Scale with auto-scaling
- **Heroku**: Free tier available for prototyping

## API Examples

### Sign Up
```bash
curl -X POST http://localhost:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123",
    "full_name": "John Doe"
  }'
```

### Sign In
```bash
curl -X POST http://localhost:8000/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123"
  }'
```

### Get User Profile (with Bearer token)
```bash
curl -X GET http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Get Presigned Upload URL
```bash
curl -X POST http://localhost:8000/api/v1/uploads/presigned-url \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "document.pdf",
    "mime_type": "application/pdf",
    "file_size": 1024000,
    "description": "Course material"
  }'
```

## Support & Documentation

- **FastAPI Docs**: https://fastapi.tiangolo.com
- **Supabase Docs**: https://supabase.com/docs
- **AWS S3 Docs**: https://docs.aws.amazon.com/s3/
- **PyJWT Docs**: https://pyjwt.readthedocs.io

## License
Part of SquadZero project.
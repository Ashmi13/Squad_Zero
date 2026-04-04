# Backend Deployment Guide

Production deployment instructions for FastAPI + Supabase backend.

## Pre-Deployment Checklist

- [ ] All tests passing: `pytest tests -v`
- [ ] `.env` file configured with production credentials
- [ ] Supabase project created and schema initialized
- [ ] AWS S3 bucket created with proper IAM permissions
- [ ] Frontend `VITE_API_BASE_URL` points to production backend
- [ ] CORS origins updated to production domain
- [ ] HTTPS certificate ready
- [ ] Database backups configured
- [ ] Monitoring/logging configured

## Environment Setup

### Production `.env` Variables

```env
# Application
APP_NAME="SquadZero API"
DEBUG=false
ENVIRONMENT=production

# Supabase (Production Project)
SUPABASE_URL=https://your-production-project.supabase.co
SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key

# Security
SECRET_KEY=your-production-secret-key-minimum-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Cookies - MUST use HTTPS in production
COOKIE_NAME=session
COOKIE_SECURE=true
COOKIE_HTTPONLY=true
COOKIE_SAMESITE=lax
COOKIE_DOMAIN=yourdomain.com

# CORS - Update to your frontend domain
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
ALLOW_CREDENTIALS=true

# Admin
ADMIN_EMAIL=admin@yourdomain.com

# AWS S3
AWS_S3_BUCKET=production-bucket-name
AWS_ACCESS_KEY_ID=production-access-key
AWS_SECRET_ACCESS_KEY=production-secret-key
AWS_REGION=us-east-1

# Password Reset
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=60
```

## Deployment Options

### Option 1: AWS Elastic Beanstalk (Recommended)

```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init -p python-3. --platform-version 3.11.x

# Create environment
eb create squadZero-prod

# Deploy
eb deploy

# View logs
eb logs
```

### Option 2: Railway

1. Push code to GitHub
2. Connect GitHub repo to Railway
3. Add environment variables in Railway dashboard
4. Railway auto-deploys on push

### Option 3: Render

1. Create new Web Service
2. Connect GitHub repository
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables
6. Deploy

### Option 4: Docker + Cloud Run (GCP)

```dockerfile
# Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

```bash
# Build and deploy to Google Cloud Run
gcloud run deploy squadZero-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --set-env-vars "..." \
  --allow-unauthenticated
```

## Security Hardening

### HTTPS/SSL
- Use HTTPS on all endpoints
- Get free SSL from Let's Encrypt
- Cloud providers usually handle this automatically
- Set `COOKIE_SECURE=true`

### Secret Management
- **Never commit `.env` file**
- Use cloud provider's secret management:
  - AWS Secrets Manager
  - Railway/Render environment variables
  - Google Cloud Secret Manager
- Rotate `SECRET_KEY` regularly (will invalidate existing tokens)
- Use separate keys for dev, staging, production

### Rate Limiting
Add rate limiting to prevent abuse:

```python
# In app/main.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
```

Install: `pip install slowapi`

### Database Security
- Enable RLS policies (already in schema.sql)
- Regular backups (Supabase has automated backups)
- Monitor audit logs
- Use strong database passwords
- Restrict access from specific IPs if possible

### API Security
- Implement request signing for sensitive endpoints
- Add API rate limiting
- Monitor for SQL injection attempts
- Keep dependencies updated: `pip list --outdated`

## Monitoring & Logging

### Application Logging
```python
# In app/main.py
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
```

### Sentry (Error Tracking)
```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn="your-sentry-dsn",
    integrations=[FastApiIntegration()],
    traces_sample_rate=0.1,
)
```

### CloudWatch (AWS)
```python
import watchtower
handler = watchtower.CloudWatchLogHandler()
logger.addHandler(handler)
```

### Database Monitoring
- Enable Supabase monitoring dashboard
- Set up alerts for high query times
- Monitor storage usage
- Track authentication events

## Performance Optimization

### Database
- Add indexes (already in schema.sql)
- Enable connection pooling
- Use read replicas for high traffic

### Caching
```python
from fastapi_cache2 import FastAPICache2
from fastapi_cache2.backends.redis import RedisBackend

# Cache user profiles for 5 minutes
@app.get("/api/v1/users/me")
@cached(expire=300)
async def get_me(...):
    ...
```

### CDN
- Store S3 uploads behind CloudFront
- Cache API responses with short TTL

## Database Migrations

```bash
# Manual migration after schema.sql changes:
# 1. Create new migration manually
# 2. Test in development
# 3. Apply to production database via Supabase SQL editor
# 4. Test production endpoints

# For large changes, consider:
# - Blue-green deployment
# - Feature flags
# - Gradual rollout
```

## Rollback Plan

If deployment fails:

1. **Keep previous `.env` backed up**
2. **Pin dependencies**: Change `requirements.txt` to specific versions
3. **Database backups**: Supabase has auto-backups (7 days retention)
4. **Blue-green deployment**: Run old and new version, switch traffic

## Health Checks

Add health monitoring:
```bash
# Verify backend is running
curl https://api.yourdomain.com/api/v1/health

# Response should be:
# {"status": "ok", "version": "1.0"}
```

Configure cloud provider health checks:
- Path: `/api/v1/health`
- Interval: 30 seconds
- Timeout: 5 seconds
- Failure threshold: 3

## Scaling

### Horizontal Scaling
- Most clouds auto-scale based on CPU/memory
- Enable auto-scaling in deployment settings
- Set reasonable limits to prevent runaway costs

### Database Scaling
- Supabase scales automatically
- Monitor connection pool usage
- Consider read replicas for heavy read workloads

### File Storage
- S3 scales automatically
- Use lifecycle policies to archive old uploads
- Set up S3 access logging for audit trail

## Troubleshooting Production

### 502 Bad Gateway
- Check server logs: `eb logs` or provider's logs
- Verify `.env` variables are set
- Check database connection

### 401 Unauthorized Everywhere
- Verify `SECRET_KEY` didn't change
- Check token expiry times are reasonable
- Verify JWT algorithm matches

### S3 Upload Failures
- Check AWS credentials are correct
- Verify bucket policy allows uploads
- Check bucket doesn't have max size limits

### CORS Issues
- Verify `CORS_ORIGINS` includes frontend domain
- Check protocol (http vs https)
- Clear browser cache

## Post-Deployment

1. **Monitor logs** for errors
2. **Test critical flows** (signup, signin, upload)
3. **Load test** with production traffic patterns
4. **Schedule security audit**
5. **Document** any customizations
6. **Set up support** process for incidents

## Maintenance

### Regular Tasks
- Weekly: Monitor logs and errors
- Monthly: Review security logs, update dependencies
- Quarterly: Database optimization, cost review
- Annually: Security audit, disaster recovery test

### Update Schedule
```bash
# Check for outdated packages
pip list --outdated

# Update dependencies (test in staging first!)
pip install --upgrade -r requirements.txt
# Then: pip freeze > requirements.txt
```

## Disaster Recovery

### Backup Strategy
- Supabase: Automated daily backups (7-day retention)
- Code: GitHub as source of truth
- Secrets: Use cloud provider's secret management
- S3: Enable versioning for important files

### Recovery Procedures
1. **Database recovery**: Restore from Supabase backup
2. **Application recovery**: Redeploy from Git
3. **Secrets recovery**: Restore from secret manager
4. **File recovery**: Restore from S3 versions

Estimated RTO (Recovery Time Objective): **30 minutes**

## Compliance & Audit

- **Data Privacy**: GDPR compliance depends on agreements
- **Audit Logs**: Enable Supabase audit logs
- **Compliance**: Document data processing flows
- **Retention**: Define data retention policies

## Support & Escalation

| Issue | Action |
|-------|--------|
| 5xx errors | Check logs, restart if needed |
| Database down | Check Supabase status page |
| S3 issues | Check AWS status page |
| DDoS attack | Enable CloudFlare, contact provider |
| Data breach | Execute incident response plan |

## Next Steps

1. Deploy to staging environment first
2. Run full test suite against staging
3. Performance test with production-like load
4. Security audit before production
5. Plan deployment window with minimal users
6. Have rollback plan ready
7. Monitor closely first 24 hours
8. Gradual traffic migration if possible

## Resources

- Supabase: https://supabase.com/docs/guides/self-hosting
- AWS Elastic Beanstalk: https://docs.aws.amazon.com/elasticbeanstalk/
- Railway: https://docs.railway.app/
- Render: https://render.com/docs
- Google Cloud Run: https://cloud.google.com/run/docs

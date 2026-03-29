# SquadZero Development Setup

## Quick Start Guide

Follow these steps to get your development environment running:

### 1. Install Node.js Dependencies

```powershell
npm install
```

This will install all required packages including:

- React, React DOM
- TypeScript
- Vite (build tool)
- Tailwind CSS
- React Hook Form
- Zod (validation)
- Axios
- Lucide React (icons)

### 2. Configure Environment

Create a `.env.local` file:

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local` and set your FastAPI backend URL:

```
VITE_API_BASE_URL=http://localhost:8000
```

### 3. Start Development Server

```powershell
npm run dev
```

Open your browser and navigate to: `http://localhost:3000`

### 4. FastAPI Backend Setup (Required)

Your FastAPI backend should implement these endpoints:

**Login Endpoint:**

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: dict

@app.post("/login", response_model=LoginResponse)
async def login(credentials: LoginRequest):
    # Your authentication logic here
    return {
        "access_token": "your_jwt_token",
        "refresh_token": "your_refresh_token",
        "token_type": "bearer",
        "user": {
            "id": "user_id",
            "email": credentials.email,
            "full_name": "User Name"
        }
    }
```

**OAuth Endpoints:**

```python
@app.get("/auth/google")
async def google_auth():
    # Redirect to Google OAuth
    pass

@app.get("/auth/github")
async def github_auth():
    # Redirect to GitHub OAuth
    pass
```

**CORS Configuration:**

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Features Checklist

✅ **Email/Password Login**

- React Hook Form for form management
- Zod schema validation
- Error handling with visual feedback
- Loading states

✅ **OAuth Authentication**

- Google sign-in button
- GitHub sign-in button
- Redirects to FastAPI OAuth endpoints

✅ **Security**

- JWT token storage
- Axios interceptors for authentication
- Token expiration handling
- Secure password input with show/hide toggle

✅ **UI/UX**

- Responsive design (mobile-first)
- Loading spinners
- Error and success alerts
- Custom styled components matching Figma design
- Smooth transitions and animations

✅ **Code Quality**

- TypeScript for type safety
- ESLint configuration
- Prettier for formatting
- Modular component architecture
- Comprehensive comments

## Folder Structure Explained

```
src/
├── components/auth/     # Authentication UI components
│   ├── LoginCard.tsx    # Main login form
│   ├── OAuthButton.tsx  # Social login buttons
│   ├── InputField.tsx   # Reusable input with validation
│   ├── Button.tsx       # Reusable button component
│   └── LoadingSpinner.tsx # Loading indicator
├── config/              # App configuration
│   └── env.ts           # Environment variables
├── hooks/               # Custom React hooks
│   └── useAuth.ts       # Authentication hook
├── lib/                 # Third-party library configs
│   └── axios.ts         # Axios instance with interceptors
├── schemas/             # Zod validation schemas
│   └── authSchema.ts    # Auth form validation
├── types/               # TypeScript type definitions
│   └── auth.ts          # Auth-related types
├── utils/               # Utility functions
│   └── tokenStorage.ts  # JWT token management
├── App.tsx              # Main app component
├── main.tsx             # React entry point
└── index.css            # Global styles + Tailwind
```

## Customization Guide

### Change Colors

Edit [tailwind.config.js](tailwind.config.js):

```javascript
colors: {
  primary: {
    500: '#YOUR_COLOR',
    600: '#YOUR_COLOR',
    700: '#YOUR_COLOR',
  },
}
```

### Change Logo

Replace [public/Logo (1).png](<public/Logo%20(1).png>) with your logo

### Change API Endpoints

Edit [src/config/env.ts](src/config/env.ts):

```typescript
export const config = {
  endpoints: {
    login: '/your-login-endpoint',
    // ...
  },
};
```

## Troubleshooting

### Port Already in Use

If port 3000 is occupied, edit [vite.config.ts](vite.config.ts):

```typescript
server: {
  port: 3001, // Change to different port
}
```

### TypeScript Errors

Ensure all dependencies are installed:

```powershell
npm install
```

### Cannot Connect to Backend

1. Verify FastAPI is running on `http://localhost:8000`
2. Check CORS configuration in FastAPI
3. Verify `.env.local` has correct API URL

## Next Steps

1. ✅ Install dependencies
2. ✅ Configure environment
3. ✅ Start development server
4. 🔲 Set up FastAPI backend
5. 🔲 Configure OAuth providers
6. 🔲 Customize styling to match your brand
7. 🔲 Add additional features (2FA, password reset, etc.)

## Support

For issues or questions, refer to:

- [React Documentation](https://react.dev/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [React Hook Form Documentation](https://react-hook-form.com/)

Happy coding! 🚀

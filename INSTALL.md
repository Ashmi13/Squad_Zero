# 🚀 Quick Installation & Run Guide

## Step 1: Install Dependencies

Open PowerShell in the project directory and run:

```powershell
npm install
```

**What this installs:**

- React 18 + React DOM
- TypeScript
- Vite (Lightning-fast build tool)
- Tailwind CSS (Styling)
- React Hook Form (Form management)
- Zod (Validation)
- Axios (HTTP client)
- Lucide React (Icons)
- All development tools (ESLint, Prettier, etc.)

⏱️ **Installation time:** ~2-3 minutes

## Step 2: Configure Environment

Create your environment file:

```powershell
Copy-Item .env.example .env.local
```

Then open `.env.local` and set your backend URL:

```
VITE_API_BASE_URL=http://localhost:8000
```

## Step 3: Start Development Server

```powershell
npm run dev
```

✅ **Your app will be available at:** http://localhost:3000

## Step 4: Verify Setup

Open your browser and navigate to `http://localhost:3000`

You should see:

- ✅ SquadZero logo at the top
- ✅ "Welcome Back" heading
- ✅ Google and GitHub OAuth buttons
- ✅ Email and password input fields
- ✅ "Sign In" button

## Troubleshooting

### ❌ Port 3000 already in use?

Edit `vite.config.ts` and change the port:

```typescript
server: {
  port: 3001, // Use any available port
}
```

### ❌ npm install fails?

Try clearing cache:

```powershell
npm cache clean --force
npm install
```

### ❌ Module not found errors?

Delete node_modules and reinstall:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

## What's Next?

1. **Set up your FastAPI backend** (see [SETUP.md](SETUP.md))
2. **Configure OAuth providers** (Google/GitHub developer console)
3. **Customize the design** (edit [tailwind.config.js](tailwind.config.js))
4. **Test the login flow**

## Available Commands

```powershell
# Development
npm run dev          # Start dev server

# Production
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
```

## File Structure Overview

```
src/
├── components/auth/    # Login UI components
├── hooks/             # Custom React hooks
├── lib/               # Axios configuration
├── schemas/           # Zod validation
├── types/             # TypeScript types
├── utils/             # Token storage utilities
└── config/            # App configuration
```

## Need More Help?

- 📖 [README.md](README.md) - Full documentation
- 🚀 [SETUP.md](SETUP.md) - Detailed setup guide
- 📁 [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - Code organization

---

**Happy Coding! 🎉**

If everything is working, you should be able to:

1. See the beautiful login UI
2. Type in email and password
3. See validation errors
4. Click OAuth buttons (they'll redirect to your FastAPI endpoints)

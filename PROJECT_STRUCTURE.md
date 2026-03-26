# Project Structure

```
Uni/
│
├── 📁 public/                          # Static assets
│   ├── Logo (1).png                   # Application logo
│   ├── Sign in 1.png                  # UI design reference images
│   ├── Sign in 2-8.png
│   └── Sign up 1-9.png
│
├── 📁 src/                            # Source code
│   │
│   ├── 📁 components/                 # React components
│   │   └── 📁 auth/                   # Authentication components
│   │       ├── Button.tsx             # ✨ Reusable button with variants
│   │       ├── InputField.tsx         # ✨ Input with validation & password toggle
│   │       ├── LoadingSpinner.tsx     # ⏳ Loading indicator
│   │       ├── LoginCard.tsx          # 🔐 Main login component
│   │       ├── OAuthButton.tsx        # 🔗 Google/GitHub OAuth buttons
│   │       └── index.ts               # Barrel exports
│   │
│   ├── 📁 config/                     # Configuration files
│   │   └── env.ts                     # ⚙️ Environment config & API endpoints
│   │
│   ├── 📁 hooks/                      # Custom React hooks
│   │   └── useAuth.ts                 # 🪝 Authentication hook
│   │
│   ├── 📁 lib/                        # Third-party libraries
│   │   └── axios.ts                   # 📡 Axios instance with interceptors
│   │
│   ├── 📁 schemas/                    # Validation schemas
│   │   └── authSchema.ts              # ✅ Zod validation for forms
│   │
│   ├── 📁 types/                      # TypeScript types
│   │   └── auth.ts                    # 📝 Auth type definitions
│   │
│   ├── 📁 utils/                      # Utility functions
│   │   └── tokenStorage.ts            # 🔐 JWT token management
│   │
│   ├── App.tsx                        # 🏠 Main app component
│   ├── main.tsx                       # 🚀 React entry point
│   ├── index.css                      # 🎨 Global styles + Tailwind
│   └── vite-env.d.ts                  # 🔧 Vite TypeScript types
│
├── 📁 .vscode/                        # VS Code configuration
│   ├── extensions.json                # Recommended extensions
│   └── settings.json                  # Editor settings
│
├── .env.example                       # Environment variable template
├── .eslintrc.cjs                      # ESLint configuration
├── .gitignore                         # Git ignore rules
├── .prettierrc                        # Prettier configuration
├── .prettierignore                    # Prettier ignore rules
├── index.html                         # HTML entry point
├── package.json                       # 📦 Dependencies & scripts
├── postcss.config.js                  # PostCSS configuration
├── README.md                          # 📖 Full documentation
├── SETUP.md                           # 🚀 Quick start guide
├── tailwind.config.js                 # 🎨 Tailwind CSS configuration
├── tsconfig.json                      # TypeScript configuration
├── tsconfig.node.json                 # TypeScript for Node
└── vite.config.ts                     # ⚡ Vite build configuration
```

## Component Hierarchy

```
App
└── LoginCard
    ├── Logo
    ├── Header
    ├── ErrorAlert (conditional)
    ├── SuccessAlert (conditional)
    ├── OAuthButton (Google)
    ├── OAuthButton (GitHub)
    ├── Divider
    └── LoginForm
        ├── InputField (Email)
        │   └── Icon (Mail)
        ├── InputField (Password)
        │   ├── Icon (Lock)
        │   └── PasswordToggle (Eye/EyeOff)
        ├── ForgotPasswordLink
        ├── Button (Submit)
        │   └── LoadingSpinner (conditional)
        └── SignUpLink
```

## Technology Stack

```
📦 Frontend Framework
├── React 18.2        (UI Library)
├── TypeScript 5.3    (Type Safety)
└── Vite 5.0          (Build Tool)

🎨 Styling
├── Tailwind CSS 3.4  (Utility-first CSS)
└── Lucide React      (Icon Library)

📝 Form Management
├── React Hook Form   (Form State)
└── Zod              (Schema Validation)

🌐 API & Auth
├── Axios            (HTTP Client)
└── JWT              (Authentication)

🛠️ Development
├── ESLint           (Linting)
├── Prettier         (Formatting)
└── TypeScript       (Type Checking)
```

## Key Features by File

### 🔐 LoginCard.tsx (Main Component)

- Email/Password form with validation
- OAuth integration (Google/GitHub)
- Loading, error, and success states
- Responsive design
- Security best practices

### 📡 axios.ts (API Client)

- Axios instance configuration
- Request interceptor (JWT attachment)
- Response interceptor (token refresh)
- Error handling

### 🔐 tokenStorage.ts (Security)

- Secure token storage
- Token retrieval
- Token expiration check
- Token decode utility

### ✅ authSchema.ts (Validation)

- Email validation
- Password validation (8+ chars)
- Register form validation
- Forgot password validation

### 🎨 Tailwind Config

- Custom color palette
- Custom shadows
- Custom border radius
- Responsive breakpoints

## Data Flow

```
User Input → React Hook Form → Zod Validation → Axios Request → FastAPI Backend
                                                      ↓
                                                  JWT Token
                                                      ↓
                                            localStorage Storage
                                                      ↓
                                            Axios Interceptor
                                                      ↓
                                         Authenticated Requests
```

## Security Features

✅ JWT token storage in localStorage
✅ Axios interceptors for automatic token attachment
✅ Token expiration handling
✅ Password show/hide toggle
✅ Form validation before submission
✅ CSRF protection ready
✅ Secure password input
✅ Error message sanitization

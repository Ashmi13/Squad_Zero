# NeuraNote — Smart Study Notes & Productivity Platform

> **SquadZero project · Honours Degree in IT & Management, University of Moratuwa**

NeuraNote is a full-stack, AI-powered study and productivity platform built by a team of five. It combines **smart note-taking**, **AI-assisted learning tools**, **file management**, and **personal productivity systems** (tasks, calendar, and a "second brain" knowledge graph) into one cohesive web application.

The platform is designed around a simple idea: **every stage of a student's workflow should be supported — capturing material, understanding it, testing it, and staying organised while you do.** NeuraNote brings that workflow into a single, modern interface with a FastAPI backend and a React frontend.

---

## Table of Contents

- [What is NeuraNote?](#what-is-neuranote)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [System Architecture & Workflow](#system-architecture--workflow)
- [Project Structure](#project-structure)
- [Team & Responsibilities](#team--responsibilities)
  - [Member 1 — Authentication & Admin Dashboard](#member-1--authentication--admin-dashboard)
  - [Member 2 — File Manager, Dashboard, Pomodoro & Flashcards](#member-2--file-manager-dashboard-pomodoro--flashcards)
  - [Member 3 — AI Smart Note Analyzer](#member-3--ai-smart-note-analyzer)
  - [Member 4 — AI Quiz Generator](#member-4--ai-quiz-generator)
  - [Member 5 — Tasks, Calendar & Second Brain *(Anoj Jeyasatheesh)*](#member-5--tasks-calendar--second-brain)
- [Contributing](#contributing)
- [Getting Started](#getting-started)

---

## What is NeuraNote?

NeuraNote helps students turn raw study material into structured, retrievable knowledge. Key modules include:

- **Auth & Accounts** — secure sign-up, login, verification, password reset, OAuth, admin moderation.
- **File Manager** — a dropbox-style interface with a folder tree, file previews, PDF handling, and AI summaries.
- **Smart Note Analyzer** — AI-powered extraction of key points from uploads into structured, reusable study notes (M3).
- **Quiz Generator** — AI-generated quizzes with history, scoring and review.
- **Flashcards** — spaced-repetition style flashcard decks for memorisation.
- **Pomodoro Timer** — focus timer for study sessions.
- **Tasks & Calendar** — a kanban-style task dashboard with categories, due dates and an integrated calendar.
- **Second Brain** — a networked notes system with **tags, backlinks (``[[Note Title]]``) and a link graph**, so knowledge grows into a connected personal wiki.
- **Payments** — PayHere-supported payments (premium / subscriptions).

---

## Screenshots

> A quick look at the core screens of NeuraNote. Each image lives in the `screenshots/` folder at the repo root.

| Login | Sign Up | Dashboard |
| :---: | :---: | :---: |
| ![Login Page](screenshots/login.png) | ![Sign-Up Page](screenshots/Signup.png) | ![Dashboard](screenshots/dashboard.png) |

| Tasks | Calendar | Second Brain |
| :---: | :---: | :---: |
| ![Tasks](screenshots/tasks.png) | ![Calendar](screenshots/calendar.png) | ![Second Brain](screenshots/second_brain.png) |

| Flashcards | Quiz | Smart Note Analyzer |
| :---: | :---: | :---: |
| ![Flashcards](screenshots/flashcards.png) | ![Quiz](screenshots/quiz.png) | ![Smart Note Synthesizer](screenshots/smartnote%20synthesizer.png) |

| Mind Map | |
| :---: | :---: |
| ![Mind Map](screenshots/mindmap.png) |

---

## Tech Stack

### Frontend
| Layer | Technology |
| :--- | :--- |
| **Language** | React 19 (JSX) |
| **Build tool** | Vite 7 |
| **UI framework** | Material UI (MUI), Tailwind CSS |
| **Styling** | CSS Modules + custom theme system (palette, typography, shadows) |
| **Routing** | React Router |
| **HTTP client** | Axios |
| **Data visualisation** | Recharts |
| **Diagrams / rendering** | Mermaid, react-markdown, html2canvas, jspdf |
| **Motion** | Framer Motion |

### Backend

| Layer | Technology |
| :--- | :--- |
| **Framework** | FastAPI (Python) |
| **Server** | Uvicorn |
| **Database** | PostgreSQL (Supabase, with **pgvector** for embeddings; AWS RDS compatible) |
| **ORM** | SQLAlchemy |
| **Auth** | PyJWT, bcrypt, python-jose, passlib, authlib (JWT + Supabase auth + OAuth) |
| **AI** | OpenAI API (gpt models) , sentence-transformers (all-MiniLM-L6-v2) for embeddings |
| **File processing** | PyMuPDF, pypdf, reportlab, python-docx |
| **Payments** | PayHere |
| **Testing** | pytest, pytest-asyncio |
| **HTTP / util** | httpx, pydantic, python-multipart, python-dotenv, anyio, tzdata |

---

## System Architecture & Workflow

NeuraNote is a **client-server** application with a clear separation between the React frontend and the FastAPI backend, connected over HTTP (`localhost:5173` → `localhost:8000`).

```text
[ Browser / Frontend (React + Vite) ]
            │  HTTP (Axios, authFetch)
            ▼
[ FastAPI Backend (Uvicorn) ]
   │
   ├── app/api/v1         → versioned REST endpoints
   ├── routes/            → feature routers (files, workspace, summary, quiz, mindmap … )
   ├── second_brain/      → tags / backlinks / link-graph module
   └── services/          → business logic (auth, openai, workspace, pdf, export, payhere)
            │  (SQLAlchemy / Supabase client)
            ▼
[ PostgreSQL (Supabase / AWS RDS + pgvector) ]
```

### Core workflow

1. A user signs in (Member 1 auth layer) and is issued a signed JWT.
2. The user **uploads study material** through the **File Manager** (Member 2).
3. The file is processed (extraction → optional AI summary).
4. **Member 3's Smart Note Analyzer** turns the content into structured notes.
5. **Member 4's Quiz generator** can turn the same material into quizzes.
6. Meanwhile, the user organises their work via **Tasks & Calendar** (Member 5).
7. Useful notes can be pushed into the **Second Brain** (Member 5), where tags and backlinks build a connected knowledge graph.
8. The **Pomodoro** timer keeps the session focused, and **Payments** unlock premium features.

Because each module is independently wired into the `v1` router, members' features can be developed and tested in isolation without breaking unrelated routes.

---

## Project Structure

```text
neuranote/
├── backend/                     # FastAPI (Python)
│   ├── app/
│   │   ├── api/v1/endpoints/     # versioned endpoints (auth, admin, tasks, calendar, payments…)
│   │   ├── core/                 # config, security
│   │   ├── db/                   # Supabase / DB clients
│   │   ├── schemas/              # Pydantic schemas
│   │   └── services/             # business logic (auth, openai, workspace, payhere…)
│   ├── m3_structurednotes/       # Smart note analyzer (Member 3)
│   ├── second_brain/             # tags + backlinks + graph (Member 5)
│   ├── routes/                   # feature routers (files, quiz, flashcards, workspace…)
│   └── requirements.txt          # dependency manifest
└── frontend/                     # React (Vite)
    └── src/
        ├── pages/                 # route-level pages (Auth, AdminDashboard, SecondBrain…)
        ├── components/            # feature components (auth, quiz, tasks, mindmap, filemanager…)
        ├── modules/               # pomodoro, secondbrain
        ├── m3_structurednotes/    # member 3 frontend
        ├── services/              # API clients
        ├── themes/                # design system
        └── hooks/ utils/ context/ config/
```

---

## Team & Responsibilities

### Member 1 — Authentication & Admin Dashboard

**Responsibilities:** Secure sign-up / login, email verification, password reset, OAuth, and the admin dashboard.

- **Key routes:** `auth.py`, `admin.py`, `user.py` (`backend/app/api/v1/endpoints/`), `auth_service.py`, `security.py`, `core/config.py`.
- **Key frontend:** `pages/SignInPage.jsx`, `SignUpPage.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`, `VerificationPage.jsx`, `AccountVerification.jsx`, `AdminDashboard.jsx`, `OAuthCallback.jsx`, `components/auth/*`.
- **Tech:** FastAPI, PyJWT, bcrypt, python-jose, passlib, authlib, Supabase auth; React MUI.
- **Features:** JWT session handling, role-based access, user verification, account suspension, admin user management, OAuth callback.

---

### Member 2 — File Manager, Dashboard, Pomodoro & Flashcards

**File Manager** — the central upload/preview layer.

- **Key files:** `routes/files.py`, `routes/pdf.py`, `routes/workspace.py`, `services/pdf_reader.py`, `services/export_service.py`, `services/workspace_service.py`.
- **Frontend:** `components/filemanager/*` (FileList, FileViewer, FolderPanel, TopBar, SummaryPanel, Rail, SettingsPanel), `pages/FileManagerPage.jsx`.
- **Tech:** PyMuPDF, pypdf, reportlab, python-docx, OpenAI (summaries), React MUI.

**Folder-tree dashboard** — `components/workspace/WorkspaceFolderPanel.jsx`, `services/workspaceApi.js`.

**Pomodoro** — `pages/PomodoroPage.jsx`, `utils/pomodoroTimer.js`, `components/modules/pomodoro/*`.

**Flashcards** — `routes/flashcards.py` (YAML), `pages/FlashcardsPage.jsx`.

**Payments** — `services/payhere_service.py`, `pages/PaymentResultPage.jsx`, `endpoints/payments.py` (PayHere integration).

---

### Member 3 — AI Smart Note Analyzer

- **Backend module:** `backend/m3_structurednotes/` (`router.py`, `services.py`, `openai_client.py`, `database.py`, `models.py`).
- **Frontend module:** `frontend/src/m3_structurednotes/` (`pages/Dashboard.jsx`, `NoteEditor.jsx`, `ManualNoteEditor.jsx`, `components/*`, `api.js`).
- **Tech:** FastAPI, OpenAI, SQLAlchemy, React; **sentence-transformers** for embeddings.
- **Features:** structured notes generation from uploads, note editor, folder-based organisation, AI-driven refinement of raw content into reusable study sheets.

---

### Member 4 — AI Quiz Generator

- **Backend:** `routes/quiz_routes.py`, `services/openai_service.py`, (`Requirements-m4.txt`).
- **Frontend:** `components/quiz/*` (QuizHomePage, QuizPage, QuizTaking, QuizResults, QuizHistory, ConfirmDialog, Toast) + `styles/`.
- **Tech:** FastAPI, OpenAI, React + MUI.
- **Features:** generates quiz questions from study material with AI, tracks scores and history, final results with explanations.

---

### Member 5 — Tasks, Calendar & Second Brain

**Anoj Jeyasatheesh** built the **productivity & knowledge layer** of NeuraNote: task management, an integrated calendar, and the Second Brain knowledge system — across **both backend and frontend**.

#### Tasks & Calendar

- **Backend endpoints:** `app/api/v1/endpoints/tasks.py` and `app/api/v1/endpoints/calendar.py`.
  - `GET/POST tasks/categories` — create & list project/life categories.
  - `PATCH tasks/categories/{id}` — rename, re-icon, recolour categories.
  - CRUD for tasks, status changes, due date handling; calendar event endpoints.
- **Frontend:** `components/tasks/` — `TaskDashboard.jsx`, `TaskList.jsx`, `TaskItem.jsx`, `MiniCalendar.jsx`, `ExpandedCalendar.jsx`, `CategoryModal.jsx`, `AddTaskModal.jsx`, `taskIcons.jsx`, `styles.css`.
- **Key outcomes:**
  - Kanban / category-bucketed tasks grouped under colour-coded projects (Work, Study, Personal by default).
  - Inline calendar (mini + expanded) with due dates, category highlighting and event handling.
  - Focus-mode notification reminders for tasks due soon.
  - Fully responsive, theme-aware UI (Material UI + custom theme context).

#### Second Brain (Knowledge graph)

- **Backend module:** `backend/second_brain/` — `db.py`, `models.py`, `router.py`, `services.py`, `extract.py`, `self_test.py`, `SETUP.md`, `README.md`.
  - `POST /second-brain/notes` — creates a note from a dropped file, **auto-generating tags and backlinks** from content.
  - `GET /second-brain/notes`, `/notes/{id}`, `/tags`, `/graph` — one graph of notes, tags and connections.
  - **Wikilinks** (`[[Note Title]]`) and verbatim title scanning create `links` rows.
  - Tag auto-generation from frequent non-stopword terms (count ≥ 2).
  - Decoupled from member 2's file-metadata code so the module never breaks on DB migrations.
- **Frontend:** `pages/SecondBrainPage.jsx`, `services/secondBrainApi.js`, `components/modules/secondbrain/`.

#### Member 5 tech stack (per layer)

| Area | Tech |
| :--- | :--- |
| Tasks & Calendar | FastAPI, Supabase client (Postgres), React + MUI, Recharts, Tailwind |
| Second Brain | FastAPI, SQLAlchemy, PostgreSQL (pgvector), React + MUI |
| Shared | JWT auth via `authFetch`/`get_current_user`, MUI theme system, Axios |

---

## Contributing

NeuraNote is a team project — keep it clean, modular, and tested.

1. **Branch** — work on your own branch (`feature/<member>/<feature>`); never commit directly to `main`.
2. **Modules first** — each feature owns its backend router + service and its frontend components; keep related files together.
3. **Validate imports** — when adding API routes, import them `_safe_import(...)` in `app/api/v1/router.py` so a failing module never blocks the rest.
4. **.env** — never commit secrets. Use `.env.example` as the template.
5. **Tests** — for the backend, add `pytest` coverage for new endpoints (see `pytest.ini`).
6. **Keep the repo clean** — no stray files, screenshot dumps, or generated folders (`venv/`, `node_modules/`, `__pycache__/`, `model_cache/`) in the tracked tree. Add them to `.gitignore`.
7. **Document as you go** — if you touch a module, update its `README.md`.

---

## Getting Started

### Backend

```bash
cd backend
python -m venv venv                 # create virtual environment
source venv/Scripts/activate        # (Windows) or venv/bin/activate (macOS/Linux)
pip install -r requirements.txt     # install dependencies
cp .env.example .env                # set DATABASE_URL / secrets
uvicorn main:app --reload
```

The API is served at `http://localhost:8000` with interactive docs at `/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev                          # starts Vite at http://localhost:5173
```

The frontend proxies API calls to `http://localhost:8000` (see `vite.config.js`).

---

> Built with teamwork by the **NeuraNote / Squad** team. For questions or contributions, open an issue or reach out to the core maintainers.
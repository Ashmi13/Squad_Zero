# NeuraNote

NeuraNote is an AI-powered note-taking application that transforms PDFs into structured notes using LLMs.

## Project Structure

```
neuranote_m3_frontend/
├── backend/       # Python FastAPI Server (AI Logic, Database)
├── frontend/      # React + Vite Frontend (UI, Components)
└── .gitignore     # Global gitignore
```

## How to Run

### 1. Backend (Python)
Navigate to the backend folder and run the server:
```bash
cd backend
# Activate venv if needed
python -m uvicorn main:app --reload
```
*Server runs on: http://localhost:8000*

### 2. Frontend (React)
Open a new terminal, navigate to the frontend folder, and start the dev server:
```bash
cd frontend
npm run dev
```
*App runs on: http://localhost:5173 (or 5174)*

## Features
- **PDF Upload & Processing**: extracting text from documents.
- **AI Note Generation**: Creating structured notes from PDFs.
- **Refinement**: "Tag & Refine" workflow to edit specific text using AI.
- **Manual Mode**: A distraction-free manual editor (Interim Demo Feature).

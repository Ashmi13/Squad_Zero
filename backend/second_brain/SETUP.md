# Second Brain — Setup & Testing (Member 5)

## The architecture (so the Supabase/AWS confusion is gone)

| Thing | Where it lives | In your `.env` |
|-------|---------------|----------------|
| Database (tables) | **Supabase Postgres** (which is *hosted on AWS*, hence the `aws-...pooler.supabase.com` host) | `DATABASE_URL` |
| Files / PDFs / notes storage | **AWS S3** bucket `neuranote`, region `eu-north-1` | `AWS_S3_BUCKET`, `AWS_REGION` |

Supabase **was not replaced by AWS**. Supabase Postgres = tables (still used).
AWS S3 = file storage (new). They're two different things that were always
meant to work side by side. Member 2's bug ("No writable file metadata
columns found") is about the **files table**, not your notes tables.

## What I already did (no action needed from you)

1. `second_brain/router.py` is already wired into `backend/app/main.py`:
   - On startup it prints `[OK] Second Brain routes loaded (/second-brain/*)`.
2. `second_brain/db.py` now:
   - reads `SECOND_BRAIN_DB_URL` → falls back to `DATABASE_URL` (already set),
   - auto-applies `sslmode=require` for Supabase/AWS hosts.
3. `second_brain/self_test.py` verifies the tag/backlink logic with an
   in-memory SQLite DB (no network, no member 2 code).

## Your 3 remaining steps

### Step 1 — Point it at the real DB (optional; falls back to DATABASE_URL already)
If you want the Second Brain to use a dedicated DB, add ONE line to `backend/.env`:

```
SECOND_BRAIN_DB_URL=postgresql+psycopg2://USER:PASS@HOST:5432/DBNAME
```

But you **do not have to**. Since `DATABASE_URL` already points at the shared
Supabase Postgres, the module will use that automatically. Skip this unless
you specifically want a separate database.

### Step 2 — Create the tables (one time)
From the `backend/` folder:

```
python -m second_brain.db
```

This creates ONLY these 4 tables in the same Supabase Postgres:
`notes`, `tags`, `note_tags`, `links`. It never touches member 2's
`files` / `folders` tables.

> To check in the Supabase dashboard: log in at supabase.com → your project
> `iatjbhvtcvnsbitpbfim` → **Table Editor** (left sidebar). You should see
> the 4 new tables listed alongside the existing ones.

### Step 3 — Verify the API is live
Start the backend normally, then open:

```
http://localhost:8000/docs
```

You should see a **"second-brain"** section with 9 endpoints.

## How to test RIGHT NOW (before member 2 fixes the sidebar)

You don't need the UI, Supabase, or member 2's code to prove the logic works:

```
cd backend
python -m second_brain.self_test
```

All 9 checks should print `PASS`, including:
- auto backlink from `[[Note Title]]`
- auto tags from repeated words
- manual tag add (case-insensitive dedupe)
- manual backlink add
- backlink shows in the note's `incoming_links`
- a note with no tag/backlink still saves fine

This uses a throwaway SQLite DB, so it tests **your logic**, not the
connection. To test the real Postgres connection separately, just run
Step 2 above — if it prints `Tables ready on: ...` without error, the
connection to Supabase Postgres works.

## The drag-and-drop contract for member 2 (hand this over)

When their sidebar is fixed, the frontend just needs to call ONE endpoint
after a file is dropped into the notes area:

```
POST /second-brain/notes
{
  "title": "Lecture 1",
  "content": "extracted text here...",
  "source_file_id": "<the file id from their workspace>"
}
```

Then `GET /second-brain/notes` lists everything, and the note will appear in
the Second Brain section. The backend already links the note back to their
file via `source_file_id` (a plain string — no import of their code).

## Manual tag / backlink endpoints (your "add after drop" feature)

| Action | Endpoint |
|--------|----------|
| Add tags to a note | `POST /second-brain/notes/{id}/tags` body `{"tags": ["x","y"]}` |
| Add a backlink | `POST /second-brain/notes/{id}/backlinks` body `{"target_note_id":"...","context":"optional"}` |
| View the link graph | `GET /second-brain/graph` |

## Q: "What if there's no backlink and no tag?"

The note is still created (verified in the self-test). You can then add tags
and backlinks manually via the two endpoints above, so the note connects to
other notes in the Second Brain later.

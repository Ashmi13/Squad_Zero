# Second Brain backend

Notes + tags + backlinks, decoupled from the upload/file-metadata code
(member 2's domain). It talks to the same Postgres DB via its own connection
and keeps its own tables.

## Why it doesn't break after the Supabase -> AWS migration

Supabase and AWS RDS are both Postgres. The migration only changed the
connection URL, not the SQL. This module reads its URL from
`SECOND_BRAIN_DB_URL` (fallback: `DATABASE_URL`) so it never collides with
member 2's settings.

## Setup

1. Add to `backend/.env`:

   ```
   SECOND_BRAIN_DB_URL=postgresql+psycopg2://USER:PASSWORD@HOST:5432/DBNAME
   ```

2. Create the tables (once):

   ```python
   from second_brain.db import init_db
   init_db()
   ```

3. Mount the router in the FastAPI app:

   ```python
   from second_brain.router import router as second_brain_router
   app.include_router(second_brain_router)
   ```

## How tags & backlinks are generated on drop

When a file is dropped into the notes section, the frontend calls
`POST /second-brain/notes` with `{title, content, source_file_id}`.
The backend then:

- **Backlinks** — scans the content for `[[Note Title]]` wikilinks AND for
  other notes' titles appearing verbatim. Creates a `links` row for each.
- **Tags** — reuses existing tags that appear in the text, and creates up to
  5 new tags from frequent non-stopword words (count >= 2).

If a note has no references, it's still created; the frontend can then call
`POST /second-brain/notes/{id}/tags` and `/backlinks` to add them manually.

## Endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST   | `/second-brain/notes` | create note on drop (auto tags + backlinks) |
| GET    | `/second-brain/notes` | list all notes (for the sidebar/notes section) |
| GET    | `/second-brain/notes/{id}` | one note + its tags, backlinks, outgoing links |
| PATCH  | `/second-brain/notes/{id}` | edit title/content |
| DELETE | `/second-brain/notes/{id}` | delete note |
| POST   | `/second-brain/notes/{id}/tags` | add tags manually |
| POST   | `/second-brain/notes/{id}/backlinks` | add a backlink manually |
| GET    | `/second-brain/tags` | all tags + note counts |
| GET    | `/second-brain/graph` | nodes + edges for the link graph |

## Drag-and-drop contract (member 2 -> this module)

Member 2's job: save the uploaded file and hand over extracted text.
This module's job: store the note and wire up tags/backlinks.

Frontend flow after member 2 fixes the sidebar:

1. User drops a file into the local folder (member 2 saves it, returns a file id).
2. Frontend extracts/gets the text.
3. Frontend calls `POST /second-brain/notes`.
4. The note shows up because `GET /second-brain/notes` is what the notes
   section renders. Nothing here reads member 2's file-metadata columns, so
   the "No writable file metadata columns found" bug cannot block it.

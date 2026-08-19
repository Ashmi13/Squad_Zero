"""Second Brain backend — notes, tags, and backlinks.

Fully decoupled from the upload/file-metadata code (member 2's domain).
It reads the same Postgres database through its own connection and keeps
its own tables, so it works regardless of the Supabase -> AWS migration
and regardless of whether the sidebar bug is fixed yet.
"""

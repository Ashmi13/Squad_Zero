"""
Second Brain self-test — verifies tags + backlinks logic WITHOUT any external
DB or member 2's code. Uses a throwaway in-memory SQLite database.

Run from the backend/ folder:

    python -m second_brain.self_test

It exercises the exact same service functions the /second-brain/* API calls,
so a PASS here means the logic works; wiring it to Postgres is just a URL change.
"""
import os

# Point the module at an in-memory SQLite DB for this test (no network needed).
os.environ["SECOND_BRAIN_DB_URL"] = "sqlite:///:memory:"

from sqlalchemy.orm import sessionmaker  # noqa: E402

from second_brain import models, services  # noqa: E402
from second_brain.db import engine, Base  # noqa: E402

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"


def check(name, condition, detail=""):
    status = PASS if condition else FAIL
    print(f"  [{status}] {name}{(' — ' + detail) if detail else ''}")
    return bool(condition)


def main():
    print("=" * 60)
    print("Second Brain self-test (in-memory SQLite)")
    print("=" * 60)

    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = Session()

    ok = True

    # 1. Create note A with a wikilink to note B + some repeated keywords.
    note_a = services.create_note_from_drop(
        db,
        title="Lecture 1 — Probability",
        content=(
            "This lecture covers probability distributions. "
            "See [[Lecture 2 — Inference]] for more. "
            "Probability and distributions are the core idea. "
            "Distributions help model uncertainty."
        ),
        source_file_id="file-abc",
    )
    # 2. Create note B (the backlink target must exist for [[...]] to resolve).
    note_b = services.create_note_from_drop(
        db,
        title="Lecture 2 — Inference",
        content="Inference is about estimating parameters from data.",
    )

    # --- Backlink check (auto, via wikilink) ---
    links_a = db.query(models.Link).filter(
        models.Link.source_note_id == note_a.id
    ).all()
    targets = {l.target_note_id for l in links_a}
    ok &= check(
        "Auto backlink created ([[wikilink]] A -> B)",
        note_b.id in targets,
        f"found {len(links_a)} outgoing link(s)",
    )

    # --- Tag check (auto) ---
    tag_names = {t.name for t in note_a.tags}
    ok &= check(
        "Auto tag 'probability' created",
        "probability" in tag_names,
        f"tags={sorted(tag_names)}",
    )
    ok &= check(
        "Auto tag 'distributions' created",
        "distributions" in tag_names,
        f"tags={sorted(tag_names)}",
    )

    # --- Manual tag ---
    note_a = services.add_tags(db, note_a, ["exam-prep", "Probability"])
    tag_names = {t.name for t in note_a.tags}
    ok &= check(
        "Manual tag 'exam-prep' added",
        "exam-prep" in tag_names,
        f"tags={sorted(tag_names)}",
    )
    ok &= check(
        "Manual tag 'Probability' deduped (case-insensitive)",
        "probability" in tag_names,
        f"tags={sorted(tag_names)}",
    )

    # --- Manual backlink B -> A (reverse direction) ---
    services.add_backlink(db, note_b, note_a.id, context="reverse ref")
    links_b = db.query(models.Link).filter(
        models.Link.source_note_id == note_b.id
    ).all()
    ok &= check(
        "Manual backlink created (B -> A)",
        any(l.target_note_id == note_a.id for l in links_b),
        f"found {len(links_b)} outgoing link(s)",
    )

    # --- Backlink appears in the note view (incoming_links) ---
    view = services.note_view(db, note_a)
    incoming = [b["from_note_id"] for b in view["backlinks"]]
    ok &= check(
        "Backlink visible in note view (incoming_links)",
        note_b.id in incoming,
        f"incoming from {len(incoming)} note(s)",
    )

    # --- Graph shape ---
    g = services.graph(db)
    ok &= check(
        "Graph returns 2 nodes + 2 edges",
        len(g["nodes"]) == 2 and len(g["edges"]) == 2,
        f"nodes={len(g['nodes'])} edges={len(g['edges'])}",
    )

    # --- Note with NO backlink and NO tag still saves cleanly ---
    note_c = services.create_note_from_drop(
        db, title="Orphan note", content="hi"
    )
    ok &= check(
        "Note with no tag/backlink still created",
        note_c.id is not None and len(note_c.tags) == 0,
        f"tags={sorted(t.name for t in note_c.tags)}",
    )

    db.close()
    print("=" * 60)
    print(f"Result: {PASS if ok else FAIL}")
    print("=" * 60)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

"""
IVI Seed Test Data — populate SQLite with realistic test data.

Usage:
    cd /path/to/IVI
    ./venv/bin/python3 -m tests.seed.run                        # uses default ~/.ivi/ivi.db
    IVI_DATA_DIR=/tmp/ivi-test ./venv/bin/python3 -m tests.seed.run   # custom path
    ./venv/bin/python3 -m tests.seed.run --fresh                 # drop & recreate tables

Run this before testing to have realistic data in the database.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from backend.db import Database
from tests.mock.data import (
    SEED_MEETINGS,
    SEED_SERIES,
    SEED_NOTES,
    SEED_COMMITMENTS,
    SEED_CONFLICTS,
    SEED_DOCUMENTS,
)


async def seed(fresh: bool = False) -> int:
    """Populate the database with test data. Returns total items created."""
    data_dir = Path(os.environ.get("IVI_DATA_DIR", str(Path.home() / ".ivi")))
    data_dir.mkdir(parents=True, exist_ok=True)
    db_path = data_dir / "ivi.db"

    if fresh and db_path.exists():
        db_path.unlink()
        print(f"🗑️  Deleted existing database: {db_path}")

    db = Database(db_path)
    await db.initialize()
    total = 0

    # --- Series ---
    for s in SEED_SERIES:
        try:
            db._conn.execute(
                "INSERT OR IGNORE INTO series (id, name) VALUES (?, ?)",
                (s["id"], s["name"]),
            )
            total += 1
        except Exception as e:
            print(f"  ⚠️  Series {s['id']}: {e}")
    db._conn.commit()
    print(f"✅ {len(SEED_SERIES)} series")

    # --- Meetings ---
    for m in SEED_MEETINGS:
        try:
            await db.create_meeting(
                m["id"],
                m["title"],
                platform=m["platform"],
                start_time=m["start_time"],
                duration_min=m["duration_min"],
                series_id=m.get("series_id"),
            )
            if m.get("ivi_attended"):
                await db.update_meeting(m["id"], ivi_attended=1)
            total += 1
        except Exception as e:
            print(f"  ⚠️  Meeting {m['id']}: {e}")
    print(f"✅ {len(SEED_MEETINGS)} meetings")

    # --- Notes ---
    for n in SEED_NOTES:
        try:
            await db.save_notes(
                n["meeting_id"],
                n.get("summary", ""),
                n.get("decisions", []),
                n.get("action_items", []),
            )
            total += 1
        except Exception as e:
            print(f"  ⚠️  Notes for {n['meeting_id']}: {e}")
    print(f"✅ {len(SEED_NOTES)} notes")

    # --- Commitments ---
    for c in SEED_COMMITMENTS:
        try:
            cid = await db.add_commitment(
                c["meeting_id"],
                c.get("series_id"),
                c["person"],
                c["description"],
                c.get("due_date"),
            )
            if c.get("status") == "done":
                await db.resolve_commitment(cid)
            total += 1
        except Exception as e:
            print(f"  ⚠️  Commitment: {e}")
    print(f"✅ {len(SEED_COMMITMENTS)} commitments")

    # --- Conflicts ---
    for c in SEED_CONFLICTS:
        try:
            cid = await db.add_conflict(c["meeting_a_id"], c["meeting_b_id"])
            if c.get("resolved"):
                await db.resolve_conflict(c["meeting_a_id"], c["meeting_b_id"], c.get("resolution", ""))
            total += 1
        except Exception as e:
            print(f"  ⚠️  Conflict: {e}")
    print(f"✅ {len(SEED_CONFLICTS)} conflicts")

    # --- Documents ---
    for d in SEED_DOCUMENTS:
        try:
            await db.add_document(d["name"], content=d.get("content", ""))
            total += 1
        except Exception as e:
            print(f"  ⚠️  Document {d['name']}: {e}")
    print(f"✅ {len(SEED_DOCUMENTS)} documents")

    await db.close()
    print(f"\n📊 Total records created: {total}")
    print(f"📁 Database: {db_path}")
    return total


if __name__ == "__main__":
    import asyncio

    fresh = "--fresh" in sys.argv
    asyncio.run(seed(fresh=fresh))

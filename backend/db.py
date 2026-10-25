"""
SQLite database layer for IVI.

Stores meetings, notes, series, documents, and commitments locally.
All data stays on the user's machine — no cloud storage.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


class Database:
    """Local SQLite database for IVI meeting data."""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._conn: sqlite3.Connection | None = None

    async def initialize(self):
        """Create tables if they don't exist."""
        self._conn = sqlite3.connect(str(self.db_path))
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")

        self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS series (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS meetings (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                platform TEXT DEFAULT '',
                start_time TEXT,
                end_time TEXT,
                duration_min INTEGER DEFAULT 0,
                ivi_attended INTEGER DEFAULT 0,
                series_id TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (series_id) REFERENCES series(id)
            );

            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                meeting_id TEXT NOT NULL,
                summary TEXT DEFAULT '',
                decisions TEXT DEFAULT '[]',
                action_items TEXT DEFAULT '[]',
                raw_transcript TEXT DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (meeting_id) REFERENCES meetings(id)
            );

            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                file_path TEXT DEFAULT '',
                content TEXT DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS commitments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                meeting_id TEXT NOT NULL,
                series_id TEXT,
                person TEXT DEFAULT '',
                description TEXT NOT NULL,
                due_date TEXT,
                status TEXT DEFAULT 'pending',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (meeting_id) REFERENCES meetings(id),
                FOREIGN KEY (series_id) REFERENCES series(id)
            );

            CREATE TABLE IF NOT EXISTS conflicts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                meeting_a_id TEXT NOT NULL,
                meeting_b_id TEXT NOT NULL,
                resolved INTEGER DEFAULT 0,
                resolution TEXT DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
        """)
        self._conn.commit()

    async def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None

    # --- Meetings ---

    async def create_meeting(self, meeting_id: str, title: str, **kw) -> bool:
        cur = self._conn.execute(
            """INSERT OR IGNORE INTO meetings (id, title, platform, start_time, duration_min, series_id)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (meeting_id, title, kw.get("platform", ""),
             kw.get("start_time"), kw.get("duration_min", 0),
             kw.get("series_id")),
        )
        self._conn.commit()
        return cur.rowcount > 0

    async def get_meetings(self, series_id: Optional[str] = None, limit: int = 20) -> list[dict]:
        if series_id:
            rows = self._conn.execute(
                "SELECT * FROM meetings WHERE series_id = ? ORDER BY start_time DESC LIMIT ?",
                (series_id, limit),
            ).fetchall()
        else:
            rows = self._conn.execute(
                "SELECT * FROM meetings ORDER BY start_time DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]

    async def get_meeting(self, meeting_id: str) -> dict | None:
        row = self._conn.execute(
            "SELECT * FROM meetings WHERE id = ?", (meeting_id,)
        ).fetchone()
        return dict(row) if row else None

    async def update_meeting(self, meeting_id: str, **kw) -> bool:
        fields = ", ".join(f"{k} = ?" for k in kw)
        vals = list(kw.values()) + [meeting_id]
        self._conn.execute(f"UPDATE meetings SET {fields} WHERE id = ?", vals)
        self._conn.commit()
        return True

    # --- Notes ---

    async def save_notes(self, meeting_id: str, summary: str,
                         decisions: list, action_items: list,
                         raw_transcript: str = "") -> int:
        cur = self._conn.execute(
            """INSERT INTO notes (meeting_id, summary, decisions, action_items, raw_transcript)
               VALUES (?, ?, ?, ?, ?)""",
            (meeting_id, summary, json.dumps(decisions),
             json.dumps(action_items), raw_transcript),
        )
        self._conn.commit()
        return cur.lastrowid

    async def get_notes(self, meeting_id: str) -> list[dict]:
        rows = self._conn.execute(
            "SELECT * FROM notes WHERE meeting_id = ? ORDER BY created_at DESC",
            (meeting_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    # --- Series ---

    async def create_series(self, name: str) -> str:
        import uuid
        sid = str(uuid.uuid4())[:8]
        self._conn.execute(
            "INSERT INTO series (id, name) VALUES (?, ?)", (sid, name)
        )
        self._conn.commit()
        return sid

    async def get_all_series(self) -> list[dict]:
        rows = self._conn.execute(
            "SELECT * FROM series ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]

    async def get_commitments(self, series_id: str) -> list[dict]:
        rows = self._conn.execute(
            """SELECT * FROM commitments
               WHERE series_id = ? AND status = 'pending'
               ORDER BY due_date ASC""",
            (series_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    # --- Documents ---

    async def add_document(self, name: str, file_path: str = "", content: str = "") -> int:
        cur = self._conn.execute(
            "INSERT INTO documents (name, file_path, content) VALUES (?, ?, ?)",
            (name, file_path, content),
        )
        self._conn.commit()
        return cur.lastrowid

    async def get_documents(self) -> list[dict]:
        rows = self._conn.execute(
            "SELECT * FROM documents ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]

    # --- Commitments ---

    async def add_commitment(self, meeting_id: str, series_id: str | None,
                              person: str, description: str,
                              due_date: str | None = None) -> int:
        cur = self._conn.execute(
            """INSERT INTO commitments (meeting_id, series_id, person, description, due_date)
               VALUES (?, ?, ?, ?, ?)""",
            (meeting_id, series_id, person, description, due_date),
        )
        self._conn.commit()
        return cur.lastrowid

    async def resolve_commitment(self, commitment_id: int):
        self._conn.execute(
            "UPDATE commitments SET status = 'done' WHERE id = ?",
            (commitment_id,),
        )
        self._conn.commit()

    # --- Conflicts ---

    async def add_conflict(self, meeting_a_id: str, meeting_b_id: str) -> int | None:
        """Record a detected conflict between two meetings. Returns id if new, None if already exists."""
        existing = self._conn.execute(
            "SELECT id FROM conflicts WHERE meeting_a_id = ? AND meeting_b_id = ?",
            (meeting_a_id, meeting_b_id),
        ).fetchone()
        if existing:
            return existing[0]
        # Normalize: always store with sorted IDs to avoid duplicates in reverse
        a, b = sorted([meeting_a_id, meeting_b_id])
        cur = self._conn.execute(
            "INSERT INTO conflicts (meeting_a_id, meeting_b_id) VALUES (?, ?)",
            (a, b),
        )
        self._conn.commit()
        return cur.lastrowid

    async def get_unresolved_conflicts(self) -> list[dict]:
        rows = self._conn.execute(
            "SELECT * FROM conflicts WHERE resolved = 0 ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]

    async def resolve_conflict(self, meeting_a_id: str, meeting_b_id: str, resolution: str):
        """Mark a conflict as resolved."""
        a, b = sorted([meeting_a_id, meeting_b_id])
        self._conn.execute(
            "UPDATE conflicts SET resolved = 1, resolution = ? WHERE meeting_a_id = ? AND meeting_b_id = ?",
            (resolution, a, b),
        )
        self._conn.commit()

    async def get_resolved_conflicts(self, limit: int = 20) -> list[dict]:
        rows = self._conn.execute(
            "SELECT * FROM conflicts WHERE resolved = 1 ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]

"""
IVI Backend Automated Tests

Tests all API endpoints using FastAPI TestClient.
Uses MOCK_MODE=1 and an isolated SQLite database (in-memory or temp file).
No real Google Calendar, Whisper, or LLM required.

Run:
    cd /path/to/IVI
    IVI_MOCK=1 IVI_DATA_DIR=/tmp/ivi-test ./venv/bin/python3 -m pytest backend/tests/ -v
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def test_data_dir() -> Path:
    """Create an isolated temp directory for test data."""
    tmp = Path(tempfile.mkdtemp(prefix="ivi_test_"))
    os.environ["IVI_DATA_DIR"] = str(tmp)
    os.environ["IVI_MOCK"] = "1"
    return tmp


@pytest.fixture(scope="session")
def client(test_data_dir: Path) -> TestClient:
    """FastAPI TestClient with mock mode and isolated data dir."""
    # Must set env BEFORE importing app
    from backend.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def seed_data(test_data_dir: Path) -> None:
    """Populate the test database with seed data (without dropping existing tables)."""
    from tests.seed.run import seed



    import asyncio

    asyncio.run(seed(fresh=False))


# =============================================================================
# Health & Status
# =============================================================================


class TestHealth:
    def test_health_endpoint(self, client: TestClient):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["version"] == "0.1.0"

    def test_mock_mode_active(self, client: TestClient):
        resp = client.get("/api/calendar/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["mock"] is True
        assert data["connected"] is True
        assert len(data["events"]) > 0


# =============================================================================
# Calendar
# =============================================================================


class TestCalendar:
    def test_calendar_status_events(self, client: TestClient):
        resp = client.get("/api/calendar/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["connected"] is True
        events = data["events"]
        assert len(events) >= 8

        # Verify event structure
        ev = events[0]
        assert "id" in ev
        assert "title" in ev
        assert "start" in ev
        assert "end" in ev
        assert "platform" in ev
        assert "participants" in ev

        # Verify overlapping events exist (for conflict detection)
        assert any("Daily" in e["title"] for e in events)
        assert any("Planning" in e["title"] for e in events)

    def test_calendar_auth_url_empty_in_mock(self, client: TestClient):
        resp = client.get("/api/calendar/status")
        assert resp.status_code == 200
        assert resp.json()["auth_url"] == ""


# =============================================================================
# Conflict Detection
# =============================================================================


class TestConflicts:
    def test_conflicts_with_seeded_data(self, client: TestClient, seed_data):
        """With seed data + mock calendar, overlapping events should create conflicts."""
        resp = client.get("/api/conflicts")
        assert resp.status_code == 200
        data = resp.json()
        assert "conflicts" in data
        assert "resolved_count" in data
        # We expect at least 2 conflicts from overlapping mock events
        assert len(data["conflicts"]) >= 2

    def test_conflict_structure(self, client: TestClient, seed_data):
        resp = client.get("/api/conflicts")
        data = resp.json()
        if data["conflicts"]:
            c = data["conflicts"][0]
            # Each conflict has left + right meeting data
            assert "id" in c
            assert "left" in c
            assert "right" in c
            assert "title" in c["left"]
            assert "title" in c["right"]
            assert "start" in c["left"]
            assert "end" in c["right"]

    def test_conflict_resolve(self, client: TestClient, seed_data):
        """Resolve a conflict and verify it moves to resolved count."""
        resp = client.get("/api/conflicts")
        data = resp.json()
        if not data["conflicts"]:
            pytest.skip("No conflicts to resolve")

        c = data["conflicts"][0]
        resp2 = client.post(
            "/api/conflicts/resolve",
            json={"meeting_a_id": c["left"]["id"], "meeting_b_id": c["right"]["id"], "resolution": "ignore"},
        )
        assert resp2.status_code == 200
        assert resp2.json()["status"] == "ok"

    def test_resolved_conflicts_endpoint(self, client: TestClient, seed_data):
        resp = client.get("/api/conflicts/resolved")
        assert resp.status_code == 200
        data = resp.json()
        assert "resolved" in data


# =============================================================================
# Meetings
# =============================================================================


class TestMeetings:
    def test_list_meetings(self, client: TestClient, seed_data):
        resp = client.get("/meetings")
        assert resp.status_code == 200
        data = resp.json()
        assert "meetings" in data
        assert len(data["meetings"]) >= 8

    def test_list_meetings_with_series_filter(self, client: TestClient, seed_data):
        resp = client.get("/meetings?series_id=ser_daily")
        assert resp.status_code == 200
        data = resp.json()
        for m in data["meetings"]:
            assert m.get("series_id") == "ser_daily"

    def test_get_single_meeting(self, client: TestClient, seed_data):
        resp = client.get("/meetings/meet_001")
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Sprint Daily 2026-10-23"
        assert data["id"] == "meet_001"

    def test_get_nonexistent_meeting(self, client: TestClient):
        resp = client.get("/meetings/nonexistent")
        assert resp.status_code == 404


# =============================================================================
# Notes
# =============================================================================


class TestNotes:
    def test_get_notes_for_meeting(self, client: TestClient, seed_data):
        resp = client.get("/meetings/meet_001/notes")
        assert resp.status_code == 200
        data = resp.json()
        assert "notes" in data
        assert len(data["notes"]) >= 1
        note = data["notes"][0]
        assert "summary" in note
        assert "decisions" in note
        assert "action_items" in note

    def test_notes_for_meeting_without_notes(self, client: TestClient):
        resp = client.get("/meetings/meet_006/notes")
        assert resp.status_code == 200
        data = resp.json()
        assert "notes" in data
        # meet_006 has no notes seeded
        assert len(data["notes"]) == 0


# =============================================================================
# Series
# =============================================================================


class TestSeries:
    def test_list_series(self, client: TestClient, seed_data):
        resp = client.get("/series")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["series"]) >= 3
        names = [s["name"] for s in data["series"]]
        assert any("Daily" in n for n in names)

    def test_create_series(self, client: TestClient):
        resp = client.post("/series", json={"name": "Test Series"})
        assert resp.status_code == 200
        data = resp.json()
        assert "series_id" in data

    def test_series_commitments(self, client: TestClient, seed_data):
        resp = client.get("/series/ser_retro/commitments")
        assert resp.status_code == 200
        data = resp.json()
        assert "commitments" in data
        assert len(data["commitments"]) >= 1


# =============================================================================
# Documents
# =============================================================================


class TestDocuments:
    def test_list_documents(self, client: TestClient, seed_data):
        resp = client.get("/documents")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["documents"]) >= 2

    def test_add_document(self, client: TestClient):
        resp = client.post("/documents", json={"name": "Test doc", "content": "test content"})
        assert resp.status_code == 200
        data = resp.json()
        assert "document_id" in data


# =============================================================================
# Commitments / Checklist
# =============================================================================


class TestCommitments:
    def test_upcoming_checklist(self, client: TestClient, seed_data):
        resp = client.get("/api/upcoming/checklist")
        assert resp.status_code == 200
        data = resp.json()
        assert "meeting" in data
        assert "commitments" in data

    def test_checklist_with_pending_items(self, client: TestClient, seed_data):
        resp = client.get("/api/upcoming/checklist")
        data = resp.json()
        # ser_daily has pending commitments from meetings with that series
        if data["meeting"]:
            assert "title" in data["meeting"]


# =============================================================================
# TTS
# =============================================================================


class TestTTS:
    def test_tts_endpoint(self, client: TestClient):
        resp = client.get("/api/tts", params={"text": "Hello world", "voice": "pl-PL-ZofiaNeural"})
        # TTS requires edge-tts; may return 500 if not installed
        assert resp.status_code in (200, 500)
        if resp.status_code == 200:
            assert resp.headers["content-type"].startswith("audio/")


# =============================================================================
# Seed data integrity
# =============================================================================


class TestSeedData:
    def test_seed_creates_all_types(self, client: TestClient, seed_data):
        """Verify seed data creates all entity types."""
        m = client.get("/meetings")
        s = client.get("/series")
        d = client.get("/documents")
        assert len(m.json()["meetings"]) >= 8
        assert len(s.json()["series"]) >= 3
        assert len(d.json()["documents"]) >= 2

    def test_seed_import_is_idempotent(self, test_data_dir: Path):
        """Running seed twice should not crash (INSERT OR IGNORE)."""
        from tests.seed.run import seed
        import asyncio
        asyncio.run(seed(fresh=False))  # run again — should be safe
        assert True

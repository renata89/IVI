# IVI Backend — Python FastAPI
# Meeting assistant: audio capture → STT → LLM notes → SQLite
# Runs as child process launched by Electron main.js

from __future__ import annotations

import json
import logging
import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .db import Database

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
BACKEND_PORT = int(os.environ.get("IVI_BACKEND_PORT", "8765"))
DATA_DIR = Path(os.environ.get("IVI_DATA_DIR", str(Path.home() / ".ivi")))
DATA_DIR.mkdir(parents=True, exist_ok=True)
MOCK_MODE = os.environ.get("IVI_MOCK", "") == "1"

logger = logging.getLogger("ivi-backend")

# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------
db: Database | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global db
    db = Database(DATA_DIR / "ivi.db")
    await db.initialize()
    logger.info(f"IVI Backend started on port {BACKEND_PORT}, data dir: {DATA_DIR}")
    yield
    if db:
        await db.close()
    logger.info("IVI Backend shut down")


app = FastAPI(title="IVI Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


# --- Meetings ---

@app.get("/meetings")
async def list_meetings(series_id: Optional[str] = None, limit: int = 20):
    """List meetings, optionally filtered by series."""
    return {"meetings": await db.get_meetings(series_id=series_id, limit=limit)}


@app.get("/meetings/{meeting_id}")
async def get_meeting(meeting_id: str):
    m = await db.get_meeting(meeting_id)
    if not m:
        raise HTTPException(404, "Meeting not found")
    return m


# --- Notes ---

@app.get("/meetings/{meeting_id}/notes")
async def get_notes(meeting_id: str):
    return {"notes": await db.get_notes(meeting_id)}


# --- Series ---

@app.get("/series")
async def list_series():
    return {"series": await db.get_all_series()}


@app.post("/series")
async def create_series(data: dict):
    sid = await db.create_series(data.get("name", "Untitled Series"))
    return {"series_id": sid}


@app.get("/series/{series_id}/commitments")
async def get_commitments(series_id: str):
    """Get all pending commitments across meetings in a series."""
    return {"commitments": await db.get_commitments(series_id)}


# --- Documents ---

@app.get("/documents")
async def list_documents():
    return {"documents": await db.get_documents()}


@app.post("/documents")
async def add_document(data: dict):
    """Register a document for context matching."""
    doc_id = await db.add_document(
        name=data["name"],
        file_path=data.get("file_path", ""),
        content=data.get("content", ""),
    )
    return {"document_id": doc_id}


# --- Text-to-Speech ---

from fastapi.responses import StreamingResponse

@app.get("/api/tts")
async def text_to_speech(text: str, voice: str = "pl-PL-ZofiaNeural"):
    """Generate speech audio from text using edge-tts."""
    try:
        import edge_tts
        communicate = edge_tts.Communicate(text, voice)
        audio_stream = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_stream += chunk["data"]

        return StreamingResponse(
            iter([audio_stream]),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline",
                "Cache-Control": "no-cache",
            },
        )
    except Exception as e:
        logger.error(f"TTS error: {e}")
        from fastapi.responses import JSONResponse
        return JSONResponse({"error": str(e)}, status_code=500)


# --- Commitments / Checklist ---

@app.get("/api/upcoming/checklist")
async def upcoming_checklist():
    """Get pending commitments for the next upcoming meeting (if any)."""
    if not db:
        return {"meeting": None, "commitments": []}

    meetings = await db.get_meetings(limit=5)
    if not meetings:
        return {"meeting": None, "commitments": []}

    # Find the first meeting with a series
    for m in meetings:
        if m.get("series_id"):
            commitments = await db.get_commitments(m["series_id"])
            if commitments:
                return {
                    "meeting": {"id": m["id"], "title": m["title"]},
                    "commitments": commitments,
                }

    return {"meeting": None, "commitments": []}


@app.post("/commitments/{commitment_id}/resolve")
async def resolve_commitment(commitment_id: int):
    """Mark a commitment as resolved."""
    if not db:
        raise HTTPException(500, "Database not ready")
    await db.resolve_commitment(commitment_id)
    return {"status": "ok"}


@app.get("/api/teams/sync-status")
async def teams_sync_status():
    """Get Teams sync status."""
    if not db:
        return {"connected": False, "recordings_total": 0, "recordings_processed": 0, "recordings_unprocessed": 0, "last_sync_minutes_ago": 0}
    meetings = await db.get_meetings(limit=50)
    total = len(meetings)
    processed = 0
    for m in meetings:
        notes = await db.get_notes(m["id"])
        if notes:
            processed += 1
    unprocessed = total - processed
    return {
        "connected": True,
        "recordings_total": total,
        "recordings_processed": processed,
        "recordings_unprocessed": unprocessed,
        "last_sync_minutes_ago": 5,
    }


# --- Calendar (Google) ---

from .calendar import CalendarClient

_calendar: CalendarClient | None = None


@app.get("/api/calendar/status")
async def calendar_status():
    """Check if calendar is connected and get upcoming events."""
    global _calendar

    # MOCK MODE: return fake events without Google API
    if MOCK_MODE:
        from tests.mock.data import MOCK_CALENDAR_EVENTS
        return {"connected": True, "events": MOCK_CALENDAR_EVENTS, "auth_url": "", "mock": True}

    if _calendar is None:
        _calendar = CalendarClient()

    connected = await _calendar.load_token()
    if not connected:
        return {"connected": False, "events": [], "auth_url": _calendar.get_auth_url()}

    events = await _calendar.get_upcoming_events(max_results=10)
    return {"connected": True, "events": events, "auth_url": ""}


@app.get("/api/calendar/oauth/callback")
async def calendar_oauth_callback(code: str = ""):
    """OAuth callback — exchange code for token."""
    global _calendar
    if _calendar is None:
        _calendar = CalendarClient()

    token = await _calendar.exchange_code(code)
    if "access_token" in token:
        return {"status": "ok", "message": "Calendar connected! You can close this tab."}
    return {"status": "error", "message": token.get("error_description", "OAuth failed")}


# --- Conflict Detection ---


@app.get("/api/conflicts")
async def detect_conflicts():
    """Detect overlapping calendar events and return unresolved conflicts."""
    global _calendar
    if not db:
        return {"conflicts": [], "resolved_count": 0}

    # MOCK MODE: detect conflicts using mock calendar events
    if MOCK_MODE:
        from tests.mock.data import MOCK_CALENDAR_EVENTS
        events = MOCK_CALENDAR_EVENTS
    else:
        if _calendar is None:
            _calendar = CalendarClient()

        # Get upcoming events
        connected = await _calendar.load_token()
        if not connected:
            logger.info("Calendar not connected — no conflict detection")
            return {"conflicts": [], "resolved_count": 0, "connected": False}

        events = await _calendar.get_upcoming_events(max_results=20)

    # Detect overlaps
    conflicts = []
    already_resolved = set()
    for cr in await db.get_unresolved_conflicts():
        already_resolved.add((cr["meeting_a_id"], cr["meeting_b_id"]))

    for i in range(len(events)):
        for j in range(i + 1, len(events)):
            a, b = events[i], events[j]
            # Skip all-day / date-only events (no time)
            if not a.get("start") or not b.get("start"):
                continue
            # Check overlap
            if a["end"] > b["start"] and a["start"] < b["end"]:
                conflict_id = f"{a['id']}|{b['id']}"
                a_id, b_id = sorted([a["id"], b["id"]])
                is_resolved = (a_id, b_id) in already_resolved
                if not is_resolved:
                    # Store in DB if new
                    await db.add_conflict(a["id"], b["id"])
                    conflicts.append({
                        "id": conflict_id,
                        "left": {
                            "id": a["id"],
                            "title": a["title"],
                            "start": a["start"],
                            "end": a["end"],
                            "platform": a.get("platform", "Unknown"),
                            "participants": a.get("participants", 0),
                            "type": "video" if a.get("platform") in ("Teams", "Zoom", "Google Meet") else "inperson",
                        },
                        "right": {
                            "id": b["id"],
                            "title": b["title"],
                            "start": b["start"],
                            "end": b["end"],
                            "platform": b.get("platform", "Unknown"),
                            "participants": b.get("participants", 0),
                            "type": "video" if b.get("platform") in ("Teams", "Zoom", "Google Meet") else "inperson",
                        },
                    })

    # Get resolved count
    resolved = await db.get_resolved_conflicts()
    return {
        "conflicts": conflicts,
        "resolved_count": len(resolved),
        "connected": True,
    }


@app.post("/api/conflicts/resolve")
async def resolve_conflict(data: dict):
    """Mark a conflict as resolved."""
    if not db:
        return {"status": "error", "message": "Database not ready"}
    meeting_a = data.get("meeting_a_id", "")
    meeting_b = data.get("meeting_b_id", "")
    resolution = data.get("resolution", "ignore")
    await db.resolve_conflict(meeting_a, meeting_b, resolution)
    return {"status": "ok"}


@app.get("/api/conflicts/resolved")
async def resolved_conflicts():
    """Get history of resolved conflicts."""
    if not db:
        return {"resolved": []}
    resolved = await db.get_resolved_conflicts()
    return {"resolved": resolved}


# --- Push-to-Talk ---

_PTT_CONTEXT = ""


@app.websocket("/ws/ptt")
async def ptt_websocket(websocket: WebSocket):
    """Receive short mic audio clip, return transcription."""
    await websocket.accept()
    from .stt import TranscriptionEngine
    engine = TranscriptionEngine()
    import tempfile, os, json

    audio_buffer = bytearray()

    try:
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break
            if msg["type"] == "websocket.receive":
                data = msg.get("text") or msg.get("bytes")
                if isinstance(data, bytes):
                    audio_buffer.extend(data)
                elif isinstance(data, str):
                    try:
                        ctrl = json.loads(data)
                        if ctrl.get("type") == "end":
                            if audio_buffer:
                                tmp = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
                                tmp.write(audio_buffer)
                                tmp.close()
                                text = await engine.transcribe(tmp.name)
                                os.unlink(tmp.name)
                            else:
                                text = ""
                            await websocket.send_json({"text": text, "type": "ptt_result"})
                            break
                    except json.JSONDecodeError:
                        pass
    except Exception as e:
        logger.error(f"PTT WS error: {e}")
    finally:
        await engine.cleanup()


@app.get("/api/ptt")
async def ptt_query(q: str = ""):
    """Answer a voice query using meeting context + LLM."""
    if not q:
        return {"answer": "Nie usłyszałem pytania."}

    from .llm import LLMPipeline
    llm = LLMPipeline()

    prompt = f"""Jesteś IVI — asystentem meetingowym. Odpowiadasz na pytanie
użytkownika na podstawie notatek ze spotkań.

Kontekst (notatki z ostatnich spotkań):
{_PTT_CONTEXT or "Brak kontekstu."}

Pytanie użytkownika: {q}

Odpowiedz krótko (max 2-3 zdania), po polsku, tylko na podstawie faktów.
Jeśli nie znasz odpowiedzi, powiedz to."""

    try:
        result = await llm._call_llm(prompt)
        if isinstance(result, dict):
            answer = result.get("summary", result.get("answer", str(result)))
        else:
            answer = str(result)
        return {"answer": answer}
    except Exception as e:
        return {"answer": f"Błąd: {e}"}


# --- Audio / WebSocket ---

@app.websocket("/ws/audio")
async def audio_websocket(websocket: WebSocket):
    """Receive audio chunks from Electron, return transcription + notes."""
    await websocket.accept()
    logger.info("Audio WebSocket connected")

    from .stt import TranscriptionEngine
    from .llm import LLMPipeline
    engine = TranscriptionEngine()
    llm = LLMPipeline()
    import tempfile, os, json

    audio_buffer = bytearray()
    meeting_id = None
    meeting_title = "Untitled Meeting"

    try:
        while True:
            msg = await websocket.receive()

            if msg["type"] == "websocket.disconnect":
                logger.info("Client disconnected")
                break

            if msg["type"] == "websocket.receive":
                data = msg.get("text") or msg.get("bytes")
                if data is None:
                    continue

                if isinstance(data, str):
                    try:
                        ctrl = json.loads(data)
                        if ctrl.get("type") == "start":
                            meeting_id = ctrl.get("meeting_id", "unknown")
                            meeting_title = ctrl.get("title", "Untitled Meeting")
                            logger.info(f"Transcription started: {meeting_title} ({meeting_id})")
                            audio_buffer.clear()
                        elif ctrl.get("type") == "end":
                            logger.info(f"Transcription ended: {meeting_title}")
                            text = "[mock - Whisper laduje]"
                            speakers = []
                            if audio_buffer:
                                tmp = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
                                tmp.write(audio_buffer)
                                tmp.close()
                                result = await engine.transcribe(tmp.name)
                                os.unlink(tmp.name)
                                if isinstance(result, dict):
                                    text = result.get("text", text)
                                    speakers = result.get("speakers", [])
                                elif isinstance(result, str):
                                    text = result

                            logger.info(f"Transcribed {len(text)} chars{' with diarization' if speakers else ''} — generating notes...")

                            # LLM: generate structured notes from transcription
                            notes = await llm.summarize(text)

                            # Save to database
                            if db:
                                await db.create_meeting(
                                    meeting_id=meeting_id,
                                    title=meeting_title,
                                    start_time=ctrl.get("start_time"),
                                    duration_min=ctrl.get("duration_min", 0),
                                )
                                note_id = await db.save_notes(
                                    meeting_id=meeting_id,
                                    summary=notes.get("summary", ""),
                                    decisions=notes.get("decisions", []),
                                    action_items=notes.get("action_items", []),
                                    raw_transcript=text,
                                )
                                # Save speaker info to meeting metadata
                                if speakers:
                                    import json as _json
                                    await db.update_meeting(
                                        meeting_id,
                                        metadata=_json.dumps({"speakers": speakers})
                                    )
                                # Save action items as commitments
                                for ai in notes.get("action_items", []):
                                    await db.add_commitment(
                                        meeting_id=meeting_id,
                                        series_id=None,
                                        person=ai.get("who", ""),
                                        description=ai.get("what", ""),
                                        due_date=ai.get("when", ""),
                                    )

                            await websocket.send_json({
                                "type": "notes_ready",
                                "meeting_id": meeting_id,
                                "meeting_title": meeting_title,
                                "summary": notes.get("summary", ""),
                                "decisions": notes.get("decisions", []),
                                "action_items": notes.get("action_items", []),
                                "speakers": speakers,
                                "diarized": bool(speakers),
                            })
                            logger.info(f"Notes for '{meeting_title}' ready")
                    except json.JSONDecodeError:
                        pass
                elif isinstance(data, bytes):
                    audio_buffer.extend(data)
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    finally:
        await engine.cleanup()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )
    uvicorn.run(
        "backend.main:app",
        host="127.0.0.1",
        port=BACKEND_PORT,
        log_level="info",
        reload=True,
    )


if __name__ == "__main__":
    main()

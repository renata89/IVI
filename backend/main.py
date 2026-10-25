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


# --- Audio / WebSocket ---

@app.websocket("/ws/audio")
async def audio_websocket(websocket: WebSocket):
    """Receive audio chunks from Electron, return transcription."""
    await websocket.accept()
    logger.info("Audio WebSocket connected")

    from .stt import TranscriptionEngine
    engine = TranscriptionEngine()
    import tempfile, os, json

    audio_buffer = bytearray()
    meeting_id = None

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
                            logger.info(f"Transcription started: {meeting_id}")
                            audio_buffer.clear()
                        elif ctrl.get("type") == "end":
                            logger.info(f"Transcription ended: {meeting_id}")
                            text = "[mock - Whisper w trakcie ladowania]"
                            if audio_buffer:
                                tmp = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
                                tmp.write(audio_buffer)
                                tmp.close()
                                text = await engine.transcribe(tmp.name)
                                os.unlink(tmp.name)
                            await websocket.send_json({
                                "type": "transcription_final",
                                "text": text,
                                "meeting_id": meeting_id,
                            })
                            logger.info(f"Transcription sent ({len(text)} chars)")
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

"""
Whisper STT (Speech-to-Text) engine for IVI.

Transcribes audio chunks streamed from Electron desktop capture.
Runs locally — no data leaves the machine.
"""

from __future__ import annotations

import logging
import time
from typing import Optional

logger = logging.getLogger("ivi-stt")


class TranscriptionEngine:
    """
    Wraps OpenAI Whisper for real-time transcription.

    Uses a small/local model by default (base.en).
    Falls back to a mock for development without GPU.
    """

    def __init__(self, model_name: str = "base"):
        self.model_name = model_name
        self._model = None
        self._loaded = False

    async def load(self):
        """Load Whisper model (lazy — first transcription triggers this)."""
        if self._loaded:
            return

        try:
            import whisper
            logger.info(f"Loading Whisper model: {self.model_name}")
            t0 = time.time()
            self._model = whisper.load_model(self.model_name)
            self._loaded = True
            logger.info(f"Whisper loaded in {time.time()-t0:.1f}s")
        except ImportError:
            logger.warning("whisper not installed, using mock STT")
            self._loaded = True  # mock mode
        except Exception as e:
            logger.warning(f"Whisper load failed ({e}), using mock STT")
            self._loaded = True  # mock mode

    async def transcribe(self, audio_path: str | None = None) -> str:
        """
        Transcribe audio file.
        In Phase 1 this will accept streaming chunks via WebSocket.
        """
        await self.load()

        if self._model is not None:
            result = self._model.transcribe(audio_path or "", language="pl")
            return result.get("text", "").strip()
        else:
            # Mock mode — return placeholder
            return "[Transkrypcja będzie dostępna po instalacji Whisper]"

    async def cleanup(self):
        self._model = None
        self._loaded = False

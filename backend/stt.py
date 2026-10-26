"""
Whisper STT (Speech-to-Text) engine for IVI.

Transcribes audio chunks streamed from Electron desktop capture.
Runs locally — no data leaves the machine.

Supports optional speaker diarization via WhisperX + pyannote.audio.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Optional

logger = logging.getLogger("ivi-stt")


class TranscriptionEngine:
    """
    Wraps Whisper/WhisperX for real-time transcription + diarization.

    Falls back to mock for development without GPU or missing deps.
    """

    def __init__(self, model_name: str = "base", diarize: bool = True):
        self.model_name = model_name
        self.diarize = diarize
        self._model = None
        self._loaded = False
        self._diarization_available = False

    async def load(self):
        """Load Whisper model (lazy — first transcription triggers this)."""
        if self._loaded:
            return

        try:
            import whisperx

            logger.info(f"Loading WhisperX model: {self.model_name}")
            t0 = time.time()
            device = "cpu"
            compute_type = "int8"  # faster on CPU

            self._model = whisperx.load_model(
                self.model_name,
                device=device,
                compute_type=compute_type,
                language="pl",
            )
            self._loaded = True
            logger.info(f"WhisperX loaded in {time.time()-t0:.1f}s (device={device})")

            # Check diarization
            if self.diarize:
                try:
                    # Just verify pyannote is importable
                    import pyannote.audio
                    self._diarization_available = True
                    logger.info("Speaker diarization available (pyannote.audio)")
                except ImportError:
                    self._diarization_available = False
                    logger.info("Speaker diarization disabled (pyannote.audio not found)")

        except ImportError:
            logger.warning("whisperx not installed, falling back to standard whisper")
            await self._load_fallback()
        except Exception as e:
            logger.warning(f"WhisperX load failed ({e}), fallback to whisper")
            await self._load_fallback()

    async def _load_fallback(self):
        """Fallback to standard whisper."""
        try:
            import whisper
            logger.info(f"Loading Whisper (fallback): {self.model_name}")
            t0 = time.time()
            self._model = whisper.load_model(self.model_name)
            self._loaded = True
            logger.info(f"Whisper loaded in {time.time()-t0:.1f}s")
        except ImportError:
            logger.warning("whisper not installed either, using mock STT")
            self._loaded = True  # mock mode
        except Exception as e:
            logger.warning(f"Whisper fallback failed ({e}), using mock STT")
            self._loaded = True

    async def transcribe(
        self, audio_path: str | None = None
    ) -> dict:
        """
        Transcribe audio file and return result with optional diarization.

        Returns dict with:
          - text: full transcript text
          - segments: list of {start, end, text, speaker?}
          - speakers: list of unique speaker labels (if diarized)
          - diarized: bool
        """
        await self.load()

        result: dict = {
            "text": "",
            "segments": [],
            "speakers": [],
            "diarized": False,
        }

        if not self._loaded or not audio_path:
            result["text"] = "[Transkrypcja będzie dostępna po instalacji Whisper]"
            return result

        try:
            import whisperx

            # Transcribe with word timestamps
            t0 = time.time()
            transcribe_result = self._model.transcribe(audio_path, batch_size=16)
            logger.info(f"Transcription completed in {time.time()-t0:.1f}s")

            result["text"] = transcribe_result.get("text", "").strip()

            # Align whisper output (better word timestamps)
            if transcribe_result.get("segments"):
                try:
                    model_a, metadata = whisperx.load_align_model(
                        language_code=transcribe_result.get("language", "pl"),
                        device="cpu",
                    )
                    transcribe_result = whisperx.align(
                        transcribe_result["segments"],
                        model_a,
                        metadata,
                        audio_path,
                        device="cpu",
                    )
                except Exception as e:
                    logger.warning(f"Alignment skipped: {e}")

            # Diarization
            if self._diarization_available and self.diarize:
                try:
                    diarize_model = whisperx.DiarizationPipeline(
                        use_auth_token=None,
                        device="cpu",
                    )
                    diarize_segments = diarize_model(audio_path)
                    transcribe_result = whisperx.assign_word_speakers(
                        diarize_segments, transcribe_result
                    )
                    result["diarized"] = True
                    logger.info("Diarization completed")
                except Exception as e:
                    logger.warning(f"Diarization failed: {e}")

            # Build segments
            segments = transcribe_result.get("segments", [])
            for seg in segments:
                entry = {
                    "start": round(seg.get("start", 0), 2),
                    "end": round(seg.get("end", 0), 2),
                    "text": seg.get("text", "").strip(),
                }
                speaker = seg.get("speaker")
                if speaker:
                    entry["speaker"] = speaker
                    if speaker not in result["speakers"]:
                        result["speakers"].append(speaker)
                result["segments"].append(entry)

            return result

        except ImportError:
            # Fallback to standard whisper
            try:
                import whisper
                whisper_result = self._model.transcribe(
                    audio_path, language="pl"
                )
                text = whisper_result.get("text", "").strip()
                result["text"] = text
                for seg in whisper_result.get("segments", []):
                    result["segments"].append({
                        "start": round(seg.get("start", 0), 2),
                        "end": round(seg.get("end", 0), 2),
                        "text": seg.get("text", "").strip(),
                    })
                return result
            except Exception as e:
                logger.warning(f"Fallback transcription failed: {e}")
                result["text"] = "[Transcription error]"
                return result

    async def cleanup(self):
        self._model = None
        self._loaded = False
        self._diarization_available = False

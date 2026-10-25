"""
LLM pipeline for IVI.

Generates meeting summaries, action items, decisions, and live suggestions
from transcribed text. Supports OpenAI, Claude, Gemini, or any compatible API.

For v0.1.0, defaults to a prompt-based approach using whatever LLM Renata
has configured (OpenAI / Gemini).
"""

from __future__ import annotations

import json
import logging
import os
from typing import Optional

logger = logging.getLogger("ivi-llm")


class LLMPipeline:
    """
    Generates structured notes from meeting transcripts.
    Supports multiple backends: openai, claude, gemini, or mock.
    """

    def __init__(self, backend: str = "openai", api_key: str | None = None):
        self.backend = backend
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self._client = None

    async def summarize(self, transcript: str) -> dict:
        """
        Take raw transcript → return structured notes with:
        - summary: short paragraph
        - decisions: list of {"what": "...", "by_whom": "..."}
        - action_items: list of {"who": "...", "what": "...", "when": "..."}
        """
        if not transcript or transcript.startswith("[Transkrypcja"):
            return {
                "summary": "Brak transkrypcji — audio capture jeszcze nieaktywne.",
                "decisions": [],
                "action_items": [],
            }

        prompt = f"""Jesteś IVI — asystentem notującym spotkania.
Przeanalizuj poniższą transkrypcję i wyciągnij:
1. Krótkie podsumowanie (max 3 zdania, po polsku)
2. Podjęte decyzje (lista)
3. Action items — kto, co, na kiedy (lista)

Transkrypcja:
{transcript}

Odpowiedz wyłącznie w formacie JSON:
{{"summary": "...", "decisions": [{{"what": "...", "by_whom": "..."}}], "action_items": [{{"who": "...", "what": "...", "when": "..."}}]}}"""

        return await self._call_llm(prompt)

    async def generate_suggestions(self, transcript_segment: str,
                                    documents: list[dict]) -> list[str]:
        """Generate live suggestions based on current conversation + user docs."""
        if not documents:
            return []

        doc_context = "\n".join(
            f"- {d.get('name', 'unknown')}: {d.get('content', '')[:200]}"
            for d in documents
        )

        prompt = f"""Jesteś IVI. Użytkownik ma załadowane dokumenty. 
Trwa spotkanie. Na podstawie tego co właśnie padło i dokumentów,
zaproponuj 1-2 krótkie podpowiedzi dla użytkownika (po polsku).

Właśnie powiedziano:
"{transcript_segment}"

Dokumenty użytkownika:
{doc_context}

Odpowiedz JSON: {{"suggestions": ["...", "..."]}}"""

        return await self._call_llm(prompt)

    async def extract_commitments(self, notes: dict, meeting_id: str,
                                   series_id: str | None = None) -> list[dict]:
        """Extract structured commitments from meeting notes."""
        items = []
        for ai in notes.get("action_items", []):
            items.append({
                "meeting_id": meeting_id,
                "series_id": series_id,
                "person": ai.get("who", ""),
                "description": ai.get("what", ""),
                "due_date": ai.get("when", ""),
            })
        return items

    async def _call_llm(self, prompt: str) -> dict | list:
        """
        Call configured LLM backend.
        Falls back to mock if no API key configured.
        """
        if self.backend == "openai" and self.api_key:
            try:
                import openai
                client = openai.AsyncOpenAI(api_key=self.api_key)
                resp = await client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                    response_format={"type": "json_object"},
                )
                return json.loads(resp.choices[0].message.content)
            except Exception as e:
                logger.warning(f"OpenAI call failed ({e}), using mock")

        elif self.backend == "gemini":
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                model = genai.GenerativeModel("gemini-2.0-flash")
                resp = model.generate_content(prompt)
                return json.loads(resp.text)
            except Exception as e:
                logger.warning(f"Gemini call failed ({e}), using mock")

        # Mock fallback
        return {
            "summary": "MOCK: LLM not configured — podsumowanie będzie dostępne po skonfigurowaniu API.",
            "decisions": [],
            "action_items": [],
            "suggestions": ["Skonfiguruj klucz API w ustawieniach IVI → LLM"],
        }

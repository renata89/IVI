"""
Google Calendar integration for IVI.

Uses Google Calendar API to fetch upcoming meetings.
OAuth2 authentication via localhost redirect.

Data is used only to detect meetings — no events are created/modified
(except for optional prep-session auto-scheduling).
"""

from __future__ import annotations

import json
import logging
import os
import webbrowser
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlencode

import httpx

logger = logging.getLogger("ivi-calendar")

# Google OAuth2 config — from env or built-in defaults
CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
if not CLIENT_ID:
    CLIENT_ID = "994182343288-p078opoo2345t76bvamn7qntg0ksq7ot" + ".apps.googleusercontent.com"
CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
if not CLIENT_SECRET:
    CLIENT_SECRET = "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"
REDIRECT_URI = "http://127.0.0.1:8765/api/calendar/oauth/callback"
SCOPES = "https://www.googleapis.com/auth/calendar.readonly"

TOKEN_FILE = Path.home() / ".ivi" / "google_token.json"


class CalendarClient:
    """Simple Google Calendar client for fetching meetings."""

    def __init__(self):
        self._token: dict | None = None
        self._client = httpx.AsyncClient(timeout=10)

    async def load_token(self) -> bool:
        """Load stored OAuth token from disk."""
        try:
            if TOKEN_FILE.exists():
                self._token = json.loads(TOKEN_FILE.read_text())
                return True
        except Exception:
            pass
        return False

    async def save_token(self, token: dict):
        """Save OAuth token to disk."""
        TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
        TOKEN_FILE.write_text(json.dumps(token, indent=2))
        self._token = token

    def get_auth_url(self) -> str:
        """Get Google OAuth consent URL."""
        params = {
            "client_id": CLIENT_ID,
            "redirect_uri": REDIRECT_URI,
            "response_type": "code",
            "scope": SCOPES,
            "access_type": "offline",
            "prompt": "consent",
        }
        return f"https://accounts.google.com/o/oauth2/auth?{urlencode(params)}"

    async def exchange_code(self, code: str) -> dict:
        """Exchange authorization code for tokens."""
        resp = await self._client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "redirect_uri": REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        data = resp.json()
        if "access_token" in data:
            await self.save_token(data)
        return data

    async def refresh_token(self) -> bool:
        """Refresh access token if expired."""
        if not self._token or "refresh_token" not in self._token:
            return False

        resp = await self._client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "refresh_token": self._token["refresh_token"],
                "grant_type": "refresh_token",
            },
        )
        data = resp.json()
        if "access_token" in data:
            self._token["access_token"] = data["access_token"]
            await self.save_token(self._token)
            return True
        return False

    async def get_upcoming_events(self, max_results: int = 20) -> list[dict]:
        """Fetch upcoming calendar events."""
        if not self._token:
            return []

        # Check if token needs refresh
        expires_at = self._token.get("expires_at", 0)
        if expires_at and datetime.now().timestamp() > expires_at - 300:
            await self.refresh_token()

        access_token = self._token.get("access_token", "")
        now = datetime.now(timezone.utc).isoformat()
        week_later = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

        resp = await self._client.get(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            params={
                "timeMin": now,
                "timeMax": week_later,
                "maxResults": max_results,
                "singleEvents": "true",
                "orderBy": "startTime",
            },
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if resp.status_code == 401:
            await self.refresh_token()
            return await self.get_upcoming_events(max_results)

        if resp.status_code != 200:
            logger.warning(f"Calendar API error: {resp.status_code}")
            return []

        data = resp.json()
        events = []
        for item in data.get("items", []):
            start = item.get("start", {}).get("dateTime") or item.get("start", {}).get("date", "")
            end = item.get("end", {}).get("dateTime") or item.get("end", {}).get("date", "")
            events.append({
                "id": item.get("id", ""),
                "title": item.get("summary", "Untitled"),
                "start": start,
                "end": end,
                "platform": _detect_platform(item),
                "participants": len(item.get("attendees", [])),
                "link": item.get("hangoutLink") or item.get("htmlLink", ""),
            })

        return events

    async def cleanup(self):
        await self._client.aclose()


def _detect_platform(event: dict) -> str:
    """Detect meeting platform from event details."""
    link = event.get("hangoutLink", "") or event.get("htmlLink", "")
    desc = event.get("description", "")
    text = link + desc

    if "zoom.us" in text.lower():
        return "Zoom"
    if "meet.google.com" in text.lower():
        return "Google Meet"
    if "teams.microsoft.com" in text.lower() or "microsoft teams" in text.lower():
        return "Teams"
    if "gotomeeting" in text.lower():
        return "GoToMeeting"
    if "webex" in text.lower():
        return "Webex"
    if link.startswith("https://meet.google.com"):
        return "Google Meet"
    return "Unknown"

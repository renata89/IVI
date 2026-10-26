"""
IVI Mock Data — realistic test data for development and testing.

Activated by setting IVI_MOCK=1 in environment.
Provides mock Google Calendar events, transcripts, and LLM responses
so the app works fully offline without real API keys.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone


# =============================================================================
# MOCK CALENDAR EVENTS
# =============================================================================
# These simulate realistic Google Calendar events with overlaps for conflict
# detection testing.

_now = datetime.now(timezone.utc)
_today = _now.strftime("%Y-%m-%d")
_yesterday_1 = (_now - timedelta(days=1)).strftime("%Y-%m-%d")
_yesterday_2 = (_now - timedelta(days=2)).strftime("%Y-%m-%d")
_tomorrow = (_now + timedelta(days=1)).strftime("%Y-%m-%d")
_day_after = (_now + timedelta(days=2)).strftime("%Y-%m-%d")


def _t(date_str: str, time_str: str) -> str:
    """Build ISO datetime string from date and time."""
    return f"{date_str}T{time_str}:00"


MOCK_CALENDAR_EVENTS = [
    # --- Today: overlapping pair (conflict) ---
    {
        "id": "mock_event_001",
        "title": "Sprint Daily — Testigo",
        "start": _t(_today, "09:00"),
        "end": _t(_today, "09:15"),
        "platform": "Teams",
        "participants": 5,
        "link": "https://teams.microsoft.com/l/meeting/mock001",
    },
    {
        "id": "mock_event_002",
        "title": "e-Krew sync",
        "start": _t(_today, "09:00"),
        "end": _t(_today, "09:30"),
        "platform": "Zoom",
        "participants": 3,
        "link": "https://zoom.us/j/mock002",
    },
    # --- Today: standalone meeting ---
    {
        "id": "mock_event_003",
        "title": "Ideamotive — screening QA",
        "start": _t(_today, "11:00"),
        "end": _t(_today, "11:45"),
        "platform": "Teams",
        "participants": 2,
        "link": "https://teams.microsoft.com/l/meeting/mock003",
    },
    # --- Tomorrow: Sprint Planning (series meeting) ---
    {
        "id": "mock_event_004",
        "title": "Sprint Planning — Testigo",
        "start": _t(_tomorrow, "10:00"),
        "end": _t(_tomorrow, "11:30"),
        "platform": "Google Meet",
        "participants": 6,
        "link": "https://meet.google.com/mock004",
    },
    # --- Tomorrow: overlapping pair ---
    {
        "id": "mock_event_005",
        "title": "Klient: Nowy projekt",
        "start": _t(_tomorrow, "11:00"),
        "end": _t(_tomorrow, "12:00"),
        "platform": "Zoom",
        "participants": 4,
        "link": "https://zoom.us/j/mock005",
    },
    {
        "id": "mock_event_006",
        "title": "Retro — Testigo",
        "start": _t(_tomorrow, "11:30"),
        "end": _t(_tomorrow, "12:30"),
        "platform": "Teams",
        "participants": 5,
        "link": "https://teams.microsoft.com/l/meeting/mock006",
    },
    # --- Day after: single meeting + all-day event ---
    {
        "id": "mock_event_007",
        "title": "1:1 z Renata",
        "start": _t(_day_after, "14:00"),
        "end": _t(_day_after, "14:30"),
        "platform": "Teams",
        "participants": 2,
        "link": "https://teams.microsoft.com/l/meeting/mock007",
    },
    {
        "id": "mock_event_008",
        "title": "Warsztat: AI w testowaniu",
        "start": _t(_day_after, "10:00"),
        "end": _t(_day_after, "16:00"),
        "platform": "Google Meet",
        "participants": 12,
        "link": "https://meet.google.com/mock008",
    },
    # --- All-day event (no time, skipped by conflict detection) ---
    {
        "id": "mock_event_009",
        "title": "Urodziny zespołu",
        "start": _t(_day_after, "00:00"),
        "end": _t(_day_after, "23:59"),
        "platform": "Unknown",
        "participants": 0,
        "link": "",
    },
]


# =============================================================================
# MOCK TRANSCRIPT
# =============================================================================

MOCK_TRANSCRIPT = """
Dzień dobry, zaczynamy daily. Wczoraj skończyłem implementację endpointu do wykrywania konfliktów.
Testy przechodzą, ale muszę dodać jeszcze walidację dla allday eventów.
Bloker: czekam na review PR od Anny.
Dzisiaj: poprawki po review i przygotowanie testów E2E.
Ja wczoraj pracowałam nad UI dashboardu — dodałam kartę konfliktów. 
Jest problem z responsywnością na małych ekranach.
Dzisiaj: fix CSS i testy manualne na różnych rozdzielczościach.
Sprint idzie zgodnie z planem, ryzyko: Anna jest na urlopie w przyszłym tygodniu.
Decyzja: przełożymy retro na czwartek zamiast piątku.
"""


# =============================================================================
# MOCK LLM RESPONSE
# =============================================================================

MOCK_LLM_SUMMARY = {
    "summary": (
        "Daily Scrum — zespół Testigo. Zakończono implementację wykrywania konfliktów "
        "i dodano UI dashboardu z kartą konfliktów. Zidentyfikowano problem responsywności "
        "na małych ekranach. Bloker: oczekiwanie na review PR. Ryzyko: urlop Anny w przyszłym tygodniu."
    ),
    "decisions": [
        {"what": "Retro przełożone z piątku na czwartek", "by_whom": "Zespół"},
        {"what": "Anna robi review PR do końca dnia", "by_whom": "Anna"},
    ],
    "action_items": [
        {"who": "Developer", "what": "Dodać walidację dla allday eventów", "when": "2026-10-27"},
        {"who": "Developer", "what": "Przygotować testy E2E konfliktów", "when": "2026-10-28"},
        {"who": "Designer", "what": "Fix CSS responsywności karty konfliktów", "when": "2026-10-26"},
        {"who": "Zespół", "what": "Testy manualne na różnych rozdzielczościach", "when": "2026-10-27"},
    ],
}

MOCK_LLM_SUGGESTIONS = {
    "suggestions": [
        "W dokumentach projektu jest wzór raportu konfliktów — możesz go użyć do E2E.",
        "W poprzedniej retro ktoś zgłaszał podobny problem responsywności — sprawdź notatki.",
    ]
}


# =============================================================================
# MOCK DOCUMENTS
# =============================================================================

MOCK_DOCUMENTS = [
    {
        "name": "Wzór raportu konfliktów",
        "content": "Raport konfliktów zawiera: ID spotkania, tytuł, godzinę, uczestników, platformę, typ konfliktu. Dla każdego konfliktu: proponowane rozwiązanie (reschedule / ignore).",
    },
    {
        "name": "Testigo — standardy QA",
        "content": "Testy E2E: Playwright. Testy API: pytest. Testy manualne: checklista w folderze docs/tests. Każdy bug: nagranie ekranu + kroki reprodukcji.",
    },
    {
        "name": "IVI — architektura",
        "content": "Frontend: Electron + vanilla JS. Backend: FastAPI + SQLite. STT: Whisper (lokalnie). LLM: OpenAI/Gemini (mock offline). Audio capture: desktopCapturer API.",
    },
]


# =============================================================================
# MOCK MEETING DATA (for seed script)
# =============================================================================

SEED_MEETINGS = [
    {
        "id": "meet_001",
        "title": "Sprint Daily 2026-10-23",
        "platform": "Teams",
        "start_time": _t(_yesterday_2, "09:00"),
        "end_time": _t(_yesterday_2, "09:15"),
        "duration_min": 15,
        "ivi_attended": 1,
        "series_id": "ser_daily",
    },
    {
        "id": "meet_002",
        "title": "e-Krew tech sync",
        "platform": "Zoom",
        "start_time": _t(_yesterday_2, "10:00"),
        "end_time": _t(_yesterday_2, "10:30"),
        "duration_min": 30,
        "ivi_attended": 1,
        "series_id": None,
    },
    {
        "id": "meet_003",
        "title": "Retro — Sprint 12",
        "platform": "Teams",
        "start_time": _t(_yesterday_1, "15:00"),
        "end_time": _t(_yesterday_1, "16:00"),
        "duration_min": 60,
        "ivi_attended": 1,
        "series_id": "ser_retro",
    },
    {
        "id": "meet_004",
        "title": "Sprint Planning — Sprint 13",
        "platform": "Google Meet",
        "start_time": _t(_yesterday_1, "10:00"),
        "end_time": _t(_yesterday_1, "11:30"),
        "duration_min": 90,
        "ivi_attended": 1,
        "series_id": "ser_planning",
    },
    {
        "id": "meet_005",
        "title": "Sprint Daily 2026-10-24",
        "platform": "Teams",
        "start_time": _t(_yesterday_1, "09:00"),
        "end_time": _t(_yesterday_1, "09:15"),
        "duration_min": 15,
        "ivi_attended": 1,
        "series_id": "ser_daily",
    },
    {
        "id": "meet_006",
        "title": "Sprint Daily 2026-10-25",
        "platform": "Teams",
        "start_time": _t(_today, "09:00"),
        "end_time": _t(_today, "09:15"),
        "duration_min": 15,
        "ivi_attended": 0,
        "series_id": "ser_daily",
    },
    {
        "id": "meet_007",
        "title": "Ideamotive — screening tester",
        "platform": "Teams",
        "start_time": _t(_today, "11:00"),
        "end_time": _t(_today, "11:45"),
        "duration_min": 45,
        "ivi_attended": 0,
        "series_id": None,
    },
    {
        "id": "meet_008",
        "title": "1:1 z Anną",
        "platform": "Teams",
        "start_time": _t(_today, "14:00"),
        "end_time": _t(_today, "14:30"),
        "duration_min": 30,
        "ivi_attended": 0,
        "series_id": "ser_1on1",
    },
    {
        "id": "meet_009",
        "title": "Refinement — backlog Q4",
        "platform": "Google Meet",
        "start_time": _t(_tomorrow, "13:00"),
        "end_time": _t(_tomorrow, "14:00"),
        "duration_min": 60,
        "ivi_attended": 0,
        "series_id": None,
    },
    {
        "id": "meet_010",
        "title": "Klient — demo MVP",
        "platform": "Zoom",
        "start_time": _t(_tomorrow, "15:00"),
        "end_time": _t(_tomorrow, "16:00"),
        "duration_min": 60,
        "ivi_attended": 0,
        "series_id": None,
    },
]

SEED_SERIES = [
    {"id": "ser_daily", "name": "Daily Scrum — Testigo"},
    {"id": "ser_retro", "name": "Retro — Testigo"},
    {"id": "ser_planning", "name": "Sprint Planning — Testigo"},
    {"id": "ser_1on1", "name": "1:1 z zespołem"},
]

SEED_NOTES = [
    {
        "meeting_id": "meet_001",
        "summary": "Daily Scrum. Frontend: progress na dashboardzie. Backend: API conflicts gotowe do testów. Bloker: czekamy na review. Decyzja: retro przeniesione na czwartek.",
        "decisions": [
            {"what": "Retro przeniesione na czwartek", "by_whom": "Zespół"},
        ],
        "action_items": [
            {"who": "Frontend", "what": "Dokończyć UI dashboardu", "when": "2026-10-24"},
            {"who": "Backend", "what": "Testy API conflicts", "when": "2026-10-24"},
        ],
    },
    {
        "meeting_id": "meet_003",
        "summary": "Retro Sprint 12. Pozytywy: poprawa jakości testów, szybsze daily. Negatywy: za dużo context-switch, brak czasu na refactor. Akcja: ograniczyć WIP do 3 tasków na osobę.",
        "decisions": [
            {"what": "Limitujemy WIP do 3 tasków na osobę", "by_whom": "Zespół"},
            {"what": "Dodajemy 2h refactora w każdym sprincie", "by_whom": "PM"},
        ],
        "action_items": [
            {"who": "SM", "what": "Zaktualizować Definition of Done", "when": "2026-10-27"},
            {"who": "Zespół", "what": "Zredukować WIP na tablicy", "when": "2026-10-26"},
        ],
    },
    {
        "meeting_id": "meet_004",
        "title": "Sprint Planning — Sprint 13",
        "summary": "Planowanie Sprint 13. 5 story points zaplanowane. Główny focus: IVI v0.2.0 (RAG + series). Ryzyko: Anna na urlopie. Kapacitiy: 32h/osoba.",
        "decisions": [
            {"what": "Sprint 13 focus: IVI v0.2.0", "by_whom": "PM"},
            {"what": "Anna przekazuje kontekst przed urlopem", "by_whom": "Anna"},
        ],
        "action_items": [
            {"who": "PM", "what": "Przygotować backlog na sprint 13", "when": "2026-10-26"},
            {"who": "Anna", "what": "Sesja przekazania wiedzy", "when": "2026-10-25"},
        ],
    },
]

SEED_COMMITMENTS = [
    {
        "meeting_id": "meet_003",
        "series_id": "ser_retro",
        "person": "SM",
        "description": "Zaktualizować Definition of Done",
        "due_date": "2026-10-27",
        "status": "pending",
    },
    {
        "meeting_id": "meet_003",
        "series_id": "ser_retro",
        "person": "Zespół",
        "description": "Zredukować WIP na tablicy do 3 tasków",
        "due_date": "2026-10-26",
        "status": "pending",
    },
    {
        "meeting_id": "meet_004",
        "series_id": "ser_planning",
        "person": "PM",
        "description": "Przygotować backlog na sprint 13",
        "due_date": "2026-10-26",
        "status": "pending",
    },
    {
        "meeting_id": "meet_004",
        "series_id": "ser_planning",
        "person": "Anna",
        "description": "Sesja przekazania wiedzy przed urlopem",
        "due_date": "2026-10-25",
        "status": "done",
    },
    {
        "meeting_id": "meet_001",
        "series_id": "ser_daily",
        "person": "Frontend",
        "description": "Dokończyć UI dashboardu",
        "due_date": "2026-10-24",
        "status": "done",
    },
]

SEED_CONFLICTS = [
    {
        "meeting_a_id": "mock_event_001",
        "meeting_b_id": "mock_event_002",
        "resolved": 0,
        "resolution": "",
    },
    {
        "meeting_a_id": "mock_event_005",
        "meeting_b_id": "mock_event_006",
        "resolved": 0,
        "resolution": "",
    },
    {
        "meeting_a_id": "mock_event_001",  # resolved conflict
        "meeting_b_id": "mock_event_003",  # these don't actually overlap, just for data
        "resolved": 1,
        "resolution": "ignore",
    },
]

SEED_DOCUMENTS = [
    {
        "name": "Wzór raportu konfliktów",
        "content": MOCK_DOCUMENTS[0]["content"],
    },
    {
        "name": "Testigo — standardy QA",
        "content": MOCK_DOCUMENTS[1]["content"],
    },
    {
        "name": "IVI — architektura",
        "content": MOCK_DOCUMENTS[2]["content"],
    },
]

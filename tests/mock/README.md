# IVI — Mock data

Mocki dla trybu offline (`IVI_MOCK=1`).
Backend importuje z tego folderu zamiast łączyć się z Google Calendar / Whisper / LLM.

## Zawartość

- `data.py` — wszystkie mock data: eventy kalendarza, transkrypty, odpowiedzi LLM, dokumenty

## Użycie

Mocki są automatycznie aktywowane przez `IVI_MOCK=1`:
```bash
IVI_MOCK=1 ./venv/bin/python3 -m backend.main
```

## Mock calendar events

9 eventów, w tym:
- 2 pary nakładających się spotkań (test konfliktów)
- eventy all-day (pomijane przez detekcję konfliktów)
- Różne platformy: Teams, Zoom, Google Meet

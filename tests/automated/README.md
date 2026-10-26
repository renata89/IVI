# IVI — Testy automatyczne

Testy API backendu IVI z użyciem FastAPI TestClient + pytest.
Używają mock mode (`IVI_MOCK=1`) — nie potrzebują Google Calendar ani Whisper.

## Uruchomienie

```bash
# Z katalogu IVI
IVI_MOCK=1 ./venv/bin/python3 -m pytest tests/automated/ -v
```

## Co jest testowane

- Health check
- Calendar status (mock)
- Wykrywanie konfliktów
- Rozwiązywanie konfliktów
- Lista spotkań
- Notatki
- Serie spotkań
- Dokumenty
- Zobowiązania
- TTS
- Seed data

## Konfiguracja

Testy tworzą izolowaną bazę SQLite w temp dirze.
Zmienna `IVI_DATA_DIR` ustawiana automatycznie przez fixture.

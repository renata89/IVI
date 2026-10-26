# IVI — Seed test data

Skrypt do wypełnienia bazy SQLite realistycznymi danymi testowymi.

## Uruchomienie

```bash
cd /path/to/IVI

# Podstawowe (używa ~/.ivi/ivi.db)
./venv/bin/python3 -m tests.seed.run

# Świeża baza (usuwa starą)
./venv/bin/python3 -m tests.seed.run --fresh

# Niestandardowa lokalizacja
IVI_DATA_DIR=/tmp/ivi-test ./venv/bin/python3 -m tests.seed.run --fresh
```

## Co tworzy (28 rekordów)

| Typ | Ilość |
|---|---|
| Series | 4 |
| Meetings | 10 |
| Notes | 3 |
| Commitments | 5 |
| Conflicts | 3 |
| Documents | 3 |

Skrypt jest idempotentny — drugie uruchomienie nie sypie błędami.

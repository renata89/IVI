# IVI — Meeting Assistant

Desktop meeting companion app. Captures system audio, transcribes meetings, generates notes and action items, detects calendar conflicts, and provides live AI suggestions.

**Author:** Renata Lesko-Gębczyk  
**License:** MIT  
**Stack:** Electron + Python (FastAPI) + SQLite

---

## Architecture

> 📐 Visual diagram available: [`IVI-architecture.html`](./IVI-architecture.html) — open in any browser.

```
┌─────────────────────────────────────────────┐
│              Electron Desktop App            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  main.js  │  │ preload  │  │ renderer │  │
│  │ (process) │  │  (bridge)│  │  (HTML)  │  │
│  └────┬─────┘  └──────────┘  └────┬─────┘  │
│       │                           │         │
│  ┌────▼───────────────────────────▼─────┐   │
│  │         Python Backend (FastAPI)      │   │
│  │  port 8765 • REST + WebSocket         │   │
│  │  STT • LLM • Calendar • SQLite        │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

- **Audio capture** via Electron `desktopCapturer` → system audio
- **Transcription** via Whisper/WhisperX (local, no cloud)
- **LLM summaries** via OpenAI, Gemini, or fallback mock
- **Calendar** via Google Calendar API (OAuth2)
- **All data local** — SQLite database in `~/.ivi/`

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **npm** (included with Node.js)

### 1. Setup Backend

```bash
python3 -m venv venv
source venv/bin/activate      # macOS/Linux
# .\venv\Scripts\activate     # Windows

pip install -r backend/requirements.txt
```

### 2. Setup Frontend

```bash
npm install
```

### 3. Run (Development)

```bash
# Terminal 1 — Backend (optional — Electron can spawn it)
source venv/bin/activate
python3 -m backend.main

# Terminal 2 — Desktop app
npm run dev
```

The Electron app automatically starts the Python backend as a child process on port `8765`.

### 4. Build for Distribution

```bash
npm run build          # macOS .dmg
npm run build:win      # Windows .exe
npm run build:all      # Both platforms
```

Builds are output to `release/`.

---

## Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Default | Description |
|---|---|---|
| `IVI_LLM_BACKEND` | `gemini` | LLM provider: `openai`, `gemini`, or empty (mock) |
| `IVI_LLM_API_KEY` | — | API key for the LLM provider |
| `GOOGLE_CLIENT_ID` | (built-in) | Google Calendar OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | (built-in) | Google Calendar OAuth secret |
| `IVI_BACKEND_PORT` | `8765` | Backend server port |
| `IVI_MOCK` | — | Set to `1` to enable mock mode (no API keys needed) |

---

## Project Structure

```
IVI/
├── main.js                 # Electron main process
├── preload.js              # Context bridge (security)
├── tracker.js              # Calendar polling & meeting detection
├── audio-capture.js        # System audio capture module
├── package.json            # Node.js dependencies
│
├── renderer/               # Desktop UI
│   ├── index.html          # HTML structure
│   ├── css/main.css        # Styles
│   └── js/
│       ├── app.js          # Main application logic
│       ├── login.js        # Login & i18n
│       └── mock-panel.js   # Dev mock controls
│
├── backend/                # Python FastAPI backend
│   ├── main.py             # API server (REST + WebSocket)
│   ├── db.py               # SQLite database layer
│   ├── stt.py              # Speech-to-text (Whisper)
│   ├── llm.py              # LLM pipeline (summaries)
│   ├── calendar.py         # Google Calendar integration
│   └── requirements.txt    # Python dependencies
│
├── tests/                  # Test helpers
│   ├── mock/data.py        # Mock calendar events
│   ├── manual/             # Manual test scenarios
│   └── seed/               # Seed data for testing
│
├── assets/                 # Icons & branding
├── build/                  # Build config (entitlements)
└── release/                # Compiled builds
```

---

## Features

- ✅ **System audio capture** — records meeting audio from desktop
- ✅ **Speech-to-text** — local Whisper transcription
- ✅ **AI summaries** — automatic meeting notes via LLM
- ✅ **Live suggestions** — context-aware prompts during meetings
- ✅ **Push-to-talk** — hotkey (`Cmd/Ctrl+Shift+I`) for quick questions
- ✅ **Calendar sync** — Google Calendar integration
- ✅ **Conflict detection** — overlapping meeting alerts
- ✅ **Todo lists** — action items from meetings
- ✅ **Series tracking** — recurring meeting series with commitments
- ✅ **Fully local** — all data stays on your machine
- ✅ **Mock mode** — works without any API keys for development

---

## Selling / Acquisition

IVI is available for acquisition. The codebase is:

- **Clean architecture** with separation of concerns
- **Self-contained** — single machine, no cloud dependencies
- **Cross-platform** — macOS and Windows builds configured
- **Local-first** — privacy-focused, no external data storage
- **Extensible** — well-defined API between frontend and backend

For inquiries, contact the author.

.PHONY: dev dev-backend build build-all clean test lint

# === Development ===

dev:  ## Run Electron app in development mode (backend auto-starts)
	npm run dev

dev-backend:  ## Run backend only (for testing without Electron)
	. venv/bin/activate && python3 -m backend.main

dev-backend-mock:  ## Run backend in mock mode (no API keys needed)
	IVI_MOCK=1 . venv/bin/activate && python3 -m backend.main

# === Build ===

build:  ## Build macOS .dmg
	npm run build

build-win:  ## Build Windows .exe
	npm run build:win

build-all:  ## Build for both platforms
	npm run build:all

# === Docker ===

docker-build:  ## Build Docker image for backend
	docker compose build

docker-up:  ## Start backend in Docker container
	docker compose up -d

docker-down:  ## Stop Docker container
	docker compose down

docker-logs:  ## View Docker logs
	docker compose logs -f

# === Quality ===

test:  ## Run backend syntax check
	. venv/bin/activate && python3 -c "import py_compile; py_compile.compile('backend/main.py', doraise=True); py_compile.compile('backend/db.py', doraise=True); print('✓ Backend syntax OK')"
	node -c main.js
	node -c preload.js
	node -c tracker.js
	node -c audio-capture.js
	@echo "✓ All files OK"

lint: test  ## Alias for test (no linter configured yet)

# === Utilities ===

clean:  ## Remove build artifacts
	rm -rf release/
	rm -rf node_modules/.cache

# === Help ===

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help

# IVI Backend — Dockerfile
# Build: docker build -f Dockerfile -t ivi-backend .
# Run:   docker run -p 8765:8765 -v ~/.ivi:/root/.ivi ivi-backend

FROM python:3.11-slim

WORKDIR /app

# Install system deps for audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy backend code
COPY backend/ ./backend/
COPY tests/ ./tests/

# Install Python dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Port
EXPOSE 8765

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/health')" || exit 1

# Run backend
CMD ["python3", "-m", "backend.main"]

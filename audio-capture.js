/**
 * IVI — Audio Capture Module
 *
 * Captures system audio using Electron's desktopCapturer API.
 * Streams audio chunks to the Python backend via WebSocket for STT.
 *
 * Design:
 * - We use desktopCapturer to get a "screen" source (which carries system audio on macOS/Windows)
 * - A hidden <audio> element processes the stream
 * - MediaRecorder chunks the audio into Opus packets
 * - Each chunk is sent over WebSocket to the Python backend
 */

let mediaRecorder = null;
let ws = null;
let audioStream = null;
let onStatusChange = null;

const BACKEND_WS_URL = 'ws://127.0.0.1:8765/ws/audio';

/**
 * Start capturing system audio and streaming to the backend.
 * @param {Function} statusCallback - Called with status updates { type, message }
 * @returns {Promise<boolean>} - true if capture started successfully
 */
async function startCapture(statusCallback) {
  onStatusChange = statusCallback || (() => {});

  try {
    // 1. Get audio source from desktopCapturer
    onStatusChange({ type: 'info', message: 'Selecting audio source...' });
    const sources = await window.ivi.desktopCapturer.getSources({
      types: ['screen'],
      fetchWindowIcons: false,
      thumbnailSize: { width: 0, height: 0 }
    });

    if (!sources || sources.length === 0) {
      onStatusChange({ type: 'error', message: 'No screen source found' });
      return false;
    }

    // Pick the first screen source (primary display)
    const source = sources[0];

    // 2. Get user media with system audio
    onStatusChange({ type: 'info', message: 'Accessing system audio...' });
    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id
        }
      },
      video: false
    });

    if (!audioStream || audioStream.getAudioTracks().length === 0) {
      onStatusChange({ type: 'error', message: 'No audio track in system stream' });
      return false;
    }

    onStatusChange({ type: 'success', message: 'System audio captured' });

    // 3. Connect WebSocket to backend
    onStatusChange({ type: 'info', message: 'Connecting to backend...' });
    ws = new WebSocket(BACKEND_WS_URL);

    await new Promise((resolve, reject) => {
      ws.onopen = () => {
        onStatusChange({ type: 'success', message: 'Connected to backend' });
        resolve();
      };
      ws.onerror = (err) => {
        onStatusChange({ type: 'error', message: 'WebSocket error: ' + (err.message || 'unknown') });
        reject(err);
      };
      ws.onclose = () => {
        onStatusChange({ type: 'info', message: 'WebSocket disconnected' });
      };
    });

    // 4. Start MediaRecorder to chunk audio
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    mediaRecorder = new MediaRecorder(audioStream, {
      mimeType,
      audioBitsPerSecond: 16000
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0 && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(event.data);
      }
    };

    mediaRecorder.start(1000); // Send chunks every 1 second

    onStatusChange({ type: 'listening', message: 'IVI is listening — transcribing...' });
    return true;

  } catch (err) {
    console.error('[IVI Audio] Capture error:', err);
    onStatusChange({ type: 'error', message: 'Capture error: ' + err.message });
    return false;
  }
}

/**
 * Stop audio capture and close WebSocket.
 */
function stopCapture() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (audioStream) {
    audioStream.getTracks().forEach(t => t.stop());
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  onStatusChange({ type: 'idle', message: 'Capture stopped' });
}

module.exports = { startCapture, stopCapture };

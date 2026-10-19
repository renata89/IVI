const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Simple calendar & meeting detection tracker
// Polls every 30 seconds for now

let intervalId = null;
let onEvent = null;
const POLL_INTERVAL = 30000; // 30s

// --------------- Mock data (MVP) ---------------
// Will be replaced with real calendar integration later

const MOCK_EVENTS = [
  {
    title: 'Product Sync Q4',
    start: new Date(Date.now() + 2 * 60 * 60 * 1000), // in 2 hours
    duration: 45,
    hasContext: true,
    documents: ['Spec_API_v2.pdf', 'Q4_goals.pdf']
  },
  {
    title: 'Teacher Lab — UI review',
    start: new Date(Date.now() + 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000), // tomorrow 10:00
    duration: 60,
    hasContext: true,
    documents: ['Teacher_Lab_requirements.pdf']
  },
  {
    title: 'e-Krew technical sync',
    start: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000), // day after tomorrow 11:00
    duration: 60,
    hasContext: false,
    documents: []
  }
];

let notifiedSoon = {};
let notifiedStarted = {};

// --------------- Process detection ---------------
function isAppRunning(appName) {
  try {
    const cmd = process.platform === 'darwin'
      ? `pgrep -i "${appName}" || true`
      : `tasklist /fi "IMAGENAME eq ${appName}" 2>nul | find /i "${appName}" >nul && echo 1 || echo 0`;
    const result = execSync(cmd, { encoding: 'utf-8', timeout: 2000 }).trim();
    return result !== '';
  } catch {
    return false;
  }
}

// --------------- Polling loop ---------------
function poll() {
  const now = Date.now();

  // Check meetings
  for (const meeting of MOCK_EVENTS) {
    const msUntilStart = meeting.start.getTime() - now;
    const eventId = meeting.title;

    // 5 minutes before: "meeting soon" notification
    if (msUntilStart > 4 * 60 * 1000 && msUntilStart <= 5 * 60 * 1000 && !notifiedSoon[eventId]) {
      notifiedSoon[eventId] = true;
      if (onEvent) {
        onEvent({
          type: 'meeting_soon',
          title: meeting.title,
          hasContext: meeting.hasContext
        });
      }
    }

    // Meeting started (within first minute)
    if (msUntilStart >= 0 && msUntilStart <= 60 * 1000 && !notifiedStarted[eventId]) {
      notifiedStarted[eventId] = true;
      if (onEvent) {
        onEvent({
          type: 'meeting_started',
          title: meeting.title
        });
      }
    }
  }
}

// --------------- Public API ---------------
function startTracker(callback) {
  onEvent = callback;
  // Initial poll
  poll();
  intervalId = setInterval(poll, POLL_INTERVAL);
}

function stopTracker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function getUpcomingMeetings() {
  return MOCK_EVENTS.map(m => ({
    title: m.title,
    start: m.start.toISOString(),
    duration: m.duration,
    hasContext: m.hasContext,
    documents: m.documents
  }));
}

module.exports = { startTracker, stopTracker, getUpcomingMeetings };

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Simple calendar & meeting detection tracker
// Polls every 30 seconds — uses real calendar data from backend

let intervalId = null;
let onEvent = null;
const POLL_INTERVAL = 30000;

// --------------- Calendar fetch ---------------
const BACKEND_URL = 'http://127.0.0.1:8765';

function fetchFromBackend(endpoint) {
  return new Promise((resolve, reject) => {
    http.get(`${BACKEND_URL}${endpoint}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    }).on('error', (err) => {
      resolve(null);
    });
  });
}

// --------------- Polling loop ---------------
let notifiedSoon = {};
let notifiedStarted = {};

async function poll() {
  const now = Date.now();

  // Fetch real calendar events from backend
  const calData = await fetchFromBackend('/api/calendar/status');
  const events = (calData && calData.connected) ? calData.events : [];

  // Fallback: use mock if calendar not connected
  const meetingList = events.length > 0
    ? events.map(e => ({
        title: e.title,
        start: new Date(e.start),
        duration: e.end ? Math.round((new Date(e.end) - new Date(e.start)) / 60000) : 30,
        hasContext: false,
        documents: [],
        platform: e.platform,
        participants: e.participants || 0,
        id: e.id,
      }))
    : getMockEvents();

  // Check meetings
  for (const meeting of meetingList) {
    const msUntilStart = meeting.start.getTime() - now;
    const eventId = meeting.title;

    // 5 minutes before: "meeting soon" notification
    if (msUntilStart > 4 * 60 * 1000 && msUntilStart <= 5 * 60 * 1000 && !notifiedSoon[eventId]) {
      notifiedSoon[eventId] = true;
      if (onEvent) {
        onEvent({
          type: 'meeting_soon',
          title: meeting.title,
          hasContext: meeting.hasContext,
          platform: meeting.platform,
          participants: meeting.participants,
        });
      }
    }

    // Meeting started
    if (msUntilStart >= 0 && msUntilStart <= 60 * 1000 && !notifiedStarted[eventId]) {
      notifiedStarted[eventId] = true;
      if (onEvent) {
        onEvent({
          type: 'meeting_started',
          title: meeting.title,
          platform: meeting.platform,
        });
      }
    }
  }
}

// --------------- Mock fallback ---------------
function getMockEvents() {
  return [
    {
      title: 'Product Sync Q4',
      start: new Date(Date.now() + 2 * 60 * 60 * 1000),
      duration: 45,
      hasContext: true,
      documents: ['Spec_API_v2.pdf', 'Q4_goals.pdf'],
      platform: 'Teams',
      participants: 6,
    },
    {
      title: 'Teacher Lab — UI review',
      start: new Date(Date.now() + 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
      duration: 60,
      hasContext: true,
      documents: ['Teacher_Lab_requirements.pdf'],
      platform: 'Google Meet',
      participants: 3,
    },
    {
      title: 'e-Krew technical sync',
      start: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
      duration: 60,
      hasContext: false,
      documents: [],
      platform: 'Teams',
      participants: 5,
    },
  ];
}

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
  // Return the latest meeting list
  return []; // Will be populated via backend API
}

module.exports = { startTracker, stopTracker, getUpcomingMeetings };

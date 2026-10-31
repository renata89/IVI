/* IVI Web — Application Logic */

let connected = false;
let cachedMeetings = [];
let cachedNotes = [];

// === Login / Connect ===
async function handleConnect() {
  const urlEl = document.getElementById('backend-url');
  const url = urlEl.value.trim();
  const statusEl = document.getElementById('conn-status');
  const dotEl = document.getElementById('conn-dot');
  const textEl = document.getElementById('conn-text');
  const errorEl = document.getElementById('login-error');

  IVI.setBaseUrl(url);
  errorEl.textContent = '';
  dotEl.className = 'conn-dot checking';
  textEl.textContent = 'Connecting...';

  const result = await IVI.checkHealth();

  if (result && result.status === 'ok' && !result.error) {
    dotEl.className = 'conn-dot connected';
    textEl.textContent = `Connected — IVI Backend v${result.version || '?'}`;
    connected = true;
    setTimeout(() => {
      document.getElementById('login-overlay').classList.add('hidden');
      document.getElementById('app-layout').classList.remove('hidden');
      document.getElementById('settings-backend-url').value = url;
      updateBackendBadge(true);
      loadDashboard();
    }, 500);
  } else {
    dotEl.className = 'conn-dot error';
    textEl.textContent = 'Connection failed';
    errorEl.textContent = `Cannot reach backend at ${url}. Make sure the backend is running.`;
  }
}

function reconnect() {
  const url = document.getElementById('settings-backend-url').value.trim();
  IVI.setBaseUrl(url);
  document.getElementById('login-overlay').classList.remove('hidden');
  document.getElementById('app-layout').classList.add('hidden');
  document.getElementById('backend-url').value = url;
  handleConnect();
}

function updateBackendBadge(online) {
  const badge = document.getElementById('backend-badge');
  if (online) {
    badge.textContent = '⚡ Backend Online';
    badge.className = 'backend-badge';
    document.getElementById('sidebar-status').textContent = 'Connected';
  } else {
    badge.textContent = '⚡ Backend Offline';
    badge.className = 'backend-badge offline';
    document.getElementById('sidebar-status').textContent = 'Disconnected';
  }
}

// === Page Navigation ===
function switchPage(page) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');

  const titles = { dashboard: 'Dashboard', meetings: 'Calendar', notes: 'Notes', settings: 'Settings' };
  document.getElementById('page-title').textContent = titles[page] || page;

  // Load data on page switch
  if (page === 'dashboard') loadDashboard();
  if (page === 'meetings') loadMeetings();
  if (page === 'notes') loadNotes();
}

// === Dashboard ===
async function loadDashboard() {
  if (!connected) return;

  // Meetings count
  const meetingsData = await IVI.getMeetings(50);
  const meetings = meetingsData?.meetings || [];
  cachedMeetings = meetings;
  document.getElementById('dash-meetings-count').textContent = meetings.length;
  document.getElementById('dash-meetings-sub').textContent = meetings.length > 0 ? 'Loaded from backend' : 'No meetings yet';

  // Calendar status
  const calData = await IVI.getCalendarStatus();
  const calConnected = calData?.connected || false;
  document.getElementById('dash-calendar-status').textContent = calConnected ? '✅ Connected' : '❌ Disconnected';

  // Todo lists
  const todoData = await IVI.getTodoLists();
  const todos = todoData?.todo_lists || [];
  const totalItems = todos.reduce((sum, t) => sum + (t.total_items || 0), 0);
  const doneItems = todos.reduce((sum, t) => sum + (t.done_items || 0), 0);
  document.getElementById('dash-todo-count').textContent = `${doneItems}/${totalItems}`;
  document.getElementById('dash-todo-sub').textContent = totalItems > 0 ? `${totalItems - doneItems} pending` : 'No items';

  // Total notes
  let noteCount = 0;
  for (const m of meetings.slice(0, 10)) {
    const notesData = await IVI.getNotes(m.id);
    if (notesData?.notes?.length) noteCount += notesData.notes.length;
  }
  document.getElementById('dash-notes-count').textContent = noteCount;
  document.getElementById('dash-notes-sub').textContent = noteCount > 0 ? 'Across all meetings' : 'No notes yet';

  // Upcoming meetings table
  const tbody = document.getElementById('dash-meetings-body');
  if (meetings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No meetings found</td></tr>';
    return;
  }
  tbody.innerHTML = meetings.slice(0, 10).map(m => `
    <tr>
      <td><strong>${escHtml(m.title || 'Untitled')}</strong></td>
      <td>${formatDate(m.start_time)}</td>
      <td><span class="badge">${escHtml(m.platform || '—')}</span></td>
      <td>${m.duration_min || '—'} min</td>
    </tr>
  `).join('');
}

// === Meetings ===
async function loadMeetings() {
  if (!connected) return;
  const data = await IVI.getMeetings(50);
  const meetings = data?.meetings || [];
  cachedMeetings = meetings;

  const tbody = document.getElementById('meetings-body');
  if (meetings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No meetings found</td></tr>';
    return;
  }
  tbody.innerHTML = meetings.map(m => `
    <tr>
      <td><strong>${escHtml(m.title || 'Untitled')}</strong></td>
      <td>${formatDate(m.start_time) || '—'}</td>
      <td>${formatTime(m.start_time) || '—'}</td>
      <td><span class="badge">${escHtml(m.platform || '—')}</span></td>
      <td>${m.ivi_attended ? '📝 Yes' : '—'}</td>
    </tr>
  `).join('');
}

// === Notes ===
async function loadNotes() {
  if (!connected) return;
  const data = await IVI.getMeetings(50);
  const meetings = data?.meetings || [];

  const container = document.getElementById('notes-list');
  let allNotes = [];

  for (const m of meetings) {
    const notesData = await IVI.getNotes(m.id);
    if (notesData?.notes?.length) {
      for (const n of notesData.notes) {
        allNotes.push({ meeting: m, note: n });
      }
    }
  }

  if (allNotes.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px">No notes yet. IVI will generate notes from meetings.</div>';
    return;
  }

  container.innerHTML = allNotes.map(item => `
    <div class="note-item">
      <div class="note-title">${escHtml(item.meeting.title || 'Untitled Meeting')}</div>
      <div class="note-meta">${formatDate(item.meeting.start_time) || 'Unknown date'} · ${item.meeting.platform || '—'}</div>
      <div class="note-summary">${escHtml(truncate(item.note.summary || 'No summary', 200))}</div>
      ${item.note.decisions && item.note.decisions.length ? `
        <div style="margin-top:6px;font-size:12px;color:var(--text-muted)">
          <strong>Decisions:</strong> ${item.note.decisions.length}
        </div>
      ` : ''}
      ${item.note.action_items && item.note.action_items.length ? `
        <div style="font-size:12px;color:var(--text-muted)">
          <strong>Action items:</strong> ${item.note.action_items.length}
        </div>
      ` : ''}
    </div>
  `).join('');
}

// === Helpers ===
function escHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function truncate(s, max) {
  if (!s) return '';
  return s.length > max ? s.substring(0, max) + '...' : s;
}

// === Auto-connect on load ===
(async function init() {
  // Auto-check on page load if user was previously connected
  const saved = localStorage.getItem('ivi_web_backend_url');
  if (saved) {
    document.getElementById('backend-url').value = saved;
    handleConnect();
  }
})();

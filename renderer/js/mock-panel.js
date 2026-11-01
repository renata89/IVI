function toggleMockPanel() {
  const panel = document.getElementById('mock-panel');
  panel.classList.toggle('active');
  loadMockState();
  // Restore last active tab
  var lastTab = localStorage.getItem('ivi_mock_last_tab') || 'dashboard';
  switchMockTab(lastTab);
  // Re-apply all mocks when panel opens
  if (typeof applyCalendarMock === 'function') applyCalendarMock();
  applyAllMocks();
}

function switchMockTab(tab) {
  document.querySelectorAll('.mock-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
    t.style.color = t.dataset.tab === tab ? 'var(--emerald)' : 'var(--text-muted)';
    t.style.borderBottomColor = t.dataset.tab === tab ? 'var(--emerald)' : 'transparent';
  });
  document.querySelectorAll('.mock-tab-content').forEach(c => c.style.display = 'none');
  const el = document.getElementById('mock-tab-' + tab);
  if (el) el.style.display = 'block';
  // Remember last tab
  localStorage.setItem('ivi_mock_last_tab', tab);
  // Mark changes as unapplied
  markMockChanges();
}

var mockChangesMade = false;

function markMockChanges() {
  mockChangesMade = true;
  var applyBtn = document.getElementById('mock-apply-btn');
  if (applyBtn) {
    applyBtn.style.background = 'var(--emerald)';
    applyBtn.style.color = '#fff';
    applyBtn.textContent = '✓ Apply changes';
  }
}

function applyMockChanges() {
  saveMockState();
  applyAllMocks();
  // Force calendar re-render if on that page
  var calConnected = document.getElementById('cal-connected');
  if (calConnected && calConnected.style.display !== 'none') {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem('ivi_mock_state')) || {}; } catch(e) {}
    if (saved['mock-cal-connected'] !== false && typeof calRenderGrid === 'function') {
      calRenderGrid();
    }
  }
  // Reset button state
  mockChangesMade = false;
  var applyBtn = document.getElementById('mock-apply-btn');
  if (applyBtn) {
    applyBtn.style.background = 'transparent';
    applyBtn.style.color = 'var(--emerald)';
    applyBtn.textContent = 'Apply';
  }
}

// Undo last change — restore previous state
var mockUndoStack = [];

function saveMockSnapshot() {
  var snapshot = {};
  try {
    var current = JSON.parse(localStorage.getItem('ivi_mock_state')) || {};
    snapshot = JSON.parse(JSON.stringify(current));
  } catch(e) {}
  mockUndoStack.push(snapshot);
  if (mockUndoStack.length > 10) mockUndoStack.shift();
}

function undoMockChange() {
  if (mockUndoStack.length === 0) return;
  var prev = mockUndoStack.pop();
  localStorage.setItem('ivi_mock_state', JSON.stringify(prev));
  loadMockState();
  if (typeof applyCalendarMock === 'function') applyCalendarMock();
  applyAllMocks();
  var undoBtn = document.getElementById('mock-undo-btn');
  if (undoBtn) undoBtn.style.display = mockUndoStack.length > 0 ? 'inline-flex' : 'none';
}

function applyAllMocks() {
  try {
    var saved = JSON.parse(localStorage.getItem('ivi_mock_state')) || {};
    // Toggle conflict card visibility
    var conflictCard = document.getElementById('conflict-card');
    if (conflictCard) {
      conflictCard.style.display = saved['mock-conflicts'] === false ? 'none' : '';
    }
    // Toggle recordings card visibility
    var recordingsCard = document.getElementById('ivi-recordings-card');
    if (recordingsCard) {
      recordingsCard.style.display = saved['mock-recordings'] === false ? 'none' : '';
    }
    // Toggle todo card visibility
    var todoCard = document.getElementById('todo-lists-card');
    if (todoCard) {
      todoCard.style.display = saved['mock-todo'] === false ? 'none' : '';
    }
    // Toggle today's meetings on calendar
    if (saved['mock-todays-meetings'] === false && typeof calRenderGrid === 'function') {
      calRenderGrid();
    }
  } catch(e) {}
}

// Hook into all onchange handlers — auto-mark changes
document.addEventListener('change', function(e) {
  if (e.target.closest('.mock-tab-content') && e.target.matches('input, select')) {
    markMockChanges();
  }
});

function loadMockState() {
  try {
    const saved = JSON.parse(localStorage.getItem('ivi_mock_state'));
    if (!saved) return;
    Object.keys(saved).forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (el.type === 'checkbox') el.checked = saved[id];
        else el.value = saved[id];
      }
    });
  } catch(e) {}
}

// ===== Original save function (declared FIRST, then overridden) =====
function saveMockState() {
  const fields = ['mock-docs','mock-docs-count','mock-ai-summary','mock-ai-suggestions',
    'mock-has-docs','mock-participants','mock-time-to-meeting','mock-meeting-state',
    'mock-conflicts','mock-conflicts-count','mock-conflict-state',
    'mock-recordings','mock-recordings-count','mock-recording-status',
    'mock-todo','mock-todo-count','mock-todo-state',
    'mock-todays-meetings','mock-todays-count','mock-readiness-mix','mock-backend',
    'mock-fresh-install','mock-cal-connected','mock-plan-type','mock-hours-used'];
  const state = {};
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) state[id] = el.type === 'checkbox' ? el.checked : el.value;
  });
  localStorage.setItem('ivi_mock_state', JSON.stringify(state));
  // Apply fresh install immediately (needs instant response)
  if (typeof applyFreshInstall === 'function') applyFreshInstall();
}

// Override saveMockState — track changes + undo stack, NO auto-apply
var origSaveMockState = saveMockState;
saveMockState = function() {
  saveMockSnapshot();
  origSaveMockState();
};

function resetMockState() {
  localStorage.removeItem('ivi_mock_state');
  // Reload mock UI without page reload
  loadMockState();
  if (typeof applyCalendarMock === 'function') applyCalendarMock();
  applyAllMocks();
  var applyBtn = document.getElementById('mock-apply-btn');
  if (applyBtn) {
    applyBtn.style.background = 'transparent';
    applyBtn.style.color = 'var(--emerald)';
    applyBtn.textContent = 'Apply';
  }
  mockChangesMade = false;
}

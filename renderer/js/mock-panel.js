// 🎛️ Mock Controls
function toggleMockPanel() {
  const panel = document.getElementById('mock-panel');
  panel.classList.toggle('active');
  loadMockState();
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
}

function saveMockState() {
  const fields = ['mock-docs','mock-docs-count','mock-ai-summary','mock-ai-suggestions',
    'mock-has-docs','mock-participants','mock-time-to-meeting','mock-meeting-state',
    'mock-conflicts','mock-conflicts-count','mock-conflict-state',
    'mock-recordings','mock-recordings-count','mock-recording-status',
    'mock-todo','mock-todo-count','mock-todo-state',
    'mock-todays-meetings','mock-todays-count','mock-readiness-mix','mock-backend'];
  const state = {};
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) state[id] = el.type === 'checkbox' ? el.checked : el.value;
  });
  localStorage.setItem('ivi_mock_state', JSON.stringify(state));
}

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

function resetMockState() {
  localStorage.removeItem('ivi_mock_state');
  location.reload();
}

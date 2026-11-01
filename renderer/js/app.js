  lucide.createIcons();

  // ---------- Topbar clock ----------
  function updateClock() {
    const now = new Date();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const day = days[now.getDay()];
    const month = months[now.getMonth()];
    const date = now.getDate();
    const hours = now.getHours();
    const mins = now.getMinutes();
    var timeStr = formatTimeForDisplay(hours, mins);
    document.getElementById('topbar-datetime').textContent = `${day}, ${month} ${date} · ${timeStr}`;
  }
  updateClock();
  setInterval(updateClock, 60000);

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      const page = this.dataset.page;
      if (!page) return;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      this.classList.add('active');
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-' + page)?.classList.add('active');
      const titles = { dashboard: 'Dashboard', meetings: 'Calendar', series: 'Series', library: 'Library', notes: 'Notes', settings: 'Settings' };
      document.getElementById('page-title').textContent = titles[page] || page;
      if (page === 'series') loadSeries();
      if (page === 'meetings') setTimeout(loadCalendarPage, 100);
      lucide.createIcons();
    });
  });

  if (window.ivi) {
    console.log('Running in IVI desktop app');
    window.ivi.onNotification((data) => console.log('Notification:', data));
  }

  
  // === SERIES ===
  function loadSeries() {
    const grid = document.getElementById('series-grid');
    if (!grid) return;
    grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:14px">Loading series...</div>';

    // Fetch from backend
    fetch('http://127.0.0.1:8765/series')
      .then(r => r.json())
      .then(data => {
        const list = data.series || [];
        if (list.length === 0) {
          grid.innerHTML = '<div class="series-empty"><div class="series-empty-icon">📋</div><div style="font-size:16px;font-weight:600;margin-bottom:8px">No meeting series yet</div><div style="font-size:13px;color:var(--text-muted)">Create a series for recurring meetings like "Daily Scrum" or "Sprint Review"</div></div>';
          return;
        }
        grid.innerHTML = '';
        list.forEach(function(s) {
          const card = document.createElement('div');
          card.className = 'series-card';
          card.innerHTML = '<div class="series-card-header"><div class="series-card-name">' + s.name + '</div><div class="series-card-count">' + (s.meeting_count || 0) + ' meetings</div></div>';
          // Fetch commitments for this series
          fetch('http://127.0.0.1:8765/series/' + s.id + '/commitments')
            .then(r2 => r2.json())
            .then(cdata => {
              const commitments = cdata.commitments || [];
              if (commitments.length > 0) {
                const clist = document.createElement('div');
                clist.className = 'series-card-commitments';
                clist.innerHTML = '<div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Open Commitments</div>';
                commitments.forEach(function(cm) {
                  const due = new Date(cm.due_date + 'T23:59:59');
                  const now = new Date();
                  const diffDays = Math.ceil((due - now) / (1000*60*60*24));
                  let statusClass = 'upcoming', statusLabel = '';
                  if (diffDays < 0) { statusClass = 'overdue'; statusLabel = 'OVERDUE'; }
                  else if (diffDays === 0) { statusClass = 'today'; statusLabel = 'TODAY'; }
                  else if (diffDays <= 7) { statusClass = 'today'; statusLabel = diffDays + 'd left'; }
                  const item = document.createElement('div');
                  item.className = 'series-commitment';
                  item.innerHTML = '<div class="status-dot ' + statusClass + '"></div><div style="flex:1;min-width:0"><div style="font-size:13px">' + (cm.person ? '<strong>' + cm.person + '</strong>: ' : '') + cm.description + '</div></div>' + (statusLabel ? '<span class="status-label ' + statusClass + '">' + statusLabel + '</span>' : '');
                  clist.appendChild(item);
                });
                card.appendChild(clist);
              }
            })
            .catch(function() {});
          grid.appendChild(card);
        });
        if (window.lucide) lucide.createIcons();
      })
      .catch(function() {
        grid.innerHTML = '<div class="series-empty"><div style="font-size:48px;margin-bottom:12px;opacity:0.3">📡</div><div style="font-size:16px;font-weight:600;margin-bottom:8px">Could not load series</div><div style="font-size:13px;color:var(--text-muted)">Make sure the backend is running on port 8765</div></div>';
      });
  }

  function createSeries() {
    const name = prompt('Enter series name:', 'New Series');
    if (!name || !name.trim()) return;
    fetch('http://127.0.0.1:8765/series', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    .then(function(r) { return r.json(); })
    .then(function() { loadSeries(); })
    .catch(function() { alert('Failed to create series'); });
  }

// === SETTINGS ===
function saveSettings() {
  var fm = document.getElementById('format-markdown');
  var fp = document.getElementById('format-pdf');
  var ft = document.getElementById('format-txt');
  var settings = {
    formatMarkdown: fm ? fm.checked : true,
    formatPdf: fp ? fp.checked : true,
    formatTxt: ft ? ft.checked : false,
    storagePath: localStorage.getItem('ivi_storage_path') || '~/Desktop/',
  };
  localStorage.setItem('ivi_settings', JSON.stringify(settings));
}

function toggleNoteFormat(el) {
  var all = ['format-markdown', 'format-pdf', 'format-txt'];
  var checked = all.filter(function(id) {
    var cb = document.getElementById(id);
    return cb && cb.checked;
  });
  // If this was the last checked one, re-check it
  if (checked.length === 0) {
    el.checked = true;
  }
  saveSettings();
}

// ---------- Meeting Prep Settings ----------
function savePrepSettings() {
  var enabled = document.getElementById('prep-enabled').checked;
  var alertTime = document.getElementById('prep-alert-time').value;
  var customMin = parseInt(document.getElementById('prep-alert-custom').value) || 10;
  var autoAdd = document.getElementById('prep-auto-add').checked;
  var eventName = document.getElementById('prep-event-name').value || 'Meeting Prep';
  var duration = parseInt(document.getElementById('prep-duration').value) || 15;
  // Show/hide all prep options based on toggle
  document.getElementById('prep-details').style.display = enabled ? 'flex' : 'none';
  // Validate duration against time to next meeting (mock: 34 min)
  var maxDuration = 34;
  var warn = document.getElementById('prep-duration-warning');
  if (duration > maxDuration) {
    warn.style.display = 'inline';
  } else {
    warn.style.display = 'none';
  }
  localStorage.setItem('ivi_prep_settings', JSON.stringify({
    enabled: enabled,
    alertTime: alertTime === 'custom' ? customMin : parseInt(alertTime),
    alertTimeMode: alertTime,
    autoAdd: autoAdd,
    eventName: eventName,
    duration: duration
  }));
  // Show/hide custom field
  document.getElementById('prep-alert-custom').style.display = alertTime === 'custom' ? 'block' : 'none';
  // Show/hide auto-add details
  document.getElementById('prep-auto-details').style.display = (autoAdd && enabled) ? 'flex' : 'none';
}

function loadPrepSettings() {
  try {
    var saved = JSON.parse(localStorage.getItem('ivi_prep_settings'));
    if (!saved) {
      // Default: toggle on, show options (matches HTML defaults)
      document.getElementById('prep-enabled').checked = true;
      document.getElementById('prep-details').style.display = 'flex';
      // Persist defaults
      localStorage.setItem('ivi_prep_settings', JSON.stringify({
        enabled: true, alertTime: 15, alertTimeMode: '15',
        autoAdd: false, eventName: 'Meeting Prep', duration: 15
      }));
      return;
    }
    var enabled = document.getElementById('prep-enabled');
    if (enabled) enabled.checked = saved.enabled;
    // Show/hide prep options based on saved state
    document.getElementById('prep-details').style.display = saved.enabled ? 'flex' : 'none';
    var alertTime = document.getElementById('prep-alert-time');
    if (alertTime) {
      alertTime.value = saved.alertTimeMode || (saved.alertTime === 15 ? '15' : saved.alertTime === 30 ? '30' : 'custom');
      if (alertTime.value === 'custom') {
        document.getElementById('prep-alert-custom').style.display = 'block';
        document.getElementById('prep-alert-custom').value = saved.alertTime || 10;
      }
    }
    var autoAdd = document.getElementById('prep-auto-add');
    if (autoAdd) {
      autoAdd.checked = saved.autoAdd;
      document.getElementById('prep-auto-details').style.display = (saved.autoAdd && saved.enabled) ? 'flex' : 'none';
    }
    var eventName = document.getElementById('prep-event-name');
    if (eventName) eventName.value = saved.eventName || 'Meeting Prep';
    var duration = document.getElementById('prep-duration');
    if (duration) duration.value = saved.duration || 15;
  } catch(e) {}
}

// ---------- AI Suggestions Settings ----------
function toggleAISuggestions() {
  var toggle = document.getElementById('ai-suggestions-enabled');
  var status = document.getElementById('ai-suggestions-status');
  var info = document.getElementById('ai-suggestions-info');
  var enabled = toggle.checked;

  if (enabled) {
    // Check if there are documents in Library
    var hasDocs = checkHasDocuments();

    if (hasDocs) {
      status.textContent = '✅ ON — AI will suggest based on your documents';
    } else {
      // Show info about no-doc mode
      status.textContent = '✅ ON — AI will use general knowledge (no documents found)';
      info.style.display = 'block';
    }
  } else {
    status.textContent = 'AI will suggest talking points based on your documents';
    info.style.display = 'none';
  }

  localStorage.setItem('ivi_ai_suggestions_enabled', enabled ? 'true' : 'false');
}

function checkHasDocuments() {
  // Check from the Library UI state
  var libraryItems = document.querySelectorAll('#library-list .library-item, .doc-item, .library-file');
  if (libraryItems.length > 0) return true;

  // Fallback: check if there's any "no documents" message hidden
  var noDocs = document.getElementById('no-documents-message');
  if (noDocs && noDocs.style.display === 'none') return true;

  // Check from actual API data if available
  if (window.ivi && window.ivi.fetchAPI) {
    // Don't block, just return false for now — data will be fetched later
  }

  return false;
}

function loadAISuggestionsSettings() {
  try {
    var saved = localStorage.getItem('ivi_ai_suggestions_enabled');
    var toggle = document.getElementById('ai-suggestions-enabled');
    if (toggle && saved === 'true') {
      toggle.checked = true;
      // Trigger the UI update
      toggleAISuggestions();
    }
  } catch(e) {}
}

// ---------- Document Reminder Settings ----------
function saveDocReminderSettings() {
  var enabled = document.getElementById('doc-reminder-enabled').checked;
  var timeVal = document.getElementById('doc-reminder-time').value;
  var customMin = parseInt(document.getElementById('doc-reminder-custom').value) || 10;
  var snooze = parseInt(document.getElementById('doc-reminder-snooze').value) || 15;
  // Show/hide options based on toggle
  document.getElementById('doc-reminder-details').style.display = enabled ? 'flex' : 'none';
  localStorage.setItem('ivi_doc_reminder_settings', JSON.stringify({
    enabled: enabled,
    time: timeVal === 'custom' ? customMin : parseInt(timeVal),
    timeMode: timeVal,
    snooze: snooze
  }));
  document.getElementById('doc-reminder-custom').style.display = timeVal === 'custom' ? 'block' : 'none';
}

function loadDocReminderSettings() {
  try {
    var saved = JSON.parse(localStorage.getItem('ivi_doc_reminder_settings'));
    if (!saved) {
      // Default: toggle on, show options (matches HTML defaults)
      document.getElementById('doc-reminder-enabled').checked = true;
      document.getElementById('doc-reminder-details').style.display = 'flex';
      // Persist defaults
      localStorage.setItem('ivi_doc_reminder_settings', JSON.stringify({
        enabled: true, time: 60, timeMode: '60', snooze: 15
      }));
      return;
    }
    var enabled = document.getElementById('doc-reminder-enabled');
    if (enabled) enabled.checked = saved.enabled;
    // Show/hide options based on saved state
    document.getElementById('doc-reminder-details').style.display = saved.enabled ? 'flex' : 'none';
    var timeEl = document.getElementById('doc-reminder-time');
    if (timeEl) {
      timeEl.value = saved.timeMode || '15';
      if (timeEl.value === 'custom') {
        document.getElementById('doc-reminder-custom').style.display = 'block';
        document.getElementById('doc-reminder-custom').value = saved.time || 10;
      }
    }
    var snooze = document.getElementById('doc-reminder-snooze');
    if (snooze) snooze.value = saved.snooze || 15;
  } catch(e) {}
}

// ---------- Dismissed meetings ----------
var DOC_DISMISSED = JSON.parse(localStorage.getItem('ivi_doc_dismissed') || '{}');
var DOC_SNOOZED = JSON.parse(localStorage.getItem('ivi_doc_snoozed') || '{}');

function dismissDocReminder(meetingId) {
  DOC_DISMISSED[meetingId] = true;
  localStorage.setItem('ivi_doc_dismissed', JSON.stringify(DOC_DISMISSED));
  renderDocReminderAlert();
}

function snoozeDocReminder(meetingId) {
  var settings = JSON.parse(localStorage.getItem('ivi_doc_reminder_settings') || '{}');
  var snoozeMin = settings.snooze || 15;
  DOC_SNOOZED[meetingId] = Date.now() + snoozeMin * 60000;
  localStorage.setItem('ivi_doc_snoozed', JSON.stringify(DOC_SNOOZED));
  renderDocReminderAlert();
}

// ---------- Doc Reminder Alert on Dashboard ----------
function renderDocReminderAlert() {
  var container = document.getElementById('doc-reminder-container');
  if (!container) return;
  var settings = JSON.parse(localStorage.getItem('ivi_doc_reminder_settings') || '{}');
  if (!settings.enabled) {
    container.innerHTML = '';
    return;
  }
  // Check if there are documents in the next meeting card
  var docs = document.querySelectorAll('.card:first-child [style*="background:#e0e7ff"]');
  if (docs.length > 0) {
    container.innerHTML = '';
    return; // has documents, no reminder needed
  }
  var now = Date.now();
  var meetingId = 'mock_next_meeting';
  if (DOC_DISMISSED[meetingId]) {
    container.innerHTML = '';
    return;
  }
  if (DOC_SNOOZED[meetingId] && now < DOC_SNOOZED[meetingId]) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = '<div class="prep-alert-bar" style="background:#fffbeb;border-color:#fde68a">' +
    '<div class="prep-icon" style="background:#f59e0b">📄</div>' +
    '<div class="prep-text">' +
    '<strong>No documents for this meeting</strong>' +
    '<span>Add documents so IVI can give you relevant suggestions during the meeting</span>' +
    '</div>' +
    '<span class="btn btn-ghost btn-sm" onclick="snoozeDocReminder(\'' + meetingId + '\')" style="font-size:11px;white-space:nowrap">Remind later</span>' +
    '<span class="btn btn-ghost btn-sm" onclick="dismissDocReminder(\'' + meetingId + '\')" style="font-size:11px;white-space:nowrap;color:#dc2626;border-color:rgba(220,38,38,0.3)">Dismiss</span>' +
    '</div>';
}

// ---------- Prep Alert on Dashboard ----------
var prepCheckInterval = null;

function renderPrepAlert() {
  var container = document.getElementById('prep-alert-container');
  if (!container) return;
  var settings = JSON.parse(localStorage.getItem('ivi_prep_settings') || '{}');
  if (!settings.enabled) {
    container.innerHTML = '';
    return;
  }
  var now = new Date();
  // Mock: next meeting in ~34 min (simulating a meeting soon)
  var nextMeeting = new Date(now.getTime() + 34 * 60000);
  var nextMeetingTitle = 'Product Sprint Review';
  var diffMs = nextMeeting.getTime() - now.getTime();
  var diffMin = Math.round(diffMs / 60000);
  var alertBefore = settings.alertTime || 15;
  var duration = settings.duration || 15;
  if (duration > diffMin) {
    // Duration too long - cap it
    duration = Math.max(5, diffMin - 1);
  }
  // Show alert if within alert window
  if (diffMin >= 0 && diffMin <= alertBefore) {
    var prepName = (settings.autoAdd && settings.eventName) ? settings.eventName : 'Meeting prep';
    container.innerHTML = '<div class="prep-alert-bar">' +
      '<div class="prep-icon">\uD83D\uDCDD</div>' +
      '<div class="prep-text">' +
      '<strong>' + prepName + ' in ' + diffMin + ' min</strong>' +
      '<span>' + nextMeetingTitle + ' starts in ' + diffMin + ' min ' +
      '(' + (settings.autoAdd ? duration + ' min prep \u00b7 auto-added to calendar' : '') + ')</span>' +
      '</div></div>';
  } else {
    container.innerHTML = '';
  }
}

function startPrepAlertLoop() {
  if (prepCheckInterval) clearInterval(prepCheckInterval);
  renderPrepAlert();
  prepCheckInterval = setInterval(renderPrepAlert, 15000);
}

function loadSettings() {
  try {
    var saved = JSON.parse(localStorage.getItem('ivi_settings'));
    if (!saved) return;
    var fm = document.getElementById('format-markdown');
    var fp = document.getElementById('format-pdf');
    var ft = document.getElementById('format-txt');
    if (fm) fm.checked = saved.formatMarkdown !== false;
    if (fp) fp.checked = saved.formatPdf !== false;
    if (ft) ft.checked = saved.formatTxt === true;
    if (saved.storagePath) {
      var el = document.getElementById('storage-path-text');
      if (el) el.textContent = saved.storagePath;
      localStorage.setItem('ivi_storage_path', saved.storagePath);
      // Highlight matching cloud button
      document.querySelectorAll('.cloud-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.path === saved.storagePath);
      });
      // Update path preview
      var preview = document.getElementById('storage-path-preview');
      if (preview) {
        var base = saved.storagePath.replace(/\/$/, '');
        preview.textContent = base + '/IVI/YYYY-MM-DD_HH-MM_Meeting-Title/';
      }
    }
  } catch(e) {}
}

function setCloudStorage(path, url, provider) {
  var el = document.getElementById('storage-path-text');
  if (el) el.textContent = path;
  localStorage.setItem('ivi_storage_path', path);
  saveSettings();
  listStoredMeetings(path);
  // Update active state on all cloud buttons
  document.querySelectorAll('.cloud-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.path === path);
  });
  // Update path preview
  var preview = document.getElementById('storage-path-preview');
  if (preview) {
    var base = path.replace(/\/$/, '');
    preview.textContent = base + '/IVI/YYYY-MM-DD_HH-MM_Meeting-Title/';
  }
  // Show status + open login in browser
  var statusEl = document.getElementById('cloud-storage-status');
  if (statusEl) {
    statusEl.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:12px">' +
      '<span style="font-size:16px">✅</span>' +
      '<div style="flex:1">' +
      '<strong style="color:#166534;display:block">' + provider + ' selected</strong>' +
      '<span style="color:#166534;opacity:0.8">Opening <strong>' + provider + '</strong> login in your browser. Make sure you\'re signed in — the folder will sync automatically.</span>' +
      '</div></div>';
    statusEl.style.display = 'block';
  }
  // Open the provider login in browser
  if (window.ivi && window.ivi.openExternal) {
    window.ivi.openExternal(url);
  } else {
    window.open(url, '_blank');
  }
}

function chooseStorageFolder() {
  if (window.ivi && window.ivi.selectFolder) {
    window.ivi.selectFolder().then(function(path) {
      if (path) {
        var el = document.getElementById('storage-path-text');
        if (el) el.textContent = path;
        localStorage.setItem('ivi_storage_path', path);
        saveSettings();
        listStoredMeetings(path);
      }
    }).catch(function() {});
  } else {
    var path = prompt('Enter storage path:', localStorage.getItem('ivi_storage_path') || '~/Desktop/');
    if (path && path.trim()) {
      var el = document.getElementById('storage-path-text');
      if (el) el.textContent = path.trim();
      localStorage.setItem('ivi_storage_path', path.trim());
      saveSettings();
    }
  }
}

function listStoredMeetings() {
  var basePath = localStorage.getItem('ivi_storage_path') || '~/Desktop/';
  var iviPath = basePath.replace(/\/$/, '') + '/IVI';
  var preview = document.getElementById('storage-preview');
  var list = document.getElementById('storage-meetings-list');
  if (!preview || !list) return;
  preview.style.display = 'block';
  if (window.ivi && window.ivi.listDirectory) {
    window.ivi.listDirectory(iviPath).then(function(entries) {
      if (entries && entries.length > 0) {
        // Only show folders that look like meetings (date-prefixed)
        var meetingDirs = entries.filter(function(e) { return /^\d{4}-\d{2}-\d{2}_/.test(e); });
        if (meetingDirs.length === 0) {
          list.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">No meetings saved yet.</div>';
          return;
        }
        var html = '';
        var start = Math.max(0, meetingDirs.length - 10);
        for (var i = meetingDirs.length - 1; i >= start; i--) {
          html += '<div style="padding:3px 0;font-size:12px">📁 ' + meetingDirs[i] + '</div>';
        }
        if (meetingDirs.length > 10) {
          html += '<div style="font-size:11px;color:var(--text-muted);padding-top:4px">... and ' + (meetingDirs.length - 10) + ' more</div>';
        }
        list.innerHTML = html;
      } else {
        list.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">No meetings saved yet</div>';
      }
    }).catch(function() {
      list.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">Could not read directory</div>';
    });
  } else {
    list.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">Folder browsing available in desktop app</div>';
  }
}

// Load settings on page load and when navigating to settings
document.addEventListener('DOMContentLoaded', function() { loadSettings(); loadPrepSettings(); loadDocReminderSettings(); });
document.querySelectorAll('.nav-item[data-page=settings]').forEach(function(el) {
  el.addEventListener('click', function() {
    setTimeout(function() { loadSettings(); loadPrepSettings(); loadDocReminderSettings(); listStoredMeetings(); }, 100);
  });
});

// ---------- Meeting Modal ----------
  function openMeetingModal(title, meta) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-meta').textContent = meta;
    document.getElementById('meeting-modal').classList.add('active');
    document.getElementById('modal-detail').style.display = 'none';
    document.querySelectorAll('#meeting-modal .modal-options').forEach(o => o.style.display = 'flex');
    lucide.createIcons();
  }

  function closeMeetingModal() {
    applyRestoredConflicts();
    document.getElementById('meeting-modal').classList.remove('active');
  }

  function showAction(action) {
    const titles = { join: 'Join Meeting', docs: 'Add Documentation', absent: 'Absent Mode', transcript: 'Generate Notes & Transcript', ai: 'AI Suggestions' };
    document.querySelectorAll('#meeting-modal .modal-options').forEach(o => o.style.display = 'none');
    document.getElementById('modal-detail').style.display = 'block';
    document.getElementById('md-title').textContent = titles[action] || action;
    document.getElementById('modal-back').style.display = 'flex';
    ['join','docs','absent','transcript','ai'].forEach(a => {
      const el = document.getElementById('detail-' + a);
      if (el) el.style.display = a === action ? 'block' : 'none';
    });
    lucide.createIcons();
  }

  function hideAction() {
    document.getElementById('modal-detail').style.display = 'none';
    document.querySelectorAll('#meeting-modal .modal-options').forEach(o => o.style.display = 'flex');
    document.getElementById('modal-back').style.display = 'none';
  }

  document.getElementById('meeting-modal').addEventListener('click', function(e) {
    if (e.target === this) closeMeetingModal();
  });
  document.getElementById('modal-close').addEventListener('click', closeMeetingModal);

  // Reschedule modal - close on overlay click
  document.getElementById('reschedule-modal').addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('active');
  });

  // Choice toggle switch
  function toggleMeetingChoice(meetingId) {
    var slider = document.getElementById('toggle-slider-' + meetingId);
    var toggle = document.getElementById('toggle-' + meetingId);
    var note = document.getElementById('note-' + meetingId);
    var hidden = document.getElementById('choice-' + meetingId);
    if (!slider || !toggle) return;

    var current = hidden ? hidden.value : 'ivi';
    var newVal = current === 'ivi' ? 'user' : 'ivi';
    if (hidden) hidden.value = newVal;

    var isIVI = newVal === 'ivi';
    slider.style.top = isIVI ? '2px' : 'calc(50% + 2px)';

    // Update all labels inside the toggle
    var labels = toggle.querySelectorAll('div[style*="position:absolute"]');
    if (labels.length >= 2) {
      // First label (IVI)
      labels[0].style.fontWeight = isIVI ? '700' : '400';
      labels[0].style.color = isIVI ? '#7c3aed' : '#9ca3af';
      // Second label (USER)
      labels[1].style.fontWeight = isIVI ? '400' : '700';
      labels[1].style.color = isIVI ? '#9ca3af' : '#3b82f6';
    }

    if (note) note.style.visibility = isIVI ? 'visible' : 'hidden';
  }

  // ---------- Conflict card: data & dynamic rendering ----------

  let activeConflicts = [];
  let currentConflictIndex = 0;
  let localResolvedConflicts = [];
  let pendingRestoreConflicts = [];

  // Mock fallback — used when calendar not connected
  const MOCK_CONFLICTS = [
    {
      id: 'c1',
      left: { title: 'Client Sync', time: '10:00 - 11:30', type: 'video', platform: 'Teams', participants: 3, createdByMe: true },
      right: { title: 'Project Review', time: '10:30 - 12:00', type: 'video', platform: 'Zoom', participants: 4, createdByMe: false }
    },
    {
      id: 'c2',
      left: { title: 'Sprint Demo', time: '10:00 - 12:00', type: 'video', platform: 'Teams', participants: 8, createdByMe: false },
      right: { title: 'Quarterly Sync', time: '10:30 - 11:30', type: 'inperson', participants: 5, createdByMe: false }
    },
    {
      id: 'c3',
      left: { title: '1:1 with Anna', time: '09:00 - 09:30', type: 'video', platform: 'Zoom', participants: 2, createdByMe: true },
      right: { title: 'Team standup', time: '09:00 - 10:00', type: 'video', platform: 'Teams', participants: 6, createdByMe: true }
    }
  ];

  async function loadConflicts() {
    try {
      const resp = await fetch('http://127.0.0.1:8765/api/conflicts');
      const data = await resp.json();
      if (data.conflicts && data.conflicts.length > 0) {
        // Transform backend events into the format expected by the UI
        var allConflicts = data.conflicts.map(c => ({
          id: c.id.replace(/[|]/g, '_'),
          _meetingA: c.left.id,
          _meetingB: c.right.id,
          _endA: c.left.end,
          _endB: c.right.end,
          left: {
            title: c.left.title,
            time: formatConflictTime(c.left.start, c.left.end),
            type: c.left.type,
            platform: c.left.platform,
            participants: c.left.participants,
            createdByMe: false
          },
          right: {
            title: c.right.title,
            time: formatConflictTime(c.right.start, c.right.end),
            type: c.right.type,
            platform: c.right.platform,
            participants: c.right.participants,
            createdByMe: false
          }
        }));
        // Filter out past conflicts — keep only those where at least one meeting hasn't ended yet
        var now = new Date();
        activeConflicts = allConflicts.filter(c => {
          var endA = c._endA ? new Date(c._endA) : null;
          var endB = c._endB ? new Date(c._endB) : null;
          return (endA && endA > now) || (endB && endB > now) || (!endA && !endB);
        });
        currentConflictIndex = 0;
        renderConflictCard();
        return;
      }
    } catch (e) {
      console.log('Conflict API unavailable, using mock data');
    }
    // Fallback to mock
    activeConflicts = MOCK_CONFLICTS.map(c => ({ ...c }));
    currentConflictIndex = 0;
    renderConflictCard();
  }

  function formatConflictTime(start, end) {
    if (!start || !end) return '00:00 - 00:00';
    try {
      const s = new Date(start);
      const e = new Date(end);
      const fmt = (d) => String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
      return fmt(s) + ' - ' + fmt(e);
    } catch {
      return '00:00 - 00:00';
    }
  }

  // Initial render — load from backend or fallback to mock
  loadConflicts();

  function getPlatformColor(platform) {
    const p = (platform || '').toLowerCase();
    if (p.includes('teams')) return '#7C3AED';
    if (p.includes('zoom')) return '#2563EB';
    if (p.includes('google meet') || p.includes('meet')) return '#D97706';
    return '#6B7280';
  }

  function buildMeetingColumn(meeting, meetingId, borderColor, isLeft, showSpacer) {
    const borderRight = isLeft ? 'border-right:1px solid #f3f4f6;' : '';

    // Spacer div only if the OTHER column has a badge but this one doesn't
    const spacerHtml = (!meeting.createdByMe && showSpacer) ? '<div style="height:15px"></div>' : '';
    const badgeHtml = meeting.createdByMe ? '<div style="font-size:9px;background:#e0e7ff;color:#4338ca;padding:1px 6px;border-radius:4px;font-weight:600;display:inline-block;margin-bottom:2px;width:fit-content">Your event</div>' : '';
    const topHtml = badgeHtml || spacerHtml;

    if (meeting.type === 'video') {
      return `<div style="border-top:4px solid ${borderColor};${borderRight}padding:14px 10px;display:flex;flex-direction:column;gap:10px">
        ${topHtml}
        <div style="font-size:15px;font-weight:700;color:#111827;min-height:2.8em;line-height:1.3">${meeting.title}</div>
        <div style="font-size:13px;color:#4b5563;font-weight:500">${meeting.time}</div>
        <div style="font-size:11px;color:#4b5563;display:flex;align-items:center;gap:6px">📹 Video Call (${meeting.platform})</div>
        <div style="font-size:11px;color:#4b5563;display:flex;align-items:center;gap:6px">👥 ${meeting.participants} participants</div>
      </div>`;
    }

    // In-person
    return `<div style="border-top:4px solid ${borderColor};${borderRight}padding:14px 10px;display:flex;flex-direction:column;gap:10px">
      ${topHtml}
      <div style="font-size:15px;font-weight:700;color:#111827;min-height:2.8em;line-height:1.3">${meeting.title}</div>
      <div style="font-size:13px;color:#4b5563;font-weight:500">${meeting.time}</div>
      <div style="font-size:11px;color:#4b5563;display:flex;align-items:center;gap:6px">📍 In-person Meeting</div>
      <div style="margin-top:auto;font-size:11px;color:#6b7280;font-style:italic">No recording</div>
    </div>`;
  }

  function renderConflictCard() {
    if (currentConflictIndex >= activeConflicts.length) {
      document.getElementById('conflict-active-content').style.display = 'none';
      document.getElementById('conflict-none').style.display = 'flex';
      document.getElementById('conflict-card').classList.remove('conflict-active');
      document.getElementById('conflict-count').style.display = 'none';
      document.getElementById('conflict-label').style.color = 'var(--text-muted)';
      document.getElementById('conflict-label').style.fontSize = '11px';
      document.getElementById('conflict-card').style.gap = '0px';
      document.getElementById('conflict-card').style.minHeight = '';
      document.getElementById('conflict-card').style.width = '';
      // Hide spacer and footer when no conflicts
      var sp = document.getElementById('conflict-spacer');
      var ft = document.getElementById('conflict-footer');
      if (sp) sp.style.display = 'none';
      if (ft) ft.style.display = 'none';
      // Notify recordings card to compact
      if (typeof onConflictStateChange === 'function') onConflictStateChange();
      return;
    }

    const conflict = activeConflicts[currentConflictIndex];
    const total = activeConflicts.length;

    document.getElementById('conflict-count').style.display = 'block';
    document.getElementById('conflict-label').style.color = '#7a2020';
    document.getElementById('conflict-label').style.fontSize = '13px';
    document.getElementById('conflict-card').style.gap = '14px';
    document.getElementById('conflict-card').style.minHeight = '480px';
    // Show spacer and footer when conflicts are active
    var sp = document.getElementById('conflict-spacer');
    var ft = document.getElementById('conflict-footer');
    if (sp) sp.style.display = '';
    if (ft) ft.style.display = '';

    document.getElementById('conflict-counter').textContent = `Conflict ${currentConflictIndex + 1} of ${total}`;

    document.getElementById('conflict-meetings-grid').innerHTML =
      buildMeetingColumn(conflict.left, 'm' + conflict.id, getPlatformColor(conflict.left.platform), true, conflict.right.createdByMe) +
      buildMeetingColumn(conflict.right, 'm' + conflict.id + 'r', getPlatformColor(conflict.right.platform), false, conflict.left.createdByMe);

    // Reset global toggle — default to IVI
    globalChoiceIsIVI = true;

    // Determine toggle visibility and labels based on meeting types
    const bothVideo = conflict.left.type === 'video' && conflict.right.type === 'video';
    const oneF2F = (conflict.left.type !== 'video') !== (conflict.right.type !== 'video');

    var toggleContainer = document.getElementById('global-toggle');
    var sliderEl = document.getElementById('global-toggle-slider');
    var iviLabel = document.querySelector('#global-toggle div:nth-child(2)');
    var userLabel = document.querySelector('#global-toggle div:nth-child(3)');

    if (toggleContainer && toggleContainer.parentElement) {
      if (bothVideo) {
        // Both video — show toggle with default labels
        toggleContainer.parentElement.style.display = 'flex';
        if (iviLabel) iviLabel.innerHTML = '🎙️ IVI';
        if (userLabel) userLabel.innerHTML = '👤 USER';
      } else if (oneF2F) {
        // One F2F — show toggle, default IVI covers the video call
        toggleContainer.parentElement.style.display = 'flex';
        const videoTitle = conflict.left.type === 'video' ? conflict.left.title : conflict.right.title;
        const f2fTitle = conflict.left.type !== 'video' ? conflict.left.title : conflict.right.title;
        if (iviLabel) iviLabel.innerHTML = '🎙️ ' + videoTitle.substring(0, 14);
        if (userLabel) userLabel.innerHTML = '👤 ' + f2fTitle.substring(0, 14);
        globalChoiceIsIVI = true;
      } else {
        // Both F2F — hide toggle
        toggleContainer.parentElement.style.display = 'none';
      }
    }
    renderGlobalToggleUI();

    // Show/hide Reschedule button based on whether user created any meeting in this conflict
    const canReschedule = conflict.left.createdByMe || conflict.right.createdByMe;
    var reschedBtn = document.querySelector('.btn-reschedule');
    if (reschedBtn) reschedBtn.style.display = canReschedule ? 'flex' : 'none';

    document.getElementById('conflict-active-content').style.display = 'block';
    document.getElementById('conflict-none').style.display = 'none';
    document.getElementById('conflict-card').classList.add('conflict-active');
    // Notify recordings card to expand
    if (typeof onConflictStateChange === 'function') onConflictStateChange();
    lucide.createIcons();
  }

  function ignoreConflict() {
    const conflict = activeConflicts[currentConflictIndex];
    if (!conflict) return;
    // Store FULL conflict locally for undo
    localResolvedConflicts.push({
      id: 'local_' + Date.now(),
      fullConflict: conflict,
      meeting_a_id: conflict.left.title,
      meeting_b_id: conflict.right.title,
      resolution: 'ignore',
      created_at: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    });
    // Persist to backend if we have real meeting IDs
    if (conflict._meetingA) {
      fetch('http://127.0.0.1:8765/api/conflicts/resolve', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({meeting_a_id: conflict._meetingA, meeting_b_id: conflict._meetingB, resolution: 'ignore'})
      }).catch(() => {});
    }
    activeConflicts.splice(currentConflictIndex, 1);
    if (currentConflictIndex >= activeConflicts.length && activeConflicts.length > 0) {
      currentConflictIndex = 0;
    }
    renderConflictCard();
  }

  function rescheduleConflict() {
    const conflict = activeConflicts[currentConflictIndex];
    if (!conflict) return;
    // Find the meeting(s) created by user
    const userMeetings = [];
    if (conflict.left.createdByMe) userMeetings.push({ side: 'left', ...conflict.left });
    if (conflict.right.createdByMe) userMeetings.push({ side: 'right', ...conflict.right });
    if (userMeetings.length === 0) return;

    const m = userMeetings[0];
    const [startStr, endStr] = m.time.split(' - ');
    const meetingDate = m.date || '2026-10-26';

    document.getElementById('reschedule-modal-title').textContent = 'Reschedule: ' + m.title;
    document.getElementById('reschedule-modal-meta').textContent = m.participants + ' participants · ' + m.platform;
    document.getElementById('reschedule-date').value = meetingDate;
    document.getElementById('reschedule-time-start').value = startStr || '09:00';
    document.getElementById('reschedule-time-end').value = endStr || '10:00';

    // Generate suggested slots based on participant availability
    const suggestions = generateSuggestions(meetingDate, startStr, m);
    const container = document.getElementById('suggested-slots');
    container.innerHTML = suggestions.map((s, i) =>
      `<div class="suggested-slot" onclick="pickSuggestedSlot(${i})"
            style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:8px;cursor:default;transition:all 0.15s;
                   ${i === 0 ? 'background:var(--emerald-light);border:1px solid var(--emerald)' : 'background:#f9fafb;border:1px solid var(--card-border)'}">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:11px;font-weight:600;color:${i === 0 ? 'var(--emerald)' : '#374151'}">${s.date}</span>
          <span style="color:var(--text-muted);font-size:11px">${s.time}</span>
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <span style="font-size:10px;color:${i === 0 ? 'var(--emerald)' : 'var(--text-muted)'}">${s.available} available</span>
          ${i === 0 ? '<span style="font-size:10px;background:var(--emerald);color:#fff;padding:1px 6px;border-radius:4px;font-weight:600">BEST</span>' : ''}
        </div>
      </div>`
    ).join('');

    // Quick date pills
    const pillContainer = document.getElementById('quick-date-pills');
    const dates = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    pillContainer.innerHTML = dates.map((d, i) => {
      const dt = new Date(d);
      const dayName = dayNames[dt.getDay()];
      const display = d === meetingDate ? 'Today' : dayName + ' ' + (dt.getMonth()+1) + '/' + dt.getDate();
      const active = d === meetingDate;
      return `<span class="btn ${active ? 'btn-primary' : 'btn-ghost'} btn-sm" style="font-size:10px;padding:3px 8px" onclick="document.getElementById('reschedule-date').value='${d}'">${display}</span>`;
    }).join('');

    document.getElementById('reschedule-modal').classList.add('active');
    lucide.createIcons();
  }

  function generateSuggestions(baseDate, currentTime, meeting) {
    const base = new Date(baseDate);
    const slots = [
      { date: 'Mon 10/26', time: '11:00 - 12:00', available: '3/3' },
      { date: 'Mon 10/26', time: '14:00 - 15:00', available: '2/3' },
      { date: 'Tue 10/27', time: '09:00 - 10:00', available: '3/3' },
      { date: 'Tue 10/27', time: '13:00 - 14:00', available: '3/3' },
      { date: 'Wed 10/28', time: '10:00 - 11:00', available: '2/3' },
    ];
    return slots;
  }

  function pickSuggestedSlot(index) {
    const slots = generateSuggestions();
    const slot = slots[index];
    if (!slot) return;
    document.getElementById('reschedule-date').value = '2026-10-' + (26 + ['Mon 10/26','Mon 10/26','Tue 10/27','Tue 10/27','Wed 10/28'].indexOf(slot.date));
    const [st, en] = slot.time.split(' - ');
    document.getElementById('reschedule-time-start').value = st;
    document.getElementById('reschedule-time-end').value = en;
  }

  function applyReschedule() {
    const conflict = activeConflicts[currentConflictIndex];
    if (!conflict) return;

    const newDate = document.getElementById('reschedule-date').value;
    const newStart = document.getElementById('reschedule-time-start').value;
    const newEnd = document.getElementById('reschedule-time-end').value;
    const newTime = newStart + ' - ' + newEnd;

    // Persist to backend if we have real meeting IDs
    if (conflict._meetingA) {
      fetch('http://127.0.0.1:8765/api/conflicts/resolve', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({meeting_a_id: conflict._meetingA, meeting_b_id: conflict._meetingB, resolution: 'reschedule'})
      }).catch(() => {});
    }

    // Update the first user-created meeting's time and date
    if (conflict.left.createdByMe) {
      conflict.left.time = newTime;
      conflict.left.date = newDate;
    } else if (conflict.right.createdByMe) {
      conflict.right.time = newTime;
      conflict.right.date = newDate;
    }

    document.getElementById('reschedule-modal').classList.remove('active');
    renderConflictCard();
  }

  // Global IVI/USER toggle for all meetings in conflict
  var globalChoiceIsIVI = true;

  function toggleGlobalChoice() {
    globalChoiceIsIVI = !globalChoiceIsIVI;
    renderGlobalToggleUI();
  }

  function renderGlobalToggleUI() {
    var slider = document.getElementById('global-toggle-slider');
    var toggle = document.getElementById('global-toggle');
    if (!slider || !toggle) return;
    var labelLeft = toggle.querySelector('div:nth-child(2)');
    var labelRight = toggle.querySelector('div:nth-child(3)');
    slider.style.left = globalChoiceIsIVI ? '2px' : 'calc(50% + 2px)';
    if (labelLeft) {
      labelLeft.innerHTML = globalChoiceIsIVI ? '🎙️ IVI' : '👤 USER';
      labelLeft.style.color = globalChoiceIsIVI ? '#fff' : '#9ca3af';
      labelLeft.style.fontWeight = globalChoiceIsIVI ? '700' : '400';
    }
    if (labelRight) {
      labelRight.innerHTML = globalChoiceIsIVI ? '👤 USER' : '🎙️ IVI';
      labelRight.style.color = globalChoiceIsIVI ? '#9ca3af' : '#fff';
      labelRight.style.fontWeight = globalChoiceIsIVI ? '400' : '700';
    }
  }

  // Cover both meetings with IVI
  function coverBoth() {
    const currentConflict = activeConflicts[currentConflictIndex];
    if (!currentConflict) return;

    // Persist to backend if we have real meeting IDs
    if (currentConflict._meetingA) {
      fetch('http://127.0.0.1:8765/api/conflicts/resolve', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({meeting_a_id: currentConflict._meetingA, meeting_b_id: currentConflict._meetingB, resolution: 'cover_both'})
      }).catch(() => {});
    }

    // Set global toggle to IVI
    if (!globalChoiceIsIVI) toggleGlobalChoice();
  }

  function renderResolvedConflicts(conflicts) {
    let html = `<div style=\"padding:8px 0\">`;
    conflicts.forEach(c => {
      const label = c.resolution === 'cover_both' ? 'IVI covers both' : c.resolution === 'reschedule' ? 'Rescheduled' : 'Ignored';
      const badgeClass = c.resolution === 'cover_both' ? 'badge-done' : c.resolution === 'reschedule' ? 'badge-wip' : 'badge-todo';
      const meetingA = c.meeting_a_id && c.meeting_a_id.length > 20 ? c.meeting_a_id.substring(0, 12) + '...' : (c.meeting_a_id || 'Meeting A');
      const meetingB = c.meeting_b_id && c.meeting_b_id.length > 20 ? c.meeting_b_id.substring(0, 12) + '...' : (c.meeting_b_id || 'Meeting B');
      html += `<div style=\"padding:10px;border:1px solid var(--card-border);border-radius:8px;margin-bottom:8px\">
        <div style=\"display:flex;align-items:center;justify-content:space-between\">
          <div style=\"font-weight:500;font-size:13px\">${meetingA} vs ${meetingB}</div>
          <div style=\"display:flex;align-items:center;gap:6px\">
            <span class=\"badge-status ${badgeClass}\" style=\"font-size:10px\">${label}</span>
            <span class=\"btn btn-ghost btn-sm\" onclick=\"undoResolveConflict('${c.id}')\" style=\"font-size:10px;padding:2px 6px;cursor:pointer\" title=\"Change decision\">↩</span>
          </div>
        </div>
        <div style=\"font-size:10px;color:var(--text-muted);margin-top:2px\">${c.created_at || ''}</div>
      </div>`;
    });
    if (conflicts.length > 1) {
      html += `<div style=\"padding:4px 0;text-align:center\">
        <span class=\"btn btn-ghost btn-sm\" onclick=\"restoreAllConflicts()\" style=\"border-color:var(--emerald);color:var(--emerald);font-size:10px\">Restore all (${conflicts.length}) ↩</span>
      </div>`;
    }
    html += `</div>`;
    document.querySelector('.modal-detail').innerHTML = html;
  }

  function undoResolveConflict(id) {
    const idx = localResolvedConflicts.findIndex(c => c.id === id);
    if (idx === -1) return;
    const entry = localResolvedConflicts[idx];
    if (entry.fullConflict) pendingRestoreConflicts.push(entry.fullConflict);
    localResolvedConflicts.splice(idx, 1);
    // Re-render the list in modal — don't close modal
    if (localResolvedConflicts.length > 0) {
      renderResolvedConflicts(localResolvedConflicts);
    } else {
      document.querySelector('.modal-detail').innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted)">All conflicts restored.</div>`;
    }
  }

  function restoreAllConflicts() {
    localResolvedConflicts.forEach(c => {
      if (c.fullConflict) pendingRestoreConflicts.push(c.fullConflict);
    });
    localResolvedConflicts = [];
    document.querySelector('.modal-detail').innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted)">All conflicts restored.</div>`;
  }

  function applyRestoredConflicts() {
    if (pendingRestoreConflicts.length > 0) {
      pendingRestoreConflicts.forEach(c => activeConflicts.push(c));
      currentConflictIndex = activeConflicts.length - 1;
      pendingRestoreConflicts = [];
      renderConflictCard();
    }
  }

  function openConflictManager(mode) {
    const title = mode === 'review' ? 'Resolved Conflicts' : 'Conflict Manager';
    const totalResolved = localResolvedConflicts.length;
    const meta = mode === 'review'
      ? (totalResolved > 0 ? totalResolved + ' resolved' : 'No resolved conflicts')
      : '3 unresolved conflicts · Oct 20-23';
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-meta').textContent = meta;
    document.getElementById('meeting-modal').classList.add('active');
    document.querySelectorAll('#meeting-modal .modal-options').forEach(o => o.style.display = 'none');
    document.getElementById('modal-detail').style.display = 'block';
    document.getElementById('modal-back').style.display = 'flex';

    if (mode === 'review') {
      // Load resolved conflicts from backend
      fetch('http://127.0.0.1:8765/api/conflicts/resolved')
        .then(r => r.json())
        .then(data => {
          const resolved = data.resolved || [];
          if (resolved.length > 0) {
            renderResolvedConflicts(resolved);
          } else if (localResolvedConflicts.length > 0) {
            renderResolvedConflicts(localResolvedConflicts);
          } else {
            document.querySelector('.modal-detail').innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted)">No resolved conflicts yet.</div>`;
          }
          lucide.createIcons();
        })
        .catch(() => {
          // Fallback to local cache if backend unavailable
          if (localResolvedConflicts.length > 0) {
            renderResolvedConflicts(localResolvedConflicts);
          } else {
            document.querySelector('.modal-detail').innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted)">Could not load resolved conflicts.</div>`;
          }
        });
    } else {
      // Conflict list data (simulated)
      const allConflicts = [
        { id: 1, date: 'Oct 22', event1: 'Sprint Demo', time1: '10:00-12:00', event2: 'Quarterly Sync', time2: '10:30-11:30' },
        { id: 2, date: 'Oct 23', event1: '1:1 with Anna', time1: '09:00-09:30', event2: 'Team standup', time2: '09:00-10:00' },
        { id: 3, date: 'Oct 24', event1: 'Client presentation', time1: '14:00-15:00', event2: 'Internal retro', time2: '14:30-15:30' },
      ];

      let conflictPage = 0;
      const perPage = 2;
      const totalPages = Math.ceil(allConflicts.length / perPage);

      function renderConflicts() {
        const start = conflictPage * perPage;
        const pageConflicts = allConflicts.slice(start, start + perPage);
        const hasNext = conflictPage + 1 < totalPages;
        const hasPrev = conflictPage > 0;

        let html = `<div style="padding:8px 0;color:var(--text-muted);font-size:13px">`;

        pageConflicts.forEach((c, i) => {
          html += `
            <div style="padding:12px;border:1px solid var(--card-border);border-radius:10px;margin-bottom:8px">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                <div style="width:48px;height:56px;background:rgba(239,68,68,0.06);border:1px solid var(--card-border);border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0">
                  <div style="font-size:11px;color:#EF4444;font-weight:600;text-transform:uppercase;line-height:1">${c.date.split(' ')[0]}</div>
                  <div style="font-size:16px;font-weight:700;color:var(--text);line-height:1.2">${c.date.split(' ')[1]}</div>
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:500;font-size:13px;color:var(--text)">${c.event1} <span style="color:var(--text-muted);font-weight:400">(${c.time1})</span></div>
                  <div style="font-size:11px;color:#EF4444;font-weight:600;margin:1px 0">VS</div>
                  <div style="font-weight:500;font-size:13px;color:var(--text)">${c.event2} <span style="color:var(--text-muted);font-weight:400">(${c.time2})</span></div>
                </div>
              </div>
              <div style="padding-top:8px;border-top:1px solid var(--card-border)">
                <div style="display:flex;flex-direction:column;gap:5px">
                  <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:default"><input type="radio" name="conf_${c.id}" value="a" checked> I attend <strong>${c.event1}</strong>, IVI covers <strong>${c.event2}</strong></label>
                  <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:default"><input type="radio" name="conf_${c.id}" value="b"> IVI covers <strong>${c.event1}</strong>, I attend <strong>${c.event2}</strong></label>
                  <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:default"><input type="radio" name="conf_${c.id}" value="both"> IVI covers <strong>both</strong></label>
                  <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:default;color:var(--text-muted)"><input type="radio" name="conf_${c.id}" value="skip"> Skip &mdash; neither attend nor record</label>
                </div>
              </div>
            </div>`;
        });

        // Pagination
        if (totalPages > 1) {
          html += '<div style="display:flex;align-items:center;justify-content:center;gap:12px;padding-top:12px;border-top:1px solid var(--card-border);margin-top:8px">';
          if (hasPrev) html += '<span class="btn btn-ghost btn-sm" onclick="window._prevConflictPage()">← Prev</span>';
          else html += '<span class="btn btn-ghost btn-sm" style="opacity:0.3;pointer-events:none">← Prev</span>';
          html += '<span style="font-size:12px;color:var(--text-muted)">' + (conflictPage + 1) + ' / ' + totalPages + '</span>';
          if (hasNext) html += '<span class="btn btn-ghost btn-sm" onclick="window._nextConflictPage()">Next →</span>';
          else html += '<span class="btn btn-ghost btn-sm" style="opacity:0.3;pointer-events:none">Next →</span>';
          html += '</div>';
        }

        html += `</div>`;
        document.querySelector('.modal-detail').innerHTML = html;

        // Store pagination state
        window._conflictPage = conflictPage;
        window._nextConflictPage = () => { conflictPage++; renderConflicts(); };
        window._prevConflictPage = () => { conflictPage--; renderConflicts(); };

        lucide.createIcons();
      }

      renderConflicts();
    }
    lucide.createIcons();
  }

  function closeDetail() {
    document.getElementById('modal-detail').style.display = 'none';
    document.querySelectorAll('#meeting-modal .modal-options').forEach(o => o.style.display = 'flex');
    document.getElementById('modal-back').style.display = 'none';
  }

  // ---------- Prepare context ----------
  function openPrepareContext() {
    document.getElementById('modal-title').textContent = 'Product Sprint Review';
    document.getElementById('modal-meta').textContent = 'Today · 14:00-14:45';
    document.getElementById('meeting-modal').classList.add('active');
    document.querySelectorAll('#meeting-modal .modal-options').forEach(o => o.style.display = 'none');
    document.getElementById('modal-detail').style.display = 'block';
    // Back closes the modal entirely (not returning to options list)
    document.getElementById('modal-back').onclick = function() {
      document.getElementById('meeting-modal').classList.remove('active');
      document.getElementById('modal-back').style.display = 'none';
      document.getElementById('modal-back').onclick = hideAction;
    };
    document.getElementById('modal-back').style.display = 'flex';
    document.querySelector('.modal-detail').innerHTML = `
      <div style="padding:8px 0">
        <div class="upload-zone" style="margin-bottom:12px">
          <i data-lucide="plus" style="width:14px;height:14px"></i> Drop documents for this meeting
        </div>
        <div style="font-size:12px;color:var(--text-muted)">
          Already loaded: <span class="badge" style="font-size:10px">Spec_API_v2.pdf</span>
          <span class="badge" style="font-size:10px">Q4_goals.pptx</span>
        </div>
      </div>
    `;
    lucide.createIcons();
  }

  // ---------- Document management ----------
  const loadedDocs = [
    { name: 'Spec_API_v2.pdf', summary: 'API v2 migration requirements, endpoints, and testing plan' },
    { name: 'Q4_goals.pptx', summary: 'Q4 business goals, KPIs, and team resource allocation' }
  ];

  function toggleAiAssistant() {
    const chk = document.getElementById('ai-assistant-chk');
    const btn = document.getElementById('add-context-btn');
    if (chk.checked) {
      btn.style.opacity = '0.4';
      btn.style.pointerEvents = 'none';
    } else {
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
    }
  }

  function joinWithAI() {
    const chk = document.getElementById('ai-assistant-chk');
    if (chk.checked && loadedDocs.length > 0) {
      const parts = loadedDocs.map(d => `— ${d.name}: ${d.summary}`).join('\n');
      alert('🎯 Joining with AI assistant\n\nAI is analyzing your documents:\n' + parts +
        '\n\nLive suggestions will appear during the meeting.');
    } else {
      openMeetingModal('Product Sprint Review', 'Today · 14:00-14:45');
    }
  }

  function downloadDoc(name) {
    alert('Downloading: ' + name);
  }

  function removeDoc(name) {
    const idx = loadedDocs.findIndex(d => d.name === name);
    if (idx !== -1) loadedDocs.splice(idx, 1);

    // Remove from card
    document.querySelectorAll('[onclick*="removeDoc"]').forEach(el => {
      const tag = el.closest('span[style*="background:#e0e7ff"]');
      if (tag && (tag.textContent.includes(name) || el.textContent.includes(name))) {
        tag.style.display = 'none';
      }
    });

    // Remove from modal
    document.querySelectorAll('#detail-docs .badge').forEach(b => {
      if (b.textContent.includes(name)) b.remove();
    });

    // Hide AI summary if no docs left
    if (loadedDocs.length === 0) {
      const summary = document.querySelector('div[style*="border-top:1px solid var(--card-border)"]');
      if (summary) summary.style.display = 'none';
    }
  }

  function openSummaryPdf() {
    if (loadedDocs.length === 0) return;
    const parts = loadedDocs.map(d => `— ${d.name}: ${d.summary}`).join('\n');
    alert('AI-generated summary of loaded documents:\n\n' + parts);
  }

  // ---------- Recent Activity mock ----------

  function isFreshInstall() {
    try {
      const saved = JSON.parse(localStorage.getItem('ivi_mock_state'));
      return saved && saved['mock-fresh-install'] === true;
    } catch(e) { return false; }
  }

  function applyFreshInstall() {
    var fresh = isFreshInstall();
    document.querySelectorAll('#page-dashboard > div:not(#prep-alert-container):not(#doc-reminder-container)').forEach(function(el) {
      el.style.display = fresh ? 'none' : '';
    });
    var existing = document.getElementById('fresh-install-msg');
    if (fresh) {
      if (!existing) {
        var msg = document.createElement('div');
        msg.id = 'fresh-install-msg';
        msg.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;padding:40px;text-align:center';
        msg.innerHTML = '<div style="font-size:48px;margin-bottom:16px">👋</div><div style="font-size:18px;font-weight:600;margin-bottom:8px">Welcome to IVI!</div><div style="font-size:13px;color:var(--text-muted);max-width:300px">Connect your calendar to get started.</div>';
        document.getElementById('page-dashboard').appendChild(msg);
      }
    } else if (existing) {
      existing.remove();
    }
  }

  const MOCK_RECENT_ACTIVITY = [
    { title: 'Product Sprint Review', status: 'recording', timestamp: Date.now() },
    { title: 'Client Sync', status: 'processing', timestamp: Date.now() - 2 * 60000 },
    { title: 'Teacher Lab — UI review', status: 'done', timestamp: Date.now() - 35 * 60000 },
    { title: 'e-Krew technical sync', status: 'done', timestamp: Date.now() - 2 * 3600000 },
    { title: 'Weekly Sync', status: 'done', timestamp: Date.now() - 6 * 3600000 },
  ];

  function timeAgo(ts) {
    var diff = Date.now() - ts;
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    return days + 'd ago';
  }

  function renderRecentActivity() {
    var table = document.getElementById('recent-activity-table');
    if (!table) return;
    while (table.rows.length > 1) table.deleteRow(-1);

    MOCK_RECENT_ACTIVITY.forEach(function(item) {
      var row = table.insertRow(-1);
      var c1 = row.insertCell(0);
      var c2 = row.insertCell(1);
      var c3 = row.insertCell(2);

      c1.textContent = item.title;
      c1.style.cssText = 'font-size:13px;font-weight:500';

      var badge = document.createElement('span');
      badge.style.cssText = 'font-size:10px;padding:2px 8px;border-radius:4px;font-weight:600;display:inline-block';
      if (item.status === 'recording') {
        badge.style.cssText += ';background:#fef2f2;color:#dc2626';
        badge.textContent = '\u25CF Recording';
      } else if (item.status === 'processing') {
        badge.style.cssText += ';background:#fffbeb;color:#d97706';
        badge.textContent = '\u25CC Processing';
      } else {
        badge.style.cssText += ';background:#dcfce7;color:#16a34a';
        badge.textContent = '\u2713 Done';
      }
      c2.appendChild(badge);

      c3.textContent = (item.status === 'recording' || item.status === 'processing') ? 'Now' : timeAgo(item.timestamp);
      c3.style.cssText = 'text-align:right;font-size:11px;color:var(--text-muted)';
    });
  }

  // Click events
  document.querySelectorAll('.cal-event').forEach(el => {
    el.addEventListener('click', function() {
      const title = this.querySelector('.cal-event-title')?.textContent || 'Meeting';
      const time = this.querySelector('.cal-event-time')?.textContent || '';
      openMeetingModal(title, time);
    });
  });
  document.querySelectorAll('.table tr').forEach((row, index) => {
    if (index === 0) return;
    row.addEventListener('click', function() {
      const cells = this.querySelectorAll('td');
      if (cells.length >= 2) {
        openMeetingModal(cells[1]?.textContent || 'Meeting', cells[0]?.textContent || '');
      }
    });
  });

  // ---------- Notes page ----------
  let notesRefreshInterval = null;

  function loadNotes() {
    const list = document.getElementById('notes-list');
    const countEl = document.getElementById('notes-count');
    if (!list) return;

    if (countEl) countEl.textContent = IVI_RECORDINGS.length;

    // Update last note
    if (IVI_RECORDINGS.length > 0) {
      const last = IVI_RECORDINGS[0];
      document.getElementById('last-note-title').textContent = last.title;
      document.getElementById('last-note-date').textContent = last.date + ' ' + last.time;
    }

    // Use filtered rendering
    renderFilteredNotes();
  }

  // Notes filter state
  var notesFilter = { period: 'all', search: '' };

  function setNotesFilter(type, value) {
    if (type === 'period') {
      notesFilter.period = value;
      document.querySelectorAll('.nf-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.period === value);
      });
    } else if (type === 'search') {
      notesFilter.search = value.toLowerCase();
    }
    // Re-render with filters
    renderFilteredNotes();
  }

  function renderFilteredNotes() {
    var filtered = IVI_RECORDINGS.filter(function(rec) {
      // Search filter
      if (notesFilter.search && !rec.title.toLowerCase().includes(notesFilter.search)) {
        return false;
      }
      // Period filter
      if (notesFilter.period !== 'all') {
        var today = new Date();
        var recDate = new Date(rec.date);
        // Handle relative dates
        if (rec.date === 'Today') recDate = today;
        else if (rec.date === 'Yesterday') recDate = new Date(today.getTime() - 86400000);

        if (isNaN(recDate.getTime())) return true; // can't parse, show it

        var diffDays = Math.floor((today - recDate) / 86400000);
        if (notesFilter.period === 'day' && diffDays > 0) return false;
        if (notesFilter.period === 'week' && diffDays >= 7) return false;
        if (notesFilter.period === 'month' && diffDays >= 30) return false;
      }
      return true;
    });

    // Render filtered list
    var list = document.getElementById('notes-list');
    if (!list) return;
    if (filtered.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:14px">No notes match your filters</div>';
      return;
    }
    var html = '';
    filtered.forEach(function(rec) {
      html += '<div class="modal-option" style="display:flex;align-items:center;gap:14px;padding:12px;border-radius:12px;cursor:default;transition:background 0.15s">';
      html += '<div style="flex:1">';
      html += '<div class="mo-title">' + rec.title + '</div>';
      html += '<div class="mo-desc">' + rec.date + ' ' + rec.time + ' · ' + rec.duration + '</div>';
      html += '</div>';
      html += '<span class="btn btn-primary btn-sm" onclick="viewIVINotes(\'' + rec.id + '\')" style="white-space:nowrap">See notes</span>';
      html += '</div>';
    });
    list.innerHTML = html;
  }

  // ---------- Note detail viewer ----------
  async function showNoteDetail(meetingId, meetingTitle) {
    try {
      const notesData = await window.ivi.fetchAPI(`/meetings/${meetingId}/notes`);
      const notes = notesData.notes || [];
      const note = notes.length > 0 ? notes[0] : null;

      if (!note) {
        alert('No notes for this meeting yet.');
        return;
      }

      const decisions = typeof note.decisions === 'string' ? JSON.parse(note.decisions || '[]') : (note.decisions || []);
      const actions = typeof note.action_items === 'string' ? JSON.parse(note.action_items || '[]') : (note.action_items || []);

      let html = `<div style="padding:0">
        <div style="border-bottom:1px solid var(--card-border);padding:16px 20px">
          <div style="font-size:18px;font-weight:600">${meetingTitle}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Notatki ze spotkania</div>
        </div>
        <div style="padding:16px 20px">
          <div style="font-weight:600;font-size:14px;margin-bottom:8px">Podsumowanie</div>
          <div style="font-size:13px;color:var(--text);line-height:1.6;margin-bottom:20px">${note.summary || 'Brak podsumowania.'}</div>`;

      if (decisions.length > 0) {
        html += `<div style="font-weight:600;font-size:14px;margin-bottom:8px">Decyzje</div><ul style="margin-bottom:20px">`;
        decisions.forEach(d => {
          html += `<li style="font-size:13px;margin-bottom:4px"><strong>${d.by_whom || '?'}:</strong> ${d.what || d}</li>`;
        });
        html += `</ul>`;
      }

      if (actions.length > 0) {
        html += `<div style="font-weight:600;font-size:14px;margin-bottom:8px">Action Items</div>
        <table class="table" style="margin-bottom:20px"><tr><th>Kto</th><th>Co</th><th>Na kiedy</th></tr>`;
        actions.forEach(a => {
          html += `<tr><td>${a.who || '—'}</td><td>${a.what || ''}</td><td>${a.when || '—'}</td></tr>`;
        });
        html += `</table>`;
      }

      html += `<div style="display:flex;gap:8px;margin-top:12px">
        <span class="btn btn-primary btn-sm" onclick="playNoteTTS('${meetingId}')">Listen 🔊</span>
        <span class="btn btn-ghost btn-sm" onclick="closeNoteDetail()">Close</span>
      </div></div></div>`;

      const detailDiv = document.createElement('div');
      detailDiv.id = 'note-detail-overlay';
      detailDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(4px)';
      detailDiv.innerHTML = `<div style="background:#fff;border-radius:20px;width:600px;max-width:90vw;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.15)">${html}</div>`;
      detailDiv.addEventListener('click', (e) => { if (e.target === detailDiv) closeNoteDetail(); });
      document.body.appendChild(detailDiv);
    } catch (err) {
      alert('Error loading notes: ' + err.message);
    }
  }

  function closeNoteDetail() {
    const el = document.getElementById('note-detail-overlay');
    if (el) el.remove();
  }

  // ---------- TTS Playback ----------
  async function playNoteTTS(meetingId) {
    try {
      const btn = event?.target || document.querySelector('.btn-primary');
      if (btn) btn.textContent = 'Playing... 🎵';

      const notesData = await window.ivi.fetchAPI(`/meetings/${meetingId}/notes`);
      const notes = notesData.notes || [];
      const note = notes.length > 0 ? notes[0] : null;
      if (!note || !note.summary) return;

      const text = encodeURIComponent(note.summary.slice(0, 2000));
      const audioUrl = `http://127.0.0.1:8765/api/tts?text=${text}&voice=pl-PL-ZofiaNeural`;

      const audio = new Audio(audioUrl);
      audio.onended = () => { if (btn) btn.textContent = 'Listen 🔊'; };
      audio.onerror = () => { if (btn) btn.textContent = 'Listen 🔊'; };
      audio.play();
    } catch (err) {
      console.error('TTS error:', err);
    }
  }

  // Load notes when Notes page is active
  document.querySelectorAll('.nav-item[data-page="notes"]').forEach(el => {
    el.addEventListener('click', () => {
      loadNotes();
      if (notesRefreshInterval) clearInterval(notesRefreshInterval);
      notesRefreshInterval = setInterval(loadNotes, 10000);
    });
  });

  // Also check backend status on dashboard load
  document.querySelectorAll('.nav-item[data-page="dashboard"]').forEach(el => {
    el.addEventListener('click', () => {
      if (notesRefreshInterval) clearInterval(notesRefreshInterval);
      loadChecklist();
      loadTodoLists();
      loadIVIRecordings();
      renderAISuggestionsRow();
      startPrepAlertLoop();
      renderDocReminderAlert();
    });
  });

  
  // ---------- Nagrania IVI — Recording Pipeline ----------
  const IVI_RECORDINGS = [
    {
      id: 'rec1',
      title: 'Product Sprint Review',
      date: 'Today',
      time: '14:00',
      duration: '45 min',
      stages: [
        { id: 'recorded', label: 'Recorded' },
        { id: 'processed', label: 'Transcribed' },
        { id: 'noted', label: 'Notes ready' },
        { id: 'deleted', label: 'Audio deleted' }
      ],
      status: ['green','green','green','green']
    },
    {
      id: 'rec2',
      title: 'Client Sync',
      date: 'Today',
      time: '10:30',
      duration: '30 min',
      status: ['green','yellow','gray','gray'],
      stages: [
        { id: 'recorded', label: 'Recorded' },
        { id: 'processed', label: 'Transcribed' },
        { id: 'noted', label: 'Notes ready' },
        { id: 'deleted', label: 'Audio deleted' }
      ]
    },
    {
      id: 'rec3',
      title: 'Teacher Lab — UI review',
      date: 'Yesterday',
      time: '09:00',
      duration: '60 min',
      status: ['green','green','green','green'],
      stages: [
        { id: 'recorded', label: 'Recorded' },
        { id: 'processed', label: 'Transcribed' },
        { id: 'noted', label: 'Notes ready' },
        { id: 'deleted', label: 'Audio deleted' }
      ]
    },
    {
      id: 'rec4',
      title: 'e-Krew technical sync',
      date: 'Oct 24',
      time: '15:00',
      duration: '25 min',
      status: ['green','green','green','red'],
      stages: [
        { id: 'recorded', label: 'Recorded' },
        { id: 'processed', label: 'Transcribed' },
        { id: 'noted', label: 'Notes ready' },
        { id: 'deleted', label: 'Audio deleted' }
      ]
    },
    {
      id: 'rec5',
      title: 'Weekly Sync',
      date: 'Oct 24',
      time: '11:00',
      duration: '50 min',
      status: ['green','green','green','green'],
      stages: [
        { id: 'recorded', label: 'Recorded' },
        { id: 'processed', label: 'Transcribed' },
        { id: 'noted', label: 'Notes ready' },
        { id: 'deleted', label: 'Audio deleted' }
      ]
    },
    {
      id: 'rec6',
      title: 'Ideamotive screening',
      date: 'Oct 23',
      time: '14:00',
      duration: '30 min',
      status: ['green','green','green','green'],
      stages: [
        { id: 'recorded', label: 'Recorded' },
        { id: 'processed', label: 'Transcribed' },
        { id: 'noted', label: 'Notes ready' },
        { id: 'deleted', label: 'Audio deleted' }
      ]
    },
    {
      id: 'rec7',
      title: 'Design review — Dashboard v2',
      date: 'Oct 22',
      time: '11:00',
      duration: '55 min',
      status: ['green','green','green','green'],
      stages: [
        { id: 'recorded', label: 'Recorded' },
        { id: 'processed', label: 'Transcribed' },
        { id: 'noted', label: 'Notes ready' },
        { id: 'deleted', label: 'Audio deleted' }
      ]
    },
    {
      id: 'rec8',
      title: 'Testigo weekly — QA sync',
      date: 'Oct 21',
      time: '09:30',
      duration: '45 min',
      status: ['green','green','green','green'],
      stages: [
        { id: 'recorded', label: 'Recorded' },
        { id: 'processed', label: 'Transcribed' },
        { id: 'noted', label: 'Notes ready' },
        { id: 'deleted', label: 'Audio deleted' }
      ]
    },
    {
      id: 'rec9',
      title: 'English Lab — lesson planning',
      date: 'Oct 20',
      time: '15:00',
      duration: '60 min',
      status: ['green','green','green','red'],
      stages: [
        { id: 'recorded', label: 'Recorded' },
        { id: 'processed', label: 'Transcribed' },
        { id: 'noted', label: 'Notes ready' },
        { id: 'deleted', label: 'Audio deleted' }
      ]
    },
    {
      id: 'rec10',
      title: 'e-Krew sprint planning',
      date: 'Oct 19',
      time: '10:00',
      duration: '50 min',
      status: ['green','green','green','green'],
      stages: [
        { id: 'recorded', label: 'Recorded' },
        { id: 'processed', label: 'Transcribed' },
        { id: 'noted', label: 'Notes ready' },
        { id: 'deleted', label: 'Audio deleted' }
      ]
    },
    {
      id: 'rec11',
      title: 'Product roadmap review',
      date: 'Oct 18',
      time: '13:00',
      duration: '40 min',
      status: ['green','green','yellow','gray'],
      stages: [
        { id: 'recorded', label: 'Recorded' },
        { id: 'processed', label: 'Transcribed' },
        { id: 'noted', label: 'Notes ready' },
        { id: 'deleted', label: 'Audio deleted' }
      ]
    },
    {
      id: 'rec12',
      title: 'Client onboarding — Acme Inc',
      date: 'Oct 17',
      time: '09:00',
      duration: '35 min',
      status: ['green','yellow','gray','gray'],
      stages: [
        { id: 'recorded', label: 'Recorded' },
        { id: 'processed', label: 'Transcribed' },
        { id: 'noted', label: 'Notes ready' },
        { id: 'deleted', label: 'Audio deleted' }
      ]
    }
  ];

  let recordingRefreshInterval = null;

  function renderRecordings(compact) {
    const list = document.getElementById('recordings-list');
    if (!list) return;
    const hasConflicts = activeConflicts.length > 0;
    const showCount = (!hasConflicts || compact) ? 5 : 5;

    // Apply compact class
    list.classList.toggle('compact-recordings', !hasConflicts || compact);

    const items = IVI_RECORDINGS.slice(0, showCount);
    if (items.length === 0) {
      list.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:12px 0;text-align:center">No recordings yet</div>';
      return;
    }

    let html = '';
    items.forEach(rec => {
      html += `<div class="recording-row">`;
      html += `<div class="rec-info">`;
      html += `<div class="rec-title">${rec.title}</div>`;
      html += `<div class="rec-meta">${rec.date} ${rec.time} · ${rec.duration}</div>`;
      html += `</div>`;
      html += `<div class="rec-dots">`;
      rec.status.forEach((state, si) => {
        const dotClass = state === 'green' ? 'green' : state === 'yellow' ? 'yellow' : state === 'red' ? 'red' : 'gray';
        const stageLabel = rec.stages?.[si]?.label || '';
        html += `<div class="rec-dot-col">`;
        html += `<div class="rec-dot ${dotClass}" title="${stageLabel}"></div>`;
        html += `</div>`;
      });
      html += `</div>`;
      html += `</div>`;
    });

    list.innerHTML = html;
  }

  function loadIVIRecordings() {
    renderRecordings(false);
  }

  // Re-render when conflict state changes (called from renderConflictCard)
  function onConflictStateChange() {
    renderRecordings(false);
  }

  let iviNotesPage = 0;
  const IVI_NOTES_PER_PAGE = 5;

  function openIVINotesModal() {
    iviNotesPage = 0;
    renderIVINotesPage();
    var modal = document.getElementById('ivi-notes-modal');
    modal.classList.add('active');
    // Reset any inline styles that might leak from other modals
    var list = document.getElementById('ivi-notes-modal-list');
    if (list) list.style.display = '';
  }

  function renderIVINotesPage() {
    const list = document.getElementById('ivi-notes-modal-list');
    if (!list) return;

    const totalPages = Math.ceil(IVI_RECORDINGS.length / IVI_NOTES_PER_PAGE);
    const start = iviNotesPage * IVI_NOTES_PER_PAGE;
    const pageItems = IVI_RECORDINGS.slice(start, start + IVI_NOTES_PER_PAGE);

    let html = '';
    pageItems.forEach(rec => {
      html += `<div class="modal-option">`;
      html += `<div style="flex:1">`;
      html += `<div class="mo-title">${rec.title}</div>`;
      html += `<div class="mo-desc">${rec.date} ${rec.time} · ${rec.duration}</div>`;
      html += `</div>`;
      html += `<span class="btn btn-primary btn-sm" onclick="viewIVINotes('${rec.id}')" style="white-space:nowrap">See notes</span>`;
      html += `</div>`;
    });

    if (totalPages > 1) {
      html += `<div style="display:flex;align-items:center;justify-content:center;gap:12px;padding-top:12px;border-top:1px solid var(--card-border);margin-top:8px">`;
      html += `<span class="btn btn-ghost btn-sm" onclick="iviNotesPrevPage()" style="${iviNotesPage === 0 ? 'opacity:0.3;pointer-events:none' : ''}">← Prev</span>`;
      html += `<span style="font-size:12px;color:var(--text-muted)">${iviNotesPage + 1} / ${totalPages}</span>`;
      html += `<span class="btn btn-ghost btn-sm" onclick="iviNotesNextPage()" style="${iviNotesPage >= totalPages - 1 ? 'opacity:0.3;pointer-events:none' : ''}">Next →</span>`;
      html += `</div>`;
    }

    list.innerHTML = html;
  }

  function iviNotesPrevPage() {
    if (iviNotesPage > 0) {
      iviNotesPage--;
      renderIVINotesPage();
    }
  }

  function iviNotesNextPage() {
    const totalPages = Math.ceil(IVI_RECORDINGS.length / IVI_NOTES_PER_PAGE);
    if (iviNotesPage < totalPages - 1) {
      iviNotesPage++;
      renderIVINotesPage();
    }
  }

  function closeIVINotesModal() {
    document.getElementById('ivi-notes-modal').classList.remove('active');
  }

  function viewIVINotes(id) {
    closeIVINotesModal();
    // Open the storage folder in file manager
    var path = localStorage.getItem('ivi_storage_path') || '~/Desktop/';
    var iviPath = path.replace(/\/$/, '') + '/IVI';
    if (window.ivi && window.ivi.openInFolder) {
      window.ivi.openInFolder(iviPath);
    }
  }

  function renderAISuggestionsRow() {
    const row = document.getElementById('ai-suggestions-row');
    if (!row) return;
    // Check if there are documents in the card
    const docs = document.querySelectorAll('.card:first-child [style*="background:#e0e7ff"]');
    if (docs.length > 0) {
      row.innerHTML = '<div style="display:flex;align-items:center;gap:8px">' +
        '<input type="checkbox" id="ai-suggest-chk" onchange="toggleAiSuggestions()" ' +
        'style="accent-color:var(--emerald);width:14px;height:14px;cursor:default;flex-shrink:0">' +
        '<label for="ai-suggest-chk" style="font-size:10px;color:var(--text-muted);cursor:default;line-height:1.3">' +
        'IVI will suggest during the meeting based on your documents</label></div>';
    } else {
      row.innerHTML = '<div style="font-size:10px;color:var(--text-muted);text-align:center;padding:4px 0;line-height:1.4">' +
        '📄 Add documents for IVI to give you suggestions during the meeting</div>';
    }
  }

  function toggleAiSuggestions() {
    // Toggle stored - can be expanded later
    const chk = document.getElementById('ai-suggest-chk');
    if (chk) {
      localStorage.setItem('ivi_ai_suggestions', chk.checked ? 'true' : 'false');
    }
  }

// ---------- Commitments checklist ----------
  async function loadChecklist() {
    try {
      const data = await window.ivi.fetchAPI('/api/upcoming/checklist');
      const card = document.getElementById('checklist-card');
      const itemsDiv = document.getElementById('checklist-items');
      const emptyDiv = document.getElementById('checklist-empty');
      const countSpan = document.getElementById('checklist-count');

      if (!data.meeting || !data.commitments || data.commitments.length === 0) {
        card.style.display = 'none';
        return;
      }

      card.style.display = 'block';
      countSpan.textContent = data.commitments.length + ' pending';

      let html = `<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">Dot. spotkania: <strong>${data.meeting.title}</strong></div>`;
      data.commitments.forEach((c, i) => {
        const status = c.status === 'done' ? 'checked' : '';
        html += `<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid var(--card-border)">
          <input type="checkbox" ${status} style="accent-color:var(--emerald);width:14px;height:14px;margin-top:2px" data-id="${c.id}">
          <div style="flex:1;font-size:13px">
            <strong>${c.person || '?'}</strong>: ${c.description}
            ${c.due_date ? `<span style="font-size:10px;color:var(--text-muted);margin-left:6px">📅 ${c.due_date}</span>` : ''}
          </div>
        </div>`;
      });
      itemsDiv.innerHTML = html;
      emptyDiv.style.display = 'none';
    } catch (err) {
      console.error('Checklist error:', err);
    }
  }

  // ---------- Calendar connection ----------
  async function checkCalendarStatus() {
    try {
      const data = await window.ivi.fetchAPI('/api/calendar/status');
      const statusText = document.getElementById('cal-status-text');
      const statusSub = document.getElementById('cal-status-sub');
      const connectBtn = document.getElementById('cal-connect-btn') || document.getElementById('cal-not-connected-btn');

      if (data && data.connected) {
        if (statusText) statusText.textContent = 'Connected';
        if (statusText) statusText.style.color = '';
        if (statusSub) statusSub.textContent = `${data.events ? data.events.length : 0} meetings this week`;
        if (connectBtn) connectBtn.style.display = 'none';
        return true;
      } else {
        if (statusText) statusText.textContent = 'Checking...';
        if (statusText) statusText.style.color = '';
        if (data && data.auth_url) {
          if (statusSub) statusSub.textContent = 'Click to connect';
          if (connectBtn) {
            connectBtn.style.display = 'inline-flex';
            connectBtn.dataset.authUrl = data.auth_url;
          }
        }
        return false;
      }
    } catch (err) {
      console.error('Calendar check error:', err);
      // On error, treat as not connected — but allow mock override
      return false;
    }
  }

  function connectCalendar() {
    const btn = document.getElementById('cal-connect-btn') || document.getElementById('cal-not-connected-btn');
    if (btn && btn.dataset.authUrl) {
      window.open(btn.dataset.authUrl, '_blank');
    }
  }

  function disconnectCalendar() {
    // For mock mode — just re-check status
    checkCalendarStatus();
  }

  // Calendar navigation state
  var calCurrentDate = new Date();
  var calCurrentView = 'week';

  function calNavWeek(delta) {
    calCurrentDate.setDate(calCurrentDate.getDate() + delta * 7);
    calRenderGrid();
  }

  function calSetView(view) {
    calCurrentView = view;
    var weekBtn = document.getElementById('cal-view-week-btn');
    var monthBtn = document.getElementById('cal-view-month-btn');
    if (weekBtn) { weekBtn.className = view === 'week' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'; }
    if (monthBtn) { monthBtn.className = view === 'month' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'; }
    calRenderGrid();
  }

  function calRenderGrid() {
    var container = document.getElementById('cal-grid-container');
    if (!container) return;
    var header = document.getElementById('cal-grid-header');
    if (!header) return;

    // Persist selected date across renders
    if (calRenderGrid.selectedDate === undefined) calRenderGrid.selectedDate = null;

    // Read mock settings
    var meetingsCount = 3;
    var showTodayMeetings = true;
    try {
      var saved = JSON.parse(localStorage.getItem('ivi_mock_state'));
      if (saved) {
        if (saved['mock-todays-count']) meetingsCount = parseInt(saved['mock-todays-count']) || 3;
        if (saved['mock-todays-meetings'] === false) showTodayMeetings = false;
      }
    } catch(e) {}

    var year = calCurrentDate.getFullYear();
    var month = calCurrentDate.getMonth();
    var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    // Mock meetings data with full details — dateStr assigned by week day
    var mockMeetings = [
      { id: 'm1', title: 'Sprint Daily', time: '09:00-09:15', platform: 'Teams', color: '#7C3AED', creator: 'Marek K.', participants: 5, conflict: false },
      { id: 'm2', title: 'e-Krew sync', time: '11:00-12:00', platform: 'Zoom', color: '#2563EB', creator: 'Renata L.', participants: 3, conflict: true, conflictWith: 'm3' },
      { id: 'm3', title: 'Ideamotive screening', time: '11:30-12:30', platform: 'Google Meet', color: '#D97706', creator: 'Ania W.', participants: 4, conflict: true, conflictWith: 'm2' },
      { id: 'm4', title: 'Teacher Lab UI', time: '09:00-10:00', platform: 'Teams', color: '#7C3AED', creator: 'Renata L.', participants: 2, conflict: false },
      { id: 'm5', title: 'Project Review', time: '10:30-12:00', platform: 'Zoom', color: '#2563EB', creator: 'Krzysiek P.', participants: 8, conflict: false },
      { id: 'm6', title: 'Product Sprint', time: '14:00-14:45', platform: 'Teams', color: '#7C3AED', creator: 'Marek K.', participants: 6, conflict: false }
    ];

    // Limit meetings based on mock setting
    var displayMeetings = mockMeetings.slice(0, Math.min(meetingsCount, mockMeetings.length));
    calRenderGrid._lastMeetings = displayMeetings;

    // Render calendar header based on view
    if (calCurrentView === 'week') {
      var startOfWeek = new Date(calCurrentDate);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      var endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      header.textContent = monthNames[startOfWeek.getMonth()] + ' ' + startOfWeek.getDate() + ' – ' + monthNames[endOfWeek.getMonth()] + ' ' + endOfWeek.getDate() + ', ' + endOfWeek.getFullYear();

      // Assign actual dates to mock meetings based on week day column
      for (var mi = 0; mi < displayMeetings.length; mi++) {
        var md = new Date(startOfWeek);
        md.setDate(startOfWeek.getDate() + mi);
        displayMeetings[mi].dateStr = md.getFullYear() + '-' + String(md.getMonth()+1).padStart(2,'0') + '-' + String(md.getDate()).padStart(2,'0');
      }

      var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      var hours = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'];
      var gridHtml = '<div class="cal-week-scroll" style="max-height:445px;overflow-y:auto;border-radius:8px">';
      gridHtml += '<div style="display:grid;grid-template-columns:60px repeat(7,1fr);gap:1px;background:var(--card-border);font-size:11px">';

      // Pre-compute selected day per column
      var daySelected = [];
      for (var d = 0; d < 7; d++) {
        var dayDate = new Date(startOfWeek);
        dayDate.setDate(startOfWeek.getDate() + d);
        var dateStr = dayDate.getFullYear() + '-' + String(dayDate.getMonth()+1).padStart(2,'0') + '-' + String(dayDate.getDate()).padStart(2,'0');
        daySelected[d] = calRenderGrid.selectedDate === dateStr;
      }

      // Header row with clickable days
      gridHtml += '<div style="background:var(--card);padding:6px;text-align:center;font-weight:600;color:var(--text-muted);font-size:10px">Time</div>';
      for (var d = 0; d < 7; d++) {
        var dayDate = new Date(startOfWeek);
        dayDate.setDate(startOfWeek.getDate() + d);
        var isToday = dayDate.toDateString() === new Date().toDateString();
        var isSelected = daySelected[d];
        var dayCellStyle = 'background:var(--card);padding:6px;text-align:center;font-weight:' + (isToday ? '700' : '500') + ';color:' + (isToday ? 'var(--emerald)' : 'var(--text)') + ';font-size:10px;cursor:pointer;border-radius:6px';
        if (isSelected) dayCellStyle += ';background:var(--emerald);color:#fff';
        gridHtml += '<div style="' + dayCellStyle + '" onclick="calSelectDay(\'' + dateStr + '\')">' + dayNames[d] + ' ' + dayDate.getDate() + '</div>';
      }

      // Time rows — build column-based grid with absolute meeting positioning
      var ROW_HEIGHT = 33; // approximate row height in px
      for (var h = 0; h < hours.length; h++) {
        gridHtml += '<div style="background:var(--card);padding:4px 6px;font-size:10px;color:var(--text-muted);text-align:right">' + hours[h] + '</div>';
        for (var d = 0; d < 7; d++) {
          var isSelected = daySelected[d];
          var cellStyle = 'background:var(--card);min-height:32px;padding:1px';
          if (isSelected) cellStyle += ';box-shadow:inset 0 0 0 2px var(--emerald);border-radius:0';
          gridHtml += '<div style="' + cellStyle + '"></div>';
        }
      }

      // Close the inner grid
      gridHtml += '</div>';

      // Now overlay meetings on top — one absolute-positioned wrapper per day column
      var dayColumnWrappers = '';
      for (var d = 0; d < 7; d++) {
        dayColumnWrappers += '<div class="cal-day-col" data-day="' + d + '" style="position:absolute;top:0;left:' + (60 + d * (100/7)) + '%;width:' + (100/7) + '%;height:100%;pointer-events:none">';
        var dayDate = new Date(startOfWeek);
        dayDate.setDate(startOfWeek.getDate() + d);

        for (var mi = 0; mi < displayMeetings.length; mi++) {
          var m = displayMeetings[mi];
          if (!m.time || mi !== d) continue; // meeting index matches day column

          // Parse start/end times
          var timeParts = m.time.split('-');
          var startStr = timeParts[0] || '09:00';
          var endStr = timeParts[1] || startStr;
          var startH = parseInt(startStr.split(':')[0]);
          var startM = parseInt(startStr.split(':')[1]);
          var endH = parseInt(endStr.split(':')[0]);
          var endM = parseInt(endStr.split(':')[1]);

          // Calculate position: find which hour row this meeting starts in
          var startHourIndex = -1;
          for (var hi = 0; hi < hours.length; hi++) {
            var hourVal = parseInt(hours[hi].split(':')[0]);
            if (hourVal === startH) { startHourIndex = hi; break; }
            else if (hourVal > startH) { startHourIndex = hi; break; } // partial hour
          }
          if (startHourIndex < 0) continue;

          // Duration in minutes
          var durMinutes = (endH * 60 + endM) - (startH * 60 + startM);
          if (durMinutes <= 0) durMinutes = 30; // minimum

          // Height: minimum 30min = 1 row. Scale proportionally.
          var spanRows = Math.max(1, Math.round(durMinutes / 60));
          var blockHeight = spanRows * ROW_HEIGHT;
          var blockTop = startHourIndex * ROW_HEIGHT;

          // Check if meeting is in the past
          var isPast = false;
          if (m.dateStr) {
            var meetingDt = new Date(m.dateStr + 'T' + startStr + ':00');
            if (!isNaN(meetingDt.getTime()) && meetingDt < new Date()) isPast = true;
          }

          var downloadIcon = isPast ? '<span style="display:inline-flex;align-items:center;margin-left:2px;flex-shrink:0" title="Notes ready for download"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>' : '';

          var meetingBlock = '<div onclick="openMeetingDetail(\'' + (m.id || '') + '\',\'' + (m.title || '').replace(/'/g,"\\'") + '\',\'' + (m.platform || '') + '\',\'' + (m.creator || '') + '\',\'' + (m.time || '') + '\')" style="position:absolute;left:2px;right:2px;top:' + blockTop + 'px;height:' + blockHeight + 'px;background:' + m.color + '15;border-left:3px solid ' + m.color + ';border-radius:4px;padding:2px 4px;font-size:9px;line-height:1.3;overflow:hidden;cursor:pointer;pointer-events:auto;z-index:5;display:flex;flex-direction:column;min-height:28px">' +
            '<div style="font-weight:600;color:' + m.color + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:2px">' + m.title + downloadIcon + '</div>' +
            '<div style="color:var(--text-muted);font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + formatTimeDisplay(m.time) + '</div>' +
            '</div>';
          dayColumnWrappers += meetingBlock;
        }
        dayColumnWrappers += '</div>';
      }

      // Wrap the entire grid in a relative container for absolute overlays
      container.innerHTML = '<div class="cal-week-scroll" style="position:relative">' + gridHtml + dayColumnWrappers + '</div>';
      // Apply saved scroll behavior
      setTimeout(applyCalScrollBehavior, 10);
    } else {
      header.textContent = monthNames[month] + ' ' + year;

      // Build month grid with colored days
      var firstDay = new Date(year, month, 1).getDay();
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var today = new Date();

      // Get week start setting
      var weekStart = 'monday';
      try {
        var ws = localStorage.getItem('ivi_week_start');
        if (ws) weekStart = ws;
      } catch(e) {}

      var dayLabels = weekStart === 'monday' ?
        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] :
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      // Adjust first day for Monday start
      var adjustedFirstDay = weekStart === 'monday' ? (firstDay === 0 ? 6 : firstDay - 1) : firstDay;

      var monthHtml = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;font-size:12px">';

      // Day labels
      for (var dl = 0; dl < 7; dl++) {
        monthHtml += '<div style="text-align:center;padding:6px 0;font-weight:600;color:var(--text-muted);font-size:10px;text-transform:uppercase">' + dayLabels[dl] + '</div>';
      }

      // Empty cells before first day
      for (var i = 0; i < adjustedFirstDay; i++) {
        monthHtml += '<div></div>';
      }

      for (var d = 1; d <= daysInMonth; d++) {
        var dateObj = new Date(year, month, d);
        var isTodayDate = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        var dateStr = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
        var isSelected = calRenderGrid.selectedDate === dateStr;

        // Determine which meetings fall on this day (approximately - assign mock meetings to different days)
        var dayMeetings = [];
        for (var mi = 0; mi < displayMeetings.length; mi++) {
          var meetingDay = ((mi * 7 + d) % daysInMonth) + 1;
          if (meetingDay === d && d <= daysInMonth) {
            dayMeetings.push(displayMeetings[mi]);
          }
        }
        if (d <= displayMeetings.length) {
          if (dayMeetings.length === 0) dayMeetings.push(displayMeetings[d - 1]);
        }

        var cellStyle = 'padding:8px 4px;text-align:center;border-radius:8px;position:relative;cursor:pointer';
        if (isSelected) cellStyle += ';background:var(--emerald);color:#fff;font-weight:700';
        else if (isTodayDate) cellStyle += ';border:2px solid var(--emerald);font-weight:700;color:var(--text)';
        else cellStyle += ';color:var(--text)';

        if (dayMeetings.length > 0 && !isSelected) {
          var mColor = dayMeetings[0].color;
          cellStyle += ';background:' + mColor + '18';
        }

        monthHtml += '<div style="' + cellStyle + '" onclick="calSelectDay(\'' + dateStr + '\')"><div>' + d + '</div>';
        if (dayMeetings.length > 0) {
          monthHtml += '<div style="display:flex;gap:3px;justify-content:center;margin-top:3px">';
          for (var di = 0; di < Math.min(dayMeetings.length, 3); di++) {
            var dm = dayMeetings[di];
            monthHtml += '<span style="width:8px;height:8px;border-radius:50%;background:' + (isSelected ? '#fff' : dm.color) + ';display:inline-block;box-shadow:0 0 0 1px ' + (isSelected ? 'rgba(255,255,255,0.3)' : dm.color + '44') + '" title="' + dm.title + ' (' + dm.platform + ')"></span>';
          }
          if (dayMeetings.length > 3) {
            monthHtml += '<span style="font-size:8px;font-weight:600;color:' + (isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)') + '">+' + (dayMeetings.length - 3) + '</span>';
          }
          monthHtml += '</div>';
        }
        monthHtml += '</div>';
      }
      monthHtml += '</div>';

      // Add legend
      var legendColors = {};
      for (var mi2 = 0; mi2 < displayMeetings.length; mi2++) {
        var m2 = displayMeetings[mi2];
        legendColors[m2.platform] = m2.color;
      }
      var legendHtml = '<div style="display:flex;gap:12px;margin-top:12px;padding-top:10px;border-top:1px solid var(--card-border);font-size:10px;color:var(--text-muted)">';
      var seenPlatforms = {};
      for (var mi3 = 0; mi3 < displayMeetings.length; mi3++) {
        var m3 = displayMeetings[mi3];
        if (!seenPlatforms[m3.platform]) {
          seenPlatforms[m3.platform] = true;
          legendHtml += '<span style="display:inline-flex;align-items:center;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:' + m3.color + ';display:inline-block"></span> ' + m3.platform + '</span>';
        }
      }
      legendHtml += '</div>';

      container.innerHTML = monthHtml + legendHtml;
    }

    // Also render "Upcoming Today" section
    renderCalendarTodayMeetings(displayMeetings, showTodayMeetings);
  }

  function renderCalendarTodayMeetings(meetings, show) {
    var container = document.getElementById('cal-today-meetings');
    if (!container) return;
    // Hide parent card if show is false
    var parentCard = container.closest('.card');
    if (parentCard) parentCard.style.display = show ? 'block' : 'none';
    if (!show) return;

    // Determine target date: selected day or today
    var targetDate = calRenderGrid.selectedDate;
    if (!targetDate) {
      var now = new Date();
      targetDate = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    }

    // Update title based on selected date
    var cardLabel = parentCard ? parentCard.querySelector('.card-label') : null;
    if (cardLabel) {
      if (calRenderGrid.selectedDate) {
        var parts = calRenderGrid.selectedDate.split('-');
        cardLabel.textContent = 'Upcoming ' + parts[2] + '-' + parts[1] + '-' + parts[0];
      } else {
        cardLabel.textContent = 'Upcoming Today';
      }
    }

    // Filter meetings by target date
    var filteredMeetings = [];
    for (var i = 0; i < meetings.length; i++) {
      if (meetings[i].dateStr === targetDate) {
        filteredMeetings.push(meetings[i]);
      }
    }

    if (!filteredMeetings || filteredMeetings.length === 0) {
      container.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:6px 0">No meetings on this day</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < filteredMeetings.length; i++) {
      var m = filteredMeetings[i];
      html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--card-border);cursor:pointer" onclick="openMeetingDetail(\'' + (m.id || '') + '\',\'' + (m.title || '').replace(/'/g,"\\'") + '\',\'' + (m.platform || '') + '\',\'' + (m.creator || '') + '\',\'' + (m.time || '') + '\')">' +
        '<div style="width:3px;height:24px;border-radius:2px;background:' + m.color + ';flex-shrink:0"></div>' +
        '<div style="flex:1;min-width:0">' +
        '<div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + m.title + '</div>' +
        '<div style="font-size:10px;color:var(--text-muted)">' + formatTimeDisplay(m.time) + ' · ' + m.platform + '</div>' +
        '</div></div>';
    }
    container.innerHTML = html;
  }

  function calFilterMeetings() {
    var row = document.getElementById('cal-meetings-search-row');
    if (row) row.style.display = row.style.display === 'none' ? 'block' : 'none';
  }

  function calSearchMeetings(query) {
    // Placeholder — would filter meetings list
  }

  function calSelectDay(dateStr) {
    calRenderGrid.selectedDate = (calRenderGrid.selectedDate === dateStr) ? null : dateStr;
    // Re-render to update selection and meeting list
    calRenderGrid();
  }

  function calNewMeetingOnPage() {
    // Open the Assign to meeting modal directly in form mode
    calListId = null;
    calCurrentDate = new Date();
    calSelectedDate = calRenderGrid.selectedDate || null;
    document.getElementById('assign-calendar-modal').classList.add('active');
    // Change header title
    var modalHeader = document.querySelector('#assign-calendar-modal .modal-title');
    if (modalHeader) modalHeader.textContent = '➕ New meeting';
    // Directly show form, hide calendar
    calNewMeeting();
  }

  // ---------- Calendar Search ----------
  function openCalSearch() {
    document.getElementById('cal-search-modal').classList.add('active');
    document.getElementById('cal-search-input').value = '';
    document.getElementById('cal-search-results').innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:24px">Start typing to search meetings...</div>';
    setTimeout(function() { document.getElementById('cal-search-input').focus(); }, 100);
  }

  function closeCalSearch() {
    document.getElementById('cal-search-modal').classList.remove('active');
  }

  function calSearchMeetings(query) {
    var resultsEl = document.getElementById('cal-search-results');
    if (!resultsEl) return;
    if (!query || query.trim() === '') {
      resultsEl.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:24px">Start typing to search meetings...</div>';
      return;
    }
    var q = query.toLowerCase().trim();

    // Gather all meetings from mock data + custom meetings + calendar mock meetings
    var allMeetings = [];

    // From calendar mock meetings (Assign to meeting data)
    var mockCalendarMeetings = [
      { id: 'cal_m1', title: 'Daily Stand-up', time: '09:15', platform: 'teams', creator: 'Marek K.' },
      { id: 'cal_m2', title: 'Product Sprint Review', time: '14:00', platform: 'zoom', creator: 'Krzysiek P.' },
      { id: 'cal_m3', title: 'Design Sync', time: '11:00', platform: 'teams' },
      { id: 'cal_m4', title: 'Client Sync — e-Krew', time: '10:30', platform: 'google-meets', creator: 'Renata L.' },
      { id: 'cal_m5', title: 'Teacher Lab UI Review', time: '09:00', platform: 'zoom', creator: 'Renata L.' },
      { id: 'cal_m6', title: 'Weekly Team Retro', time: '16:00', platform: 'teams' },
      { id: 'cal_m7', title: '1:1 with Marek', time: '13:30', platform: 'zoom' }
    ];

    // From the current week grid meetings
    var gridMeetings = calRenderGrid._lastMeetings || [];
    for (var gi = 0; gi < gridMeetings.length; gi++) {
      allMeetings.push(gridMeetings[gi]);
    }

    // Custom meetings
    var custom = getCustomMeetings();
    for (var ci = 0; ci < custom.length; ci++) {
      allMeetings.push(custom[ci]);
    }

    // Calendar mock meetings (for more data)
    for (var mi = 0; mi < mockCalendarMeetings.length; mi++) {
      allMeetings.push(mockCalendarMeetings[mi]);
    }

    // Filter
    var results = [];
    var seen = {};
    for (var i = 0; i < allMeetings.length; i++) {
      var m = allMeetings[i];
      if (seen[m.id]) continue;
      seen[m.id] = true;
      var match = (m.title && m.title.toLowerCase().indexOf(q) !== -1) ||
                  (m.creator && m.creator.toLowerCase().indexOf(q) !== -1) ||
                  (m.platform && m.platform.toLowerCase().indexOf(q) !== -1) ||
                  (m.date && m.date.indexOf(q.replace(/-/g,'')) !== -1) ||
                  (m.time && m.time.toLowerCase().indexOf(q) !== -1);
      if (match) results.push(m);
      if (results.length >= 20) break;
    }

    if (results.length === 0) {
      resultsEl.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:24px">No meetings found for "' + query + '"</div>';
      return;
    }
    var html = '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">' + results.length + ' result(s) for "' + query + '"</div>';
    for (var ri = 0; ri < results.length; ri++) {
      var r = results[ri];
      var platformColor = '#7C3AED';
      if (r.platform === 'zoom') platformColor = '#2563EB';
      else if (r.platform === 'google-meets') platformColor = '#D97706';
      else if (r.platform === 'teams') platformColor = '#7C3AED';
      html += '<div style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:8px;border:1px solid var(--card-border);margin-bottom:6px;cursor:pointer;transition:background .15s" onclick="closeCalSearch();openMeetingDetail(\'' + (r.id || '') + '\',\'' + (r.title || '').replace(/'/g,"\\'") + '\',\'' + (r.platform || '') + '\',\'' + (r.creator || '') + '\',\'' + (r.time || '') + '\')" onmouseover="this.style.background=\'#f9fafb\'" onmouseout="this.style.background=\'\'">' +
        '<div style="width:3px;height:28px;border-radius:2px;background:' + platformColor + ';flex-shrink:0"></div>' +
        '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (r.title || 'Untitled') + '</div>' +
        '<div style="font-size:11px;color:var(--text-muted)">' + (r.creator ? r.creator + ' · ' : '') + (r.time || '') + '</div></div>' +
        '</div>';
    }
    resultsEl.innerHTML = html;
    lucide.createIcons();
  }

  // ---------- Meeting Detail Modal ----------
  function openMeetingDetail(id, title, platform, creator, time) {
    var modal = document.getElementById('meeting-modal');
    var titleEl = document.getElementById('modal-title');
    var metaEl = document.getElementById('modal-meta');
    var bodyEl = document.getElementById('modal-body');
    if (!modal || !titleEl || !metaEl || !bodyEl) return;

    titleEl.textContent = title || 'Meeting';
    metaEl.textContent = (time || '') + (platform ? ' · ' + platform : '') + (creator ? ' · ' + creator : '');

    var isCustom = id && id.indexOf('custom_') === 0;
    var now = new Date();
    var isPast = false;
    // Check if we can find this meeting's date
    var customMeetings = getCustomMeetings();
    var meetingData = null;
    for (var i = 0; i < customMeetings.length; i++) {
      if (customMeetings[i].id === id) { meetingData = customMeetings[i]; break; }
    }

    var docsHtml = '<div style="font-size:13px;font-weight:600;margin:16px 0 8px">📄 Documents</div>' +
      '<div style="font-size:12px;color:var(--text-muted);padding:12px;background:#f9fafb;border-radius:8px;border:1px dashed var(--card-border);text-align:center">No documents attached yet</div>';

    if (meetingData && meetingData.documents && meetingData.documents.length > 0) {
      docsHtml = '<div style="font-size:13px;font-weight:600;margin:16px 0 8px">📄 Documents (' + meetingData.documents.length + ')</div>';
      for (var di = 0; di < meetingData.documents.length; di++) {
        var doc = meetingData.documents[di];
        var visLabel = doc.visibility === 'all' ? '👥 All participants' : '👤 Only me';
        docsHtml += '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f9fafb;border-radius:8px;border:1px solid var(--card-border);margin-bottom:4px">' +
          '<span style="font-size:13px">📄</span>' +
          '<span style="flex:1;font-size:12px;font-weight:500">' + (doc.name || 'Document') + '</span>' +
          '<span style="font-size:10px;color:var(--text-muted)">' + visLabel + '</span></div>';
      }
      // IVI learns from docs
      docsHtml += '<div style="margin-top:8px;font-size:11px;color:var(--emerald);background:var(--emerald-light);padding:8px 12px;border-radius:6px;display:flex;align-items:center;gap:8px">' +
        '<span>🧠</span><span>IVI has <strong>' + meetingData.documents.length + ' document(s)</strong> to prepare for this meeting</span></div>';
    }

    var bodyHtml = '<div id="meeting-detail-body">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
        '<span class="btn btn-primary btn-sm" onclick="calNewMeetingOnPageFromDetail()" style="font-size:11px">📝 Join Meeting</span>' +
        (isCustom ? '<span class="btn btn-ghost btn-sm" onclick="editMeetingFromDetail()" style="font-size:11px">✏️ Edit</span>' : '') +
      '</div>';

    if (meetingData) {
      if (meetingData.people) bodyHtml += '<div style="margin-bottom:8px"><div style="font-size:11px;color:var(--text-muted);font-weight:500">People</div><div style="font-size:13px">' + meetingData.people + '</div></div>';
      if (meetingData.link) bodyHtml += '<div style="margin-bottom:8px"><div style="font-size:11px;color:var(--text-muted);font-weight:500">Link</div><div style="font-size:13px"><a href="' + meetingData.link + '" target="_blank" style="color:var(--emerald);text-decoration:none">' + meetingData.link + '</a></div></div>';
      if (meetingData.notes) bodyHtml += '<div style="margin-bottom:8px"><div style="font-size:11px;color:var(--text-muted);font-weight:500">Notes</div><div style="font-size:13px">' + meetingData.notes + '</div></div>';
    }

    bodyHtml += docsHtml;

    if (isPast) {
      bodyHtml += '<div style="margin-top:12px;font-size:11px;color:var(--text-muted);padding:8px 12px;background:#f9fafb;border-radius:6px;border:1px solid var(--card-border);display:flex;align-items:center;gap:8px">' +
        '<span>📄</span><span>Notes from this meeting are available for download</span></div>';
    }

    bodyHtml += '</div>';
    bodyEl.innerHTML = bodyHtml;
    modal.classList.add('active');
  }

  function editMeetingFromDetail() {
    // Navigate to the new meeting form pre-filled
    document.getElementById('meeting-modal').classList.remove('active');
    calNewMeetingOnPage();
    // Pre-fill with current meeting data - find in custom
    var title = document.getElementById('modal-title').textContent;
    var custom = getCustomMeetings();
    for (var i = 0; i < custom.length; i++) {
      if (custom[i].title === title) {
        document.getElementById('cal-form-title').value = custom[i].title || '';
        document.getElementById('cal-form-date').value = custom[i].date || '';
        document.getElementById('cal-form-time').value = custom[i].time || '';
        document.getElementById('cal-form-platform').value = custom[i].platform || '';
        document.getElementById('cal-form-people').value = custom[i].people || '';
        document.getElementById('cal-form-notes').value = custom[i].notes || '';
        document.getElementById('cal-form-link').value = custom[i].link || '';
        break;
      }
    }
    calSetView('week');
  }

  function calNewMeetingOnPageFromDetail() {
    document.getElementById('meeting-modal').classList.remove('active');
    calNewMeetingOnPage();
  }

  function calShowMeetingDetail(meetingId) {
    var modal = document.getElementById('meeting-modal');
    var title = document.getElementById('modal-title');
    var meta = document.getElementById('modal-meta');
    if (!modal || !title || !meta) return;
    
    // Find meeting in our data
    var meetings = calRenderGrid._lastMeetings || [];
    var meeting = null;
    for (var i = 0; i < meetings.length; i++) {
      if (meetings[i].id === meetingId) { meeting = meetings[i]; break; }
    }
    if (!meeting) return;
    
    title.textContent = meeting.title;
    meta.textContent = meeting.time + ' · ' + meeting.platform + ' · ' + meeting.creator;
    
    // Build detail content
    var body = document.querySelector('#meeting-modal .modal-options') || document.querySelector('#meeting-modal div:nth-child(2)');
    if (body) {
      body.innerHTML =
        '<div style="padding:16px 24px;display:flex;flex-direction:column;gap:12px;font-size:13px">' +
        '<div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Time:</span><span>' + meeting.time + '</span></div>' +
        '<div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Created by:</span><span>' + meeting.creator + '</span></div>' +
        '<div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Participants:</span><span>' + meeting.participants + '</span></div>' +
        '<div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Platform:</span><span style="color:' + meeting.color + ';font-weight:600">' + meeting.platform + '</span></div>' +
        (meeting.conflict ?
          '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between">' +
          '<span style="font-size:12px;color:#dc2626">⚠️ Conflict with another meeting</span>' +
          '<span class="btn btn-sm" style="border:1px solid #dc2626;color:#dc2626;background:transparent;padding:4px 8px;font-size:10px;border-radius:6px;cursor:pointer" onclick="closeModal(\'meeting-modal\');document.querySelector(\'.nav-item[data-page=dashboard]\').click()">Resolve →</span>' +
          '</div>' : '') +
        '</div>';
    }
    
    modal.classList.add('active');
    // Change close handler
    var closeBtn = document.getElementById('modal-close');
    if (closeBtn) closeBtn.onclick = function() { modal.classList.remove('active'); };
  }

  function saveWeekStart(value) {
    localStorage.setItem('ivi_week_start', value);
    // Re-render if on calendar page
    if (typeof calRenderGrid === 'function') calRenderGrid();
  }

  // Load week start setting into settings page radio buttons
  function loadWeekStartSetting() {
    try {
      var ws = localStorage.getItem('ivi_week_start') || 'monday';
      var radios = document.querySelectorAll('input[name="week-start"]');
      radios.forEach(function(r) { r.checked = r.value === ws; });
    } catch(e) {}
  }
  // Load on page load
  setTimeout(loadWeekStartSetting, 500);
  setTimeout(loadTimeSystemSetting, 500);

  // ---------- Settings tabs ----------
  function switchSettingsTab(tab) {
    document.querySelectorAll('.settings-tab').forEach(function(t) {
      t.style.borderBottomColor = 'transparent';
      t.style.color = 'var(--text-muted)';
      t.style.fontWeight = '500';
    });
    var activeTab = document.querySelector('.settings-tab[data-tab="' + tab + '"]');
    if (activeTab) {
      activeTab.style.borderBottomColor = 'var(--emerald)';
      activeTab.style.color = 'var(--emerald)';
      activeTab.style.fontWeight = '600';
    }
    // Show correct content - mapping tabs to content divs
    var contentMap = {
      'general': ['settings-tab-general', 'settings-tab-general-extra'],
      'dashboard': ['settings-tab-dashboard'],
      'calendar': ['settings-tab-calendar'],
      'library': ['settings-tab-library'],
      'notes': ['settings-tab-notes'],
      'storage': ['settings-tab-storage']
    };
    // Hide all
    document.querySelectorAll('.settings-tab-content').forEach(function(c) { c.style.display = 'none'; });
    // Show selected
    var ids = contentMap[tab] || [];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) el.style.display = 'block';
    }
  }

  // ---------- Calendar scroll behavior ----------
  function getCalScrollBehavior() {
    try { return localStorage.getItem('ivi_cal_scroll') || 'internal'; }
    catch(e) { return 'internal'; }
  }

  function saveCalScrollBehavior(value) {
    localStorage.setItem('ivi_cal_scroll', value);
    applyCalScrollBehavior();
  }

  function applyCalScrollBehavior() {
    var scrollContainers = document.querySelectorAll('.cal-week-scroll');
    var mode = getCalScrollBehavior();
    scrollContainers.forEach(function(el) {
      if (mode === 'page') {
        el.style.maxHeight = 'none';
        el.style.overflowY = 'visible';
      } else {
        el.style.maxHeight = '445px';
        el.style.overflowY = 'auto';
      }
    });
  }

  function loadCalScrollSetting() {
    try {
      var mode = getCalScrollBehavior();
      var radios = document.querySelectorAll('input[name="cal-scroll"]');
      radios.forEach(function(r) { r.checked = r.value === mode; });
      applyCalScrollBehavior();
    } catch(e) {}
  }
  setTimeout(loadCalScrollSetting, 500);

  // ---------- Time system (12h / 24h) ----------
  function getTimeSystem() {
    try { return localStorage.getItem('ivi_time_system') || '24h'; }
    catch(e) { return '24h'; }
  }

  function saveTimeSystem(value) {
    localStorage.setItem('ivi_time_system', value);
    updateClock();
    if (typeof calRenderGrid === 'function') calRenderGrid();
  }

  function loadTimeSystemSetting() {
    try {
      var ts = getTimeSystem();
      var radios = document.querySelectorAll('input[name="time-system"]');
      radios.forEach(function(r) { r.checked = r.value === ts; });
    } catch(e) {}
  }
  setTimeout(loadTimeSystemSetting, 500);

  function formatTimeForDisplay(hour24, minute, use12h) {
    if (use12h === undefined) use12h = getTimeSystem() === '12h';
    if (use12h) {
      var period = hour24 >= 12 ? 'PM' : 'AM';
      var h12 = hour24 % 12 || 12;
      return h12 + ':' + String(minute).padStart(2,'0') + ' ' + period;
    }
    return String(hour24).padStart(2,'0') + ':' + String(minute).padStart(2,'0');
  }

  function formatTimeDisplay(timeStr, use12h) {
    // Accepts "HH:MM" or "HH:MM-HH:MM" formats
    if (use12h === undefined) use12h = getTimeSystem() === '12h';
    if (!timeStr) return timeStr;
    // Simple single time "HH:MM"
    var parts = timeStr.split('-');
    if (parts.length === 1) {
      var t = parts[0].split(':');
      if (t.length === 2) {
        var h = parseInt(t[0]);
        var m = parseInt(t[1]);
        if (!isNaN(h) && !isNaN(m)) return formatTimeForDisplay(h, m, use12h);
      }
      return timeStr;
    }
    // Range "HH:MM-HH:MM"
    var t1 = parts[0].split(':');
    var t2 = parts[1].split(':');
    if (t1.length === 2 && t2.length === 2) {
      var h1 = parseInt(t1[0]), m1 = parseInt(t1[1]);
      var h2 = parseInt(t2[0]), m2 = parseInt(t2[1]);
      if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
        return formatTimeForDisplay(h1, m1, use12h) + '-' + formatTimeForDisplay(h2, m2, use12h);
      }
    }
    return timeStr;
  }

  // Apply calendar mock settings without page reload
  function applyCalendarMock() {
    var loading = document.getElementById('cal-loading');
    var notConnected = document.getElementById('cal-not-connected');
    var connected = document.getElementById('cal-connected');
    if (!loading || !notConnected || !connected) return;

    var mockConnected = true;
    try {
      var saved = JSON.parse(localStorage.getItem('ivi_mock_state'));
      if (saved && saved['mock-cal-connected'] === false) mockConnected = false;
    } catch(e) {}

    loading.style.display = 'none';
    if (mockConnected) {
      notConnected.style.display = 'none';
      connected.style.display = 'block';
      setTimeout(calRenderGrid, 50);
    } else {
      notConnected.style.display = 'block';
      connected.style.display = 'none';
    }
  }

  // Load calendar page — called when Calendar nav is clicked
  function loadCalendarPage() {
    var loading = document.getElementById('cal-loading');
    var notConnected = document.getElementById('cal-not-connected');
    var connected = document.getElementById('cal-connected');

    if (!loading || !notConnected || !connected) return;

    // Hide loading
    loading.style.display = 'none';

    // Check mock toggle — default to connected (mock mode)
    var mockConnected = true;
    try {
      var saved = JSON.parse(localStorage.getItem('ivi_mock_state'));
      if (saved && saved['mock-cal-connected'] === false) mockConnected = false;
    } catch(e) {}

    if (mockConnected) {
      notConnected.style.display = 'none';
      connected.style.display = 'block';
      setTimeout(calRenderGrid, 50);
    } else {
      notConnected.style.display = 'block';
      connected.style.display = 'none';
    }
  }

  // Check calendar status on dashboard load
  document.querySelectorAll('.nav-item[data-page="dashboard"]').forEach(el => {
    el.addEventListener('click', checkCalendarStatus);
  });
  // Also check on initial load
  setTimeout(checkCalendarStatus, 2000);
  // Load recordings on initial load
  loadIVIRecordings();
  // Load recent activity
  renderRecentActivity();
  // Check fresh install state
  applyFreshInstall();
  // Start prep alert loop on initial load
  setTimeout(startPrepAlertLoop, 2000);
  setTimeout(renderDocReminderAlert, 2500);

  // ---------- Push-to-Talk ----------
  let pttRecorder = null;
  let pttStream = null;
  let pttChunks = [];

  // Listen for hotkey from main process
  window.ivi.onPushToTalk((data) => {
    console.log('[PTT] Hotkey pressed:', data.hotkey);
    startPTT();
  });

  async function startPTT() {
    try {
      // Show mic indicator
      showPTTIndicator(true);

      // Capture microphone audio
      pttStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      pttChunks = [];
      pttRecorder = new MediaRecorder(pttStream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus' : 'audio/webm'
      });

      pttRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) pttChunks.push(e.data);
      };

      pttRecorder.onstop = async () => {
        showPTTIndicator(false);
        pttStream.getTracks().forEach(t => t.stop());

        // Send captured audio to backend
        const blob = new Blob(pttChunks, { type: 'audio/webm' });
        const text = await sendPTTAudio(blob);
        if (text) {
          // Query LLM with the transcribed question
          await askIVI(text);
        }
      };

      // Auto-stop after 5 seconds of silence
      pttRecorder.start();
      setTimeout(() => {
        if (pttRecorder && pttRecorder.state === 'recording') {
          pttRecorder.stop();
        }
      }, 5000);
    } catch (err) {
      console.error('[PTT] Error:', err);
      showPTTIndicator(false);
    }
  }

  function showPTTIndicator(active) {
    let el = document.getElementById('ptt-indicator');
    if (!el && active) {
      el = document.createElement('div');
      el.id = 'ptt-indicator';
      el.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#7c3aed;color:#fff;padding:8px 14px;border-radius:20px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(124,58,237,0.4);display:flex;align-items:center;gap:6px';
      el.innerHTML = '🎤 Listening...';
      document.body.appendChild(el);
    } else if (!active && el) {
      el.remove();
    }
  }

  async function sendPTTAudio(blob) {
    try {
      // Send via WebSocket — use existing ws endpoint
      const ws = new WebSocket('ws://127.0.0.1:8765/ws/ptt');
      await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
      });

      // Send audio data
      const buffer = await blob.arrayBuffer();
      ws.send(buffer);
      ws.send(JSON.stringify({ type: 'end' }));

      // Wait for response
      const response = await new Promise((resolve) => {
        ws.onmessage = (e) => resolve(e.data);
        setTimeout(() => resolve(null), 10000);
      });

      ws.close();
      if (response) {
        const data = JSON.parse(response);
        return data.text;
      }
      return null;
    } catch (err) {
      console.error('[PTT] WS error:', err);
      return null;
    }
  }

  async function askIVI(question) {
    try {
      showPTTIndicator(true);
      const indicator = document.getElementById('ptt-indicator');
      if (indicator) indicator.innerHTML = '🧠 Thinking...';

      // Encode question and send to backend
      const resp = await window.ivi.fetchAPI(`/api/ptt?q=${encodeURIComponent(question)}`);
      if (resp && resp.answer) {
        // Play TTS response
        const audioUrl = `http://127.0.0.1:8765/api/tts?text=${encodeURIComponent(resp.answer.slice(0, 1000))}&voice=pl-PL-ZofiaNeural`;
        const audio = new Audio(audioUrl);
        audio.onended = () => showPTTIndicator(false);
        audio.play();
        if (indicator) indicator.innerHTML = '🔊 Speaking...';
      } else {
        showPTTIndicator(false);
      }
    } catch (err) {
      console.error('[PTT] ask error:', err);
      showPTTIndicator(false);
    }
  }

  // Keyboard shortcut: Cmd+Shift+I triggers push-to-talk manually (for testing)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'I') {
      // main.js handles this via globalShortcut, this is a fallback
    }
  });

  // === MEETING ROOM ===
  let meetingRoomOpen = false;
  let meetingTimer = null;
  let meetingSeconds = 0;

  function openMeetingRoom() {
    const modal = document.getElementById('meeting-modal');
    if (modal) modal.classList.remove('active');

    const room = document.getElementById('meeting-room');
    if (!room) return;
    room.style.display = 'flex';

    // Get meeting info from the modal title/meta
    const titleEl = document.getElementById('modal-title');
    const metaEl = document.getElementById('modal-meta');
    if (titleEl) document.getElementById('mr-meeting-title').textContent = titleEl.textContent;
    if (metaEl) document.getElementById('mr-meeting-time').textContent = metaEl.textContent;

    // Find the meeting's joinUrl from tracker data
    const meetingTitle = titleEl ? titleEl.textContent : '';
    let joinUrl = '';

    // Try to get from the current meeting card data
    const nextCard = document.querySelector('.next-meeting-card');
    if (nextCard && nextCard.dataset) {
      joinUrl = nextCard.dataset.joinUrl || '';
    }

    // Try the webview
    const webview = document.getElementById('teams-webview');
    const placeholder = document.getElementById('teams-placeholder');
    if (webview && joinUrl) {
      webview.src = joinUrl;
      webview.addEventListener('did-start-loading', function() {
        if (placeholder) placeholder.style.display = 'flex';
      });
      webview.addEventListener('did-stop-loading', function() {
        if (placeholder) placeholder.classList.add('webview-loaded');
        setTimeout(() => { if (placeholder) placeholder.style.display = 'none'; }, 500);
      });
      webview.addEventListener('did-fail-load', function() {
        // Keep placeholder visible if load fails
        if (placeholder) placeholder.style.display = 'flex';
      });
    }

    // Start timer
    meetingSeconds = 0;
    if (meetingTimer) clearInterval(meetingTimer);
    meetingTimer = setInterval(function() {
      meetingSeconds++;
      const m = Math.floor(meetingSeconds / 60);
      const s = meetingSeconds % 60;
      const timer = document.getElementById('mr-timer');
      if (timer) timer.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }, 1000);

    meetingRoomOpen = true;
    if (window.lucide) setTimeout(function() { lucide.createIcons(); }, 50);
  }

  function closeMeetingRoom() {
    const room = document.getElementById('meeting-room');
    if (room) room.style.display = 'none';
    if (meetingTimer) { clearInterval(meetingTimer); meetingTimer = null; }

    // Stop webview
    const webview = document.getElementById('teams-webview');
    if (webview) { try { webview.src = 'about:blank'; } catch(e) {} }

    const placeholder = document.getElementById('teams-placeholder');
    if (placeholder) placeholder.classList.remove('webview-loaded');
    if (placeholder) placeholder.style.display = 'flex';

    meetingRoomOpen = false;

    // Save live notes when meeting ends
    saveLiveNotes();
    // Close notes panel
    const notesPanel = document.getElementById('live-notes-panel');
    if (notesPanel) notesPanel.style.display = 'none';
  }

  // === LIVE NOTES ===
  let liveNotesSaveTimer = null;

  function toggleLiveNotes() {
    const panel = document.getElementById('live-notes-panel');
    if (!panel) return;
    if (panel.style.display === 'none' || panel.style.display === '') {
      panel.style.display = 'flex';
      loadLiveNotes();
      // Start auto-save interval
      if (liveNotesSaveTimer) clearInterval(liveNotesSaveTimer);
      liveNotesSaveTimer = setInterval(autoSaveLiveNotes, 10000);
      setTimeout(function() { if (window.lucide) lucide.createIcons(); }, 50);
    } else {
      panel.style.display = 'none';
      if (liveNotesSaveTimer) { clearInterval(liveNotesSaveTimer); liveNotesSaveTimer = null; }
    }
  }

  function closeLiveNotes() {
    const panel = document.getElementById('live-notes-panel');
    if (panel) panel.style.display = 'none';
    if (liveNotesSaveTimer) { clearInterval(liveNotesSaveTimer); liveNotesSaveTimer = null; }
  }

  function autoSaveLiveNotes() {
    const ta = document.getElementById('live-notes-textarea');
    if (!ta) return;
    const text = ta.value;
    // Update char count
    var countEl = document.getElementById('live-notes-count');
    if (countEl) countEl.textContent = text.length + ' chars';
    // Show status
    var statusEl = document.getElementById('live-notes-status');
    if (statusEl) {
      statusEl.textContent = 'Auto-saving...';
      statusEl.style.color = 'rgba(255,255,255,0.6)';
    }
    // Save to localStorage (debounced in saveLiveNotes)
    localStorage.setItem('ivi_live_notes', text);
    clearTimeout(liveNotesSaveTimer);
    liveNotesSaveTimer = setTimeout(function() {
      if (statusEl) {
        statusEl.textContent = 'Auto-saved ✓';
        statusEl.style.color = 'rgba(16,185,129,0.6)';
        setTimeout(function() {
          if (statusEl) { statusEl.textContent = 'Auto-saved'; statusEl.style.color = 'rgba(255,255,255,0.3)'; }
        }, 3000);
      }
    }, 500);
  }

  function saveLiveNotes() {
    const ta = document.getElementById('live-notes-textarea');
    if (!ta) return;
    const text = ta.value.trim();
    if (!text) return;
    localStorage.setItem('ivi_live_notes', text);
    // Also save to a dated entry for history
    var meetingTitle = (document.getElementById('mr-meeting-title') || {}).textContent || 'Meeting';
    var now = new Date();
    var dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    var timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    var notesKey = 'ivi_live_notes_' + dateStr.replace(/[,\s]/g, '_') + '_' + meetingTitle.replace(/[^a-zA-Z0-9]/g, '_');
    localStorage.setItem(notesKey, JSON.stringify({
      meeting: meetingTitle,
      date: dateStr,
      time: timeStr,
      notes: text
    }));
  }

  function loadLiveNotes() {
    const ta = document.getElementById('live-notes-textarea');
    if (!ta) return;
    const saved = localStorage.getItem('ivi_live_notes');
    if (saved) {
      ta.value = saved;
      var countEl = document.getElementById('live-notes-count');
      if (countEl) countEl.textContent = saved.length + ' chars';
    } else {
      ta.value = '';
      var countEl = document.getElementById('live-notes-count');
      if (countEl) countEl.textContent = '0 chars';
    }
  }

  // === DRAGGABLE AI BUBBLE ===
  let dragState = null;

  function initDrag(e) {
    const bubble = document.getElementById('ai-bubble');
    if (!bubble) return;
    const rect = bubble.getBoundingClientRect();
    dragState = {
      startX: e.clientX, startY: e.clientY,
      origLeft: rect.left, origTop: rect.top,
      origRight: window.innerWidth - rect.right,
      origBottom: window.innerHeight - rect.bottom,
    };
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
    e.preventDefault();
  }

  function onDrag(e) {
    if (!dragState) return;
    const bubble = document.getElementById('ai-bubble');
    if (!bubble) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    bubble.style.left = (dragState.origLeft + dx) + 'px';
    bubble.style.top = (dragState.origTop + dy) + 'px';
    bubble.style.bottom = 'auto';
    bubble.style.right = 'auto';
  }

  function endDrag() {
    dragState = null;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
  }

  // Attach drag handlers after DOM ready
  document.addEventListener('DOMContentLoaded', function() {
    const handle = document.getElementById('ai-bubble-handle');
    if (handle) {
      handle.addEventListener('mousedown', initDrag);
    }
  });

  // Also re-attach when lucide creates icons
  function closeAiChat() {
    const bubble = document.getElementById('ai-bubble');
    if (bubble) bubble.style.display = bubble.style.display === 'none' ? '' : 'none';
  }

  function sendAiPrompt(text) {
    if (!text || !text.trim()) return;
    const body = document.getElementById('ai-bubble-body');
    const input = document.getElementById('ai-chat-input');
    if (!body) return;

    // Add user message
    const userMsg = document.createElement('div');
    userMsg.className = 'ai-message';
    userMsg.style.justifyContent = 'flex-end';
    userMsg.innerHTML = '<div class="ai-msg-text" style="background:rgba(16,185,129,0.2);color:#d1fae5;border-bottom-right-radius:4px">' + text + '</div>';
    body.appendChild(userMsg);

    // Clear input
    if (input) input.value = '';

    // Simulate AI response
    setTimeout(function() {
      const respMsg = document.createElement('div');
      respMsg.className = 'ai-message ai-welcome';
      const responses = [
        'Based on the documents, the key focus areas are API migration timeline and Q4 deliverables.',
        'I found 3 relevant points: test plan gaps, resource allocation, and deadline risks.',
        'The meeting context includes Spec_API_v2.pdf and Q4_goals.pdf — both are loaded and ready.',
      ];
      respMsg.innerHTML = '<div class="ai-msg-text" style="background:rgba(59,130,246,0.12);color:#bfdbfe;border-bottom-left-radius:4px">' + responses[Math.floor(Math.random() * responses.length)] + '</div>';
      body.appendChild(respMsg);
      body.scrollTop = body.scrollHeight;
    }, 600);

    body.scrollTop = body.scrollHeight;
  }

  // ---------- Todo Lists ----------

  const MOCK_TODO_LISTS = [
    {
      id: 1, meeting_title: 'Sprint Review Follow-up', meeting_date: 'Today', meeting_time: '17:45 – 18:00',
      total_items: 3, done_items: 1, assigned_to_meeting_id: true, color: '#f0f5ff', borderColor: '#c7d2fe', urgent: true,
      items: [
        { person: 'Marek', description: 'Update API docs', status: 'done' },
        { person: 'Ania', description: 'Review test plan', status: 'pending' },
        { person: 'Krzysiek', description: 'Deploy v2.3', status: 'pending' }
      ]
    },
    {
      id: 2, meeting_title: 'Teacher Lab UI Review', meeting_date: 'Tomorrow', meeting_time: '09:00 – 10:00',
      total_items: 4, done_items: 2, assigned_to_meeting_id: false, color: '#fdf2f8', borderColor: '#fbcfe8',
      items: [
        { person: 'Renata', description: 'Prepare mockups', status: 'done' },
        { person: 'Marek', description: 'API integration test', status: 'done' },
        { person: 'Ania', description: 'Review accessibility', status: 'not_done' },
        { person: 'Krzysiek', description: 'Deploy staging', status: 'pending' }
      ]
    },
    {
      id: 3, meeting_title: 'Daily Stand-up', meeting_date: 'Tomorrow', meeting_time: '09:15 – 09:30',
      total_items: 2, done_items: 0, assigned_to_meeting_id: true, color: '#fffbeb', borderColor: '#fde68a',
      items: [
        { person: 'Renata', description: 'Follow up on API migration blockers', status: 'pending' },
        { person: 'Marek', description: 'Prepare sprint demo for Friday', status: 'pending' }
      ]
    },
    {
      id: 4, meeting_title: 'Q4 Planning Sync', meeting_date: 'Fri, Oct 31', meeting_time: '11:00 – 12:00',
      total_items: 5, done_items: 1, assigned_to_meeting_id: false, color: '#f0fdf4', borderColor: '#bbf7d0',
      items: [
        { person: 'Renata', description: 'Prepare Q4 roadmap draft', status: 'done' },
        { person: 'Marek', description: 'Compile resource estimates', status: 'pending' },
        { person: 'Ania', description: 'Review past quarter metrics', status: 'pending' },
        { person: 'Krzysiek', description: 'Prepare risk assessment', status: 'pending' },
        { person: 'Renata', description: 'Define OKRs for next quarter', status: 'pending' }
      ]
    },
    {
      id: 5, meeting_title: 'Design Review', meeting_date: 'Mon, Nov 3', meeting_time: '14:00 – 15:00',
      total_items: 3, done_items: 0, assigned_to_meeting_id: false, color: '#f5f3ff', borderColor: '#ddd6fe',
      items: [
        { person: 'Ania', description: 'Finalize wireframes', status: 'pending' },
        { person: 'Marek', description: 'Prepare user flow diagrams', status: 'pending' },
        { person: 'Renata', description: 'Review accessibility compliance', status: 'pending' }
      ]
    },
    {
      id: 6, meeting_title: '1:1 with Manager', meeting_date: 'Tue, Nov 4', meeting_time: '10:00 – 10:30',
      total_items: 2, done_items: 1, assigned_to_meeting_id: true, color: '#ecfeff', borderColor: '#a5f3fc',
      items: [
        { person: 'Renata', description: 'Prepare status report', status: 'done' },
        { person: 'Renata', description: 'List topics for discussion', status: 'pending' }
      ]
    },
    {
      id: 7, meeting_title: 'Sprint Retrospective', meeting_date: 'Wed, Nov 5', meeting_time: '15:00 – 16:00',
      total_items: 4, done_items: 3, assigned_to_meeting_id: false, color: '#fff7ed', borderColor: '#fed7aa',
      items: [
        { person: 'Team', description: 'Gather feedback from sprint', status: 'done' },
        { person: 'Renata', description: 'Prepare improvement proposals', status: 'done' },
        { person: 'Marek', description: 'Compile velocity metrics', status: 'done' },
        { person: 'Ania', description: 'Document action items', status: 'pending' }
      ]
    },
    {
      id: 8, meeting_title: 'Client Presentation Prep', meeting_date: 'Thu, Nov 6', meeting_time: '09:00 – 10:30',
      total_items: 6, done_items: 2, assigned_to_meeting_id: true, color: '#fef2f2', borderColor: '#fecaca',
      items: [
        { person: 'Renata', description: 'Create slide deck', status: 'done' },
        { person: 'Marek', description: 'Prepare demo environment', status: 'done' },
        { person: 'Ania', description: 'Write talking points', status: 'pending' },
        { person: 'Krzysiek', description: 'Set up analytics dashboard', status: 'pending' },
        { person: 'Renata', description: 'Rehearse presentation', status: 'pending' },
        { person: 'Team', description: 'Review competitor analysis', status: 'pending' }
      ]
    },
    {
      id: 9, meeting_title: 'Architecture Decision Review', meeting_date: 'Fri, Nov 7', meeting_time: '13:00 – 14:00',
      total_items: 3, done_items: 0, assigned_to_meeting_id: false, color: '#faf5ff', borderColor: '#e9d5ff',
      items: [
        { person: 'Marek', description: 'Document proposed architecture', status: 'pending' },
        { person: 'Krzysiek', description: 'Prepare migration path comparison', status: 'pending' },
        { person: 'Ania', description: 'Review security implications', status: 'pending' }
      ]
    },
    {
      id: 10, meeting_title: 'Team Building Planning', meeting_date: 'Mon, Nov 10', meeting_time: '16:00 – 17:00',
      total_items: 2, done_items: 2, assigned_to_meeting_id: true, color: '#f0fdf4', borderColor: '#86efac',
      items: [
        { person: 'Renata', description: 'Choose venue & date', status: 'done' },
        { person: 'Ania', description: 'Collect team preferences', status: 'done' }
      ]
    }
  ];

  // Meetings available for item assignment
  const MOCK_MEETINGS_FOR_ASSIGN = [
    { id: 'm1', title: 'Daily Stand-up', date: 'Wed, Oct 28', time: '09:15' },
    { id: 'm2', title: 'Sprint Planning', date: 'Thu, Oct 29', time: '10:00' },
    { id: 'm3', title: 'Product Sprint Review', date: 'Fri, Oct 30', time: '14:00' },
    { id: 'm4', title: 'e-Krew Technical Sync', date: 'Fri, Oct 30', time: '11:00' }
  ];

  // Load saved item→meeting assignments from localStorage
  function getItemAssignments() {
    try { return JSON.parse(localStorage.getItem('ivi_item_assignments') || '{}'); } catch(e) { return {}; }
  }
  function saveItemAssignment(itemId, meetingId) {
    var ass = getItemAssignments();
    if (meetingId) ass[itemId] = meetingId;
    else delete ass[itemId];
    localStorage.setItem('ivi_item_assignments', JSON.stringify(ass));
  }

  // Toggle checkbox on dashboard card
  function toggleDismissItem(el) {
    // Try detail modal first (todo-detail-item)
    var detailItem = el.closest('.todo-detail-item');
    if (detailItem) {
      var itemId = parseInt(detailItem.dataset.itemId);
      var listId = parseInt(detailItem.dataset.listId);
      var isDismissing = el.textContent === '✕';
      // Update MOCK_TODO_LISTS
      for (var i = 0; i < MOCK_TODO_LISTS.length; i++) {
        if (MOCK_TODO_LISTS[i].id === listId) {
          for (var j = 0; j < MOCK_TODO_LISTS[i].items.length; j++) {
            if ((MOCK_TODO_LISTS[i].items[j].id === undefined || MOCK_TODO_LISTS[i].items[j].id === itemId) && j === itemId - 1) {
              MOCK_TODO_LISTS[i].items[j].status = isDismissing ? 'dismissed' : 'pending';
            }
          }
          break;
        }
      }
      // Re-render
      openTodoDetail(listId);
      loadTodoLists();
      // Also sync dashboard card
      syncDashboardTodoCard();
      return;
    }

    // Fallback to dashboard card (todo-mock-item)
    var label = el.closest('.todo-mock-item');
    if (!label) return;
    var cb = label.querySelector('input[type="checkbox"]');
    var text = label.querySelector('.todo-text');
    var isDismissing = el.textContent === '✕';
    // Also update MOCK_TODO_LISTS for reverse sync
    var listEl = label.closest('.todo-mock-list');
    if (listEl) {
      var listIdx = -1;
      var allLists = document.querySelectorAll('.todo-mock-list');
      allLists.forEach(function(l, li) { if (l === listEl) listIdx = li; });
      var itemIdx = -1;
      var items = listEl.querySelectorAll('.todo-mock-item');
      items.forEach(function(it, ii) { if (it === label) itemIdx = ii; });
      if (listIdx >= 0 && listIdx < MOCK_TODO_LISTS.length && itemIdx >= 0 && MOCK_TODO_LISTS[listIdx].items && itemIdx < MOCK_TODO_LISTS[listIdx].items.length) {
        MOCK_TODO_LISTS[listIdx].items[itemIdx].status = isDismissing ? 'dismissed' : 'pending';
      }
    }
    if (isDismissing) {
      label.classList.add('dismissed');
      cb.checked = false;
      cb.disabled = true;
      toggleTodoItem(cb);
      text.style.color = '#ef4444';
      text.style.textDecoration = 'line-through';
      text.style.textDecorationColor = '#ef4444';
      label.style.opacity = '0.5';
      el.textContent = '↩';
      el.style.color = 'var(--emerald)';
    } else {
      label.classList.remove('dismissed');
      cb.checked = false;
      cb.disabled = false;
      toggleTodoItem(cb);
      label.style.opacity = '1';
      el.textContent = '✕';
      el.style.color = '#9ca3af';
    }
    updateUrgentState();
  }

  function toggleTodoItem(cb) {
    var textSpan = cb.parentElement.querySelector('.todo-text');
    if (cb.checked) {
      textSpan.style.textDecoration = 'line-through';
      textSpan.style.color = '#6b7280';
    } else {
      textSpan.style.textDecoration = 'none';
      textSpan.style.color = '';
    }
    // Sync with MOCK_TODO_LISTS
    var label = cb.closest('.todo-mock-item');
    var listEl = cb.closest('.todo-mock-list');
    if (label && listEl) {
      var listIdx = -1;
      var allLists = document.querySelectorAll('.todo-mock-list');
      allLists.forEach(function(l, li) { if (l === listEl) listIdx = li; });
      var itemIdx = -1;
      var items = listEl.querySelectorAll('.todo-mock-item');
      items.forEach(function(it, ii) { if (it === label) itemIdx = ii; });
      if (listIdx >= 0 && listIdx < MOCK_TODO_LISTS.length && itemIdx >= 0 && MOCK_TODO_LISTS[listIdx].items && itemIdx < MOCK_TODO_LISTS[listIdx].items.length) {
        MOCK_TODO_LISTS[listIdx].items[itemIdx].status = cb.checked ? 'done' : 'pending';
      }
    }
    // Recalculate counts for this list — exclude dismissed items
    var listEl = cb.closest('.todo-mock-list');
    if (listEl) {
      var items = listEl.querySelectorAll('.todo-mock-item');
      var countEl = listEl.querySelector('.todo-count');
      if (countEl && items.length > 0) {
        var done = 0;
        var activeTotal = 0;
        items.forEach(function(item) {
          var isDis = item.classList.contains('dismissed');
          if (!isDis) activeTotal++;
          var c = item.querySelector('input[type="checkbox"]');
          if (c && c.checked && !isDis) done++;
        });
        countEl.textContent = done + '/' + activeTotal + ' done';
      }
    }
    // Update summary
    updateTodoSummary();
    updateUrgentState();
  }

  function updateTodoSummary() {
    var allChecks = document.querySelectorAll('#todo-lists-items .todo-mock-item input[type="checkbox"]');
    var allCount = allChecks.length;
    var doneCount = 0;
    allChecks.forEach(function(c) { if (c.checked) doneCount++; });
    var summaryEl = document.getElementById('todo-lists-summary');
    if (summaryEl) {
      summaryEl.textContent = '2 lists · ' + (allCount - doneCount) + ' open';
    }
  }

  // Check if all items in an urgent list are done/dismissed → remove urgency
  function updateUrgentState() {
    document.querySelectorAll('.todo-mock-list.urgent').forEach(function(list) {
      var items = list.querySelectorAll('.todo-mock-item');
      var allDone = true;
      items.forEach(function(item) {
        var cb = item.querySelector('input[type="checkbox"]');
        var dismissed = item.classList.contains('dismissed');
        if (!(cb && cb.checked) && !dismissed) {
          allDone = false;
        }
      });
      if (allDone && items.length > 0) {
        // Remove urgency: normal state
        list.classList.remove('urgent');
        list.style.boxShadow = '';
        list.style.transform = '';
        list.style.margin = '';
        list.style.zIndex = '';
        list.style.padding = '8px 10px';
      }
    });
  }

  function syncDashboardTodoCard() {
    var lists = document.querySelectorAll('.todo-mock-list');
    lists.forEach(function(listEl) {
      var items = listEl.querySelectorAll('.todo-mock-item');
      items.forEach(function(itemEl, idx) {
        var cb = itemEl.querySelector('input[type="checkbox"]');
        var text = itemEl.querySelector('.todo-text');
        var dismiss = itemEl.querySelector('.todo-dismiss');
        if (!cb || !text) return;
        var mockListIdx = -1;
        for (var i = 0; i < MOCK_TODO_LISTS.length && mockListIdx === -1; i++) {
          if (MOCK_TODO_LISTS[i].items && idx < MOCK_TODO_LISTS[i].items.length) {
            var item = MOCK_TODO_LISTS[i].items[idx];
            var txt = text.textContent.replace('👤','').trim();
            if (txt.indexOf(item.description.substring(0, Math.min(8, item.description.length))) !== -1) {
              mockListIdx = i;
            }
          }
        }
        if (mockListIdx === -1 || !MOCK_TODO_LISTS[mockListIdx] || !MOCK_TODO_LISTS[mockListIdx].items[idx]) return;
        var mockItem = MOCK_TODO_LISTS[mockListIdx].items[idx];
        if (mockItem.status === 'dismissed') {
          itemEl.classList.add('dismissed');
          cb.checked = false; cb.disabled = true;
          text.style.color = '#ef4444'; text.style.textDecoration = 'line-through'; text.style.textDecorationColor = '#ef4444';
          itemEl.style.opacity = '0.5';
          if (dismiss) { dismiss.textContent = '↩'; dismiss.style.color = 'var(--emerald)'; }
        } else if (mockItem.status === 'done') {
          itemEl.classList.remove('dismissed');
          cb.checked = true; cb.disabled = false;
          text.style.color = '#6b7280'; text.style.textDecoration = 'line-through'; text.style.textDecorationColor = '#6b7280';
          itemEl.style.opacity = '1';
          if (dismiss) { dismiss.textContent = '✕'; dismiss.style.color = '#9ca3af'; }
        } else {
          itemEl.classList.remove('dismissed');
          cb.checked = false; cb.disabled = false;
          text.style.color = ''; text.style.textDecoration = 'none';
          itemEl.style.opacity = '1';
          if (dismiss) { dismiss.textContent = '✕'; dismiss.style.color = '#9ca3af'; }
        }
      });
    });
    // Update per-list counts
    var listEls = document.querySelectorAll('.todo-mock-list');
    listEls.forEach(function(l) {
      var items = l.querySelectorAll('.todo-mock-item');
      var countEl = l.querySelector('.todo-count');
      if (countEl && items.length > 0) {
        var done = 0, activeTotal = 0;
        items.forEach(function(item) {
          var isDis = item.classList.contains('dismissed');
          if (!isDis) activeTotal++;
          var c = item.querySelector('input[type="checkbox"]');
          if (c && c.checked && !isDis) done++;
        });
        countEl.textContent = done + '/' + activeTotal + ' done';
      }
    });
    updateTodoSummary();
    updateUrgentState();
  }

  async function loadTodoLists() {
    try {
      const data = await window.ivi.fetchAPI('/api/todo-lists');
      const lists = data.todo_lists || [];
      const card = document.getElementById('todo-lists-card');
      const summaryEl = document.getElementById('todo-lists-summary');
      const itemsEl = document.getElementById('todo-lists-items');

      // Fallback to MOCK_TODO_LISTS with real item statuses
      const source = (lists.length > 0 ? lists : MOCK_TODO_LISTS).map(function(list) {
        // Calculate actual counts from items
        var activeItems = (list.items || []).filter(function(it) { return it.status !== 'dismissed'; });
        var doneItems = activeItems.filter(function(it) { return it.status === 'done'; });
        return {
          id: list.id,
          meeting_title: list.meeting_title,
          total_items: list.items ? list.items.length : 0,
          active_items: activeItems.length,
          done_items: doneItems.length,
          assigned_to_meeting_id: list.assigned_to_meeting_id
        };
      });

      if (source.length === 0) {
        if (itemsEl && itemsEl.children.length > 0) return;
        summaryEl.textContent = 'No lists yet';
        itemsEl.innerHTML = '';
        return;
      }

      var totalActive = source.reduce(function(s, l) { return s + (l.active_items - l.done_items); }, 0);
      var totalAll = source.length;
      summaryEl.textContent = totalAll + ' list' + (totalAll > 1 ? 's' : '') + ' · ' + totalActive + ' open';

      // Don't touch items HTML — static card content is authoritative
      // Only update per-list counts in static HTML if needed

      // Show notification badge if there are unassigned lists
      var unassigned = source.filter(function(l) { return !l.assigned_to_meeting_id; });
      var badge = document.getElementById('nav-todo-badge');
      if (badge) {
        badge.textContent = unassigned.length;
        badge.style.display = unassigned.length > 0 ? 'inline-flex' : 'none';
      }
    } catch (err) {
      console.error('Todo lists error:', err);
    }
  }

  function openTodoManager() {
    const modal = document.getElementById('todo-manager-modal');
    const listEl = document.getElementById('todo-manager-list');
    modal.classList.add('active');

    window.ivi.fetchAPI('/api/todo-lists').then(data => {
      const lists = data.todo_lists || [];
      // Use mock data if API returns empty
      const displayLists = lists.length > 0 ? lists : MOCK_TODO_LISTS;
      document.getElementById('todo-manager-meta').textContent = `${displayLists.length} list${displayLists.length !== 1 ? 's' : ''}`;

      if (displayLists.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">No to-do lists yet. They appear after meetings with action items.</div>';
        return;
      }

      let html = '';
      const pastelBg = ['#f0f5ff', '#fdf2f8', '#f0fdf4', '#fffbeb', '#faf5ff', '#ecfeff'];
      displayLists.forEach((list, idx) => {
        const pct = list.total_items > 0 ? Math.round((list.done_items / list.total_items) * 100) : 0;
        const assigned = list.assigned_to_meeting_id
          ? `<span style="font-size:10px;color:var(--emerald)">✅ Assigned</span>`
          : `<span style="font-size:10px;color:#f59e0b">⚠️ Not assigned</span>`;
        // Use list color if available, else cycle through pastelBg
        const bg = list.color || pastelBg[idx % pastelBg.length];
        html += `<div style="padding:12px;margin-bottom:8px;border-radius:10px;background:${bg};cursor:pointer" onclick="openTodoDetail(${list.id})">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-weight:600;font-size:14px">${list.meeting_title}</div>
            ${assigned}
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${list.meeting_date} ${list.meeting_time}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
            ${list.meeting_date} ${list.meeting_time} · ${list.total_items} items · ${list.done_items} done
          </div>
          <div style="margin-top:6px;background:#e5e7eb;border-radius:4px;height:4px;overflow:hidden">
            <div style="background:var(--emerald);height:100%;width:${pct}%;border-radius:4px;transition:width .3s"></div>
          </div>
        </div>`;
      });
      listEl.innerHTML = html;
    }).catch(() => {
      listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">Error loading lists</div>';
    });
  }

  function closeTodoManager() {
    document.getElementById('todo-manager-modal').classList.remove('active');
  }

  async function openTodoDetail(listId) {
    const modal = document.getElementById('todo-detail-modal');
    const titleEl = document.getElementById('todo-detail-title');
    const metaEl = document.getElementById('todo-detail-meta');
    const bodyEl = document.getElementById('todo-detail-body');
    modal.classList.add('active');

    try {
      const data = await window.ivi.fetchAPI(`/api/todo-lists/${listId}`);
      let list = data.todo_list;
      let items = data.items || [];

      // Fallback to mock if API returns empty
      if (!list || items.length === 0) {
        const mock = MOCK_TODO_LISTS.find(m => m.id === listId);
        if (mock) {
          list = { ...mock, meeting_id: 'mock_' + mock.id, participants: 'Marek, Ania, Krzysiek' };
          items = mock.items.map((item, idx) => ({
            id: idx + 1, person: item.person, description: item.description,
            status: item.status, selected_for_export: false, not_done_reason: ''
          }));
        }
      }

      titleEl.textContent = `📋 ${list.meeting_title}`;
      metaEl.textContent = `${list.meeting_date} ${list.meeting_time} · ${list.participants || 'No participants'}`;

      // Build meeting options for bulk action bar (needed in header)
      var bulkMeetingOpts = '<option value="">→ Assign to meeting...</option>';
      MOCK_MEETINGS_FOR_ASSIGN.forEach(function(m) {
        bulkMeetingOpts += '<option value="' + m.id + '">' + m.title + ' (' + m.date + ' ' + m.time + ')</option>';
      });
      bulkMeetingOpts += '<option value="__personal__">📝 Not assigned (personal note)</option>';

      // Meeting info header with bulk actions on the right
      let html = `<div style="background:var(--card-hover);border-radius:8px;padding:12px;margin-bottom:16px">
        <div style="display:flex;gap:16px;align-items:flex-start">
          <div>
            <div style="font-size:12px;color:var(--text-muted);display:flex;gap:16px;flex-wrap:wrap">
              <span>📅 ${list.meeting_date} ${list.meeting_time}</span>
              <span>👥 ${list.participants || '—'}</span>
            </div>
            <div style="margin-top:8px;display:flex;gap:8px">
              <span class="btn btn-ghost btn-sm" onclick="showNoteDetail('${list.meeting_id}', '${list.meeting_title.replace(/'/g, "\\'")}')">📝 IVI notes</span>
              <span class="btn btn-ghost btn-sm" onclick="addTodoItem(${listId})">➕ Add item</span>
            </div>
          </div>
          <div style="flex:1"></div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
            <span class="btn btn-primary btn-sm" id="bulk-export-${listId}" onclick="bulkExportItems(${listId})" style="font-size:11px;padding:4px 10px;opacity:0.5;pointer-events:none">📤 Export</span>
            <span class="btn btn-ghost btn-sm" id="bulk-assign-btn-${listId}" onclick="openAssignCalendar(${listId})" style="font-size:11px;padding:4px 8px;opacity:0.5;pointer-events:none">→ Assign to meeting</span>
          </div>
        </div>
      </div>`;

      if (items.length === 0) {
        html += '<div style="text-align:center;padding:20px;color:var(--text-muted)">No items in this list</div>';
      } else {
        html += `<div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase">Items (${items.length})</div>`;

        items.forEach(item => {
          const isDone = item.status === 'done';
          const isNotDone = item.status === 'not_done';
          var isDismissed = item.status === 'dismissed';
          var dismissMark = isDismissed ? '↩' : '✕';

          // Status checkbox — styled div, not unicode
          var statusHtml;
          var statusClick = isDismissed ? '' : `onclick="toggleTodoStatus(${item.id}, ${listId})"`;
          var statusCursor = isDismissed ? 'default' : 'pointer';
          if (isDone) {
            statusHtml = `<div class="todo-status done" ${statusClick} style="cursor:${statusCursor};width:18px;height:18px;flex-shrink:0;margin-top:2px;border-radius:4px;border:2px solid #22c55e;background:#22c55e;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;line-height:1">✓</div>`;
          } else if (isNotDone) {
            statusHtml = `<div class="todo-status not-done" ${statusClick} style="cursor:${statusCursor};width:18px;height:18px;flex-shrink:0;margin-top:2px;border-radius:4px;border:2px solid #ef4444;background:#fee2e2;display:flex;align-items:center;justify-content:center;font-size:11px;color:#ef4444;line-height:1">✕</div>`;
          } else {
            statusHtml = `<div class="todo-status pending" ${statusClick} style="cursor:${statusCursor};width:18px;height:18px;flex-shrink:0;margin-top:2px;border-radius:4px;border:2px solid ${isDismissed ? '#ef4444' : '#d1d5db'};background:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;color:transparent;line-height:1;${isDismissed ? 'opacity:0.35' : ''}">✓</div>`;
          }

          html += `<div class="todo-detail-item" data-item-id="${item.id}" data-list-id="${listId}" style="display:flex;gap:8px;padding:10px 0;border-bottom:1px solid var(--card-border);align-items:flex-start">
            ${statusHtml}
            <span class="todo-dismiss" onclick="event.stopPropagation();toggleDismissItem(this);return false" style="cursor:pointer;font-size:14px;color:#9ca3af;flex-shrink:0;line-height:1;margin-top:4px">${dismissMark}</span>
            <span onclick="editTodoItem(${item.id}, ${listId})" style="cursor:pointer;font-size:14px;color:#9ca3af;flex-shrink:0;line-height:1;margin-top:4px;opacity:0.5" title="Edit item">✏️</span>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:4px">
                <span style="font-size:13px;font-weight:500;${isDone || isDismissed ? 'text-decoration:line-through;' : ''}${isDismissed ? 'color:#ef4444;text-decoration-color:#ef4444' : isDone ? 'color:var(--text-muted)' : ''}">${item.description}</span>
              </div>
              ${item.person ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">👤 ${item.person}</div>` : `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">👤 <span style="color:#d1d5db">(none)</span></div>`}
              ${isNotDone && item.not_done_reason ? `<div style="font-size:11px;color:#ef4444;margin-top:2px">💬 ${item.not_done_reason}</div>` : ''}
            </div>
            <input type="checkbox" onchange="toggleSelectItem(this, ${listId})" ${isDismissed ? 'disabled' : ''} style="accent-color:var(--emerald);width:14px;height:14px;flex-shrink:0;cursor:${isDismissed ? 'default' : 'pointer'};margin-top:4px${isDismissed ? ';opacity:0.35' : ''}">
          </div>`;
        });

        // Bottom select all bar — on the right
        html += `<div style=\"display:flex;align-items:center;gap:8px;padding:10px 0 4px;justify-content:flex-end\">
          <label class=\"select-all-label\" style=\"display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted);cursor:pointer\">
            <input type=\"checkbox\" onchange=\"toggleSelectAll(this, ${listId})\" style=\"accent-color:var(--emerald);width:13px;height:13px;cursor:pointer\"> Select all
          </label>
          <span id=\"selected-count-${listId}\" style=\"font-size:10px;color:var(--text-muted);margin-left:4px\">0 selected</span>
        </div>`;
      }

      bodyEl.innerHTML = html;
    } catch (err) {
      bodyEl.innerHTML = `<div style="text-align:center;padding:20px;color:#ef4444">Error: ${err.message}</div>`;
    }
  }

  function closeTodoDetail() {
    document.getElementById('todo-detail-modal').classList.remove('active');
  }

  // ---------- Bulk select & action in detail modal ----------
  function toggleSelectItem(cb, listId) {
    updateBulkActions(listId);
  }

  function toggleSelectAll(cb, listId) {
    document.querySelectorAll('#todo-detail-body .todo-detail-item input[type="checkbox"]').forEach(function(c) {
      c.checked = cb.checked;
    });
    updateBulkActions(listId);
  }

  function updateBulkActions(listId) {
    var allSelectors = document.querySelectorAll('#todo-detail-body .todo-detail-item input[type="checkbox"]');
    var checked = document.querySelectorAll('#todo-detail-body .todo-detail-item input[type="checkbox"]:checked');
    var count = checked.length;
    var total = allSelectors.length;
    var countEl = document.getElementById('selected-count-' + listId);
    if (countEl) countEl.textContent = count + ' selected';

    // Sync Select all checkbox
    var selectAllCb = document.querySelector('.select-all-label input[type="checkbox"]');
    if (selectAllCb) selectAllCb.checked = (count > 0 && count === total);

    var exportBtn = document.getElementById('bulk-export-' + listId);
    var assignBtn = document.getElementById('bulk-assign-btn-' + listId);

    if (count > 0) {
      if (exportBtn) { exportBtn.style.opacity = '1'; exportBtn.style.pointerEvents = 'auto'; }
      if (assignBtn) { assignBtn.style.opacity = '1'; assignBtn.style.pointerEvents = 'auto'; }
    } else {
      if (exportBtn) { exportBtn.style.opacity = '0.5'; exportBtn.style.pointerEvents = 'none'; }
      if (assignBtn) { assignBtn.style.opacity = '0.5'; assignBtn.style.pointerEvents = 'none'; }
    }
  }

  function bulkAssignItems(listId, meetingId) {
    if (!meetingId) return;
    var checked = document.querySelectorAll('#todo-detail-body .todo-detail-item input[type="checkbox"]:checked');
    checked.forEach(function(c) {
      var itemEl = c.closest('.todo-detail-item');
      var itemId = itemEl ? itemEl.dataset.itemId : null;
      if (itemId) {
        var val = meetingId === '__personal__' ? '' : meetingId;
        saveItemAssignment(parseInt(itemId), val);
      }
    });
    // Show feedback
    var count = checked.length;
    var meetingName = meetingId === '__personal__' ? 'personal note' : (MOCK_MEETINGS_FOR_ASSIGN.find(function(m) { return m.id === meetingId; }) || {}).title || meetingId;
    showToast('📌 Assigned ' + count + ' item(s) to ' + meetingName);
  }

  function bulkExportItems(listId) {
    var checked = document.querySelectorAll('#todo-detail-body .todo-detail-item input[type="checkbox"]:checked');
    var texts = [];
    checked.forEach(function(c) {
      var itemEl = c.closest('.todo-detail-item');
      if (itemEl) {
        var desc = itemEl.querySelector('div[style*="font-size:13px"]');
        var person = itemEl.querySelector('div[style*="font-size:11px;color:var(--text-muted)"]');
        var t = '';
        if (person) t += person.textContent.replace('👤 ', '').trim() + ': ';
        t += desc ? desc.textContent.trim() : '';
        texts.push(t);
      }
    });
    if (texts.length > 0) {
      var text = texts.join('\n');
      navigator.clipboard.writeText(text).then(function() {
        showToast('📋 Copied ' + texts.length + ' item(s) to clipboard');
      }).catch(function() {
        // Fallback
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('📋 Copied ' + texts.length + ' item(s) to clipboard');
      });
    }
  }

  function showToast(msg) {
    var existing = document.getElementById('toast-msg');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.id = 'toast-msg';
    toast.textContent = msg;
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 20px;border-radius:12px;font-size:13px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.2);transition:opacity .3s;opacity:1';
    document.body.appendChild(toast);
    setTimeout(function() { toast.style.opacity = '0'; setTimeout(function() { toast.remove(); }, 300); }, 2000);
  }

  // ===== Assign Calendar =====
  var calCurrentDate = new Date();
  var calListId = null;
  var calSelectedDate = null;

  function openAssignCalendar(listId) {
    calListId = listId;
    calCurrentDate = new Date();
    calSelectedDate = null;
    document.getElementById('assign-calendar-modal').classList.add('active');
    // Always start with calendar view, not the form
    document.getElementById('cal-new-meeting-form').style.display = 'none';
    document.getElementById('cal-actions-bar').style.display = 'flex';
    document.getElementById('cal-prev-month').parentElement.style.display = 'flex';
    document.getElementById('cal-day-labels').style.display = 'grid';
    document.getElementById('cal-grid').style.display = 'grid';
    document.getElementById('cal-selected-day').style.display = 'block';
    document.getElementById('cal-meetings-list').style.display = 'block';
    calRender();
  }

  function closeAssignCalendar() {
    document.getElementById('assign-calendar-modal').classList.remove('active');
    // Reset platform color
    var modalEl = document.getElementById('assign-calendar-modal');
    if (modalEl) modalEl.style.background = '';
  }

  function calNavMonth(delta) {
    calCurrentDate.setMonth(calCurrentDate.getMonth() + delta);
    calRender();
  }

  var PLATFORM_COLORS = {
    'teams': { dot: '#8b5cf6', bg: '#ede9fe', label: 'Teams' },
    'zoom': { dot: '#3b82f6', bg: '#dbeafe', label: 'Zoom' },
    'google-meets': { dot: '#eab308', bg: '#fef9c3', label: 'Google Meet' }
  };

  function calRender() {
    // Legend in header
    var legendHtml = '';
    var keys = Object.keys(PLATFORM_COLORS);
    for (var li = 0; li < keys.length; li++) {
      var pc = PLATFORM_COLORS[keys[li]];
      legendHtml += '<span style="display:inline-flex;align-items:center;gap:3px"><span style="width:7px;height:7px;border-radius:50%;background:' + pc.dot + ';display:inline-block"></span> ' + pc.label + '</span>';
    }
    document.getElementById('cal-legend-inline').innerHTML = legendHtml;

    // Day labels
    var labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    document.getElementById('cal-day-labels').innerHTML = labels.map(function(l) { return '<span>' + l + '</span>'; }).join('');

    // Month label
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    document.getElementById('cal-month-label').textContent = months[calCurrentDate.getMonth()] + ' ' + calCurrentDate.getFullYear();

    // Calendar grid
    var year = calCurrentDate.getFullYear();
    var month = calCurrentDate.getMonth();
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var today = new Date();

    var grid = '';
    // Empty cells before first day
    for (var i = 0; i < firstDay; i++) grid += '<span></span>';

    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
      var isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      var isSelected = calSelectedDate === dateStr;
      var meetings = getMeetingsForDate(dateStr);

      // Collect unique platforms for this day
      var platforms = {};
      meetings.forEach(function(m) { if (m.platform) platforms[m.platform] = true; });
      var platformKeys = Object.keys(platforms);

      var cellStyle = 'padding:8px 4px;text-align:center;font-size:12px;border-radius:8px;cursor:pointer;position:relative';
      if (isSelected) cellStyle += ';background:var(--emerald);color:#fff;font-weight:600';
      else if (isToday) cellStyle += ';border:2px solid var(--emerald);color:var(--text);font-weight:700;background:transparent';

      // Platform-colored background (pastel) — split if multiple platforms
      if (!isSelected && !isToday && platformKeys.length > 0) {
        if (platformKeys.length === 1) {
          var pc = PLATFORM_COLORS[platformKeys[0]];
          if (pc) cellStyle += ';background:' + pc.bg;
        } else if (platformKeys.length === 2) {
          var pc1 = PLATFORM_COLORS[platformKeys[0]];
          var pc2 = PLATFORM_COLORS[platformKeys[1]];
          if (pc1 && pc2) cellStyle += ';background:linear-gradient(90deg,' + pc1.bg + ' 50%,' + pc2.bg + ' 50%)';
        } else if (platformKeys.length >= 3) {
          var pcts = [33, 66];
          var stops = '';
          platformKeys.forEach(function(pk, idx) {
            var pc = PLATFORM_COLORS[pk];
            if (pc) {
              if (idx === 0) stops += pc.bg + ' 0% ' + pcts[0] + '%';
              else if (idx === 1) stops += ',' + pc.bg + ' ' + pcts[0] + '% ' + pcts[1] + '%';
              else stops += ',' + pc.bg + ' ' + pcts[1] + '% 100%';
            }
          });
          cellStyle += ';background:linear-gradient(90deg,' + stops + ')';
        }
      }

      grid += '<span style="' + cellStyle + '" onclick="calSelectDate(\'' + dateStr + '\')">' + d + '</span>';
    }

    document.getElementById('cal-grid').innerHTML = grid;

    // Selected day section
    if (calSelectedDate) {
      document.getElementById('cal-selected-day').textContent = '📅 ' + calSelectedDate;
      calRenderMeetings(calSelectedDate);
      // Disable New meeting for past dates
      var todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
      var isPast = calSelectedDate < todayStr;
      var newBtn = document.querySelector('#cal-actions-bar [onclick*="calNewMeeting"]');
      if (newBtn) {
        if (isPast) {
          newBtn.style.opacity = '0.4';
          newBtn.style.pointerEvents = 'none';
          newBtn.title = 'Cannot create meeting in the past';
        } else {
          newBtn.style.opacity = '1';
          newBtn.style.pointerEvents = 'auto';
          newBtn.title = '';
        }
      }
    } else {
      document.getElementById('cal-selected-day').textContent = '';
      document.getElementById('cal-meetings-list').innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:16px">Click a day to see meetings</div>';
    }
  }

  function getMeetingsForDate(dateStr) {
    // Return meetings that fall on this date — from calendar data + custom meetings
    var res = [];

    // Generate meetings from the full calendar for the current month
    var today = new Date();
    var year = parseInt(dateStr.substring(0,4));
    var month = parseInt(dateStr.substring(5,7)) - 1;
    var day = parseInt(dateStr.substring(8,10));

    // Mock calendar meetings spread across month days with platform colors
    var mockCalendarMeetings = [
      { id: 'cal_m1', title: 'Daily Stand-up', time: '09:15', daysFromStart: 1, platform: 'teams' },
      { id: 'cal_m2', title: 'Product Sprint Review', time: '14:00', daysFromStart: 2, platform: 'zoom' },
      { id: 'cal_m3', title: 'Design Sync', time: '11:00', daysFromStart: 3, platform: 'teams' },
      { id: 'cal_m3b', title: 'Client Sync', time: '13:00', daysFromStart: 3, platform: 'zoom' },
      { id: 'cal_m4', title: 'Client Sync — e-Krew', time: '10:30', daysFromStart: 4, platform: 'google-meets' },
      { id: 'cal_m5', title: 'Teacher Lab UI Review', time: '09:00', daysFromStart: 5, platform: 'zoom' },
      { id: 'cal_m6', title: 'Weekly Team Retro', time: '16:00', daysFromStart: 6, platform: 'teams' },
      { id: 'cal_m7', title: '1:1 with Marek', time: '13:30', daysFromStart: 7, platform: 'zoom' },
      { id: 'cal_m7b', title: 'Daily Stand-up', time: '09:15', daysFromStart: 7, platform: 'teams' },
      { id: 'cal_m8', title: 'Architecture Review', time: '15:00', daysFromStart: 8, platform: 'google-meets' },
      { id: 'cal_m9', title: 'Q4 Planning Prep', time: '10:00', daysFromStart: 10, platform: 'teams' },
      { id: 'cal_m10', title: 'Design Review — v3', time: '14:30', daysFromStart: 12, platform: 'google-meets' },
      { id: 'cal_m10b', title: 'Sprint Sync', time: '11:00', daysFromStart: 12, platform: 'teams' },
      { id: 'cal_m10c', title: 'Focus Session', time: '16:00', daysFromStart: 12, platform: 'zoom' }
    ];

    var firstOfMonth = new Date(year, month, 1);
    mockCalendarMeetings.forEach(function(m) {
      var mDate = new Date(firstOfMonth);
      mDate.setDate(firstOfMonth.getDate() + m.daysFromStart - 1);
      if (mDate.getMonth() !== month) return; // skip if rolled over
      var ds = mDate.getFullYear() + '-' + String(mDate.getMonth()+1).padStart(2,'0') + '-' + String(mDate.getDate()).padStart(2,'0');
      if (ds === dateStr) {
        res.push({ id: m.id, title: m.title, date: ds, time: m.time, createdDate: ds, platform: m.platform });
      }
    });

    // Also check custom meetings created via the calendar
    var custom = getCustomMeetings();
    var seenIds = {};
    for (var i = 0; i < custom.length; i++) {
      if (seenIds[custom[i].id]) continue;
      if (custom[i].date === dateStr) {
        seenIds[custom[i].id] = true;
        res.push(custom[i]);
      } else if (custom[i].repeat && custom[i].repeatInterval) {
        // Check if this date falls within the recurrence pattern
        var ri = custom[i].repeatInterval;
        if (ri && ri.indexOf('every_') === 0) {
          var parts = ri.split('_');
          if (parts.length === 3) {
            var num = parseInt(parts[1]);
            var unit = parts[2];
            if (num > 0 && isDateInRecurrence(custom[i].createdDate, dateStr, num, unit)) {
              seenIds[custom[i].id] = true;
              res.push(custom[i]);
            }
          }
        }
      }
    }
    return res;
  }

  function isDateInRecurrence(startDateStr, targetDateStr, num, unit) {
    if (!startDateStr || !targetDateStr) return false;
    var start = new Date(startDateStr);
    var target = new Date(targetDateStr);
    if (isNaN(start.getTime()) || isNaN(target.getTime())) return false;
    // Target must be on or after start
    if (target < start) return false;
    var diffMs = target.getTime() - start.getTime();
    var diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (unit === 'days') {
      return diffDays % num === 0;
    } else if (unit === 'weeks') {
      return diffDays % (num * 7) === 0;
    } else if (unit === 'months') {
      // Check month difference
      var monthDiff = (target.getFullYear() - start.getFullYear()) * 12 + (target.getMonth() - start.getMonth());
      // Also check that the day matches or is the last valid day of the month
      if (monthDiff % num !== 0) return false;
      // Allow same day-of-month, or end-of-month clamp
      return target.getDate() === start.getDate() ||
             (target.getDate() === new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate() &&
              start.getDate() > target.getDate());
    }
    return false;
  }

  function calSelectDate(dateStr) {
    calSelectedDate = dateStr;
    calRender();
  }

  function calRenderMeetings(dateStr) {
    var meetings = getMeetingsForDate(dateStr);
    if (meetings.length === 0) {
      document.getElementById('cal-meetings-list').innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:16px">No meetings on this day</div>';
      return;
    }
    var html = '';
    meetings.forEach(function(m) {
      var platformBadge = '';
      if (m.platform && PLATFORM_COLORS[m.platform]) {
        var pc = PLATFORM_COLORS[m.platform];
        platformBadge = '<span style="display:inline-flex;align-items:center;gap:3px;font-size:9px;padding:1px 5px;border-radius:4px;background:' + pc.bg + ';color:' + pc.dot + ';font-weight:600;margin-left:6px"><span style="width:6px;height:6px;border-radius:50%;background:' + pc.dot + ';display:inline-block"></span>' + pc.label + '</span>';
      }
      var isCustom = m.id && m.id.indexOf('custom_') === 0;
      var actionsHtml = isCustom
        ? '<span class="btn btn-ghost btn-sm" onclick="event.stopPropagation();calDeleteMeeting(\'' + m.id + '\')" style="font-size:9px;padding:1px 4px;color:#ef4444;flex-shrink:0" title="Delete meeting">✕</span>'
        : '';
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;border:1px solid var(--card-border);margin-bottom:6px;cursor:pointer" onclick="calSelectMeeting(\'' + m.id + '\')" onmouseover="this.style.background=\'var(--card-hover)\'" onmouseout="this.style.background=\'\'">' +
        '<span style="flex:1;font-size:12px;font-weight:500">' + m.title + platformBadge + '</span>' +
        '<span style="font-size:10px;color:var(--text-muted)">' + m.date + ' ' + m.time + '</span>' +
        actionsHtml +
        '<span class="btn btn-primary btn-sm" style="font-size:10px;padding:2px 8px">Assign ✓</span>' +
      '</div>';
    });
    document.getElementById('cal-meetings-list').innerHTML = html;
  }

  function calDeleteMeeting(meetingId) {
    var custom = getCustomMeetings();
    var before = custom.length;
    custom = custom.filter(function(m) { return m.id !== meetingId; });
    if (custom.length < before) {
      saveCustomMeetings(custom);
      if (calSelectedDate) calRender();
      calRenderGrid();
      showToast('🗑️ Meeting deleted');
    }
  }

  function calSelectMeeting(meetingId) {
    // Assign selected items to this meeting
    if (!calListId) return;
    var meetingName = '';
    // Find in calendar mock meetings
    var calMocks = [
      { id: 'cal_m1', title: 'Daily Stand-up' }, { id: 'cal_m2', title: 'Product Sprint Review' },
      { id: 'cal_m3', title: 'Design Sync' }, { id: 'cal_m4', title: 'Client Sync — e-Krew' },
      { id: 'cal_m5', title: 'Teacher Lab UI Review' }, { id: 'cal_m6', title: 'Weekly Team Retro' },
      { id: 'cal_m7', title: '1:1 with Marek' }, { id: 'cal_m8', title: 'Architecture Review' },
      { id: 'cal_m9', title: 'Q4 Planning Prep' }, { id: 'cal_m10', title: 'Design Review — v3' }
    ];
    for (var i = 0; i < calMocks.length; i++) {
      if (calMocks[i].id === meetingId) { meetingName = calMocks[i].title; break; }
    }
    if (!meetingName) {
      var custom = getCustomMeetings();
      for (var i = 0; i < custom.length; i++) {
        if (custom[i].id === meetingId) { meetingName = custom[i].title; break; }
      }
    }
    var checked = document.querySelectorAll('#todo-detail-body .todo-detail-item input[type="checkbox"]:checked');
    checked.forEach(function(c) {
      var itemEl = c.closest('.todo-detail-item');
      var itemId = itemEl ? itemEl.dataset.itemId : null;
      if (itemId) {
        saveItemAssignment(parseInt(itemId), meetingId);
      }
    });
    closeAssignCalendar();
    showToast('📌 Assigned ' + checked.length + ' item(s) to ' + (meetingName || meetingId));
  }

  function getCustomMeetings() {
    try {
      return JSON.parse(localStorage.getItem('ivi_custom_meetings') || '[]');
    } catch(e) { return []; }
  }

  function saveCustomMeetings(meetings) {
    localStorage.setItem('ivi_custom_meetings', JSON.stringify(meetings));
  }

  function calNewMeeting() {
    // Show form, hide calendar
    document.getElementById('cal-new-meeting-form').style.display = 'block';
    document.getElementById('cal-actions-bar').style.display = 'none';
    document.getElementById('cal-prev-month').parentElement.style.display = 'none';
    document.getElementById('cal-day-labels').style.display = 'none';
    document.getElementById('cal-grid').style.display = 'none';
    document.getElementById('cal-selected-day').style.display = 'none';
    document.getElementById('cal-meetings-list').style.display = 'none';
    // Pre-fill date
    var dateStr = calSelectedDate || (new Date().getFullYear() + '-' + String(new Date().getMonth()+1).padStart(2,'0') + '-' + String(new Date().getDate()).padStart(2,'0'));
    document.getElementById('cal-form-date').value = dateStr;
    // Reset form fields
    document.getElementById('cal-form-title').value = '';
    document.getElementById('cal-form-time').value = '12:00';
    document.getElementById('cal-form-platform').value = '';
    document.getElementById('cal-form-people').value = '';
    document.getElementById('cal-form-notes').value = '';
    document.getElementById('cal-form-link').value = '';
    document.getElementById('cal-form-repeat').checked = false;
    document.getElementById('cal-form-repeat-interval').value = 'weekly';
    document.getElementById('cal-form-repeat-interval').disabled = true;
    document.getElementById('cal-form-repeat-interval').style.opacity = '0.5';
    document.getElementById('cal-form-repeat-items').checked = false;
    document.getElementById('cal-form-repeat-items').disabled = true;
    document.getElementById('cal-form-repeat-items').parentElement.style.opacity = '0.5';
    document.getElementById('cal-repeat-custom').style.display = 'none';
  }

  function calCancelNewMeeting() {
    // Hide form, show calendar
    document.getElementById('cal-new-meeting-form').style.display = 'none';
    document.getElementById('cal-actions-bar').style.display = 'flex';
    document.getElementById('cal-prev-month').parentElement.style.display = 'flex';
    document.getElementById('cal-day-labels').style.display = 'grid';
    document.getElementById('cal-grid').style.display = 'grid';
    document.getElementById('cal-selected-day').style.display = 'block';
    document.getElementById('cal-meetings-list').style.display = 'block';
    // Restore header title
    var modalHeader = document.querySelector('#assign-calendar-modal .modal-title');
    if (modalHeader) modalHeader.textContent = '📅 Assign to meeting';
  }

  function calToggleRepeat() {
    var repeatCb = document.getElementById('cal-form-repeat');
    var interval = document.getElementById('cal-form-repeat-interval');
    var repeatItems = document.getElementById('cal-form-repeat-items');
    var custom = document.getElementById('cal-repeat-custom');
    var isOn = repeatCb.checked;
    interval.disabled = !isOn;
    interval.style.opacity = isOn ? '1' : '0.5';
    repeatItems.disabled = !isOn;
    repeatItems.parentElement.style.opacity = isOn ? '1' : '0.5';
    // Show/hide custom interval
    if (isOn && interval.value === 'other') {
      custom.style.display = 'flex';
    } else {
      custom.style.display = 'none';
    }
  }

  function calAddDocumentField() {
    var container = document.getElementById('cal-form-docs');
    if (!container) return;
    var count = container.querySelectorAll('.cal-doc-row').length;
    var docId = 'doc_' + Date.now() + '_' + count;
    var row = '<div class="cal-doc-row" id="' + docId + '" style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
      '<input type="checkbox" class="cal-doc-ivi" checked onchange="calUpdateIVICheckbox()" style="accent-color:var(--emerald);width:12px;height:12px;flex-shrink:0" title="Include in IVI prep">' +
      '<input type="text" class="cal-doc-name" oninput="calUpdateIVICheckbox()" placeholder="Document name (e.g. Sprint_plan.md)" style="flex:1;padding:5px 8px;border:1px solid var(--card-border);border-radius:6px;font-size:11px;font-family:inherit">' +
      '<select class="cal-doc-vis" style="padding:5px 4px;border:1px solid var(--card-border);border-radius:6px;font-size:10px;font-family:inherit;background:#fff">' +
        '<option value="me">👤 Only me</option>' +
        '<option value="all">👥 All participants</option>' +
      '</select>' +
      '<span class="btn btn-ghost btn-sm" onclick="calRemoveDocumentField(\'' + docId + '\')" style="font-size:10px;padding:2px 6px;color:#ef4444">✕</span>' +
    '</div>';
    container.insertAdjacentHTML('beforeend', row);
    calUpdateIVICheckbox();
  }

  function calRemoveDocumentField(docId) {
    var el = document.getElementById(docId);
    if (el) el.remove();
    calUpdateIVICheckbox();
  }

  function calUpdateIVICheckbox() {
    var docRows = document.querySelectorAll('.cal-doc-row');
    var docCheckboxes = document.querySelectorAll('.cal-doc-ivi');
    var docInputs = document.querySelectorAll('.cal-doc-name');
    var mainCheckbox = document.getElementById('cal-form-docs-ivi');
    var mainLabel = document.getElementById('cal-form-docs-ivi-label');
    if (!mainCheckbox || !mainLabel) return;

    // Count docs that have names and are checked
    var hasActiveDoc = false;
    for (var i = 0; i < docCheckboxes.length; i++) {
      var nameVal = docInputs[i] ? docInputs[i].value.trim() : '';
      if (nameVal && docCheckboxes[i].checked) { hasActiveDoc = true; break; }
    }

    if (hasActiveDoc) {
      mainCheckbox.disabled = false;
      mainCheckbox.checked = true;
      mainLabel.style.opacity = '1';
      mainLabel.style.cursor = 'pointer';
    } else {
      mainCheckbox.disabled = true;
      mainCheckbox.checked = false;
      mainLabel.style.opacity = '0.5';
      mainLabel.style.cursor = 'default';
    }
  }

  function calChangePlatformColor(platform) {
    var modalEl = document.getElementById('assign-calendar-modal');
    if (!modalEl) return;
    // Reset
    modalEl.style.background = '';
    // Set pastel background based on platform
    if (platform === 'teams') {
      modalEl.style.background = 'rgba(139,92,246,0.06)';
    } else if (platform === 'zoom') {
      modalEl.style.background = 'rgba(59,130,246,0.06)';
    } else if (platform === 'google-meets') {
      modalEl.style.background = 'rgba(234,179,8,0.06)';
    }
  }

  function calCheckRepeatInterval() {
    var interval = document.getElementById('cal-form-repeat-interval');
    var custom = document.getElementById('cal-repeat-custom');
    if (interval.value === 'other' && !interval.disabled) {
      custom.style.display = 'flex';
    } else {
      custom.style.display = 'none';
    }
  }

  function calCopyLink() {
    var linkEl = document.getElementById('cal-form-link');
    if (linkEl.value) {
      navigator.clipboard.writeText(linkEl.value).then(function() {
        showToast('📋 Link copied!');
      });
    }
  }

  function calSaveNewMeeting() {
    var title = document.getElementById('cal-form-title').value.trim();
    var dateVal = document.getElementById('cal-form-date').value;
    var timeVal = document.getElementById('cal-form-time').value;
    var platform = document.getElementById('cal-form-platform').value;
    var people = document.getElementById('cal-form-people').value.trim();
    var notes = document.getElementById('cal-form-notes').value.trim();
    var link = document.getElementById('cal-form-link').value.trim();
    var repeat = document.getElementById('cal-form-repeat').checked;
    var repeatInterval = repeat ? document.getElementById('cal-form-repeat-interval').value : '';
    if (repeatInterval === 'other') {
      var num = document.getElementById('cal-form-repeat-num').value || '3';
      var unit = document.getElementById('cal-form-repeat-unit').value;
      repeatInterval = 'every_' + num + '_' + unit;
    }
    var repeatItems = repeat ? document.getElementById('cal-form-repeat-items').checked : false;

    // Collect documents
    var docNames = document.querySelectorAll('.cal-doc-name');
    var docVisibilities = document.querySelectorAll('.cal-doc-vis');
    var docCheckboxes = document.querySelectorAll('.cal-doc-ivi');
    var documents = [];
    for (var di = 0; di < docNames.length; di++) {
      var dName = docNames[di].value.trim();
      if (dName) {
        documents.push({
          name: dName,
          visibility: docVisibilities[di] ? docVisibilities[di].value : 'me',
          iviLearn: docCheckboxes[di] ? docCheckboxes[di].checked : false
        });
      }
    }

    // Validation
    if (!title) { showToast('⚠️ Title is required'); return; }
    if (!dateVal) { showToast('⚠️ Date is required'); return; }
    if (!timeVal) { showToast('⚠️ Time is required'); return; }
    if (!platform) { showToast('⚠️ Platform is required'); return; }

    // Create meeting
    var custom = getCustomMeetings();
    var newId = 'custom_' + Date.now();

    var meeting = {
      id: newId,
      title: title,
      date: dateVal,
      time: timeVal,
      platform: platform,
      people: people,
      notes: notes,
      link: link,
      documents: documents,
      repeat: repeat,
      repeatInterval: repeatInterval,
      repeatItems: repeatItems,
      createdDate: dateVal
    };
    custom.push(meeting);
    saveCustomMeetings(custom);

    // Auto-assign currently selected items from the todo detail
    var checked = document.querySelectorAll('#todo-detail-body .todo-detail-item input[type="checkbox"]:checked');
    checked.forEach(function(c) {
      var itemEl = c.closest('.todo-detail-item');
      var itemId = itemEl ? itemEl.dataset.itemId : null;
      if (itemId) {
        saveItemAssignment(parseInt(itemId), newId);
      }
    });

    var itemCount = checked.length;
    calCancelNewMeeting();
    calRender();
    showToast('✅ "' + title + '" created — ' + itemCount + ' item(s) assigned');
  }

  // Map meeting title from Upcoming Meetings to a To-Do list ID
  function getTodoListIdForMeeting(meetingTitle) {
    var map = {
      'Product Sprint Review': 1,
      'Client Sync': null, // no dedicated todo list — open detail with empty
      'Teacher Lab UI Review': 2
    };
    var id = map[meetingTitle];
    if (id) return id;
    // Fallback: try fuzzy match by substring
    var q = meetingTitle.toLowerCase();
    for (var i = 0; i < MOCK_TODO_LISTS.length; i++) {
      if (MOCK_TODO_LISTS[i].meeting_title.toLowerCase().indexOf(q) !== -1 || q.indexOf(MOCK_TODO_LISTS[i].meeting_title.toLowerCase()) !== -1) {
        return MOCK_TODO_LISTS[i].id;
      }
    }
    // If nothing found, set mock item[0] as fallback so detail isn't completely empty
    return 1;
  }

  async function toggleTodoStatus(itemId, listId) {
    try {
      // Simple toggle: pending/dismissed/not_done → done, done → pending
      const data = await window.ivi.fetchAPI(`/api/todo-lists/${listId}`);
      const item = data.items ? data.items.find(i => i.id === itemId) : null;

      // If API returned no matching item, throw to trigger mock fallback
      if (!item) throw new Error('No matching item in API response');

      var newStatus = (item.status === 'done' || item.status === 'not_done') ? 'pending' : 'done';

      await window.ivi.fetchAPI(`/api/todo-lists/${listId}/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, not_done_reason: '' }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Refresh
      openTodoDetail(listId);
      loadTodoLists();
    } catch (err) {
      // Fallback for mock — update MOCK_TODO_LISTS directly
      var mockList = null;
      for (var i = 0; i < MOCK_TODO_LISTS.length; i++) {
        if (MOCK_TODO_LISTS[i].id === listId) { mockList = MOCK_TODO_LISTS[i]; break; }
      }
      if (!mockList) return;
      // itemId is 1-indexed in mock items array (0-indexed internally)
      var mockItem = mockList.items[itemId - 1];
      if (!mockItem) return;

      // Simple toggle
      if (mockItem.status === 'done' || mockItem.status === 'not_done') {
        mockItem.status = 'pending';
      } else {
        mockItem.status = 'done';
      }
      mockItem.not_done_reason = '';
      openTodoDetail(listId);
      loadTodoLists();
    }
  }

  // ---------- Edit item (text + person) in detail modal ----------
  function addTodoItem(listId) {
    var mockList = null;
    for (var i = 0; i < MOCK_TODO_LISTS.length; i++) {
      if (MOCK_TODO_LISTS[i].id === listId) { mockList = MOCK_TODO_LISTS[i]; break; }
    }
    if (!mockList) return;
    var desc = prompt('New item text:', '');
    if (!desc || desc.trim() === '') return;
    var person = prompt('Assign to person (name, optional):', '');
    mockList.items.push({
      person: person ? person.trim() : '',
      description: desc.trim(),
      status: 'pending'
    });
    openTodoDetail(listId);
    loadTodoLists();
  }

  // ---------- Edit item (text + person) in detail modal ----------
  function editTodoItem(itemId, listId) {
    var itemEl = document.querySelector('.todo-detail-item[data-item-id="' + itemId + '"]');
    if (!itemEl) return;

    // Find description span
    var descSpan = itemEl.querySelector('span[style*="font-size:13px;font-weight:500"]');
    if (!descSpan) return;

    var currentDesc = descSpan.textContent;

    // Find or create person container
    var personContainer = itemEl.querySelector('div[style*="font-size:11px;color:var(--text-muted)"]');
    if (!personContainer) {
      // Create one if it doesn't exist (person was empty)
      personContainer = document.createElement('div');
      personContainer.style.cssText = 'font-size:11px;color:var(--text-muted);margin-top:2px';
      var descDiv = itemEl.querySelector('div[style*="flex:1;min-width:0"]');
      if (descDiv) descDiv.appendChild(personContainer);
    }
    var currentPerson = personContainer.textContent.replace('👤 ', '').trim();

    // Replace description with input
    var input = document.createElement('input');
    input.type = 'text';
    input.value = currentDesc;
    input.style.cssText = 'font-size:13px;font-weight:500;padding:2px 6px;border:1px solid var(--emerald);border-radius:4px;font-family:inherit;width:100%';
    input.autofocus = true;
    descSpan.replaceWith(input);
    input.focus();
    input.select();

    // Replace person with text input
    var personInput = document.createElement('input');
    personInput.type = 'text';
    personInput.placeholder = 'Person (optional)';
    personInput.value = currentPerson;
    personInput.style.cssText = 'font-size:11px;padding:2px 6px;border:1px solid var(--card-border);border-radius:4px;font-family:inherit;width:140px;margin-top:2px';

    if (personContainer) {
      personContainer.innerHTML = '👤 ';
      personContainer.appendChild(personInput);
      personInput.focus();
    }

    // Save on Enter, cancel on Escape
    function saveEdit() {
      var newDesc = input.value.trim();
      var newPerson = personInput ? personInput.value.trim() : '';
      if (!newDesc) { input.focus(); return; }

      // Update MOCK_TODO_LISTS
      var mockList = null;
      for (var i = 0; i < MOCK_TODO_LISTS.length; i++) {
        if (MOCK_TODO_LISTS[i].id === listId) { mockList = MOCK_TODO_LISTS[i]; break; }
      }
      if (mockList) {
        var idx = itemId - 1;
        if (mockList.items[idx]) {
          mockList.items[idx].description = newDesc;
          mockList.items[idx].person = newPerson;
        }
      }
      openTodoDetail(listId);
      loadTodoLists();
    }

    function cancelEdit() {
      openTodoDetail(listId);
    }

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') saveEdit();
      if (e.key === 'Escape') cancelEdit();
    });
    personInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') saveEdit();
      if (e.key === 'Escape') cancelEdit();
    });
    // Save on blur of input (if not clicking personInput)
    input.addEventListener('blur', function(e) {
      if (e.relatedTarget && (e.relatedTarget === personInput || e.relatedTarget.tagName === 'INPUT')) return;
      setTimeout(saveEdit, 200);
    });
    personInput.addEventListener('blur', function(e) {
      if (e.relatedTarget && (e.relatedTarget === input || e.relatedTarget === input)) return;
      setTimeout(saveEdit, 200);
    });
  }

  async function assignTodoList(listId) {
    try {
      // Get meetings for assignment
      const meetingsData = await window.ivi.fetchAPI('/meetings');
      const meetings = meetingsData.meetings || [];

      const options = meetings.map(m => `<option value="${m.id}">${m.title} (${m.start_time || ''})</option>`).join('');
      const selected = prompt('Assign this list to which meeting?\n\nPaste the meeting ID or leave blank to skip:', '');
      if (!selected) return;

      await window.ivi.fetchAPI(`/api/todo-lists/${listId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ meeting_id: selected }),
        headers: { 'Content-Type': 'application/json' },
      });

      openTodoDetail(listId);
      loadTodoLists();
    } catch (err) {
      console.error('Assign error:', err);
    }
  }

  async function exportTodoList(listId) {
    try {
      const data = await window.ivi.fetchAPI(`/api/todo-lists/${listId}/export?selected_only=true`);
      const text = data.text;

      // Copy to clipboard
      await navigator.clipboard.writeText(text);
      showToast('📋 Copied to clipboard!');
    } catch (err) {
      // Fallback: show in alert
      try {
        const data = await window.ivi.fetchAPI(`/api/todo-lists/${listId}/export?selected_only=true`);
        alert(data.text);
      } catch (e2) {
        console.error('Export error:', err);
      }
    }
  }

  async function toggleExportItem(itemId, listId, selected) {
    try {
      await window.ivi.fetchAPI(`/api/todo-lists/${listId}/items/${itemId}/export`, {
        method: 'PATCH',
        body: JSON.stringify({ selected }),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('Toggle export error:', err);
    }
  }

  // Simple toast notification
  let toastTimer = null;
  function showToast(msg) {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast-notification';
      toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1f2937;color:#f9fafb;padding:10px 20px;border-radius:10px;font-size:13px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.2);transition:opacity .3s;opacity:0';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
  }

  // Auto-hide ivi-notes placeholder in sidebar
  document.querySelectorAll('.nav-item[data-page=\"notes\"]').forEach(el => {
    el.addEventListener('click', () => {
      // no-op, handled elsewhere
    });
  });

  // Also load todo lists on initial load
  setTimeout(loadTodoLists, 3000);

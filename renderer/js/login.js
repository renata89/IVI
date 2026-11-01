  // LOGIN + LANGUAGE SELECT
  const savedAuth = localStorage.getItem('ivi_authenticated');
  let loginLang = 'en';

  const LOGIN_STRINGS = {
    en: { title: 'Sign in to IVI', sub: 'Your meeting assistant', email: 'Email', password: 'Password', signin: 'Sign In', or: 'or', google: 'Sign in with Google', link: 'Create one', noAccount: "Don't have an account?", error: 'Invalid email or password. Try demo@testigo.com / demo123' }
  };

  function setLoginLang(lang) {
    // No-op: English only
  }

  function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errEl = document.getElementById('login-error');
    if (!email || !password) {
      errEl.textContent = LOGIN_STRINGS[loginLang].error;
      errEl.className = 'login-error visible';
      return;
    }
    errEl.className = 'login-error';
    localStorage.setItem('ivi_authenticated', 'true');
    localStorage.setItem('ivi_user_email', email);
    // Go to dashboard
    location.reload();
  }


  document.addEventListener('DOMContentLoaded', function() {
    if (savedAuth) {
      document.getElementById('login-overlay').classList.add('hidden');
    }
    setLoginLang('en');

    // Update user info
    const userEmail = localStorage.getItem('ivi_user_email');
    if (userEmail) {
      const nameEl = document.getElementById('topbar-username');
      const avatarEl = document.getElementById('topbar-avatar');
      const menuEmail = document.getElementById('user-menu-email');
      const userName = userEmail.split('@')[0] || 'User';
      const avatarLetter = (userEmail[0] || 'U').toUpperCase();
      if (nameEl) nameEl.textContent = userName;
      if (avatarEl) avatarEl.textContent = avatarLetter;
      if (menuEmail) menuEmail.textContent = userEmail;
      // Sync profile panel in Settings
      const profileAvatar = document.getElementById('profile-avatar');
      const profileName = document.getElementById('profile-name');
      const profileEmail = document.getElementById('profile-email');
      if (profileAvatar) profileAvatar.textContent = avatarLetter;
      if (profileName) profileName.textContent = userName;
      if (profileEmail) profileEmail.textContent = userEmail;
    }


  });

  window.iviLogout = function() {
    localStorage.removeItem('ivi_authenticated');
    localStorage.removeItem('ivi_user_email');
    location.reload();
  };

  // USER MENU
  function toggleUserMenu() {
    const menu = document.getElementById('user-menu');
    if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  }
  document.addEventListener('click', function(e) {
    const menu = document.getElementById('user-menu');
    if (menu && !e.target.closest('.topbar-right')) menu.style.display = 'none';
  });


  // i18n
  const APP_STRINGS = {
    en: {
      'sidebar-dashboard': 'Dashboard', 'sidebar-calendar': 'Calendar', 'sidebar-library': 'Library', 'sidebar-notes': 'Notes',
      'sidebar-ivi-all': 'IVI notes <strong>all</strong> my meetings', 'sidebar-active-plan': 'Active plan',
      'plan-warning': 'All meetings count toward your 30h limit',
      'page-title-dashboard': 'Dashboard', 'page-title-meetings': 'Calendar', 'page-title-library': 'Library', 'page-title-notes': 'Notes',
      'next-meeting': 'NEXT MEETING', 'participants': 'Participants', 'platform': 'Platform',
      'added-documents': 'Added documents:', 'ai-summary': 'AI summary:', 'download-pdf': 'Download full summary (PDF)',
      'ai-assistant-checkbox': 'AI assistant — get live suggestions during the meeting',
      'join': 'Join', 'add-context': 'Add context',
      'calendar-alert': 'CALENDAR ALERT', 'meetings-overlap': '{n} meetings overlap',
      'ivi-record': 'IVI Record', 'user-only': 'User Only', 'ivi-covers-both': '✓ IVI covers both',
      'reschedule': 'Reschedule', 'ignore-conflict': 'Ignore Conflict',
      'conflict-of': 'Conflict {current} of {total}', 'manage-conflicts': 'Manage conflicts',
      'your-event': 'Your event', 'ivi-will-take-notes': 'IVI will take notes & summarize',
      'teams-sync': 'TEAMS SYNC', 'connected': 'Connected',
      'recordings-to-process': '{n} recordings', 'unprocessed': '{n} unprocessed', 'last-sync': 'Last sync: {time} ago',
      'action-items': 'ACTION ITEMS', 'action-open': '{n} open', 'action-overdue-today': '{over} overdue · {today} due today',
      'upcoming-meetings': 'Upcoming Meetings', 'view-all': 'View all',
      'recent-activity': 'Recent Activity', 'clear-action': 'Clear',
      'date-col': 'Date', 'meeting-col': 'Meeting', 'context-col': 'Context', 'item-col': 'Item', 'status-col': 'Status',
      'missing-context': 'Missing', 'conflict-tag': 'Conflict', 'loaded': 'Loaded', 'processing': 'Processing',
      'no-conflicts': 'No conflicts in the calendar', 'review-decisions': 'Review decisions',
      'user-menu-settings': 'Settings', 'user-menu-lang': 'Language', 'user-menu-signout': 'Sign Out',
    },  };

  function getString(key, vars) {
    vars = vars || {};
    const strings = APP_STRINGS.en;
    if (!strings) return key;
    let val = strings[key];
    if (!val) return key;
    if (typeof val === 'object') return val;
    for (const [vk, vv] of Object.entries(vars)) {
      val = val.replace('{' + vk + '}', vv);
    }
    return val;
  }


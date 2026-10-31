/* IVI Web — API Client */
const IVI = (() => {
  let backendUrl = 'http://127.0.0.1:8765';

  function setBaseUrl(url) {
    backendUrl = url.replace(/\/+$/, '');
  }

  function getBaseUrl() {
    return backendUrl;
  }

  async function fetchAPI(path, options = {}) {
    const url = `${backendUrl}${path}`;
    try {
      const resp = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
      });
      if (!resp.ok) {
        const text = await resp.text();
        return { error: `HTTP ${resp.status}: ${text}` };
      }
      return await resp.json();
    } catch (err) {
      return { error: err.message };
    }
  }

  async function checkHealth() {
    return fetchAPI('/health');
  }

  async function getMeetings(limit = 20) {
    return fetchAPI(`/meetings?limit=${limit}`);
  }

  async function getMeeting(id) {
    return fetchAPI(`/meetings/${id}`);
  }

  async function getNotes(meetingId) {
    return fetchAPI(`/meetings/${meetingId}/notes`);
  }

  async function getSeries() {
    return fetchAPI('/series');
  }

  async function getTodoLists() {
    return fetchAPI('/api/todo-lists');
  }

  async function getCalendarStatus() {
    return fetchAPI('/api/calendar/status');
  }

  async function getConflicts() {
    return fetchAPI('/api/conflicts');
  }

  async function getDocuments() {
    return fetchAPI('/documents');
  }

  return {
    setBaseUrl,
    getBaseUrl,
    fetchAPI,
    checkHealth,
    getMeetings,
    getMeeting,
    getNotes,
    getSeries,
    getTodoLists,
    getCalendarStatus,
    getConflicts,
    getDocuments,
  };
})();

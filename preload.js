const { contextBridge, ipcRenderer, desktopCapturer } = require('electron');

contextBridge.exposeInMainWorld('ivi', {
  // Get upcoming meetings from tracker
  getUpcomingMeetings: () => ipcRenderer.invoke('get-upcoming-meetings'),

  // Get context documents
  getContextDocuments: () => ipcRenderer.invoke('get-context-documents'),

  // Get backend status
  getBackendStatus: () => ipcRenderer.invoke('get-backend-status'),

  // Desktop capturer for system audio
  desktopCapturer: desktopCapturer,

  // Minimize to tray
  minimizeToTray: () => ipcRenderer.send('minimize-to-tray'),

  // Listen for notifications from main process
  onNotification: (callback) => {
    ipcRenderer.on('notification', (_event, data) => callback(data));
  },

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Platform
  platform: process.platform
});

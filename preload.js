const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('weles', {
  // Get upcoming meetings from tracker
  getUpcomingMeetings: () => ipcRenderer.invoke('get-upcoming-meetings'),

  // Get context documents
  getContextDocuments: () => ipcRenderer.invoke('get-context-documents'),

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

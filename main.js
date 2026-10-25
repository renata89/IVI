const { app, BrowserWindow, Tray, Menu, nativeImage, Notification, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { startTracker, stopTracker, getUpcomingMeetings } = require('./tracker');

let mainWindow = null;
let tray = null;
let isQuitting = false;
let backendProcess = null;

// --------------- Tray icon ---------------
function createTrayIcon() {
  const trayPath = path.join(__dirname, 'assets', 'icon_tray.png');
  return nativeImage.createFromPath(trayPath);
}
function createAppIcon() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  return nativeImage.createFromPath(iconPath);
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('IVI');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open IVI',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Upcoming Meetings',
      enabled: false
    },
    {
      label: 'Quit IVI',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

// --------------- Main Window ---------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'IVI',
    icon: createAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false,
    vibrancy: 'sidebar',
    backgroundMaterial: 'acrylic',
    visualEffectState: 'active'
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Dev tools in dev mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// --------------- Notifications ---------------
function sendNotification(title, body) {
  if (mainWindow) {
    mainWindow.webContents.send('notification', { title, body });
  }
  // Native notification too
  const notif = new Notification({ title, body });
  notif.show();
}

// --------------- Backend ---------------
const BACKEND_PORT = 8765;

function startBackend() {
  const backendPath = path.join(__dirname, 'venv', 'bin', 'python3');
  const mainPath = path.join(__dirname, 'backend', 'main.py');

  console.log(`[IVI] Starting backend: ${backendPath} ${mainPath}`);

  backendProcess = spawn(backendPath, ['-m', 'backend.main'], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, IVI_BACKEND_PORT: String(BACKEND_PORT) }
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`[backend] ${data.toString().trim()}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.log(`[backend] ${data.toString().trim()}`);
  });

  backendProcess.on('error', (err) => {
    console.error(`[IVI] Backend error: ${err.message}`);
  });

  backendProcess.on('close', (code) => {
    console.log(`[IVI] Backend exited with code ${code}`);
    backendProcess = null;
  });
}

function stopBackend() {
  if (backendProcess) {
    console.log('[IVI] Stopping backend...');
    backendProcess.kill('SIGTERM');
    setTimeout(() => {
      if (backendProcess) {
        backendProcess.kill('SIGKILL');
      }
    }, 3000);
  }
}

// --------------- IPC Handlers ---------------
const { globalShortcut } = require('electron');

ipcMain.handle('get-upcoming-meetings', () => getUpcomingMeetings());
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-backend-status', () => ({
  running: backendProcess !== null,
  port: BACKEND_PORT
}));
ipcMain.on('minimize-to-tray', () => {
  if (mainWindow) mainWindow.hide();
});

// --------------- App Lifecycle ---------------
app.whenReady().then(() => {
  // Set app name for dock/taskbar
  app.name = 'IVI';
  app.setAppUserModelId('com.testigo.ivi');
  // Set dock icon on macOS
  if (process.platform === 'darwin') {
    const dockIcon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'));
    app.dock.setIcon(dockIcon);
  }
  createTray();
  createWindow();
  startBackend();

  // Push-to-talk hotkey
  const PTT_HOTKEY = 'CmdOrCtrl+Shift+I';
  globalShortcut.register(PTT_HOTKEY, () => {
    if (mainWindow) {
      mainWindow.webContents.send('push-to-talk', { hotkey: PTT_HOTKEY });
    }
  });

  // Start background tracker
  startTracker((event) => {
    if (event.type === 'meeting_soon') {
      sendNotification(
        '📅 Meeting in 5 min',
        `${event.title} starts soon. ${event.hasContext ? 'Context loaded ✅' : 'No context loaded ⚠️'}`
      );
    }
    if (event.type === 'meeting_started') {
      sendNotification(
        '🔴 Meeting started',
        event.title
      );
    }
    if (event.type === 'notes_ready') {
      sendNotification(
        '📝 Notes ready',
        `Notes for "${event.title}" are ready to review`
      );
    }
  });

  // Send meetings list to renderer on request
  // (renderer can call via IPC)
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // On Mac we keep running in tray
    // On others we quit
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopTracker();
  stopBackend();
});

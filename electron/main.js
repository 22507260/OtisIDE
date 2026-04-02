const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const {
  setArduinoIdeWindowGetter,
  prepareArduinoIde,
  getHardwareList,
  verifyHardwareSketch,
  uploadHardwareSketch,
  openHardwareSerialMonitor,
  closeHardwareSerialMonitor,
  disposeArduinoIde,
} = require('./arduino-ide');

let mainWindow = null;

function resolveIconPath() {
  const winIcon = path.join(__dirname, '..', 'build', 'icon.ico');
  const pngIcon = path.join(__dirname, '..', 'build', 'icon.png');

  if (process.platform === 'win32' && fs.existsSync(winIcon)) {
    return winIcon;
  }

  if (fs.existsSync(pngIcon)) {
    return pngIcon;
  }

  return undefined;
}

async function loadApplication(window, isDev) {
  if (isDev) {
    await window.loadURL('http://localhost:5173');
    window.webContents.openDevTools();
    return;
  }

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  await window.loadFile(indexPath);
}

async function createWindow() {
  const isDev = !app.isPackaged || process.argv.includes('--dev');
  const useCustomWindowChrome = process.platform !== 'darwin';

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: 'OtisIDE',
    icon: resolveIconPath(),
    frame: !useCustomWindowChrome,
    titleBarStyle: useCustomWindowChrome ? undefined : 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#1a1a2e',
  });

  if (useCustomWindowChrome) {
    Menu.setApplicationMenu(null);
    mainWindow.setMenuBarVisibility(false);
    mainWindow.setMenu(null);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (mainWindow && !mainWindow.isVisible()) {
        mainWindow.show();
      }

      if (isMainFrame) {
        dialog.showErrorBox(
          'Renderer Load Error',
          `${errorDescription} (${errorCode})\n${validatedURL || ''}`.trim()
        );
      }
    }
  );

  try {
    await loadApplication(mainWindow, isDev);
  } catch (error) {
    dialog.showErrorBox(
      'Startup Error',
      error?.stack || error?.message || String(error)
    );
    throw error;
  }
}

function readDialogOptions(options) {
  if (!options || typeof options !== 'object') {
    return {};
  }

  return {
    title: typeof options.title === 'string' ? options.title : undefined,
    defaultPath:
      typeof options.defaultPath === 'string' ? options.defaultPath : undefined,
    filterName:
      typeof options.filterName === 'string' ? options.filterName : undefined,
  };
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.otis21.otiside');
  setArduinoIdeWindowGetter(() => mainWindow);
  return createWindow();
});

app.on('window-all-closed', () => {
  void disposeArduinoIde();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  void disposeArduinoIde();
});

process.on('uncaughtException', (error) => {
  dialog.showErrorBox(
    'Unexpected Error',
    error?.stack || error?.message || String(error)
  );
});

process.on('unhandledRejection', (reason) => {
  dialog.showErrorBox(
    'Unhandled Rejection',
    reason?.stack || reason?.message || String(reason)
  );
});

ipcMain.on('set-window-title', (_event, title) => {
  if (mainWindow && typeof title === 'string') {
    mainWindow.setTitle(title);
  }
});

ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
  return true;
});

ipcMain.handle('window-toggle-maximize', () => {
  if (!mainWindow) return false;

  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  }

  mainWindow.maximize();
  return true;
});

ipcMain.handle('window-close', () => {
  mainWindow?.close();
  return true;
});

ipcMain.handle('save-project', async (_event, payload) => {
  const data = payload?.data;
  const options = readDialogOptions(payload?.options);
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: options.title || 'Save Project',
    defaultPath: options.defaultPath || 'circuit-project.json',
    filters: [
      {
        name: options.filterName || 'Circuit Project',
        extensions: ['json'],
      },
    ],
  });

  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return filePath;
});

ipcMain.handle('load-project', async (_event, optionsPayload) => {
  const options = readDialogOptions(optionsPayload);
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: options.title || 'Open Project',
    filters: [
      {
        name: options.filterName || 'Circuit Project',
        extensions: ['json'],
      },
    ],
    properties: ['openFile'],
  });

  if (canceled || filePaths.length === 0) return null;
  const content = fs.readFileSync(filePaths[0], 'utf-8');
  return JSON.parse(content);
});

ipcMain.handle('export-png', async (_event, payload) => {
  const dataUrl = payload?.dataUrl;
  const options = readDialogOptions(payload?.options);
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: options.title || 'Export as PNG',
    defaultPath: options.defaultPath || 'circuit.png',
    filters: [
      {
        name: options.filterName || 'PNG Image',
        extensions: ['png'],
      },
    ],
  });

  if (canceled || !filePath || typeof dataUrl !== 'string') return null;
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  return filePath;
});

ipcMain.handle(
  'ai-chat',
  async (_event, { baseUrl, model, messages, apiKey }) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 2000,
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { error: err.error?.message || `API error: ${res.status}` };
      }

      const data = await res.json();
      return {
        content: data.choices?.[0]?.message?.content || 'No response received.',
      };
    } catch (error) {
      return { error: error?.message || 'Connection error' };
    }
  }
);

ipcMain.handle('ide-prepare', async (_event, payload) =>
  prepareArduinoIde(payload)
);

ipcMain.handle('ide-list-devices', async () => getHardwareList());

ipcMain.handle('ide-verify-sketch', async (_event, payload) =>
  verifyHardwareSketch(payload)
);

ipcMain.handle('ide-upload-sketch', async (_event, payload) =>
  uploadHardwareSketch(payload)
);

ipcMain.handle('ide-open-serial-monitor', async (_event, payload) =>
  openHardwareSerialMonitor(payload)
);

ipcMain.handle('ide-close-serial-monitor', async () =>
  closeHardwareSerialMonitor()
);

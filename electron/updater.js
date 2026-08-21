const { app, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { toVersionInfo } = require('./updateNotes');

/**
 * GitHub Releases based auto update.
 *
 * Flow: the app checks shortly after startup and every few hours after that,
 * tells the renderer when a newer version exists, and waits for the user to
 * accept before downloading anything. Once the download finishes the user
 * decides when to restart.
 */

/** How often a session that stays open looks for a newer release. */
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let mainWindowGetter = null;
let checkStarted = false;
let periodicTimer = null;
let latestInfo = null;
let state = 'idle';

function setUpdaterWindowGetter(getter) {
  mainWindowGetter = getter;
}

function getMainWindow() {
  return typeof mainWindowGetter === 'function' ? mainWindowGetter() : null;
}

function sendToRenderer(payload) {
  const mainWindow = getMainWindow();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('updater-status', payload);
}

function formatError(error) {
  return error?.message || String(error || 'Unknown update error');
}

function publish(nextState, extra = {}) {
  state = nextState;
  sendToRenderer({
    state: nextState,
    currentVersion: app.getVersion(),
    info: latestInfo,
    ...extra,
  });
}

/**
 * Update problems are invisible by design (the user is never interrupted), so
 * the details go to userData/updater.log instead. The file is truncated when it
 * grows past 256 KB.
 */
function createUpdateLogger() {
  const write = (level, args) => {
    try {
      const logPath = path.join(app.getPath('userData'), 'updater.log');
      if (fs.existsSync(logPath) && fs.statSync(logPath).size > 256 * 1024) {
        fs.writeFileSync(logPath, '');
      }
      const line = args
        .map((item) => (typeof item === 'string' ? item : item?.stack || JSON.stringify(item)))
        .join(' ');
      fs.appendFileSync(
        logPath,
        `[${new Date().toISOString()}] ${level}: ${line}\n`
      );
    } catch {
      // Logging must never break the update flow.
    }
  };

  return {
    info: (...args) => write('info', args),
    warn: (...args) => write('warn', args),
    error: (...args) => write('error', args),
    debug: () => {},
  };
}

function configureAutoUpdater() {
  // Escape hatch for testing the flow against a local folder, and for anyone who
  // wants to serve updates from their own host instead of GitHub Releases:
  //   set OTISIDE_UPDATE_FEED_URL to a directory that holds latest.yml plus the
  //   installer it points at.
  const feedUrl = process.env.OTISIDE_UPDATE_FEED_URL;
  if (feedUrl) {
    autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl });
    autoUpdater.forceDevUpdateConfig = true;
  }

  // Default is Discord-style: ask first, download only after the user agrees.
  // Set OTISIDE_UPDATE_AUTO_DOWNLOAD=1 to download in the background instead and
  // only prompt once the update is ready to install.
  autoUpdater.autoDownload = process.env.OTISIDE_UPDATE_AUTO_DOWNLOAD === '1';
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  // Someone on 1.4.0 jumps straight to the newest release; asking for the full
  // changelog means they also see what every version in between changed.
  autoUpdater.fullChangelog = true;
  autoUpdater.logger = createUpdateLogger();

  autoUpdater.on('update-available', (info) => {
    latestInfo = toVersionInfo(info);
    publish('available');
  });

  autoUpdater.on('update-not-available', () => {
    latestInfo = null;
    publish('up-to-date');
  });

  autoUpdater.on('download-progress', (progress) => {
    publish('downloading', {
      percent: Math.max(0, Math.min(100, Math.round(progress?.percent ?? 0))),
      bytesPerSecond: Math.round(progress?.bytesPerSecond ?? 0),
      transferred: progress?.transferred ?? 0,
      total: progress?.total ?? 0,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    latestInfo = toVersionInfo(info) || latestInfo;
    publish('downloaded');
  });

  autoUpdater.on('error', (error) => {
    // A missing release, a private repository or no connection at all must not
    // interrupt the user; the renderer stays quiet unless a check was manual.
    publish('error', { error: formatError(error) });
  });
}

async function checkForUpdates({ silent = true } = {}) {
  if (!app.isPackaged) {
    // electron-updater refuses to run from an unpacked build.
    publish('unsupported');
    return { ok: false, reason: 'not-packaged' };
  }

  if (state === 'downloading') {
    return { ok: true, state };
  }

  try {
    publish('checking');
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, version: result?.updateInfo?.version || '' };
  } catch (error) {
    publish('error', { error: formatError(error), silent });
    return { ok: false, error: formatError(error) };
  }
}

async function downloadUpdate() {
  if (!app.isPackaged) return { ok: false, reason: 'not-packaged' };

  try {
    publish('downloading', { percent: 0 });
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (error) {
    publish('error', { error: formatError(error) });
    return { ok: false, error: formatError(error) };
  }
}

function installUpdate() {
  if (!app.isPackaged) return { ok: false, reason: 'not-packaged' };

  // isSilent = false so the NSIS installer shows its progress window,
  // isForceRunAfter = true so OtisIDE comes back up on the new version.
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return { ok: true };
}

function registerUpdaterIpc() {
  ipcMain.handle('updater-check', async (_event, payload) =>
    checkForUpdates({ silent: payload?.silent !== false })
  );
  ipcMain.handle('updater-download', async () => downloadUpdate());
  ipcMain.handle('updater-install', async () => installUpdate());
  ipcMain.handle('updater-state', async () => ({
    state,
    currentVersion: app.getVersion(),
    info: latestInfo,
  }));
}

function startUpdateCheck() {
  if (checkStarted) return;
  checkStarted = true;

  if (!app.isPackaged) {
    publish('unsupported');
    return;
  }

  // Give the window a moment to render before touching the network.
  setTimeout(() => {
    void checkForUpdates({ silent: true });
  }, 4000);

  // OtisIDE is often left open for days, and a check that only ran at startup
  // meant those sessions never heard about a release.
  periodicTimer = setInterval(() => {
    // Nothing to gain while an update is already waiting on the user.
    if (state === 'available' || state === 'downloading' || state === 'downloaded') return;
    void checkForUpdates({ silent: true });
  }, UPDATE_CHECK_INTERVAL_MS);
  periodicTimer.unref?.();
}

configureAutoUpdater();

module.exports = {
  setUpdaterWindowGetter,
  registerUpdaterIpc,
  startUpdateCheck,
  checkForUpdates,
};

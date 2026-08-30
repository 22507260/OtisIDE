import React from 'react';
import { useCircuitStore } from '../store/circuitStore';
import { useUpdateStore } from '../store/updateStore';
import { getControllerBoardDefinition } from '../models/arduinoUno';
import { t } from '../lib/i18n';
import { askToSaveChanges } from './SaveChangesDialog';

const DesktopTitleBar: React.FC = () => {
  const language = useCircuitStore((s) => s.language);
  const boardType = useCircuitStore((s) => s.boardType);
  const simulationRunning = useCircuitStore((s) => s.simulation.running);
  const projectFilePath = useCircuitStore((s) => s.projectFilePath);
  const projectDirty = useCircuitStore((s) => s.projectDirty);
  const updateSupported = useUpdateStore((s) => s.supported);
  const appVersion = useUpdateStore((s) => s.appVersion);
  const updateState = useUpdateStore((s) => s.status?.state);
  const checkNow = useUpdateStore((s) => s.checkNow);
  const isCustomWindowChrome = Boolean(window.electronAPI?.isCustomWindowChrome);
  const projectName = projectFilePath
    ? (projectFilePath.split(/[\\/]/).pop() ?? '').replace(/\.json$/i, '')
    : null;
  const board = getControllerBoardDefinition(boardType);
  const isChecking = updateState === 'checking';
  const hasUpdate =
    updateState === 'available' ||
    updateState === 'downloading' ||
    updateState === 'downloaded';

  if (!isCustomWindowChrome) {
    return null;
  }

  const handleToggleMaximize = () => {
    void window.electronAPI?.toggleMaximizeWindow?.();
  };

  /** Closing is the last chance to keep unsaved work, so it asks first. */
  const handleClose = async () => {
    if (projectDirty) {
      const choice = await askToSaveChanges();
      if (choice === 'cancel') return;
      if (choice === 'save') {
        window.dispatchEvent(new CustomEvent('trigger-save'));
        // The save runs through the file dialog, so the window stays open and
        // the user closes it again once the writing is done.
        return;
      }
    }

    void window.electronAPI?.closeWindow?.();
  };

  return (
    <div className="desktop-titlebar">
      <div
        className="desktop-titlebar-drag"
        onDoubleClick={handleToggleMaximize}
      >
        <div className="desktop-brand">
          <div className="desktop-brand-mark" aria-hidden="true" />
          <div className="desktop-brand-copy">
            <strong>{t(language, 'appTitle')}</strong>
            <span>
              {/* The saved file's name, so it is clear which project is open —
                  with a dot in front of it while there is unsaved work. */}
              {projectName
                ? `${projectDirty ? '● ' : ''}${projectName}`
                : language === 'tr'
                  ? 'Masaüstü çalışma alanı'
                  : 'Desktop workspace'}
            </span>
          </div>
        </div>

        <div className="desktop-titlebar-meta">
          {appVersion && (
            <>
              <span className="desktop-meta-value">v{appVersion}</span>
              {updateSupported && (
                <button
                  className={`desktop-update-btn${hasUpdate ? ' has-update' : ''}`}
                  type="button"
                  disabled={isChecking}
                  onClick={() => void checkNow()}
                  title={t(language, 'updateCheckNow')}
                >
                  {isChecking
                    ? t(language, 'updateCheckingShort')
                    : hasUpdate
                      ? t(language, 'updateAvailableShort')
                      : t(language, 'updateCheckNow')}
                </button>
              )}
              <span className="desktop-meta-divider" />
            </>
          )}
          <span className="desktop-meta-value">{board.shortName}</span>
          <span className="desktop-meta-divider" />
          <span
            className={`desktop-status-dot ${
              simulationRunning ? 'live' : 'idle'
            }`}
            aria-hidden="true"
          />
          <span className="desktop-meta-value">
            {simulationRunning ? t(language, 'running') : t(language, 'stopped')}
          </span>
        </div>
      </div>

      <div className="desktop-window-controls">
        <button
          className="desktop-window-btn minimize"
          type="button"
          onClick={() => void window.electronAPI?.minimizeWindow?.()}
          title={language === 'tr' ? 'Küçült' : 'Minimize'}
          aria-label={language === 'tr' ? 'Küçült' : 'Minimize'}
        >
          <span className="desktop-window-icon" />
        </button>
        <button
          className="desktop-window-btn maximize"
          type="button"
          onClick={handleToggleMaximize}
          title={language === 'tr' ? 'Büyüt' : 'Maximize'}
          aria-label={language === 'tr' ? 'Büyüt' : 'Maximize'}
        >
          <span className="desktop-window-icon" />
        </button>
        <button
          className="desktop-window-btn close"
          type="button"
          onClick={() => void handleClose()}
          title={language === 'tr' ? 'Kapat' : 'Close'}
          aria-label={language === 'tr' ? 'Kapat' : 'Close'}
        >
          <span className="desktop-window-icon" />
        </button>
      </div>
    </div>
  );
};

export default DesktopTitleBar;

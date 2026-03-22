import React from 'react';
import { useCircuitStore } from '../store/circuitStore';
import { getControllerBoardDefinition } from '../models/arduinoUno';
import { t } from '../lib/i18n';

const DesktopTitleBar: React.FC = () => {
  const language = useCircuitStore((s) => s.language);
  const boardType = useCircuitStore((s) => s.boardType);
  const simulationRunning = useCircuitStore((s) => s.simulation.running);
  const isCustomWindowChrome = Boolean(window.electronAPI?.isCustomWindowChrome);
  const board = getControllerBoardDefinition(boardType);

  if (!isCustomWindowChrome) {
    return null;
  }

  const handleToggleMaximize = () => {
    void window.electronAPI?.toggleMaximizeWindow?.();
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
            <span>{language === 'tr' ? 'Masaustu calisma alani' : 'Desktop workspace'}</span>
          </div>
        </div>

        <div className="desktop-titlebar-meta">
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
          title={language === 'tr' ? 'Kucult' : 'Minimize'}
          aria-label={language === 'tr' ? 'Kucult' : 'Minimize'}
        >
          <span className="desktop-window-icon" />
        </button>
        <button
          className="desktop-window-btn maximize"
          type="button"
          onClick={handleToggleMaximize}
          title={language === 'tr' ? 'Buyut' : 'Maximize'}
          aria-label={language === 'tr' ? 'Buyut' : 'Maximize'}
        >
          <span className="desktop-window-icon" />
        </button>
        <button
          className="desktop-window-btn close"
          type="button"
          onClick={() => void window.electronAPI?.closeWindow?.()}
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

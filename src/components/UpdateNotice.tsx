import React, { useCallback, useEffect, useState } from 'react';
import { useCircuitStore } from '../store/circuitStore';
import { t } from '../lib/i18n';

type UpdateStatus = UpdaterStatusPayload;

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0 MB';
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const formatSpeed = (bytesPerSecond: number) => {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '';
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
};

/**
 * Startup update prompt. The main process only reports that a newer release
 * exists; nothing is downloaded until the user says yes here.
 */
const UpdateNotice: React.FC = () => {
  const language = useCircuitStore((s) => s.language);
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onUpdateStatus) return;

    const unsubscribe = api.onUpdateStatus((payload) => setStatus(payload));
    void api.getUpdateState?.().then((payload) => {
      if (payload) setStatus(payload);
    });

    return unsubscribe;
  }, []);

  const handleDownload = useCallback(() => {
    void window.electronAPI?.downloadUpdate?.();
  }, []);

  const handleInstall = useCallback(() => {
    void window.electronAPI?.installUpdate?.();
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissedVersion(status?.info?.version ?? 'unknown');
  }, [status]);

  if (!status) return null;

  const version = status.info?.version ?? '';
  const isVisible =
    (status.state === 'available' ||
      status.state === 'downloading' ||
      status.state === 'downloaded') &&
    dismissedVersion !== (version || 'unknown');

  if (!isVisible) return null;

  const percent = Math.max(0, Math.min(100, status.percent ?? 0));
  const notes = status.info?.releaseNotes?.trim();

  return (
    <div className="update-overlay" role="dialog" aria-modal="true">
      <div className="update-card">
        <div className="update-card-head">
          <span className="update-badge">{t(language, 'updateBadge')}</span>
          <h2 className="update-title">
            {status.state === 'downloaded'
              ? t(language, 'updateReadyTitle')
              : t(language, 'updateAvailableTitle')}
          </h2>
          <p className="update-subtitle">
            {t(language, 'updateVersionLine', {
              current: status.currentVersion ?? '',
              next: version,
            })}
          </p>
        </div>

        {status.state === 'available' && notes && (
          <div className="update-notes">
            <div className="update-notes-title">{t(language, 'updateNotes')}</div>
            <pre className="update-notes-body">{notes}</pre>
          </div>
        )}

        {status.state === 'downloading' && (
          <div className="update-progress">
            <div className="update-progress-track">
              <div
                className="update-progress-bar"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="update-progress-meta">
              <span>{percent}%</span>
              <span>
                {formatBytes(status.transferred ?? 0)} / {formatBytes(status.total ?? 0)}
                {status.bytesPerSecond
                  ? ` · ${formatSpeed(status.bytesPerSecond)}`
                  : ''}
              </span>
            </div>
          </div>
        )}

        {status.state === 'downloaded' && (
          <p className="update-ready-text">{t(language, 'updateReadyText')}</p>
        )}

        <div className="update-actions">
          {status.state === 'available' && (
            <>
              <button className="toolbar-btn" type="button" onClick={handleDismiss}>
                {t(language, 'updateLater')}
              </button>
              <button
                className="toolbar-btn success"
                type="button"
                onClick={handleDownload}
              >
                {t(language, 'updateNow')}
              </button>
            </>
          )}

          {status.state === 'downloading' && (
            <button className="toolbar-btn" type="button" onClick={handleDismiss}>
              {t(language, 'updateBackground')}
            </button>
          )}

          {status.state === 'downloaded' && (
            <>
              <button className="toolbar-btn" type="button" onClick={handleDismiss}>
                {t(language, 'updateOnNextLaunch')}
              </button>
              <button
                className="toolbar-btn success"
                type="button"
                onClick={handleInstall}
              >
                {t(language, 'updateRestartNow')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateNotice;

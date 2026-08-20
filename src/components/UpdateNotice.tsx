import React from 'react';
import { useCircuitStore } from '../store/circuitStore';
import { useUpdateStore } from '../store/updateStore';
import { t } from '../lib/i18n';

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0 MB';
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const formatSpeed = (bytesPerSecond: number) => {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '';
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
};

/**
 * Update prompt. The startup check only speaks up when a newer version exists;
 * a check the user started from the title bar also reports "you are up to date"
 * and failures, so the button never looks dead.
 */
const UpdateNotice: React.FC = () => {
  const language = useCircuitStore((s) => s.language);
  const status = useUpdateStore((s) => s.status);
  const manualCheck = useUpdateStore((s) => s.manualCheck);
  const dismissedVersion = useUpdateStore((s) => s.dismissedVersion);
  const download = useUpdateStore((s) => s.download);
  const install = useUpdateStore((s) => s.install);
  const dismiss = useUpdateStore((s) => s.dismiss);

  if (!status) return null;

  const version = status.info?.version ?? '';
  const state = status.state;
  const isOfferState =
    state === 'available' || state === 'downloading' || state === 'downloaded';
  const isManualResult =
    manualCheck && (state === 'checking' || state === 'up-to-date' || state === 'error');

  if (!isOfferState && !isManualResult) return null;
  if (isOfferState && dismissedVersion === (version || 'unknown')) return null;

  const percent = Math.max(0, Math.min(100, status.percent ?? 0));
  const notes = status.info?.releaseNotes?.trim();

  const title =
    state === 'downloaded'
      ? t(language, 'updateReadyTitle')
      : state === 'up-to-date'
        ? t(language, 'updateUpToDateTitle')
        : state === 'error'
          ? t(language, 'updateFailedTitle')
          : state === 'checking'
            ? t(language, 'updateCheckingTitle')
            : t(language, 'updateAvailableTitle');

  return (
    <div className="update-overlay" role="dialog" aria-modal="true">
      <div className="update-card">
        <div className="update-card-head">
          <span className="update-badge">{t(language, 'updateBadge')}</span>
          <h2 className="update-title">{title}</h2>
          <p className="update-subtitle">
            {isOfferState
              ? t(language, 'updateVersionLine', {
                  current: status.currentVersion ?? '',
                  next: version,
                })
              : t(language, 'updateCurrentVersionLine', {
                  current: status.currentVersion ?? '',
                })}
          </p>
        </div>

        {state === 'available' && notes && (
          <div className="update-notes">
            <div className="update-notes-title">{t(language, 'updateNotes')}</div>
            <pre className="update-notes-body">{notes}</pre>
          </div>
        )}

        {state === 'downloading' && (
          <div className="update-progress">
            <div className="update-progress-track">
              <div className="update-progress-bar" style={{ width: `${percent}%` }} />
            </div>
            <div className="update-progress-meta">
              <span>{percent}%</span>
              <span>
                {formatBytes(status.transferred ?? 0)} / {formatBytes(status.total ?? 0)}
                {status.bytesPerSecond ? ` · ${formatSpeed(status.bytesPerSecond)}` : ''}
              </span>
            </div>
          </div>
        )}

        {state === 'downloaded' && (
          <p className="update-ready-text">{t(language, 'updateReadyText')}</p>
        )}

        {state === 'error' && (
          <p className="update-ready-text">
            {status.error || t(language, 'updateFailedTitle')}
          </p>
        )}

        <div className="update-actions">
          {state === 'available' && (
            <>
              <button className="toolbar-btn" type="button" onClick={dismiss}>
                {t(language, 'updateLater')}
              </button>
              <button
                className="toolbar-btn success"
                type="button"
                onClick={() => void download()}
              >
                {t(language, 'updateNow')}
              </button>
            </>
          )}

          {state === 'downloading' && (
            <button className="toolbar-btn" type="button" onClick={dismiss}>
              {t(language, 'updateBackground')}
            </button>
          )}

          {state === 'downloaded' && (
            <>
              <button className="toolbar-btn" type="button" onClick={dismiss}>
                {t(language, 'updateOnNextLaunch')}
              </button>
              <button
                className="toolbar-btn success"
                type="button"
                onClick={() => void install()}
              >
                {t(language, 'updateRestartNow')}
              </button>
            </>
          )}

          {(state === 'up-to-date' || state === 'error') && (
            <button className="toolbar-btn" type="button" onClick={dismiss}>
              {t(language, 'close')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateNotice;

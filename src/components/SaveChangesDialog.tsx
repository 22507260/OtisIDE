import { useEffect, useState } from 'react';
import { useCircuitStore } from '../store/circuitStore';
import { t } from '../lib/i18n';

export type SaveChangesAnswer = 'save' | 'discard' | 'cancel';

/**
 * Asks whether unsaved work should be written out before it is thrown away.
 *
 * The question is a promise rather than store state because every caller is in
 * the middle of doing something — starting a new project, closing the window —
 * and needs the answer before it can decide whether to carry on. The dialog
 * itself is an ordinary component that happens to resolve it.
 */
let resolvePending: ((answer: SaveChangesAnswer) => void) | null = null;
const listeners = new Set<(open: boolean) => void>();

export function askToSaveChanges(): Promise<SaveChangesAnswer> {
  // A second question while one is already up would strand the first promise.
  resolvePending?.('cancel');

  return new Promise((resolve) => {
    resolvePending = resolve;
    for (const listener of listeners) listener(true);
  });
}

function answer(choice: SaveChangesAnswer) {
  const resolve = resolvePending;
  resolvePending = null;
  for (const listener of listeners) listener(false);
  resolve?.(choice);
}

export function SaveChangesDialog() {
  const language = useCircuitStore((s) => s.language);
  const projectFilePath = useCircuitStore((s) => s.projectFilePath);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    listeners.add(setOpen);
    return () => {
      listeners.delete(setOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') answer('cancel');
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  const name = projectFilePath
    ? projectFilePath.split(/[\\/]/).pop()
    : t(language, 'unsavedProjectName');

  return (
    <div className="error-overlay" role="alertdialog" aria-modal="true">
      <div className="error-card">
        <div className="error-card-head">
          <span className="error-badge" aria-hidden="true">
            ?
          </span>
          <h2 className="error-title">{t(language, 'unsavedTitle')}</h2>
        </div>

        <p className="error-hint">{t(language, 'unsavedBody', { name: name ?? '' })}</p>

        <div className="error-actions">
          <button className="toolbar-btn" type="button" onClick={() => answer('cancel')}>
            {t(language, 'unsavedCancel')}
          </button>
          <button className="toolbar-btn" type="button" onClick={() => answer('discard')}>
            {t(language, 'unsavedDiscard')}
          </button>
          <button
            className="toolbar-btn success"
            type="button"
            onClick={() => answer('save')}
            autoFocus
          >
            {t(language, 'unsavedSave')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SaveChangesDialog;

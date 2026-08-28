import { useCircuitStore } from '../store/circuitStore';
import { t } from '../lib/i18n';

/**
 * Pops up the moment something goes wrong, so a problem cannot be missed while
 * looking at the canvas. Closing it only hides the popup — every entry stays in
 * the Errors tab at the bottom, which is where they are read back afterwards.
 */
export function ErrorDialog() {
  const entries = useCircuitStore((s) => s.errorDialog);
  const dismiss = useCircuitStore((s) => s.dismissErrorDialog);
  const setBottomTab = useCircuitStore((s) => s.setBottomTab);
  const bottomPanelCollapsed = useCircuitStore((s) => s.bottomPanelCollapsed);
  const toggleBottomPanel = useCircuitStore((s) => s.toggleBottomPanel);
  const language = useCircuitStore((s) => s.language);

  if (!entries || entries.length === 0) return null;

  const showAll = () => {
    if (bottomPanelCollapsed) toggleBottomPanel();
    setBottomTab('errors');
    dismiss();
  };

  return (
    <div className="error-overlay" role="alertdialog" aria-modal="true">
      <div className="error-card">
        <div className="error-card-head">
          <span className="error-badge" aria-hidden="true">
            !
          </span>
          <h2 className="error-title">
            {entries.length > 1
              ? t(language, 'errorDialogTitlePlural', { count: entries.length })
              : t(language, 'errorDialogTitle')}
          </h2>
        </div>

        <ul className="error-list">
          {entries.map((entry) => (
            <li key={entry.id}>{entry.text}</li>
          ))}
        </ul>

        <p className="error-hint">{t(language, 'errorDialogHint')}</p>

        <div className="error-actions">
          <button className="toolbar-btn" type="button" onClick={showAll}>
            {t(language, 'errorDialogShowAll')}
          </button>
          <button className="toolbar-btn success" type="button" onClick={dismiss} autoFocus>
            {t(language, 'errorDialogClose')}
          </button>
        </div>
      </div>
    </div>
  );
}

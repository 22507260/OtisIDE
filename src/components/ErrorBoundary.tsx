import React from 'react';
import { t, type AppLanguage } from '../lib/i18n';
import { readStorage } from '../lib/storage';

interface ErrorBoundaryState {
  error: Error | null;
  showDetails: boolean;
}

/**
 * Last line of defence for the renderer. Without it a single render error leaves
 * the packaged app as a blank window, and users have no devtools to find out why.
 *
 * The language is read straight from storage rather than the circuit store: the
 * store may well be what failed.
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null, showDetails: false };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('OtisIDE render error', error, info.componentStack);
  }

  private get language(): AppLanguage {
    return readStorage('app_language') === 'tr' ? 'tr' : 'en';
  }

  private handleRetry = () => {
    this.setState({ error: null, showDetails: false });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error, showDetails } = this.state;
    if (!error) return this.props.children;

    const language = this.language;

    return (
      <div className="crash-screen">
        <div className="crash-card">
          <div className="crash-title">{t(language, 'crashTitle')}</div>
          <p className="crash-text">{t(language, 'crashText')}</p>

          <div className="crash-actions">
            <button className="toolbar-btn" type="button" onClick={this.handleReload}>
              {t(language, 'crashReload')}
            </button>
            <button
              className="toolbar-btn success"
              type="button"
              onClick={this.handleRetry}
            >
              {t(language, 'crashRetry')}
            </button>
          </div>

          <button
            className="crash-details-toggle"
            type="button"
            onClick={() => this.setState({ showDetails: !showDetails })}
          >
            {t(language, 'crashDetails')}
          </button>

          {showDetails && (
            <pre className="crash-details">{error.stack || error.message}</pre>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;

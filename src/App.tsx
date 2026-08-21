import React, { useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import { useCircuitStore } from './store/circuitStore';
import { useHardwareStore } from './store/hardwareStore';
import { useUpdateStore } from './store/updateStore';
import { t } from './lib/i18n';

const App: React.FC = () => {
  const language = useCircuitStore((s) => s.language);
  const initHardwareIde = useHardwareStore((s) => s.init);
  const disposeHardwareIde = useHardwareStore((s) => s.dispose);
  const initUpdates = useUpdateStore((s) => s.init);
  const disposeUpdates = useUpdateStore((s) => s.dispose);

  useEffect(() => {
    const title = t(language, 'appTitle');
    document.title = title;
    document.documentElement.lang = language;
    window.electronAPI?.setWindowTitle?.(title);
  }, [language]);

  useEffect(() => {
    void initHardwareIde();
    return () => {
      disposeHardwareIde();
    };
  }, [disposeHardwareIde, initHardwareIde]);

  useEffect(() => {
    initUpdates();
    return () => {
      disposeUpdates();
    };
  }, [disposeUpdates, initUpdates]);

  return (
    <ErrorBoundary>
      <Layout />
    </ErrorBoundary>
  );
};

export default App;

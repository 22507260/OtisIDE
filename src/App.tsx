import React, { useEffect } from 'react';
import Layout from './components/Layout';
import { useCircuitStore } from './store/circuitStore';
import { useHardwareStore } from './store/hardwareStore';
import { t } from './lib/i18n';

const App: React.FC = () => {
  const language = useCircuitStore((s) => s.language);
  const initHardwareIde = useHardwareStore((s) => s.init);
  const disposeHardwareIde = useHardwareStore((s) => s.dispose);

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

  return <Layout />;
};

export default App;

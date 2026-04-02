import React, { useEffect } from 'react';
import Layout from './components/Layout';
import { getAppDisplayName } from './config/appVariant';
import { useCircuitStore } from './store/circuitStore';
import { useHardwareStore } from './store/hardwareStore';

const App: React.FC = () => {
  const language = useCircuitStore((s) => s.language);
  const initHardwareIde = useHardwareStore((s) => s.init);
  const disposeHardwareIde = useHardwareStore((s) => s.dispose);

  useEffect(() => {
    const title = getAppDisplayName(language);
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

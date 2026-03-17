import React, { useEffect } from 'react';
import Layout from './components/Layout';
import { useCircuitStore } from './store/circuitStore';
import { t } from './lib/i18n';

const App: React.FC = () => {
  const language = useCircuitStore((s) => s.language);

  useEffect(() => {
    const title = t(language, 'appTitle');
    document.title = title;
    document.documentElement.lang = language;
    window.electronAPI?.setWindowTitle?.(title);
  }, [language]);

  return <Layout />;
};

export default App;

import React from 'react';
import DesktopTitleBar from './DesktopTitleBar';
import Toolbar from './Toolbar';
import Palette from './Palette';
import CircuitCanvas from './CircuitCanvas';
import PropertiesPanel from './PropertiesPanel';
import AIPanel from './AIPanel';
import BottomPanel from './BottomPanel';
import { useCircuitStore } from '../store/circuitStore';
import { t } from '../lib/i18n';

const Layout: React.FC = () => {
  const rightTab = useCircuitStore((s) => s.rightTab);
  const language = useCircuitStore((s) => s.language);

  return (
    <div className="app-shell">
      <DesktopTitleBar />
      <div className="app-container">
        <Toolbar />
        <div className="main-content">
          <div className="left-panel">
            <div className="panel-header">{t(language, 'componentsPanel')}</div>
            <Palette />
          </div>
          <div className="center-panel">
            <CircuitCanvas />
            <BottomPanel />
          </div>
          <div className="right-panel">
            <div className="tab-bar">
              <TabButton
                tab="properties"
                label={t(language, 'propertiesTab')}
              />
              <TabButton tab="ai" label={t(language, 'aiAssistantTab')} />
            </div>
            {rightTab === 'properties' ? <PropertiesPanel /> : <AIPanel />}
          </div>
        </div>
      </div>
    </div>
  );
};

const TabButton: React.FC<{ tab: 'properties' | 'ai'; label: string }> = ({
  tab,
  label,
}) => {
  const rightTab = useCircuitStore((s) => s.rightTab);
  const setRightTab = useCircuitStore((s) => s.setRightTab);

  return (
    <button
      className={`tab-btn ${rightTab === tab ? 'active' : ''}`}
      onClick={() => setRightTab(tab)}
    >
      {label}
    </button>
  );
};

export default Layout;

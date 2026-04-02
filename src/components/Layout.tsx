import React from 'react';
import DesktopTitleBar from './DesktopTitleBar';
import Toolbar from './Toolbar';
import Palette from './Palette';
import CircuitCanvas from './CircuitCanvas';
import PropertiesPanel from './PropertiesPanel';
import AIPanel from './AIPanel';
import BottomPanel from './BottomPanel';
import LearnPanel from './LearnPanel';
import LearningOnboarding from './LearningOnboarding';
import { SHOW_LEARN_TAB } from '../config/appVariant';
import { useCircuitStore } from '../store/circuitStore';
import { t } from '../lib/i18n';

const Layout: React.FC = () => {
  const rightTab = useCircuitStore((s) => s.rightTab);
  const language = useCircuitStore((s) => s.language);
  const activeRightTab =
    !SHOW_LEARN_TAB && rightTab === 'learn' ? 'properties' : rightTab;

  return (
    <div className="app-shell">
      <DesktopTitleBar />
      <div className="app-container">
        <Toolbar />
        {SHOW_LEARN_TAB && <LearningOnboarding />}
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
              {SHOW_LEARN_TAB && (
                <TabButton tab="learn" label={t(language, 'learnTab')} />
              )}
            </div>
            {activeRightTab === 'properties' ? (
              <PropertiesPanel />
            ) : activeRightTab === 'ai' ? (
              <AIPanel />
            ) : (
              <LearnPanel />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const TabButton: React.FC<{ tab: 'properties' | 'ai' | 'learn'; label: string }> = ({
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

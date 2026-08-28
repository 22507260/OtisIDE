import React from 'react';
import DesktopTitleBar from './DesktopTitleBar';
import Toolbar from './Toolbar';
import Palette from './Palette';
import CircuitCanvas from './CircuitCanvas';
import PropertiesPanel from './PropertiesPanel';
import BottomPanel from './BottomPanel';
import UpdateNotice from './UpdateNotice';
import { ErrorDialog } from './ErrorDialog';
import { useCircuitStore } from '../store/circuitStore';
import { t } from '../lib/i18n';

const Layout: React.FC = () => {
  const language = useCircuitStore((s) => s.language);

  return (
    <div className="app-shell">
      <UpdateNotice />
      <ErrorDialog />
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
          {/* The assistant now lives beside the device console at the bottom,
              leaving this panel to the selected part's properties alone. */}
          <div className="right-panel">
            <div className="tab-bar">
              <button className="tab-btn active">{t(language, 'propertiesTab')}</button>
            </div>
            <PropertiesPanel />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;

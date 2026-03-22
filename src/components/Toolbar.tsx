import React from 'react';
import { useCircuitStore } from '../store/circuitStore';
import { useHardwareStore } from '../store/hardwareStore';
import { WIRE_COLORS } from '../models/types';
import { CONTROLLER_BOARD_OPTIONS } from '../models/arduinoUno';
import { getWireColorDisplayName, t } from '../lib/i18n';

const Toolbar: React.FC = () => {
  const toolMode = useCircuitStore((s) => s.toolMode);
  const setToolMode = useCircuitStore((s) => s.setToolMode);
  const wireColor = useCircuitStore((s) => s.wireColor);
  const setWireColor = useCircuitStore((s) => s.setWireColor);
  const simulation = useCircuitStore((s) => s.simulation);
  const startSimulation = useCircuitStore((s) => s.startSimulation);
  const stopSimulation = useCircuitStore((s) => s.stopSimulation);
  const clearProject = useCircuitStore((s) => s.clearProject);
  const getProjectData = useCircuitStore((s) => s.getProjectData);
  const loadProject = useCircuitStore((s) => s.loadProject);
  const zoom = useCircuitStore((s) => s.zoom);
  const setZoom = useCircuitStore((s) => s.setZoom);
  const boardType = useCircuitStore((s) => s.boardType);
  const setBoardType = useCircuitStore((s) => s.setBoardType);
  const code = useCircuitStore((s) => s.code);
  const language = useCircuitStore((s) => s.language);
  const setLanguage = useCircuitStore((s) => s.setLanguage);
  const preparingHardwareIde = useHardwareStore((s) => s.preparing);
  const hardwareCliAvailable = useHardwareStore((s) => s.cliAvailable);
  const hardwareCliVersion = useHardwareStore((s) => s.cliVersion);
  const hardwarePorts = useHardwareStore((s) => s.ports);
  const selectedHardwarePortPath = useHardwareStore((s) => s.selectedPortPath);
  const detectedBoardName = useHardwareStore((s) => s.detectedBoardName);
  const uploadInProgress = useHardwareStore((s) => s.uploadInProgress);
  const prepareHardwareIde = useHardwareStore((s) => s.prepareHardwareIde);
  const refreshDevices = useHardwareStore((s) => s.refreshDevices);
  const setSelectedPortPath = useHardwareStore((s) => s.setSelectedPortPath);
  const verifySketch = useHardwareStore((s) => s.verifySketch);
  const uploadSketch = useHardwareStore((s) => s.uploadSketch);
  const isDesktop = Boolean(window.electronAPI);
  const selectedHardwarePort =
    hardwarePorts.find((port) => port.path === selectedHardwarePortPath) ?? null;
  const effectiveBoardType = selectedHardwarePort?.boardType ?? boardType;

  const handleSave = async () => {
    const data = getProjectData();
    if (window.electronAPI) {
      await window.electronAPI.saveProject(data, {
        title: t(language, 'saveProjectDialogTitle'),
        defaultPath: t(language, 'projectFileName'),
        filterName: t(language, 'projectFilterName'),
      });
      return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = t(language, 'projectFileName');
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = async () => {
    if (window.electronAPI) {
      const data = await window.electronAPI.loadProject({
        title: t(language, 'openProjectDialogTitle'),
        filterName: t(language, 'projectFilterName'),
      });
      if (data) loadProject(data as any);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          loadProject(data);
        } catch {
          // Ignore invalid files.
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleExportPng = () => {
    window.dispatchEvent(new CustomEvent('export-canvas-png'));
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleSave}>
          {t(language, 'save')}
        </button>
        <button className="toolbar-btn" onClick={handleLoad}>
          {t(language, 'open')}
        </button>
        <button className="toolbar-btn" onClick={clearProject}>
          {t(language, 'newProject')}
        </button>
        <button className="toolbar-btn" onClick={handleExportPng}>
          {t(language, 'exportPng')}
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${toolMode === 'select' ? 'active' : ''}`}
          onClick={() => setToolMode('select')}
          title={t(language, 'selectToolTitle')}
        >
          {t(language, 'selectTool')}
        </button>
        <button
          className={`toolbar-btn ${toolMode === 'wire' ? 'active' : ''}`}
          onClick={() => setToolMode('wire')}
          title={t(language, 'wireToolTitle')}
        >
          {t(language, 'wireTool')}
        </button>
        <button
          className={`toolbar-btn ${toolMode === 'pan' ? 'active' : ''}`}
          onClick={() => setToolMode('pan')}
          title={t(language, 'panToolTitle')}
        >
          {t(language, 'panTool')}
        </button>
        <button
          className={`toolbar-btn ${toolMode === 'delete' ? 'active' : ''}`}
          onClick={() => setToolMode('delete')}
          title={t(language, 'deleteToolTitle')}
        >
          {t(language, 'deleteTool')}
        </button>
      </div>

      <div className="toolbar-separator" />

      {toolMode === 'wire' && (
        <>
          <div className="wire-colors">
            {WIRE_COLORS.map((color) => (
              <button
                key={color.value}
                className={`wire-color-btn ${wireColor === color.value ? 'active' : ''}`}
                style={{ background: color.value }}
                onClick={() => setWireColor(color.value)}
                title={getWireColorDisplayName(language, color.name)}
              />
            ))}
          </div>
          <div className="toolbar-separator" />
        </>
      )}

      <div className="toolbar-group">
        <span className="toolbar-label">{t(language, 'board')}</span>
        <select
          className="toolbar-select"
          value={boardType}
          onChange={(event) => setBoardType(event.target.value as typeof boardType)}
          title={t(language, 'selectBoard')}
        >
          {CONTROLLER_BOARD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {isDesktop && (
        <>
          <div className="toolbar-separator" />

          <div className="toolbar-group toolbar-group-wrap">
            <span className="toolbar-label">{t(language, 'usbIde')}</span>
            <select
              className="toolbar-select hardware-port-select"
              value={selectedHardwarePortPath ?? ''}
              onChange={(event) =>
                setSelectedPortPath(event.target.value || null)
              }
              title={t(language, 'usbDevice')}
            >
              <option value="">
                {hardwarePorts.length > 0
                  ? t(language, 'selectUsbDevice')
                  : t(language, 'noUsbDevice')}
              </option>
              {hardwarePorts.map((port) => (
                <option key={port.path} value={port.path}>
                  {port.boardName || port.label || port.path}
                </option>
              ))}
            </select>

            <button
              className="toolbar-btn"
              onClick={() => void refreshDevices()}
              title={t(language, 'refreshPorts')}
            >
              {t(language, 'refreshPortsShort')}
            </button>

            <button
              className="toolbar-btn"
              onClick={() => void prepareHardwareIde(true)}
              disabled={preparingHardwareIde}
              title={t(language, 'prepareIde')}
            >
              {preparingHardwareIde
                ? t(language, 'preparing')
                : t(language, 'prepareIde')}
            </button>

            <button
              className="toolbar-btn"
              onClick={() => void verifySketch(code, effectiveBoardType)}
              disabled={!hardwareCliAvailable || uploadInProgress}
              title={t(language, 'verifySketch')}
            >
              {t(language, 'verifySketch')}
            </button>

            <button
              className="toolbar-btn success"
              onClick={() => void uploadSketch(code, effectiveBoardType)}
              disabled={
                !hardwareCliAvailable ||
                !selectedHardwarePortPath ||
                uploadInProgress
              }
              title={t(language, 'uploadSketch')}
            >
              {uploadInProgress
                ? t(language, 'uploadingSketch')
                : t(language, 'uploadSketch')}
            </button>

            <span
              className={`sim-status ${
                hardwareCliAvailable ? 'running' : 'stopped'
              }`}
              title={hardwareCliVersion || t(language, 'usbIde')}
            >
              {preparingHardwareIde
                ? t(language, 'preparing')
                : hardwareCliAvailable
                  ? t(language, 'ideReady')
                  : t(language, 'ideOffline')}
            </span>

            {selectedHardwarePort && (
              <span className="panel-pill">
                {selectedHardwarePort.path}
              </span>
            )}

            {detectedBoardName && (
              <span className="panel-pill">
                {t(language, 'detectedBoard')}: {detectedBoardName}
              </span>
            )}
          </div>
        </>
      )}

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={() => setZoom(zoom - 0.1)}>
          -
        </button>
        <span style={{ fontSize: 12, minWidth: 40, textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button className="toolbar-btn" onClick={() => setZoom(zoom + 0.1)}>
          +
        </button>
        <button
          className="toolbar-btn"
          onClick={() => setZoom(1)}
          title={t(language, 'zoomReset')}
        >
          100%
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="sim-controls">
        {!simulation.running ? (
          <button className="toolbar-btn success" onClick={startSimulation}>
            {t(language, 'startSimulation')}
          </button>
        ) : (
          <button className="toolbar-btn danger" onClick={stopSimulation}>
            {t(language, 'stopSimulation')}
          </button>
        )}
        <span className={`sim-status ${simulation.running ? 'running' : 'stopped'}`}>
          {simulation.running
            ? t(language, 'running')
            : t(language, 'stopped')}
        </span>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group toolbar-group-right">
        {isDesktop && <span className="toolbar-label">Desktop</span>}
        <span className="toolbar-label">{t(language, 'language')}</span>
        <select
          className="toolbar-select toolbar-select-compact"
          value={language}
          onChange={(event) => setLanguage(event.target.value as 'en' | 'tr')}
        >
          <option value="en">{language === 'tr' ? 'Ingilizce' : 'English'}</option>
          <option value="tr">{language === 'tr' ? 'Turkce' : 'Turkish'}</option>
        </select>
      </div>
    </div>
  );
};

export default Toolbar;

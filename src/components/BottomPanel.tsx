import Editor, { type Monaco } from '@monaco-editor/react';
import React, { useEffect, useRef, useState } from 'react';
import { useCircuitStore } from '../store/circuitStore';
import {
  HARDWARE_BAUD_RATE_OPTIONS,
  useHardwareStore,
} from '../store/hardwareStore';
import { t } from '../lib/i18n';

const configureEditorTheme = (monaco: Monaco) => {
  monaco.editor.defineTheme('ai-circuit-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6d8596', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff9d5c' },
      { token: 'number', foreground: 'f7c948' },
      { token: 'string', foreground: '5eead4' },
      { token: 'type.identifier', foreground: '63b3ff' },
    ],
    colors: {
      'editor.background': '#07111a',
      'editor.foreground': '#eaf6ff',
      'editor.lineHighlightBackground': '#0d1f2d',
      'editorLineNumber.foreground': '#5f7383',
      'editorLineNumber.activeForeground': '#ffb77c',
      'editorCursor.foreground': '#5eead4',
      'editor.selectionBackground': '#15324a',
      'editor.inactiveSelectionBackground': '#112637',
      'editorIndentGuide.background1': '#143146',
      'editorIndentGuide.activeBackground1': '#295172',
      'editorWhitespace.foreground': '#19354b',
      'editorGutter.background': '#07111a',
    },
  });
};

const DEFAULT_PANEL_HEIGHT = 360;
const MIN_PANEL_HEIGHT = 220;
const MAX_PANEL_HEIGHT_RATIO = 0.72;

const clampPanelHeight = (height: number) => {
  const maxHeight = Math.max(
    MIN_PANEL_HEIGHT,
    Math.floor(window.innerHeight * MAX_PANEL_HEIGHT_RATIO)
  );

  return Math.min(Math.max(height, MIN_PANEL_HEIGHT), maxHeight);
};

const BottomPanel: React.FC = () => {
  const bottomPanelCollapsed = useCircuitStore((s) => s.bottomPanelCollapsed);
  const toggleBottomPanel = useCircuitStore((s) => s.toggleBottomPanel);
  const bottomTab = useCircuitStore((s) => s.bottomTab);
  const setBottomTab = useCircuitStore((s) => s.setBottomTab);
  const code = useCircuitStore((s) => s.code);
  const setCode = useCircuitStore((s) => s.setCode);
  const serialOutput = useCircuitStore((s) => s.simulation.serialOutput);
  const clearSerialOutput = useCircuitStore((s) => s.clearSerialOutput);
  const simulation = useCircuitStore((s) => s.simulation);
  const language = useCircuitStore((s) => s.language);

  const hardwareCliAvailable = useHardwareStore((s) => s.cliAvailable);
  const hardwarePorts = useHardwareStore((s) => s.ports);
  const selectedHardwarePortPath = useHardwareStore((s) => s.selectedPortPath);
  const serialMonitorOpen = useHardwareStore((s) => s.serialMonitorOpen);
  const serialBaudRate = useHardwareStore((s) => s.serialBaudRate);
  const hardwareConsoleEntries = useHardwareStore((s) => s.consoleEntries);
  const uploadInProgress = useHardwareStore((s) => s.uploadInProgress);
  const setSerialBaudRate = useHardwareStore((s) => s.setSerialBaudRate);
  const toggleSerialMonitor = useHardwareStore((s) => s.toggleSerialMonitor);
  const clearHardwareConsole = useHardwareStore((s) => s.clearConsole);

  const serialEndRef = useRef<HTMLDivElement>(null);
  const hardwareEndRef = useRef<HTMLDivElement>(null);
  const resizeStateRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [panelHeight, setPanelHeight] = useState(() =>
    clampPanelHeight(DEFAULT_PANEL_HEIGHT)
  );
  const codeLineCount = Math.max(1, code.split(/\r?\n/).length);
  const codeCharCount = code.length;
  const selectedHardwarePort =
    hardwarePorts.find((port) => port.path === selectedHardwarePortPath) ?? null;

  useEffect(() => {
    serialEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [serialOutput]);

  useEffect(() => {
    hardwareEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [hardwareConsoleEntries]);

  useEffect(() => {
    const handleResize = () => {
      setPanelHeight((currentHeight) => clampPanelHeight(currentHeight));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;

      const nextHeight = resizeState.startHeight + (resizeState.startY - event.clientY);
      setPanelHeight(clampPanelHeight(nextHeight));
    };

    const handlePointerUp = () => {
      if (!resizeStateRef.current) return;

      resizeStateRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    resizeStateRef.current = {
      startY: event.clientY,
      startHeight: panelHeight,
    };

    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div
      className={`bottom-panel ${bottomPanelCollapsed ? 'collapsed' : ''}`}
      style={bottomPanelCollapsed ? undefined : { height: panelHeight }}
    >
      {!bottomPanelCollapsed && (
        <div
          className="bottom-panel-resizer"
          onPointerDown={handleResizeStart}
          role="separator"
          aria-label={t(language, 'codeWorkspace')}
          aria-orientation="horizontal"
        />
      )}
      <div className="bottom-panel-header" onClick={toggleBottomPanel}>
        <div className="bottom-panel-header-left">
          <button className="bottom-panel-collapse" type="button">
            {bottomPanelCollapsed ? '^' : 'v'}
          </button>
          <button
            className={`tab-btn ${bottomTab === 'code' ? 'active' : ''}`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setBottomTab('code');
              if (bottomPanelCollapsed) toggleBottomPanel();
            }}
            style={{ padding: '4px 10px', fontSize: 11 }}
          >
            {t(language, 'arduinoCode')}
          </button>
          <button
            className={`tab-btn ${bottomTab === 'serial' ? 'active' : ''}`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setBottomTab('serial');
              if (bottomPanelCollapsed) toggleBottomPanel();
            }}
            style={{ padding: '4px 10px', fontSize: 11 }}
          >
            {t(language, 'serialMonitor')}
            {serialOutput.length > 0 ? ` (${serialOutput.length})` : ''}
          </button>
          <button
            className={`tab-btn ${bottomTab === 'device' ? 'active' : ''}`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setBottomTab('device');
              if (bottomPanelCollapsed) toggleBottomPanel();
            }}
            style={{ padding: '4px 10px', fontSize: 11 }}
          >
            {t(language, 'deviceConsole')}
            {hardwareConsoleEntries.length > 0
              ? ` (${hardwareConsoleEntries.length})`
              : ''}
          </button>
        </div>

        <div className="bottom-panel-meta">
          {bottomTab === 'code' ? (
            <>
              <span className="panel-pill">
                {t(language, 'lineCount', { count: codeLineCount })}
              </span>
              <span className="panel-pill">
                {t(language, 'charCount', { count: codeCharCount })}
              </span>
            </>
          ) : bottomTab === 'serial' ? (
            <>
              <span className={`panel-pill ${simulation.running ? 'live' : ''}`}>
                {simulation.running
                  ? t(language, 'serialLive')
                  : t(language, 'serialIdle')}
              </span>
              <span className="panel-pill">
                {t(language, 'logCount', { count: serialOutput.length })}
              </span>
            </>
          ) : (
            <>
              <span className={`panel-pill ${hardwareCliAvailable ? 'live' : ''}`}>
                {hardwareCliAvailable
                  ? t(language, 'ideReady')
                  : t(language, 'ideOffline')}
              </span>
              <span className="panel-pill">
                {selectedHardwarePort?.path || t(language, 'noUsbDevice')}
              </span>
              <span className={`panel-pill ${serialMonitorOpen ? 'live' : ''}`}>
                {serialMonitorOpen
                  ? t(language, 'monitorOpen')
                  : t(language, 'monitorClosed')}
              </span>
              <span className="panel-pill">
                {t(language, 'logCount', {
                  count: hardwareConsoleEntries.length,
                })}
              </span>
            </>
          )}

          {(bottomTab === 'serial' || bottomTab === 'device') &&
            !bottomPanelCollapsed && (
              <button
                className="toolbar-btn"
                style={{ fontSize: 11, padding: '6px 10px' }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (bottomTab === 'serial') {
                    clearSerialOutput();
                  } else {
                    clearHardwareConsole();
                  }
                }}
                type="button"
              >
                {t(language, 'clear')}
              </button>
            )}
        </div>
      </div>

      {!bottomPanelCollapsed && (
        <div className="bottom-panel-content">
          {bottomTab === 'code' ? (
            <div className="code-workspace">
              <div className="code-toolbar">
                <div>
                  <div className="code-toolbar-title">
                    {t(language, 'codeWorkspace')}
                  </div>
                  <div className="code-toolbar-text">
                    {t(language, 'codeWorkspaceHint')}
                  </div>
                </div>
                <div className="code-toolbar-meta">
                  <span className="panel-pill">
                    <span className="code-toolbar-dot orange" />
                    sketch.ino
                  </span>
                  <span className="panel-pill">
                    <span className="code-toolbar-dot cyan" />
                    Arduino C++
                  </span>
                </div>
              </div>
              <div className="code-editor-body">
                <Editor
                  beforeMount={configureEditorTheme}
                  defaultLanguage="cpp"
                  loading={
                    <div className="code-editor-loading">Loading editor...</div>
                  }
                  onChange={(value) => setCode(value ?? '')}
                  options={{
                    automaticLayout: true,
                    bracketPairColorization: { enabled: true },
                    cursorBlinking: 'phase',
                    fontFamily: "'Cascadia Code', 'Consolas', monospace",
                    fontLigatures: false,
                    fontSize: 13,
                    folding: false,
                    glyphMargin: false,
                    lineHeight: 21,
                    lineNumbersMinChars: 3,
                    minimap: { enabled: false },
                    overviewRulerBorder: false,
                    padding: { top: 14, bottom: 14 },
                    renderLineHighlight: 'gutter',
                    roundedSelection: true,
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    tabSize: 2,
                    wordWrap: 'on',
                  }}
                  path="sketch.ino"
                  theme="ai-circuit-dark"
                  value={code}
                />
              </div>
            </div>
          ) : bottomTab === 'serial' ? (
            <div className="serial-shell">
              <div className="serial-shell-head">
                <div>
                  <div className="serial-shell-title">{t(language, 'serialFeed')}</div>
                  <div className="serial-shell-text">
                    {t(language, 'serialFeedHint')}
                  </div>
                </div>
                <span className={`panel-pill ${simulation.running ? 'live' : ''}`}>
                  {simulation.running
                    ? t(language, 'serialLive')
                    : t(language, 'serialIdle')}
                </span>
              </div>
              <div className="serial-output">
                {serialOutput.length === 0 ? (
                  <span className="serial-output-empty">
                    {simulation.running
                      ? t(language, 'serialWaiting')
                      : t(language, 'serialStartPrompt')}
                  </span>
                ) : (
                  serialOutput.map((line, index) => (
                    <div key={index} className="serial-line">
                      {line}
                    </div>
                  ))
                )}
                <div ref={serialEndRef} />
              </div>
            </div>
          ) : (
            <div className="serial-shell">
              <div className="serial-shell-head">
                <div>
                  <div className="serial-shell-title">
                    {t(language, 'deviceConsole')}
                  </div>
                  <div className="serial-shell-text">
                    {t(language, 'deviceConsoleHint')}
                  </div>
                </div>

                <div className="code-toolbar-meta">
                  <select
                    className="property-select hardware-baud-select"
                    value={serialBaudRate}
                    onChange={(event) =>
                      setSerialBaudRate(Number(event.target.value))
                    }
                    disabled={uploadInProgress}
                  >
                    {HARDWARE_BAUD_RATE_OPTIONS.map((baudRate) => (
                      <option key={baudRate} value={baudRate}>
                        {baudRate} baud
                      </option>
                    ))}
                  </select>
                  <button
                    className="toolbar-btn"
                    onClick={() => void toggleSerialMonitor()}
                    disabled={
                      !selectedHardwarePort?.serialCapable || uploadInProgress
                    }
                    type="button"
                  >
                    {serialMonitorOpen
                      ? t(language, 'closeMonitor')
                      : t(language, 'openMonitor')}
                  </button>
                </div>
              </div>

              <div className="serial-output hardware-console-output">
                {hardwareConsoleEntries.length === 0 ? (
                  <span className="serial-output-empty">
                    {t(language, 'deviceConsoleEmpty')}
                  </span>
                ) : (
                  hardwareConsoleEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`serial-line hardware-console-line ${entry.kind}`}
                    >
                      <span className="hardware-console-prefix">
                        {entry.kind.toUpperCase()}
                      </span>
                      <span>{entry.text}</span>
                    </div>
                  ))
                )}
                <div ref={hardwareEndRef} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BottomPanel;

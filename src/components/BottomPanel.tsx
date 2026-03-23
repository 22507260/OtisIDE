import Editor, { type Monaco } from '@monaco-editor/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCircuitStore } from '../store/circuitStore';
import type { CircuitComponent, OscilloscopeSample } from '../models/types';
import {
  HARDWARE_BAUD_RATE_OPTIONS,
  useHardwareStore,
} from '../store/hardwareStore';
import {
  getLocalizedOscilloscopeDisplayText,
  getOscilloscopeStatusLabel,
  getPropertyDisplayName,
  t,
} from '../lib/i18n';

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

const SCOPE_CHART_WIDTH = 760;
const SCOPE_CHART_HEIGHT = 236;
const SCOPE_CHART_PADDING = {
  top: 16,
  right: 18,
  bottom: 24,
  left: 42,
};
const MIN_SCOPE_TIME_WINDOW_MS = 250;

type ScopeChartData = {
  latestVoltage: number;
  latestTimeMs: number;
  minVoltage: number;
  maxVoltage: number;
  rms: number;
  visibleSamples: OscilloscopeSample[];
  polylinePoints: string;
  yMin: number;
  yMax: number;
  zeroLineY: number;
};

function getScopeNumericProperty(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getScopeDisplayName(scope: CircuitComponent): string {
  return `Scope ${scope.id.slice(0, 4).toUpperCase()}`;
}

function buildScopeChartData(
  trace: OscilloscopeSample[],
  rawWindowMs: number
): ScopeChartData {
  const timeWindowMs = Math.max(MIN_SCOPE_TIME_WINDOW_MS, rawWindowMs);
  const innerWidth =
    SCOPE_CHART_WIDTH - SCOPE_CHART_PADDING.left - SCOPE_CHART_PADDING.right;
  const innerHeight =
    SCOPE_CHART_HEIGHT - SCOPE_CHART_PADDING.top - SCOPE_CHART_PADDING.bottom;

  if (trace.length === 0) {
    const defaultMin = -1;
    const defaultMax = 1;
    return {
      latestVoltage: 0,
      latestTimeMs: 0,
      minVoltage: 0,
      maxVoltage: 0,
      rms: 0,
      visibleSamples: [],
      polylinePoints: '',
      yMin: defaultMin,
      yMax: defaultMax,
      zeroLineY:
        SCOPE_CHART_PADDING.top +
        ((defaultMax - 0) / (defaultMax - defaultMin)) * innerHeight,
    };
  }

  const latestTimeMs = trace[trace.length - 1]?.timeMs ?? 0;
  const windowStartMs = Math.max(0, latestTimeMs - timeWindowMs);
  let firstVisibleIndex = trace.findIndex((sample) => sample.timeMs >= windowStartMs);

  if (firstVisibleIndex === -1) {
    firstVisibleIndex = Math.max(0, trace.length - 1);
  } else if (firstVisibleIndex > 0) {
    firstVisibleIndex -= 1;
  }

  const visibleSamples = trace.slice(firstVisibleIndex);
  const voltages = visibleSamples.map((sample) => sample.voltage);
  const minVoltage = Math.min(0, ...voltages);
  const maxVoltage = Math.max(0, ...voltages);
  const spread = Math.max(0.4, maxVoltage - minVoltage);
  const padding = Math.max(0.2, spread * 0.16);
  const yMin = minVoltage - padding;
  const yMax = maxVoltage + padding;
  const voltageSpan = Math.max(0.001, yMax - yMin);
  const polylinePoints = visibleSamples
    .map((sample) => {
      const x =
        SCOPE_CHART_PADDING.left +
        ((sample.timeMs - windowStartMs) / timeWindowMs) * innerWidth;
      const y =
        SCOPE_CHART_PADDING.top +
        ((yMax - sample.voltage) / voltageSpan) * innerHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return {
    latestVoltage: visibleSamples[visibleSamples.length - 1]?.voltage ?? 0,
    latestTimeMs,
    minVoltage,
    maxVoltage,
    rms: Math.sqrt(
      voltages.reduce((sum, voltage) => sum + voltage * voltage, 0) /
        Math.max(1, voltages.length)
    ),
    visibleSamples,
    polylinePoints,
    yMin,
    yMax,
    zeroLineY:
      SCOPE_CHART_PADDING.top + ((yMax - 0) / voltageSpan) * innerHeight,
  };
}

const BottomPanel: React.FC = () => {
  const bottomPanelCollapsed = useCircuitStore((s) => s.bottomPanelCollapsed);
  const toggleBottomPanel = useCircuitStore((s) => s.toggleBottomPanel);
  const bottomTab = useCircuitStore((s) => s.bottomTab);
  const setBottomTab = useCircuitStore((s) => s.setBottomTab);
  const components = useCircuitStore((s) => s.components);
  const selectedComponentId = useCircuitStore((s) => s.selectedComponentId);
  const code = useCircuitStore((s) => s.code);
  const setCode = useCircuitStore((s) => s.setCode);
  const serialOutput = useCircuitStore((s) => s.simulation.serialOutput);
  const oscilloscopeTraces = useCircuitStore((s) => s.simulation.oscilloscopeTraces);
  const clearSerialOutput = useCircuitStore((s) => s.clearSerialOutput);
  const clearOscilloscopeTraces = useCircuitStore((s) => s.clearOscilloscopeTraces);
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
  const [preferredScopeId, setPreferredScopeId] = useState<string | null>(null);
  const codeLineCount = Math.max(1, code.split(/\r?\n/).length);
  const codeCharCount = code.length;
  const selectedHardwarePort =
    hardwarePorts.find((port) => port.path === selectedHardwarePortPath) ?? null;
  const oscilloscopeComponents = useMemo(
    () => components.filter((component) => component.type === 'oscilloscope'),
    [components]
  );
  const selectedOscilloscope =
    components.find(
      (component) =>
        component.id === selectedComponentId && component.type === 'oscilloscope'
    ) ?? null;

  useEffect(() => {
    if (selectedOscilloscope) {
      setPreferredScopeId(selectedOscilloscope.id);
    }
  }, [selectedOscilloscope]);

  useEffect(() => {
    if (
      preferredScopeId &&
      oscilloscopeComponents.some((component) => component.id === preferredScopeId)
    ) {
      return;
    }

    setPreferredScopeId(oscilloscopeComponents[0]?.id ?? null);
  }, [oscilloscopeComponents, preferredScopeId]);

  const activeOscilloscope =
    oscilloscopeComponents.find((component) => component.id === preferredScopeId) ??
    oscilloscopeComponents[0] ??
    null;
  const activeOscilloscopeLiveProperties = activeOscilloscope
    ? simulation.componentStates[activeOscilloscope.id] ?? null
    : null;
  const activeOscilloscopeDisplay = activeOscilloscope
    ? simulation.running && activeOscilloscopeLiveProperties
      ? {
          ...activeOscilloscope,
          properties: {
            ...activeOscilloscope.properties,
            ...activeOscilloscopeLiveProperties,
          },
        }
      : activeOscilloscope
    : null;
  const activeOscilloscopeTrace = activeOscilloscope
    ? oscilloscopeTraces[activeOscilloscope.id] ?? []
    : [];
  const activeOscilloscopeWindowMs = activeOscilloscopeDisplay
    ? Math.max(
        MIN_SCOPE_TIME_WINDOW_MS,
        getScopeNumericProperty(activeOscilloscopeDisplay.properties.timeWindowMs, 4000)
      )
    : 4000;
  const scopeChart = useMemo(
    () => buildScopeChartData(activeOscilloscopeTrace, activeOscilloscopeWindowMs),
    [activeOscilloscopeTrace, activeOscilloscopeWindowMs]
  );
  const activeOscilloscopeStatus = String(
    activeOscilloscopeDisplay?.properties.status ?? 'idle'
  );
  const oscilloscopeEmptyMessage = !activeOscilloscope
    ? t(language, 'oscilloscopeAddPrompt')
    : activeOscilloscopeStatus === 'open'
      ? t(language, 'oscilloscopeConnectPrompt')
      : simulation.running
        ? t(language, 'oscilloscopeWaiting')
        : t(language, 'oscilloscopeConnectPrompt');

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
            className={`tab-btn ${bottomTab === 'oscilloscope' ? 'active' : ''}`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setBottomTab('oscilloscope');
              if (bottomPanelCollapsed) toggleBottomPanel();
            }}
            style={{ padding: '4px 10px', fontSize: 11 }}
          >
            {t(language, 'oscilloscope')}
            {activeOscilloscopeTrace.length > 0
              ? ` (${activeOscilloscopeTrace.length})`
              : oscilloscopeComponents.length > 0
                ? ` (${oscilloscopeComponents.length})`
                : ''}
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
          ) : bottomTab === 'oscilloscope' ? (
            <>
              <span
                className={`panel-pill ${
                  simulation.running && activeOscilloscopeStatus === 'live' ? 'live' : ''
                }`}
              >
                {getOscilloscopeStatusLabel(language, activeOscilloscopeStatus)}
              </span>
              <span className="panel-pill">
                {activeOscilloscope
                  ? getScopeDisplayName(activeOscilloscope)
                  : t(language, 'oscilloscope')}
              </span>
              <span className="panel-pill">
                {t(language, 'sampleCount', {
                  count: activeOscilloscopeTrace.length,
                })}
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

          {(bottomTab === 'serial' ||
            bottomTab === 'device' ||
            bottomTab === 'oscilloscope') &&
            !bottomPanelCollapsed && (
              <button
                className="toolbar-btn"
                style={{ fontSize: 11, padding: '6px 10px' }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (bottomTab === 'serial') {
                    clearSerialOutput();
                  } else if (bottomTab === 'oscilloscope') {
                    clearOscilloscopeTraces();
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
          ) : bottomTab === 'oscilloscope' ? (
            <div className="serial-shell oscilloscope-shell">
              <div className="serial-shell-head">
                <div>
                  <div className="serial-shell-title">
                    {t(language, 'oscilloscope')}
                  </div>
                  <div className="serial-shell-text">
                    {t(language, 'oscilloscopeHint')}
                  </div>
                </div>

                {oscilloscopeComponents.length > 1 && (
                  <select
                    className="property-select oscilloscope-select"
                    value={activeOscilloscope?.id ?? ''}
                    onChange={(event) => setPreferredScopeId(event.target.value)}
                  >
                    {oscilloscopeComponents.map((component) => (
                      <option key={component.id} value={component.id}>
                        {getScopeDisplayName(component)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {activeOscilloscopeDisplay ? (
                <div className="oscilloscope-workspace">
                  <div className="oscilloscope-chart-card">
                    <svg
                      className="oscilloscope-chart"
                      viewBox={`0 0 ${SCOPE_CHART_WIDTH} ${SCOPE_CHART_HEIGHT}`}
                      aria-label={t(language, 'oscilloscope')}
                      role="img"
                    >
                      {Array.from({ length: 9 }, (_, index) => {
                        const usableWidth =
                          SCOPE_CHART_WIDTH -
                          SCOPE_CHART_PADDING.left -
                          SCOPE_CHART_PADDING.right;
                        const x =
                          SCOPE_CHART_PADDING.left + (usableWidth / 8) * index;
                        return (
                          <line
                            key={`scope-grid-v-${index}`}
                            x1={x}
                            y1={SCOPE_CHART_PADDING.top}
                            x2={x}
                            y2={SCOPE_CHART_HEIGHT - SCOPE_CHART_PADDING.bottom}
                            className="oscilloscope-grid-line"
                          />
                        );
                      })}
                      {Array.from({ length: 7 }, (_, index) => {
                        const usableHeight =
                          SCOPE_CHART_HEIGHT -
                          SCOPE_CHART_PADDING.top -
                          SCOPE_CHART_PADDING.bottom;
                        const y =
                          SCOPE_CHART_PADDING.top + (usableHeight / 6) * index;
                        return (
                          <line
                            key={`scope-grid-h-${index}`}
                            x1={SCOPE_CHART_PADDING.left}
                            y1={y}
                            x2={SCOPE_CHART_WIDTH - SCOPE_CHART_PADDING.right}
                            y2={y}
                            className="oscilloscope-grid-line"
                          />
                        );
                      })}
                      <line
                        x1={SCOPE_CHART_PADDING.left}
                        y1={scopeChart.zeroLineY}
                        x2={SCOPE_CHART_WIDTH - SCOPE_CHART_PADDING.right}
                        y2={scopeChart.zeroLineY}
                        className="oscilloscope-zero-line"
                      />
                      {scopeChart.polylinePoints && (
                        <polyline
                          points={scopeChart.polylinePoints}
                          className="oscilloscope-trace-line"
                        />
                      )}
                    </svg>

                    {activeOscilloscopeTrace.length === 0 ? (
                      <div className="oscilloscope-empty-state">
                        {oscilloscopeEmptyMessage}
                      </div>
                    ) : null}
                  </div>

                  <div className="oscilloscope-stats">
                    <div className="oscilloscope-stat">
                      <span className="oscilloscope-stat-label">
                        {getPropertyDisplayName(language, 'reading')}
                      </span>
                      <strong>
                        {getLocalizedOscilloscopeDisplayText(
                          language,
                          String(activeOscilloscopeDisplay.properties.displayText ?? '0.00 V')
                        )}
                      </strong>
                    </div>
                    <div className="oscilloscope-stat">
                      <span className="oscilloscope-stat-label">Vpp</span>
                      <strong>
                        {(scopeChart.maxVoltage - scopeChart.minVoltage).toFixed(2)} V
                      </strong>
                    </div>
                    <div className="oscilloscope-stat">
                      <span className="oscilloscope-stat-label">RMS</span>
                      <strong>{scopeChart.rms.toFixed(2)} V</strong>
                    </div>
                    <div className="oscilloscope-stat">
                      <span className="oscilloscope-stat-label">
                        {t(language, 'timeWindow')}
                      </span>
                      <strong>{activeOscilloscopeWindowMs} ms</strong>
                    </div>
                    <div className="oscilloscope-stat">
                      <span className="oscilloscope-stat-label">Min / Max</span>
                      <strong>
                        {scopeChart.minVoltage.toFixed(2)} V / {scopeChart.maxVoltage.toFixed(2)} V
                      </strong>
                    </div>
                    <div className="oscilloscope-stat">
                      <span className="oscilloscope-stat-label">
                        {t(language, 'sampleCount', {
                          count: scopeChart.visibleSamples.length,
                        })}
                      </span>
                      <strong>{scopeChart.latestTimeMs} ms</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="oscilloscope-empty-state">
                  {oscilloscopeEmptyMessage}
                </div>
              )}
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

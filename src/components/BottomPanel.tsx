import Editor, { type Monaco } from '@monaco-editor/react';
import React, { useEffect, useRef } from 'react';
import { useCircuitStore } from '../store/circuitStore';
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

  const serialEndRef = useRef<HTMLDivElement>(null);
  const codeLineCount = Math.max(1, code.split(/\r?\n/).length);
  const codeCharCount = code.length;

  useEffect(() => {
    serialEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [serialOutput]);

  return (
    <div className={`bottom-panel ${bottomPanelCollapsed ? 'collapsed' : ''}`}>
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
        </div>
        <div className="bottom-panel-meta">
          {bottomTab === 'code' ? (
            <>
              <span className="panel-pill">{t(language, 'lineCount', { count: codeLineCount })}</span>
              <span className="panel-pill">{t(language, 'charCount', { count: codeCharCount })}</span>
            </>
          ) : (
            <>
              <span
                className={`panel-pill ${simulation.running ? 'live' : ''}`}
              >
                {simulation.running
                  ? t(language, 'serialLive')
                  : t(language, 'serialIdle')}
              </span>
              <span className="panel-pill">{t(language, 'logCount', { count: serialOutput.length })}</span>
            </>
          )}
          {bottomTab === 'serial' && !bottomPanelCollapsed && (
            <button
              className="toolbar-btn"
              style={{ fontSize: 11, padding: '6px 10px' }}
              onClick={(event) => {
                event.stopPropagation();
                clearSerialOutput();
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
                  <div className="code-toolbar-title">{t(language, 'codeWorkspace')}</div>
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
                  loading={<div className="code-editor-loading">Loading editor...</div>}
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
          ) : (
            <div className="serial-shell">
              <div className="serial-shell-head">
                <div>
                  <div className="serial-shell-title">{t(language, 'serialFeed')}</div>
                  <div className="serial-shell-text">
                    {t(language, 'serialFeedHint')}
                  </div>
                </div>
                <span
                  className={`panel-pill ${simulation.running ? 'live' : ''}`}
                >
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
          )}
        </div>
      )}
    </div>
  );
};

export default BottomPanel;

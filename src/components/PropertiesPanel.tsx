import React from 'react';
import { useCircuitStore } from '../store/circuitStore';
import { COMPONENT_CATALOG } from '../models/types';
import {
  getComponentDisplayName,
  getMultimeterModeLabel,
  getMultimeterStatusLabel,
  getPropertyDisplayName,
  t,
} from '../lib/i18n';

const PropertiesPanel: React.FC = () => {
  const selectedComponentId = useCircuitStore((s) => s.selectedComponentId);
  const components = useCircuitStore((s) => s.components);
  const updateComponentProperty = useCircuitStore((s) => s.updateComponentProperty);
  const updateComponent = useCircuitStore((s) => s.updateComponent);
  const removeComponent = useCircuitStore((s) => s.removeComponent);
  const language = useCircuitStore((s) => s.language);

  const selectedComp = components.find((component) => component.id === selectedComponentId);

  if (!selectedComp) {
    return (
      <div className="properties-content">
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: 13,
            textAlign: 'center',
            marginTop: 40,
            whiteSpace: 'pre-line',
          }}
        >
          {t(language, 'selectComponentPrompt')}
        </p>
      </div>
    );
  }

  const info = COMPONENT_CATALOG.find((component) => component.type === selectedComp.type);
  const displayName = info
    ? getComponentDisplayName(language, info.type, info.name)
    : selectedComp.type;
  const multimeterReadOnlyKeys = new Set([
    'reading',
    'unit',
    'displayText',
    'continuity',
    'status',
  ]);
  const multimeterHiddenKeys = new Set([
    'blackProbeX',
    'blackProbeY',
    'redProbeX',
    'redProbeY',
    'blackProbeDocked',
    'redProbeDocked',
    'blackProbeTargetComponentId',
    'blackProbeTargetPinId',
    'redProbeTargetComponentId',
    'redProbeTargetPinId',
  ]);

  return (
    <div className="properties-content">
      <div className="property-group">
        <div className="property-group-title">
          {info?.icon} {displayName}
        </div>
        <div className="property-row">
          <span className="property-label">{t(language, 'id')}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {selectedComp.id.slice(0, 8)}
          </span>
        </div>
      </div>

      <div className="property-group">
        <div className="property-group-title">{t(language, 'position')}</div>
        <div className="property-row">
          <span className="property-label">X</span>
          <input
            className="property-input"
            type="number"
            value={selectedComp.x}
            onChange={(event) =>
              updateComponent(selectedComp.id, { x: Number(event.target.value) })
            }
          />
        </div>
        <div className="property-row">
          <span className="property-label">Y</span>
          <input
            className="property-input"
            type="number"
            value={selectedComp.y}
            onChange={(event) =>
              updateComponent(selectedComp.id, { y: Number(event.target.value) })
            }
          />
        </div>
        <div className="property-row">
          <span className="property-label">{t(language, 'angle')}</span>
          <input
            className="property-input"
            type="number"
            value={selectedComp.rotation}
            step={90}
            onChange={(event) =>
              updateComponent(selectedComp.id, {
                rotation: Number(event.target.value),
              })
            }
          />
        </div>
      </div>

      <div className="property-group">
        <div className="property-group-title">{t(language, 'values')}</div>
        {Object.entries(selectedComp.properties)
          .filter(([key]) => !multimeterHiddenKeys.has(key))
          .map(([key, value]) => (
          <div className="property-row" key={key}>
            <span className="property-label">
              {getPropertyDisplayName(language, key)}
            </span>
            {selectedComp.type === 'multimeter' && key === 'mode' ? (
              <select
                className="property-select"
                value={String(value)}
                onChange={(event) =>
                  updateComponentProperty(selectedComp.id, key, event.target.value)
                }
              >
                <option value="voltage">{getMultimeterModeLabel(language, 'voltage')}</option>
                <option value="current">{getMultimeterModeLabel(language, 'current')}</option>
                <option value="resistance">{getMultimeterModeLabel(language, 'resistance')}</option>
                <option value="continuity">{getMultimeterModeLabel(language, 'continuity')}</option>
              </select>
            ) : selectedComp.type === 'multimeter' && multimeterReadOnlyKeys.has(key) ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {key === 'status'
                  ? getMultimeterStatusLabel(language, String(value))
                  : typeof value === 'boolean'
                    ? (value ? 'ON' : 'OFF')
                    : String(value)}
              </span>
            ) : typeof value === 'boolean' ? (
              <input
                type="checkbox"
                checked={value}
                onChange={(event) =>
                  updateComponentProperty(selectedComp.id, key, event.target.checked)
                }
              />
            ) : key === 'color' ? (
              <select
                className="property-select"
                value={value as string}
                onChange={(event) =>
                  updateComponentProperty(selectedComp.id, key, event.target.value)
                }
              >
                <option value="red">{t(language, 'red')}</option>
                <option value="green">{t(language, 'green')}</option>
                <option value="blue">{t(language, 'blue')}</option>
                <option value="yellow">{t(language, 'yellow')}</option>
                <option value="white">{t(language, 'white')}</option>
                <option value="orange">{t(language, 'orange')}</option>
              </select>
            ) : key === 'commonType' ? (
              <select
                className="property-select"
                value={value as string}
                onChange={(event) =>
                  updateComponentProperty(selectedComp.id, key, event.target.value)
                }
              >
                <option value="cathode">{t(language, 'commonCathode')}</option>
                <option value="anode">{t(language, 'commonAnode')}</option>
              </select>
            ) : key === 'unit' ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {value as string}
              </span>
            ) : (
              <input
                className="property-input"
                type={typeof value === 'number' ? 'number' : 'text'}
                value={value as string | number}
                onChange={(event) => {
                  const newValue =
                    typeof value === 'number'
                      ? Number(event.target.value)
                      : event.target.value;
                  updateComponentProperty(selectedComp.id, key, newValue);
                }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="property-group">
        <div className="property-group-title">{t(language, 'pins')}</div>
        {selectedComp.pins.map((pin) => (
          <div className="property-row" key={pin.id}>
            <span className="property-label" style={{ fontSize: 11 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background:
                    pin.type === 'power'
                      ? '#f39c12'
                      : pin.type === 'ground'
                        ? '#e74c3c'
                        : '#4ecca3',
                  marginRight: 4,
                }}
              />
              {pin.name}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {pin.type}
            </span>
          </div>
        ))}
      </div>

      <button
        className="toolbar-btn danger"
        style={{ width: '100%', marginTop: 12 }}
        onClick={() => removeComponent(selectedComp.id)}
      >
        {t(language, 'deleteComponent')}
      </button>
    </div>
  );
};

export default PropertiesPanel;

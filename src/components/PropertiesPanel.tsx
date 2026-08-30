import React from 'react';
import { useCircuitStore } from '../store/circuitStore';
import {
  COMPONENT_CATALOG,
  WIRE_COLORS,
  WIRE_DEFAULT_WIDTH,
  WIRE_MIN_WIDTH,
  WIRE_MAX_WIDTH,
} from '../models/types';
import { ARDUINO_COMPONENT_ID, getControllerBoardDefinition } from '../models/arduinoUno';
import { BREADBOARD_COMPONENT_ID, getBreadboardHoleGlobal } from '../models/breadboard';
import {
  getWireColorDisplayName,
  getComponentDisplayName,
  getMultimeterModeLabel,
  getMultimeterStatusLabel,
  getOscilloscopeStatusLabel,
  getDamageLabel,
  getPinTypeLabel,
  getPropertyDisplayName,
  t,
} from '../lib/i18n';
import {
  clampComponentScale,
  MAX_COMPONENT_SCALE,
  MIN_COMPONENT_SCALE,
} from '../lib/componentTransform';
import {
  RESISTANCE_UNITS,
  fromOhms,
  getResistanceUnitSymbol,
  normalizeResistanceUnit,
  pickResistanceUnit,
  toOhms,
  type ResistanceUnit,
} from '../lib/resistanceUnits';

/** The parts whose resistance is a value the user picks rather than one the
 *  simulation reports back, so it is worth a unit to type it in. */
const UNIT_AWARE_RESISTANCE_TYPES = new Set(['resistor', 'potentiometer']);

/**
 * Resistance with the unit it is entered in.
 *
 * The stored value stays in ohms, so switching kΩ to Ω only changes how the
 * same resistor is written — 4700 becomes 4.7 and the circuit does not move.
 *
 * The number is held as text while it is being typed. A number input reports an
 * empty value for a half-written decimal like "4.", which would collapse the
 * resistance to zero mid-keystroke — unavoidable once the natural way to write
 * a resistor is 4.7k rather than 4700.
 */
const ResistanceRow: React.FC<{
  label: string;
  ohms: number;
  unit: ResistanceUnit;
  onCommit: (ohms: number) => void;
  onUnitChange: (unit: ResistanceUnit) => void;
  onFocus: () => void;
}> = ({ label, ohms, unit, onCommit, onUnitChange, onFocus }) => {
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? String(fromOhms(ohms, unit));

  return (
    <div className="property-row">
      <span className="property-label">{label}</span>
      <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          className="property-input"
          type="text"
          inputMode="decimal"
          value={shown}
          style={{ minWidth: 0 }}
          onFocus={() => {
            onFocus();
            setDraft(String(fromOhms(ohms, unit)));
          }}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);

            const parsed = Number(next);
            if (next.trim() !== '' && Number.isFinite(parsed)) {
              onCommit(toOhms(parsed, unit));
            }
          }}
          onBlur={() => setDraft(null)}
        />
        <select
          className="property-select"
          value={unit}
          style={{ width: 'auto', flex: '0 0 auto' }}
          onChange={(event) => {
            // The resistance itself is untouched: only the way it is written
            // changes, so the draft has to be dropped or it would keep showing
            // the number in the unit that is no longer selected.
            setDraft(null);
            onUnitChange(normalizeResistanceUnit(event.target.value));
          }}
        >
          {RESISTANCE_UNITS.map((option) => (
            <option key={option} value={option}>
              {getResistanceUnitSymbol(option)}
            </option>
          ))}
        </select>
      </span>
    </div>
  );
};

const PropertiesPanel: React.FC = () => {
  const selectedComponentId = useCircuitStore((s) => s.selectedComponentId);
  const selectedWireId = useCircuitStore((s) => s.selectedWireId);
  const wires = useCircuitStore((s) => s.wires);
  const boardType = useCircuitStore((s) => s.boardType);
  const breadboardPosition = useCircuitStore((s) => s.breadboardPosition);
  const setWireColorById = useCircuitStore((s) => s.setWireColorById);
  const thickenWire = useCircuitStore((s) => s.thickenWire);
  const thinWire = useCircuitStore((s) => s.thinWire);
  const removeWire = useCircuitStore((s) => s.removeWire);
  const components = useCircuitStore((s) => s.components);
  const simulation = useCircuitStore((s) => s.simulation);
  const updateComponentProperty = useCircuitStore((s) => s.updateComponentProperty);
  const updateComponent = useCircuitStore((s) => s.updateComponent);
  const removeComponent = useCircuitStore((s) => s.removeComponent);
  const captureUndoSnapshot = useCircuitStore((s) => s.captureUndoSnapshot);
  const language = useCircuitStore((s) => s.language);
  const selectedComponentIds = useCircuitStore((s) => s.selectedComponentIds);

  const selectedComp = components.find((component) => component.id === selectedComponentId);
  const selectedWire = wires.find((wire) => wire.id === selectedWireId);

  if (!selectedComp && selectedWire) {
    const board = getControllerBoardDefinition(boardType);

    const endpointLabel = (componentId: string, pinId: string) => {
      if (componentId === ARDUINO_COMPONENT_ID) return `${board.shortName} · ${pinId}`;
      if (componentId === BREADBOARD_COMPONENT_ID) {
        const hole = getBreadboardHoleGlobal(pinId, breadboardPosition);
        return `Breadboard · ${hole?.label ?? pinId}`;
      }

      const component = components.find((item) => item.id === componentId);
      if (!component) return pinId;

      const info = COMPONENT_CATALOG.find((item) => item.type === component.type);
      const name = info
        ? getComponentDisplayName(language, info.type, info.name)
        : component.type;
      const pin = component.pins.find((item) => item.id === pinId);
      return `${name} · ${pin?.name ?? pinId}`;
    };

    return (
      <div className="properties-content">
        <div className="property-group">
          <div className="property-group-title">{t(language, 'wireProperties')}</div>
          <div className="property-row">
            <span className="property-label">{t(language, 'wireFrom')}</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>
              {endpointLabel(selectedWire.startComponentId, selectedWire.startPinId)}
            </span>
          </div>
          <div className="property-row">
            <span className="property-label">{t(language, 'wireTo')}</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>
              {endpointLabel(selectedWire.endComponentId, selectedWire.endPinId)}
            </span>
          </div>
        </div>

        <div className="property-group">
          <div className="property-group-title">{t(language, 'wireColorTitle')}</div>
          <div className="wire-colors wire-colors-panel">
            {WIRE_COLORS.map((color) => (
              <button
                key={color.value}
                className={`wire-color-btn ${selectedWire.color === color.value ? 'active' : ''}`}
                style={{ background: color.value }}
                onClick={() => setWireColorById(selectedWire.id, color.value)}
                title={getWireColorDisplayName(language, color.name)}
                type="button"
              />
            ))}
          </div>
        </div>

        <div className="property-group">
          <div className="property-group-title">{t(language, 'wireWidthTitle')}</div>
          <div className="property-row">
            <button
              className="toolbar-btn"
              type="button"
              title={t(language, 'thinWire')}
              disabled={(selectedWire.width ?? WIRE_DEFAULT_WIDTH) <= WIRE_MIN_WIDTH}
              onClick={() => thinWire(selectedWire.id)}
            >
              −
            </button>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 32, textAlign: 'center' }}>
              {(selectedWire.width ?? WIRE_DEFAULT_WIDTH).toFixed(1)}
            </span>
            <button
              className="toolbar-btn"
              type="button"
              title={t(language, 'thickenWire')}
              disabled={(selectedWire.width ?? WIRE_DEFAULT_WIDTH) >= WIRE_MAX_WIDTH}
              onClick={() => thickenWire(selectedWire.id)}
            >
              +
            </button>
          </div>
        </div>

        <div className="property-group">
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {t(language, 'wireReplugHint')}
          </p>
        </div>

        <button
          className="toolbar-btn danger"
          style={{ width: '100%', marginTop: 12 }}
          onClick={() => removeWire(selectedWire.id)}
          type="button"
        >
          {t(language, 'deleteWire')}
        </button>
      </div>
    );
  }

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
  const oscilloscopeReadOnlyKeys = new Set(['reading', 'displayText', 'status']);
  // Shown as one red line of its own rather than three raw rows.
  const damageKeys = new Set(['damaged', 'damageReason', 'damageDetail']);
  const liveProperties = simulation.componentStates[selectedComp.id] ?? null;
  const displayComp =
    simulation.running && liveProperties
      ? {
          ...selectedComp,
          properties: {
            ...selectedComp.properties,
            ...liveProperties,
          },
        }
      : selectedComp;

  const unitAwareResistance = UNIT_AWARE_RESISTANCE_TYPES.has(displayComp.type);
  const resistanceOhms = Number(displayComp.properties.resistance);
  // Older projects were saved before the unit could be chosen, so a missing one
  // falls back to whatever writes the stored value most readably.
  const resistanceUnit: ResistanceUnit =
    typeof selectedComp.properties.unit === 'string'
      ? normalizeResistanceUnit(selectedComp.properties.unit)
      : pickResistanceUnit(Number.isFinite(resistanceOhms) ? resistanceOhms : 0);

  return (
    <div className="properties-content">
      {selectedComponentIds.length > 1 && (
        <div className="property-group">
          <div className="property-group-title">
            {t(language, 'multiSelection').replace('{{count}}', String(selectedComponentIds.length))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {t(language, 'multiSelectionHint')}
          </p>
        </div>
      )}

      <div className="property-group">
        <div className="property-group-title">
          {info?.icon} {displayName}
        </div>
        <div className="property-row">
          <span className="property-label">{t(language, 'id')}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {displayComp.id.slice(0, 8)}
          </span>
        </div>
        <div className="property-row">
          <span className="property-label">{t(language, 'componentName')}</span>
          <input
            className="property-input"
            type="text"
            placeholder={displayName}
            value={selectedComp.name ?? ''}
            onFocus={captureUndoSnapshot}
            onChange={(event) =>
              updateComponent(
                selectedComp.id,
                { name: event.target.value },
                { recordHistory: false }
              )
            }
          />
        </div>
        <div className="property-row" style={{ alignItems: 'flex-start' }}>
          <span className="property-label" style={{ paddingTop: 8 }}>
            {t(language, 'componentDescription')}
          </span>
          <textarea
            className="property-input"
            style={{ width: 150, minHeight: 52, resize: 'vertical', fontFamily: 'inherit' }}
            value={selectedComp.description ?? ''}
            onFocus={captureUndoSnapshot}
            onChange={(event) =>
              updateComponent(
                selectedComp.id,
                { description: event.target.value },
                { recordHistory: false }
              )
            }
          />
        </div>
      </div>

      <div className="property-group">
        <div className="property-group-title">{t(language, 'position')}</div>
        <div className="property-row">
          <span className="property-label">X</span>
          <input
            className="property-input"
            type="number"
            value={displayComp.x}
            onFocus={captureUndoSnapshot}
            onChange={(event) =>
              updateComponent(
                selectedComp.id,
                { x: Number(event.target.value) },
                { recordHistory: false }
              )
            }
          />
        </div>
        <div className="property-row">
          <span className="property-label">Y</span>
          <input
            className="property-input"
            type="number"
            value={displayComp.y}
            onFocus={captureUndoSnapshot}
            onChange={(event) =>
              updateComponent(
                selectedComp.id,
                { y: Number(event.target.value) },
                { recordHistory: false }
              )
            }
          />
        </div>
        <div className="property-row">
          <span className="property-label">{t(language, 'angle')}</span>
          <input
            className="property-input"
            type="number"
            value={displayComp.rotation}
            step={5}
            onFocus={captureUndoSnapshot}
            onChange={(event) =>
              updateComponent(
                selectedComp.id,
                { rotation: Number(event.target.value) },
                { recordHistory: false }
              )
            }
          />
        </div>
        <div className="property-row">
          <span className="property-label">{t(language, 'size')}</span>
          <input
            className="property-input"
            type="number"
            value={displayComp.scale ?? 1}
            step={0.1}
            min={MIN_COMPONENT_SCALE}
            max={MAX_COMPONENT_SCALE}
            onFocus={captureUndoSnapshot}
            onChange={(event) =>
              updateComponent(
                selectedComp.id,
                { scale: clampComponentScale(Number(event.target.value)) },
                { recordHistory: false }
              )
            }
          />
        </div>
        <div className="property-row">
          <span className="property-label">{t(language, 'mirror')}</span>
          <input
            type="checkbox"
            checked={displayComp.flipX === true}
            onChange={(event) =>
              updateComponent(selectedComp.id, { flipX: event.target.checked })
            }
          />
        </div>
      </div>

      {displayComp.properties.damaged === true && (
        <div className="property-group">
          <div className="property-row">
            <span className="property-label">{t(language, 'damageStatus')}</span>
            <span style={{ fontSize: 11, color: '#ff6b6b', textAlign: 'right' }}>
              {getDamageLabel(language, String(displayComp.properties.damageReason ?? ''))}
              {displayComp.properties.damageDetail
                ? ` (${displayComp.properties.damageDetail})`
                : ''}
            </span>
          </div>
        </div>
      )}

      <div className="property-group">
        <div className="property-group-title">
          {t(language, 'values')}
          {simulation.running && liveProperties ? ` (${t(language, 'live')})` : ''}
        </div>
        {Object.entries(displayComp.properties)
          .filter(([key]) => !damageKeys.has(key))
          .filter(([key]) =>
            displayComp.type === 'multimeter' ? !multimeterHiddenKeys.has(key) : true
          )
          // The unit is shown beside the resistance instead of on a row of its own.
          .filter(([key]) => !(unitAwareResistance && key === 'unit'))
          .map(([key, value]) => {
          if (unitAwareResistance && key === 'resistance') {
            return (
              <ResistanceRow
                key={key}
                label={getPropertyDisplayName(language, key)}
                ohms={Number.isFinite(resistanceOhms) ? resistanceOhms : 0}
                unit={resistanceUnit}
                onFocus={captureUndoSnapshot}
                onCommit={(ohms) =>
                  updateComponentProperty(selectedComp.id, 'resistance', ohms, {
                    recordHistory: false,
                  })
                }
                onUnitChange={(unit) =>
                  updateComponentProperty(selectedComp.id, 'unit', unit)
                }
              />
            );
          }

          return (
          <div className="property-row" key={key}>
            <span className="property-label">
              {getPropertyDisplayName(language, key)}
            </span>
            {displayComp.type === 'multimeter' && key === 'mode' ? (
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
            ) : displayComp.type === 'multimeter' && multimeterReadOnlyKeys.has(key) ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {key === 'status'
                  ? getMultimeterStatusLabel(language, String(value))
                  : typeof value === 'boolean'
                    ? t(language, value ? 'on' : 'off')
                    : String(value)}
              </span>
            ) : displayComp.type === 'oscilloscope' && oscilloscopeReadOnlyKeys.has(key) ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {key === 'status'
                  ? getOscilloscopeStatusLabel(language, String(value))
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
                onFocus={captureUndoSnapshot}
                onChange={(event) => {
                  const newValue =
                    typeof value === 'number'
                      ? Number(event.target.value)
                      : event.target.value;
                  updateComponentProperty(selectedComp.id, key, newValue, {
                    recordHistory: false,
                  });
                }}
              />
            )}
          </div>
          );
        })}
      </div>

      <div className="property-group">
        <div className="property-group-title">{t(language, 'pins')}</div>
        {displayComp.pins.map((pin) => (
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
              {getPinTypeLabel(language, pin.type)}
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

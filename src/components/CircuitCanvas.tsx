import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Stage, Layer, Group, Rect, Line, Circle, Text, Image as KonvaImage } from 'react-konva';
import { useCircuitStore } from '../store/circuitStore';
import {
  CircuitComponent,
  ComponentType,
  Pin,
  SimulationState,
  getDefaultPins,
} from '../models/types';
import {
  ARDUINO_COMPONENT_ID,
  CONTROLLER_BOARD_OPTIONS,
  getControllerBoardDefinition,
  getControllerBoardPins,
  type ControllerBoardDefinition,
  type ControllerBoardType,
} from '../models/arduinoUno';
import {
  BREADBOARD_COMPONENT_ID,
  DEFAULT_BREADBOARD_POSITION,
  type BreadboardHole,
  BB_COLS,
  getBreadboardBounds,
  getBreadboardHoleGlobal,
  HOLE_R,
  HOLE_SP,
  RAIL_H,
  getNearestBreadboardHole,
} from '../models/breadboard';
import type Konva from 'konva';
import {
  useAssetImage,
  useComponentImage,
  SVG_CONFIGS,
} from '../hooks/useComponentImages';
import {
  getMultimeterModeLabel,
  getMultimeterStatusLabel,
  getLocalizedOscilloscopeDisplayText,
  getOscilloscopeStatusLabel,
  t,
} from '../lib/i18n';
import multimeterProbeRedSvg from '../assets/components/multimeter-probe-red.svg';
import multimeterProbeBlackSvg from '../assets/components/multimeter-probe-black.svg';

// ===== Constants =====
const GRID_SIZE = 10;
const SNAP_RADIUS_SQ = (HOLE_SP * 2.5) ** 2;
const WIRE_PIN_RADIUS = 6;
const WIRE_PIN_FANOUT_RADIUS = 8;
const WIRE_PIN_FANOUT_OFFSET = 24;
const WIRE_PIN_FANOUT_SPACING = 22;
const DENSE_PIN_THRESHOLD = 20;
const MAX_FANOUT_PINS = 6;
const BREADBOARD_WIRE_SNAP_RADIUS_SQ = (HOLE_SP * 1.8) ** 2;
const PROBE_SNAP_RADIUS_SQ = (HOLE_SP * 1.8) ** 2;
const PROBE_DOCK_SNAP_RADIUS_SQ = 24 ** 2;
const MULTIMETER_BLACK_ANCHOR = { x: 0, y: 103 };
const MULTIMETER_RED_V_ANCHOR = { x: 36, y: 103 };
const MULTIMETER_RED_A_ANCHOR = { x: -36, y: 103 };
const PROBE_IMAGE_WIDTH = 24;
const PROBE_IMAGE_HEIGHT = 72;

type WirePinHandle = {
  pin: Pin;
  targetX: number;
  targetY: number;
  expanded: boolean;
  label: string;
};

type ResistorBandOverlay = {
  x: number;
  width: number;
  coverX: number;
  coverWidth: number;
};

type ContextMenuTarget =
  | { kind: 'background' }
  | { kind: 'board' }
  | { kind: 'component'; componentId: string }
  | { kind: 'wire'; wireId: string };

type ContextMenuState = {
  x: number;
  y: number;
  target: ContextMenuTarget;
};

type ProbeSlot = 'black' | 'red';

type ProbeSnapTarget = {
  componentId: string;
  pinId: string;
  x: number;
  y: number;
  label: string;
  distSq: number;
};

const RESISTOR_DIGIT_COLORS = [
  '#111111',
  '#6e3b19',
  '#c0392b',
  '#e67e22',
  '#f1c40f',
  '#27ae60',
  '#2980b9',
  '#8e44ad',
  '#7f8c8d',
  '#ecf0f1',
];

const RESISTOR_MULTIPLIER_COLORS: Record<number, string> = {
  [-2]: '#bdc3c7',
  [-1]: '#c8a94b',
  0: RESISTOR_DIGIT_COLORS[0],
  1: RESISTOR_DIGIT_COLORS[1],
  2: RESISTOR_DIGIT_COLORS[2],
  3: RESISTOR_DIGIT_COLORS[3],
  4: RESISTOR_DIGIT_COLORS[4],
  5: RESISTOR_DIGIT_COLORS[5],
  6: RESISTOR_DIGIT_COLORS[6],
  7: RESISTOR_DIGIT_COLORS[7],
  8: RESISTOR_DIGIT_COLORS[8],
  9: RESISTOR_DIGIT_COLORS[9],
};

const RESISTOR_BODY_COLOR = '#d9b477';
const RESISTOR_TOLERANCE_COLOR = '#c8a94b';
const RESISTOR_BANDS: ResistorBandOverlay[] = [
  { x: -19.4, width: 5.4, coverX: -20.3, coverWidth: 7.1 },
  { x: -8.7, width: 5.4, coverX: -9.5, coverWidth: 7.0 },
  { x: 2.1, width: 5.4, coverX: 1.3, coverWidth: 7.0 },
  { x: 19.1, width: 2.1, coverX: 18.4, coverWidth: 3.5 },
];

function getNumericValue(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getMultimeterMode(value: unknown): 'voltage' | 'current' | 'resistance' | 'continuity' {
  const normalized = String(value ?? 'voltage').trim().toLowerCase();
  if (normalized.includes('akim')) return 'current';
  if (normalized.includes('direnc')) return 'resistance';
  if (normalized.includes('surekl')) return 'continuity';
  if (normalized === 'current') return 'current';
  if (normalized === 'resistance') return 'resistance';
  if (normalized === 'continuity') return 'continuity';
  return 'voltage';
}

function getLocalizedMultimeterDisplayText(language: 'en' | 'tr', text: string): string {
  const normalized = text.trim().toLowerCase();
  if (normalized === 'open') return getMultimeterStatusLabel(language, 'open');
  if (normalized === 'beep') return getMultimeterStatusLabel(language, 'beep');
  return text;
}

function readBooleanProperty(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return null;
}

function getProbeAnchorLocalPosition(
  slot: ProbeSlot,
  mode: 'voltage' | 'current' | 'resistance' | 'continuity'
) {
  if (slot === 'black') {
    return MULTIMETER_BLACK_ANCHOR;
  }

  return mode === 'current' ? MULTIMETER_RED_A_ANCHOR : MULTIMETER_RED_V_ANCHOR;
}

function getProbeStoredWorldPosition(
  component: CircuitComponent,
  slot: ProbeSlot
): { x: number; y: number } {
  const prefix = slot === 'black' ? 'blackProbe' : 'redProbe';
  const fallbackX = component.x + (slot === 'black' ? 6 : 72);
  const fallbackY = component.y + 170;

  return {
    x: getNumericValue(component.properties[`${prefix}X`], fallbackX),
    y: getNumericValue(component.properties[`${prefix}Y`], fallbackY),
  };
}

function getProbeTargetKeys(slot: ProbeSlot) {
  if (slot === 'black') {
    return {
      componentKey: 'blackProbeTargetComponentId',
      pinKey: 'blackProbeTargetPinId',
    } as const;
  }

  return {
    componentKey: 'redProbeTargetComponentId',
    pinKey: 'redProbeTargetPinId',
  } as const;
}

function getProbeDockKey(slot: ProbeSlot) {
  return slot === 'black' ? 'blackProbeDocked' : 'redProbeDocked';
}

function getProbeDockedLocalPosition(
  slot: ProbeSlot,
  mode: 'voltage' | 'current' | 'resistance' | 'continuity'
) {
  const anchor = getProbeAnchorLocalPosition(slot, mode);
  return {
    x: anchor.x,
    y: anchor.y + 54,
  };
}

function formatCompactNumber(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  return Number(value.toFixed(value >= 10 ? 1 : 2)).toString();
}

function formatResistanceLabel(value: unknown): string {
  const resistance = getNumericValue(value, 0);
  const magnitude = Math.abs(resistance);

  if (magnitude >= 1_000_000) {
    return `${formatCompactNumber(resistance / 1_000_000)}MΩ`;
  }

  if (magnitude >= 1_000) {
    return `${formatCompactNumber(resistance / 1_000)}kΩ`;
  }

  return `${formatCompactNumber(resistance)}Ω`;
}

function getResistorBandColors(value: unknown): string[] {
  const resistance = Math.abs(getNumericValue(value, 0));

  if (resistance === 0) {
    return [
      RESISTOR_DIGIT_COLORS[0],
      RESISTOR_DIGIT_COLORS[0],
      RESISTOR_MULTIPLIER_COLORS[0],
      RESISTOR_TOLERANCE_COLOR,
    ];
  }

  let multiplier = Math.floor(Math.log10(resistance)) - 1;
  let significant = Math.round(resistance / 10 ** multiplier);

  while (significant >= 100) {
    significant = Math.round(significant / 10);
    multiplier += 1;
  }

  while (significant < 10) {
    significant = Math.round(significant * 10);
    multiplier -= 1;
  }

  significant = Math.max(10, Math.min(99, significant));
  multiplier = Math.max(-2, Math.min(9, multiplier));

  return [
    RESISTOR_DIGIT_COLORS[Math.floor(significant / 10)],
    RESISTOR_DIGIT_COLORS[significant % 10],
    RESISTOR_MULTIPLIER_COLORS[multiplier] ?? RESISTOR_MULTIPLIER_COLORS[0],
    RESISTOR_TOLERANCE_COLOR,
  ];
}

function snapToGrid(val: number): number {
  return Math.round(val / GRID_SIZE) * GRID_SIZE;
}

function normalizeRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

function rotatePoint(x: number, y: number, rotation = 0): { x: number; y: number } {
  const normalized = normalizeRotation(rotation);
  const snappedRightAngle = (Math.round(normalized / 90) * 90) % 360;

  if (Math.abs(normalized - snappedRightAngle) < 0.001) {
    switch (snappedRightAngle) {
      case 90:
        return { x: -y, y: x };
      case 180:
        return { x: -x, y: -y };
      case 270:
        return { x: y, y: -x };
      default:
        return { x, y };
    }
  }

  const radians = (normalized * Math.PI) / 180;
  const rotatedX = x * Math.cos(radians) - y * Math.sin(radians);
  const rotatedY = x * Math.sin(radians) + y * Math.cos(radians);

  return {
    x: Math.round(rotatedX * 1000) / 1000,
    y: Math.round(rotatedY * 1000) / 1000,
  };
}

function getRotatedPins<T extends { x: number; y: number }>(pins: T[], rotation = 0): T[] {
  if (pins.length === 0 || normalizeRotation(rotation) === 0) {
    return pins;
  }

  return pins.map((pin) => {
    const rotated = rotatePoint(pin.x, pin.y, rotation);
    return {
      ...pin,
      x: rotated.x,
      y: rotated.y,
    };
  });
}

function getComponentPinWorldPosition(
  component: Pick<CircuitComponent, 'x' | 'y' | 'rotation' | 'pins'>,
  pinId: string
) {
  const pin = component.pins.find((item) => item.id === pinId);
  if (!pin) return null;

  const rotated = rotatePoint(pin.x, pin.y, component.rotation);
  return {
    pin,
    x: component.x + rotated.x,
    y: component.y + rotated.y,
  };
}

function isNearBreadboardArea(
  x: number,
  y: number,
  breadboardPosition: { x: number; y: number } = DEFAULT_BREADBOARD_POSITION
): boolean {
  const bounds = getBreadboardBounds(breadboardPosition);
  return (
    x >= bounds.x - 24 &&
    x <= bounds.right + 24 &&
    y >= bounds.y - 24 &&
    y <= bounds.bottom + 24
  );
}

function snapPinsToBreadboard(
  x: number,
  y: number,
  pins: Array<{ x: number; y: number }>,
  breadboardPosition: { x: number; y: number } = DEFAULT_BREADBOARD_POSITION
): { x: number; y: number } | null {
  if (pins.length === 0) return null;

  let bestCandidate: { x: number; y: number; score: number } | null = null;

  for (const anchorPin of pins) {
    const anchorGlobalX = x + anchorPin.x;
    const anchorGlobalY = y + anchorPin.y;
    const nearestHole = getNearestBreadboardHole(
      anchorGlobalX,
      anchorGlobalY,
      breadboardPosition
    );

    if (
      !isNearBreadboardArea(anchorGlobalX, anchorGlobalY, breadboardPosition) &&
      nearestHole.distSq > SNAP_RADIUS_SQ
    ) {
      continue;
    }

    const candidateX = nearestHole.x - anchorPin.x;
    const candidateY = nearestHole.y - anchorPin.y;
    let score = 0;

    for (const pin of pins) {
      const pinGlobalX = candidateX + pin.x;
      const pinGlobalY = candidateY + pin.y;
      const snappedHole = getNearestBreadboardHole(
        pinGlobalX,
        pinGlobalY,
        breadboardPosition
      );

      score += snappedHole.distSq;
      if (!isNearBreadboardArea(pinGlobalX, pinGlobalY, breadboardPosition)) {
        score += SNAP_RADIUS_SQ;
      }
    }

    if (!bestCandidate || score < bestCandidate.score) {
      bestCandidate = { x: candidateX, y: candidateY, score };
    }
  }

  return bestCandidate ? { x: bestCandidate.x, y: bestCandidate.y } : null;
}

export function snapToBreadboard(
  x: number,
  y: number,
  type?: string,
  pins?: Array<{ x: number; y: number }>,
  breadboardPosition: { x: number; y: number } = DEFAULT_BREADBOARD_POSITION,
  rotation = 0
): { x: number; y: number } {
  const componentType = type && type in SVG_CONFIGS ? (type as ComponentType) : undefined;
  const pinLayout = pins ?? (componentType ? getDefaultPins(componentType) : []);
  const rotatedPinLayout = getRotatedPins(pinLayout, rotation);
  const snapped = snapPinsToBreadboard(x, y, rotatedPinLayout, breadboardPosition);

  if (snapped) {
    return snapped;
  }

  return { x: snapToGrid(x), y: snapToGrid(y) };
}

function getPinHandleLabel(pin: Pin): string {
  const compactId = pin.id.replace(/[^a-z0-9+-]/gi, '').toUpperCase();
  if (compactId.length <= 4) return compactId;
  return compactId.slice(0, 4);
}

function getWirePinHandles(pins: Pin[]): WirePinHandle[] {
  if (pins.length === 0) return [];

  let minDistance = Infinity;
  for (let i = 0; i < pins.length; i++) {
    for (let j = i + 1; j < pins.length; j++) {
      const dx = pins[i].x - pins[j].x;
      const dy = pins[i].y - pins[j].y;
      minDistance = Math.min(minDistance, Math.sqrt(dx * dx + dy * dy));
    }
  }

  const shouldFanOut =
    pins.length > 1 &&
    pins.length <= MAX_FANOUT_PINS &&
    minDistance < DENSE_PIN_THRESHOLD;

  if (!shouldFanOut) {
    return pins.map((pin) => ({
      pin,
      targetX: pin.x,
      targetY: pin.y,
      expanded: false,
      label: getPinHandleLabel(pin),
    }));
  }

  const minX = Math.min(...pins.map((pin) => pin.x));
  const maxX = Math.max(...pins.map((pin) => pin.x));
  const minY = Math.min(...pins.map((pin) => pin.y));
  const maxY = Math.max(...pins.map((pin) => pin.y));
  const horizontalSpread = maxX - minX;
  const verticalSpread = maxY - minY;
  const sortByHorizontal = horizontalSpread >= verticalSpread;
  const sortedPins = [...pins].sort((a, b) =>
    sortByHorizontal
      ? a.x - b.x || a.y - b.y
      : a.y - b.y || a.x - b.x
  );
  const startOffset = ((sortedPins.length - 1) * WIRE_PIN_FANOUT_SPACING) / 2;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const handleTargets = new Map<string, { x: number; y: number }>();

  sortedPins.forEach((pin, index) => {
    const offset = index * WIRE_PIN_FANOUT_SPACING - startOffset;
    const target = sortByHorizontal
      ? { x: centerX + offset, y: minY - WIRE_PIN_FANOUT_OFFSET }
      : { x: maxX + WIRE_PIN_FANOUT_OFFSET, y: centerY + offset };
    handleTargets.set(pin.id, target);
  });

  return pins.map((pin) => {
    const target = handleTargets.get(pin.id) ?? { x: pin.x, y: pin.y };
    return {
      pin,
      targetX: target.x,
      targetY: target.y,
      expanded: true,
      label: getPinHandleLabel(pin),
    };
  });
}

function getCanvasComponentLabel(type: ComponentType): string {
  if (type === 'oscilloscope') return 'SCOPE';
  if (type === 'multimeter') return 'DMM';
  if (type === 'bme280') return 'BME280';
  if (type === 'ina219') return 'INA219';
  if (type === 'sx1276-lora') return 'LORA';
  if (type === 'a4988-driver') return 'A4988';
  return type.toUpperCase();
}

// ===== SVG-Based Component Shape =====
const ComponentShape: React.FC<{
  comp: CircuitComponent;
  isSelected: boolean;
  simulation: SimulationState;
  language: 'en' | 'tr';
}> = ({ comp: sourceComp, isSelected, simulation, language }) => {
  const comp = simulation.running
    ? {
        ...sourceComp,
        properties: {
          ...sourceComp.properties,
          ...(simulation.componentStates[sourceComp.id] ?? {}),
        },
      }
    : sourceComp;
  const config = SVG_CONFIGS[comp.type];
  const image = useComponentImage(comp.type);
  const multimeterMode =
    comp.type === 'multimeter' ? getMultimeterMode(comp.properties.mode) : 'voltage';
  const blackProbeDocked =
    comp.type === 'multimeter'
      ? (
          readBooleanProperty(comp.properties.blackProbeDocked) ??
          (!String(comp.properties.blackProbeTargetComponentId ?? '').trim() &&
            !String(comp.properties.blackProbeTargetPinId ?? '').trim())
        )
      : false;
  const redProbeDocked =
    comp.type === 'multimeter'
      ? (
          readBooleanProperty(comp.properties.redProbeDocked) ??
          (!String(comp.properties.redProbeTargetComponentId ?? '').trim() &&
            !String(comp.properties.redProbeTargetPinId ?? '').trim())
        )
      : false;
  const lcdDisplayOn =
    comp.type === 'lcd-16x2' ? (readBooleanProperty(comp.properties.displayOn) ?? true) : false;
  const lcdBacklight =
    comp.type === 'lcd-16x2' ? (readBooleanProperty(comp.properties.backlight) ?? true) : false;
  const servoAngle =
    comp.type === 'servo' ? getNumericValue(comp.properties.angle, 90) : 90;

  if (!config || !image) {
    return <Circle radius={10} fill="#888" />;
  }

  return (
    <Group>
      {/* Invisible hit area for drag/click */}
      <Rect
        x={-config.offsetX}
        y={-config.offsetY}
        width={config.width}
        height={config.height}
        fill="rgba(255,255,255,0.001)"
      />
      {/* SVG image */}
      <KonvaImage
        image={image}
        x={-config.offsetX}
        y={-config.offsetY}
        width={config.width}
        height={config.height}
        listening={false}
      />

      {/* LED glow overlay */}
      {comp.type === 'led' && (() => {
        const ledState = simulation.ledStates[comp.id];
        const isOn = simulation.running && ledState?.on;
        const bri = ledState?.brightness ?? 0;
        const color = (comp.properties.color as string) || 'red';
        const cMap: Record<string, string> = {
          red: '#e74c3c', green: '#27ae60', blue: '#2980b9',
          yellow: '#f1c40f', white: '#dcdde1', orange: '#e67e22',
        };
        const c = cMap[color] || cMap.red;
        return isOn ? (
          <>
            <Circle radius={28} fill={c} opacity={0.12 * bri} listening={false} />
            <Circle radius={18} fill={c} opacity={0.22 * bri} listening={false} />
          </>
        ) : null;
      })()}

      {/* Resistor color bands and value */}
      {comp.type === 'resistor' && (() => {
        const bandColors = getResistorBandColors(comp.properties.resistance);

        return (
          <>
            {RESISTOR_BANDS.map((band, index) => (
              <React.Fragment key={`resistor-band-${index}`}>
                <Rect
                  x={band.coverX}
                  y={-9.2}
                  width={band.coverWidth}
                  height={18.4}
                  fill={RESISTOR_BODY_COLOR}
                  listening={false}
                />
                <Rect
                  x={band.x}
                  y={-8.5}
                  width={band.width}
                  height={16.8}
                  fill={bandColors[index]}
                  stroke="#4b3a2d"
                  strokeWidth={0.35}
                  cornerRadius={1}
                  listening={false}
                />
              </React.Fragment>
            ))}

            <Text
              text={formatResistanceLabel(comp.properties.resistance)}
              x={-22}
              y={-22}
              width={44}
              align="center"
              fontSize={9}
              fill="#ccc"
              listening={false}
            />
          </>
        );
      })()}

      {/* Capacitor value */}
      {comp.type === 'capacitor' && (
        <Text text={`${comp.properties.capacitance}µF`} x={-18} y={-28} width={36} align="center" fontSize={8} fill="#aaa" listening={false} />
      )}

      {/* Servo angle */}
      {comp.type === 'servo' && (
        <>
          <Group rotation={(servoAngle - 90) * 0.9} listening={false}>
            <Line
              points={[0, -4, 0, -22]}
              stroke="#f5f5f5"
              strokeWidth={2.2}
              lineCap="round"
              listening={false}
            />
          </Group>
          <Circle x={0} y={-4} radius={3.2} fill="#d9d9d9" listening={false} />
          <Text
            text={`${Math.round(servoAngle)}°`}
            x={-10}
            y={-30}
            width={20}
            align="center"
            fontSize={8}
            fill="#aaa"
            listening={false}
          />
        </>
      )}

      {comp.type === 'dc-motor' && (
        <>
          <Circle
            x={0}
            y={0}
            radius={7}
            stroke={Math.abs(Number(comp.properties.rpm) || 0) > 0 ? '#f7e38b' : '#6d7481'}
            strokeWidth={1.4}
            dash={Math.abs(Number(comp.properties.rpm) || 0) > 0 ? [2, 2] : undefined}
            listening={false}
          />
          <Text
            text={`${Math.round(Number(comp.properties.rpm) || 0)} RPM`}
            x={-20}
            y={-24}
            width={40}
            align="center"
            fontSize={7}
            fill={Math.abs(Number(comp.properties.rpm) || 0) > 0 ? '#f7e38b' : '#8a909c'}
            listening={false}
          />
        </>
      )}

      {comp.type === 'multimeter' && (
        <>
          <Group listening={false}>
            <Circle
              x={MULTIMETER_RED_A_ANCHOR.x}
              y={MULTIMETER_RED_A_ANCHOR.y}
              radius={9}
              fill={multimeterMode === 'current' ? '#3b1118' : '#1b1f27'}
              stroke={multimeterMode === 'current' ? '#ef6c7a' : '#697486'}
              strokeWidth={1.4}
              listening={false}
            />
            <Circle
              x={MULTIMETER_RED_A_ANCHOR.x}
              y={MULTIMETER_RED_A_ANCHOR.y}
              radius={4.1}
              fill={redProbeDocked && multimeterMode === 'current' ? '#191c22' : '#090b0f'}
              stroke={redProbeDocked && multimeterMode === 'current' ? '#ffb5bf' : '#303744'}
              strokeWidth={1}
              listening={false}
            />
            <Circle
              x={MULTIMETER_BLACK_ANCHOR.x}
              y={MULTIMETER_BLACK_ANCHOR.y}
              radius={9}
              fill="#1b1f27"
              stroke={blackProbeDocked ? '#d4dae3' : '#697486'}
              strokeWidth={1.4}
              listening={false}
            />
            <Circle
              x={MULTIMETER_BLACK_ANCHOR.x}
              y={MULTIMETER_BLACK_ANCHOR.y}
              radius={4.1}
              fill={blackProbeDocked ? '#15191f' : '#090b0f'}
              stroke={blackProbeDocked ? '#eff4fb' : '#303744'}
              strokeWidth={1}
              listening={false}
            />
            <Circle
              x={MULTIMETER_RED_V_ANCHOR.x}
              y={MULTIMETER_RED_V_ANCHOR.y}
              radius={9}
              fill={multimeterMode === 'current' ? '#1b1f27' : '#3b1118'}
              stroke={multimeterMode === 'current' ? '#697486' : '#ef6c7a'}
              strokeWidth={1.4}
              listening={false}
            />
            <Circle
              x={MULTIMETER_RED_V_ANCHOR.x}
              y={MULTIMETER_RED_V_ANCHOR.y}
              radius={4.1}
              fill={redProbeDocked && multimeterMode !== 'current' ? '#191c22' : '#090b0f'}
              stroke={redProbeDocked && multimeterMode !== 'current' ? '#ffb5bf' : '#303744'}
              strokeWidth={1}
              listening={false}
            />
            <Text
              text="10A"
              x={MULTIMETER_RED_A_ANCHOR.x - 12}
              y={MULTIMETER_RED_A_ANCHOR.y + 12}
              width={24}
              align="center"
              fontSize={6}
              fill={multimeterMode === 'current' ? '#ffb0ba' : '#8d99ab'}
              listening={false}
            />
            <Text
              text="COM"
              x={MULTIMETER_BLACK_ANCHOR.x - 12}
              y={MULTIMETER_BLACK_ANCHOR.y + 12}
              width={24}
              align="center"
              fontSize={6}
              fill={blackProbeDocked ? '#e5ebf3' : '#8d99ab'}
              listening={false}
            />
            <Text
              text="VΩ"
              x={MULTIMETER_RED_V_ANCHOR.x - 12}
              y={MULTIMETER_RED_V_ANCHOR.y + 12}
              width={24}
              align="center"
              fontSize={6}
              fill={multimeterMode === 'current' ? '#8d99ab' : '#ffb0ba'}
              listening={false}
            />
          </Group>
          <Rect
            x={-58}
            y={-96}
            width={116}
            height={42}
            cornerRadius={6}
            fill="#9bc1d9"
            opacity={0.78}
            stroke="#c6e3f1"
            strokeWidth={1}
            listening={false}
          />
          <Text
            text={getLocalizedMultimeterDisplayText(
              language,
              String(comp.properties.displayText ?? '0.00 V')
            )}
            x={-52}
            y={-86}
            width={104}
            align="center"
            fontSize={12}
            fontStyle="bold"
            fill="#133243"
            listening={false}
          />
          <Text
            text={`${getMultimeterModeLabel(language, String(comp.properties.mode ?? 'voltage'))} | ${getMultimeterStatusLabel(language, String(comp.properties.status ?? 'ready'))}`}
            x={-56}
            y={-68}
            width={112}
            align="center"
            fontSize={6}
            fill="#214a60"
            listening={false}
          />
        </>
      )}

      {comp.type === 'oscilloscope' && (
        <>
          <Rect
            x={-46}
            y={-28}
            width={92}
            height={38}
            cornerRadius={6}
            fill="#8fd7c2"
            opacity={0.88}
            stroke="#c7fff1"
            strokeWidth={1}
            listening={false}
          />
          <Text
            text={getLocalizedOscilloscopeDisplayText(
              language,
              String(comp.properties.displayText ?? '0.00 V')
            )}
            x={-40}
            y={-20}
            width={80}
            align="center"
            fontSize={12}
            fontStyle="bold"
            fill="#083239"
            listening={false}
          />
          <Text
            text={getOscilloscopeStatusLabel(
              language,
              String(comp.properties.status ?? 'idle')
            )}
            x={-40}
            y={-5}
            width={80}
            align="center"
            fontSize={6}
            fill="#1a5560"
            listening={false}
          />
          {comp.pins.map((pin) => (
            <Group key={`oscilloscope-pin-${pin.id}`} listening={false}>
              <Circle
                x={pin.x}
                y={pin.y}
                radius={6}
                fill={pin.id === 'gnd' ? '#11171e' : '#151b12'}
                stroke={pin.id === 'gnd' ? '#e3ebf5' : '#f4d35e'}
                strokeWidth={1.2}
              />
              <Text
                text={pin.name}
                x={pin.x - 16}
                y={pin.y - 18}
                width={32}
                align="center"
                fontSize={7}
                fill={pin.id === 'gnd' ? '#dbe7f3' : '#f4d35e'}
              />
            </Group>
          ))}
        </>
      )}

      {/* Potentiometer position */}
      {comp.type === 'potentiometer' && (
        <Text text={`${(comp.properties.position as number) ?? 50}%`} x={-12} y={-28} width={24} align="center" fontSize={8} fill="#aaa" listening={false} />
      )}

      {/* Joystick axes */}
      {comp.type === 'joystick' && (
        <Text
          text={`${Math.round(Number(comp.properties.xAxis) || 0)}/${Math.round(Number(comp.properties.yAxis) || 0)}`}
          x={-18}
          y={-34}
          width={36}
          align="center"
          fontSize={7}
          fill="#9fd3ff"
          listening={false}
        />
      )}

      {/* LM35 temperature */}
      {comp.type === 'lm35' && (
        <Text text={`${(comp.properties.temperature as number) ?? 25}°C`} x={-14} y={-24} width={28} align="center" fontSize={8} fill="#e67e22" listening={false} />
      )}

      {/* DHT11 reading */}
      {comp.type === 'dht11' && (
        <Text
          text={`${comp.properties.temperature ?? 24}C ${comp.properties.humidity ?? 55}%`}
          x={-18}
          y={-28}
          width={36}
          align="center"
          fontSize={7}
          fill="#7fd6ff"
          listening={false}
        />
      )}

      {/* PIR state */}
      {comp.type === 'pir-sensor' && (
        <Text
          text={comp.properties.detected ? t(language, 'detect') : t(language, 'idle')}
          x={-16}
          y={-28}
          width={32}
          align="center"
          fontSize={7}
          fill={comp.properties.detected ? '#f1c40f' : '#95a5a6'}
          listening={false}
        />
      )}

      {/* Flame sensor state */}
      {comp.type === 'flame-sensor' && (
        <Text
          text={comp.properties.flameDetected ? t(language, 'alarm') : t(language, 'safe')}
          x={-16}
          y={-26}
          width={32}
          align="center"
          fontSize={7}
          fill={comp.properties.flameDetected ? '#ffb347' : '#95a5a6'}
          listening={false}
        />
      )}

      {/* MQ-2 level */}
      {comp.type === 'mq2' && (
        <Text
          text={`${t(language, 'gasPrefix')} ${comp.properties.gasLevel ?? 0}`}
          x={-18}
          y={-26}
          width={36}
          align="center"
          fontSize={7}
          fill="#d7dee4"
          listening={false}
        />
      )}

      {comp.type === 'hc-05' && (
        <Text
          text={comp.properties.connected ? 'BT ON' : 'BT OFF'}
          x={-20}
          y={-24}
          width={40}
          align="center"
          fontSize={7}
          fill={comp.properties.connected ? '#4ecca3' : '#95a5a6'}
          listening={false}
        />
      )}

      {comp.type === 'oled-i2c' && (
        <>
          <Text
            text={String(comp.properties.text1 ?? '')}
            x={-26}
            y={-6}
            width={52}
            align="center"
            fontSize={6}
            fill="#b7f7d4"
            listening={false}
          />
          <Text
            text={String(comp.properties.text2 ?? '')}
            x={-26}
            y={2}
            width={52}
            align="center"
            fontSize={6}
            fill="#b7f7d4"
            listening={false}
          />
        </>
      )}

      {comp.type === 'lcd-16x2' && (
        <>
          <Rect
            x={-49}
            y={-6}
            width={98}
            height={23}
            cornerRadius={3}
            fill={lcdBacklight ? '#c8e17a' : '#6d7851'}
            opacity={lcdDisplayOn ? (lcdBacklight ? 0.42 : 0.18) : 0.08}
            listening={false}
          />
          <Text
            text={lcdDisplayOn ? String(comp.properties.text1 ?? '') : ''}
            x={-45}
            y={-4}
            width={90}
            align="left"
            wrap="none"
            fontFamily="monospace"
            fontSize={7}
            fill={lcdBacklight ? '#193b1b' : '#31412b'}
            listening={false}
          />
          <Text
            text={lcdDisplayOn ? String(comp.properties.text2 ?? '') : ''}
            x={-45}
            y={5}
            width={90}
            align="left"
            wrap="none"
            fontFamily="monospace"
            fontSize={7}
            fill={lcdBacklight ? '#193b1b' : '#31412b'}
            listening={false}
          />
        </>
      )}

      {comp.type === 'rc522' && (
        <Text
          text={comp.properties.cardPresent ? t(language, 'card') : t(language, 'noCard')}
          x={-22}
          y={-82}
          width={44}
          align="center"
          fontSize={7}
          fill={comp.properties.cardPresent ? '#f1c40f' : '#95a5a6'}
          listening={false}
        />
      )}

      {comp.type === 'stepper-28byj48' && (
        <Text
          text={`${comp.properties.angle ?? 0}deg`}
          x={-20}
          y={-70}
          width={40}
          align="center"
          fontSize={7}
          fill="#d7dee4"
          listening={false}
        />
      )}

      {comp.type === 'l298n-driver' && (
        <Text
          text={`A:${comp.properties.enabledA ? 'ON' : 'OFF'} B:${comp.properties.enabledB ? 'ON' : 'OFF'}`}
          x={-30}
          y={-24}
          width={60}
          align="center"
          fontSize={7}
          fill="#f7e38b"
          listening={false}
        />
      )}

      {comp.type === 'vl53l0x' && (
        <Text
          text={`${comp.properties.distance ?? 120}mm`}
          x={-18}
          y={-22}
          width={36}
          align="center"
          fontSize={7}
          fill="#9fd3ff"
          listening={false}
        />
      )}

      {comp.type === 'reed-switch-module' && (
        <Text
          text={comp.properties.triggered ? t(language, 'triggered') : t(language, 'openState')}
          x={-20}
          y={-22}
          width={40}
          align="center"
          fontSize={7}
          fill={comp.properties.triggered ? '#f1c40f' : '#95a5a6'}
          listening={false}
        />
      )}

      {comp.type === 'breadboard-power-supply' && (
        <Text
          text={`${comp.properties.leftRail ?? '5V'} | ${comp.properties.rightRail ?? '3.3V'}`}
          x={-36}
          y={-20}
          width={72}
          align="center"
          fontSize={7}
          fill={comp.properties.enabled ? '#d7dee4' : '#777'}
          listening={false}
        />
      )}

      {comp.type === 'acs712' && (
        <Text
          text={`${comp.properties.current ?? 0}A`}
          x={-16}
          y={-22}
          width={32}
          align="center"
          fontSize={7}
          fill="#f7e38b"
          listening={false}
        />
      )}

      {comp.type === 'logic-level-converter' && (
        <Text
          text={`${comp.properties.lowVoltage ?? 3.3}V>${comp.properties.highVoltage ?? 5}V`}
          x={-26}
          y={-20}
          width={52}
          align="center"
          fontSize={7}
          fill="#d7dee4"
          listening={false}
        />
      )}

      {comp.type === 'rf-433-receiver' && (
        <Text
          text={comp.properties.signal ? t(language, 'rxOn') : t(language, 'rxIdle')}
          x={-20}
          y={-20}
          width={40}
          align="center"
          fontSize={7}
          fill={comp.properties.signal ? '#4ecca3' : '#95a5a6'}
          listening={false}
        />
      )}

      {comp.type === 'sound-sensor' && (
        <Text
          text={comp.properties.detected ? t(language, 'sound') : t(language, 'quiet')}
          x={-20}
          y={-18}
          width={40}
          align="center"
          fontSize={7}
          fill={comp.properties.detected ? '#f1c40f' : '#95a5a6'}
          listening={false}
        />
      )}

      {comp.type === 'tm1637' && (
        <Text
          text={String(comp.properties.value ?? '0000')}
          x={-26}
          y={-8}
          width={52}
          align="center"
          fontSize={8}
          fill="#ff4d4d"
          listening={false}
        />
      )}

      {comp.type === 'uln2003-driver' && (
        <Text
          text={comp.properties.enabled ? t(language, 'stepOn') : t(language, 'stepIdle')}
          x={-24}
          y={-26}
          width={48}
          align="center"
          fontSize={7}
          fill={comp.properties.enabled ? '#4ecca3' : '#95a5a6'}
          listening={false}
        />
      )}

      {comp.type === 'rf-433-transmitter' && (
        <Text
          text={comp.properties.transmitting ? t(language, 'txOn') : t(language, 'txIdle')}
          x={-20}
          y={-20}
          width={40}
          align="center"
          fontSize={7}
          fill={comp.properties.transmitting ? '#4ecca3' : '#95a5a6'}
          listening={false}
        />
      )}

      {comp.type === 'ds18b20-probe' && (
        <Text
          text={`${comp.properties.temperature ?? 24}C`}
          x={-14}
          y={-20}
          width={28}
          align="center"
          fontSize={7}
          fill="#7fd6ff"
          listening={false}
        />
      )}

      {comp.type === 'esp8266-module' && (
        <Text
          text={comp.properties.connected ? t(language, 'wifiOn') : t(language, 'wifiOff')}
          x={-24}
          y={-18}
          width={48}
          align="center"
          fontSize={7}
          fill={comp.properties.connected ? '#4ecca3' : '#95a5a6'}
          listening={false}
        />
      )}

      {comp.type === 'tcs230' && (
        <Text
          text={`R${comp.properties.red ?? 0} G${comp.properties.green ?? 0}`}
          x={-24}
          y={-22}
          width={48}
          align="center"
          fontSize={6}
          fill="#d7dee4"
          listening={false}
        />
      )}

      {comp.type === 'uv-sensor' && (
        <Text
          text={`UV ${comp.properties.uvIndex ?? 0}`}
          x={-16}
          y={-22}
          width={32}
          align="center"
          fontSize={7}
          fill="#ffd166"
          listening={false}
        />
      )}

      {/* HC-SR04 distance */}
      {comp.type === 'hc-sr04' && (
        <Text text={`${(comp.properties.distance as number) ?? 100}cm`} x={-14} y={-28} width={28} align="center" fontSize={8} fill="#3498db" listening={false} />
      )}

      {/* Relay state */}
      {comp.type === 'relay' && (
        <Text
          text={comp.properties.activated ? 'ON' : 'OFF'}
          x={-10} y={6} width={20} align="center" fontSize={7}
          fill={comp.properties.activated ? '#4ecca3' : '#e74c3c'} fontStyle="bold" listening={false}
        />
      )}

      {/* Selection outline */}
      {isSelected && (
        <Rect
          x={-config.offsetX - 2}
          y={-config.offsetY - 2}
          width={config.width + 4}
          height={config.height + 4}
          stroke="#fff"
          strokeWidth={1.5}
          dash={[3, 3]}
          fill="transparent"
          cornerRadius={4}
          listening={false}
        />
      )}
    </Group>
  );
};


// ===== Breadboard â€” Tinkercad-style =====
const Breadboard: React.FC = React.memo(() => {
  const boardW = BB_COLS * HOLE_SP + 40;
  const mainH = 10 * HOLE_SP + HOLE_SP + 50; // 10 rows + center gap + padding
  const railH = 18;
  const totalH = mainH + railH * 2 + 30;

  const holes = useMemo(() => {
    const els: React.ReactElement[] = [];

    // â”€â”€ Power rails (top & bottom) â”€â”€
    for (let rail = 0; rail < 2; rail++) {
      const ry = rail === 0 ? 14 : totalH - 28;
      // Red / blue rail stripes
      els.push(
        <Rect key={`rs-r-${rail}`} x={18} y={ry - 1} width={boardW - 36} height={1.2} fill="#e74c3c" opacity={0.5} />,
        <Rect key={`rs-b-${rail}`} x={18} y={ry + HOLE_SP + 1} width={boardW - 36} height={1.2} fill="#3498db" opacity={0.5} />
      );
      for (let col = 0; col < BB_COLS; col++) {
        const hx = 20 + col * HOLE_SP;
        for (let r = 0; r < 2; r++) {
          const hy = ry + r * HOLE_SP;
          els.push(
            <Circle key={`pr-${rail}-${col}-${r}`} x={hx} y={hy} radius={HOLE_R + 0.5} fill="#999" />,
            <Circle key={`prh-${rail}-${col}-${r}`} x={hx} y={hy} radius={HOLE_R} fill="#1a1a1a" />
          );
        }
      }
      // +/âˆ’ labels
      els.push(
        <Text key={`rl+${rail}`} x={6} y={ry - 5} text="+" fill="#e74c3c" fontSize={10} fontStyle="bold" />,
        <Text key={`rl-${rail}`} x={6} y={ry + HOLE_SP - 5} text="âˆ’" fill="#3498db" fontSize={10} fontStyle="bold" />
      );
    }

    // â”€â”€ Main hole area (rows A-E, F-J) â”€â”€
    const mainStartY = railH + 28;
    for (let section = 0; section < 2; section++) {
      for (let row = 0; row < 5; row++) {
        const label = String.fromCharCode(65 + section * 5 + row);
        const hy = mainStartY + (section * 6 + row) * HOLE_SP;
        els.push(
          <Text key={`lb-${label}`} x={5} y={hy - 4} text={label} fill="#aaa" fontSize={7} fontFamily="monospace" />
        );
        for (let col = 0; col < BB_COLS; col++) {
          const hx = 20 + col * HOLE_SP;
          els.push(
            <Circle key={`h-${section}-${row}-${col}`} x={hx} y={hy} radius={HOLE_R + 0.5} fill="#999" />,
            <Circle key={`hi-${section}-${row}-${col}`} x={hx} y={hy} radius={HOLE_R} fill="#1a1a1a" />
          );
        }
      }
    }

    // â”€â”€ Column numbers every 5 â”€â”€
    for (let col = 0; col < BB_COLS; col += 5) {
      els.push(
        <Text key={`cn-${col}`} x={17 + col * HOLE_SP} y={mainStartY - 14} text={String(col + 1)} fill="#aaa" fontSize={6} fontFamily="monospace" />
      );
    }

    return els;
  }, []);

  const mainStartY = railH + 28;
  const gapY = mainStartY + 4.5 * HOLE_SP;

  return (
    <Group>
      {/* Shadow */}
      <Rect x={3} y={3} width={boardW} height={totalH} fill="#000" opacity={0.25} cornerRadius={6} />
      {/* Board body */}
      <Rect x={0} y={0} width={boardW} height={totalH} fill="#f8f8f5" cornerRadius={5} />
      {/* Top highlight */}
      <Rect x={1} y={1} width={boardW - 2} height={totalH * 0.3} fill="#fff" opacity={0.15} cornerRadius={[5, 5, 0, 0]} />
      {/* Edge lip */}
      <Rect x={0} y={0} width={boardW} height={totalH} stroke="#d0d0cc" strokeWidth={1.5} fill="transparent" cornerRadius={5} />
      {/* Center channel */}
      <Rect x={8} y={gapY - 3} width={boardW - 16} height={HOLE_SP + 2} fill="#e8e8e4" cornerRadius={2} />
      <Rect x={10} y={gapY - 1} width={boardW - 20} height={HOLE_SP - 2} fill="#d8d8d4" cornerRadius={1} />
      {/* Branding */}
      <Text x={boardW / 2 - 30} y={gapY} text="AI DEVRE" fontSize={8} fill="#c0c0b8" fontStyle="bold" letterSpacing={3} />
      {holes}
    </Group>
  );
});

// ===== Controller Board =====
const useBoardImage = (imageUrl: string) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new window.Image();
    img.src = imageUrl;
    img.onload = () => setImage(img);
  }, [imageUrl]);
  return image;
};

const ControllerBoard: React.FC<{ board: ControllerBoardDefinition }> = React.memo(({ board }) => {
  const boardImg = useBoardImage(board.imageUrl);
  const chipWidth = board.type === 'nano' ? 28 : board.type === 'mega' ? 72 : 64;
  const chipHeight = board.type === 'nano' ? board.height * 0.38 : 36;
  const usbWidth = board.type === 'nano' ? 26 : board.type === 'mega' ? 34 : 30;
  const usbHeight = board.type === 'nano' ? 16 : 18;
  const boardRadius = board.type === 'nano' ? 14 : 18;
  const accentStripY = board.type === 'mega' ? board.height * 0.26 : board.type === 'nano' ? 22 : 28;
  const accentStripHeight = board.type === 'nano' ? board.height - 44 : 28;
  const pinRadius = board.type === 'nano' ? 2.8 : 3.1;

  return (
    <Group>
      <Rect
        x={0}
        y={0}
        width={board.width}
        height={board.height}
        fill="rgba(255,255,255,0.001)"
      />

      {boardImg ? (
        <KonvaImage
          image={boardImg}
          x={0}
          y={0}
          width={board.width}
          height={board.height}
          listening={false}
        />
      ) : (
        <>
          <Rect
            x={4}
            y={4}
            width={board.width}
            height={board.height}
            fill="#000"
            opacity={0.22}
            cornerRadius={boardRadius}
            listening={false}
          />
          <Rect
            x={0}
            y={0}
            width={board.width}
            height={board.height}
            fill={board.theme.body}
            stroke={board.theme.outline}
            strokeWidth={1.4}
            cornerRadius={boardRadius}
            listening={false}
          />
          <Rect
            x={board.type === 'nano' ? 18 : 14}
            y={accentStripY}
            width={board.type === 'nano' ? board.width - 36 : board.width - 28}
            height={accentStripHeight}
            fill={board.theme.accent}
            opacity={0.95}
            cornerRadius={board.type === 'nano' ? 10 : 12}
            listening={false}
          />
          <Rect
            x={board.type === 'mega' ? 12 : board.type === 'nano' ? (board.width - usbWidth) / 2 : 10}
            y={board.type === 'nano' ? 4 : 20}
            width={usbWidth}
            height={usbHeight}
            fill={board.theme.usb}
            stroke="#8b98a5"
            strokeWidth={1}
            cornerRadius={4}
            listening={false}
          />
          <Rect
            x={board.type === 'nano' ? (board.width - chipWidth) / 2 : board.width * 0.38}
            y={board.type === 'nano' ? board.height * 0.28 : board.height * 0.42}
            width={chipWidth}
            height={chipHeight}
            fill={board.theme.chip}
            stroke="#36455d"
            strokeWidth={1}
            cornerRadius={6}
            listening={false}
          />
          <Text
            text={board.name}
            x={board.type === 'nano' ? 14 : 18}
            y={board.type === 'mega' ? board.height * 0.1 : board.type === 'nano' ? board.height * 0.19 : board.height * 0.22}
            width={board.type === 'nano' ? board.width - 28 : board.width - 36}
            align="center"
            fontSize={board.type === 'nano' ? 11 : 12}
            fontStyle="bold"
            fill={board.theme.text}
            listening={false}
          />
          <Text
            text={board.shortName}
            x={0}
            y={board.type === 'mega' ? board.height * 0.62 : board.type === 'nano' ? board.height * 0.58 : board.height * 0.6}
            width={board.width}
            align="center"
            fontSize={board.type === 'nano' ? 15 : 18}
            fontStyle="bold"
            fill="rgba(255,255,255,0.18)"
            listening={false}
          />
        </>
      )}

      {!boardImg &&
        board.pinDefs.map((pin) => (
          <Circle
            key={`board-pin-${pin.id}`}
            x={pin.x}
            y={pin.y}
            radius={pinRadius}
            fill={board.theme.pin}
            stroke="#d6dde7"
            strokeWidth={0.45}
            listening={false}
          />
        ))}
    </Group>
  );
});

// ===== Main Canvas =====
const CircuitCanvas: React.FC = () => {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeDragRef = useRef<{ componentId: string; node: Konva.Group | null } | null>(null);
  const draggedComponentPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const breadboardDragRef = useRef<{
    startPosition: { x: number; y: number };
    attachedComponents: Array<{ id: string; x: number; y: number }>;
  } | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [middlePanActive, setMiddlePanActive] = useState(false);
  const [wiringStart, setWiringStart] = useState<{ componentId: string; pinId: string; x: number; y: number } | null>(null);
  const [wiringMouse, setWiringMouse] = useState<{ x: number; y: number } | null>(null);
  const [hoveredBreadboardHole, setHoveredBreadboardHole] = useState<BreadboardHole | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [, setDragPreviewVersion] = useState(0);

  const components = useCircuitStore((s) => s.components);
  const wires = useCircuitStore((s) => s.wires);
  const selectedComponentId = useCircuitStore((s) => s.selectedComponentId);
  const selectedWireId = useCircuitStore((s) => s.selectedWireId);
  const toolMode = useCircuitStore((s) => s.toolMode);
  const zoom = useCircuitStore((s) => s.zoom);
  const stagePos = useCircuitStore((s) => s.stagePos);
  const wireColor = useCircuitStore((s) => s.wireColor);
  const simulation = useCircuitStore((s) => s.simulation);
  const boardType = useCircuitStore((s) => s.boardType);
  const boardPosition = useCircuitStore((s) => s.boardPosition);
  const breadboardPosition = useCircuitStore((s) => s.breadboardPosition);
  const language = useCircuitStore((s) => s.language);

  const setZoom = useCircuitStore((s) => s.setZoom);
  const setStagePos = useCircuitStore((s) => s.setStagePos);
  const setToolMode = useCircuitStore((s) => s.setToolMode);
  const setRightTab = useCircuitStore((s) => s.setRightTab);
  const setBoardType = useCircuitStore((s) => s.setBoardType);
  const setBoardPosition = useCircuitStore((s) => s.setBoardPosition);
  const setBreadboardPosition = useCircuitStore((s) => s.setBreadboardPosition);
  const captureUndoSnapshot = useCircuitStore((s) => s.captureUndoSnapshot);
  const addComponent = useCircuitStore((s) => s.addComponent);
  const selectComponent = useCircuitStore((s) => s.selectComponent);
  const updateComponent = useCircuitStore((s) => s.updateComponent);
  const removeComponent = useCircuitStore((s) => s.removeComponent);
  const addWire = useCircuitStore((s) => s.addWire);
  const removeWire = useCircuitStore((s) => s.removeWire);
  const selectWire = useCircuitStore((s) => s.selectWire);
  const updateComponentProperty = useCircuitStore((s) => s.updateComponentProperty);
  const isStagePanning = toolMode === 'pan' || middlePanActive;
  const currentBoard = useMemo(() => getControllerBoardDefinition(boardType), [boardType]);
  const boardPins = useMemo(() => getControllerBoardPins(boardType), [boardType]);
  const boardPinRadius = currentBoard.pinDefs.length > 30 ? 4 : 6;
  const boardPinHoverRadius = currentBoard.pinDefs.length > 30 ? 5.5 : 8;
  const canUndo = useCircuitStore((s) => s.canUndo());
  const multimeterRedProbeImage = useAssetImage(multimeterProbeRedSvg);
  const multimeterBlackProbeImage = useAssetImage(multimeterProbeBlackSvg);
  const getRenderedComponentPosition = useCallback(
    (component: CircuitComponent) =>
      draggedComponentPositionsRef.current[component.id] ?? {
        x: component.x,
        y: component.y,
      },
    []
  );

  const resolveWireEndpointPosition = useCallback((
    componentId: string,
    pinId: string,
    availableComponents: CircuitComponent[] = components
  ) => {
    if (componentId === ARDUINO_COMPONENT_ID) {
      const pin = boardPins.find((item) => item.id === pinId);
      return pin
        ? {
            x: boardPosition.x + pin.x,
            y: boardPosition.y + pin.y,
          }
        : null;
    }

    if (componentId === BREADBOARD_COMPONENT_ID) {
      const hole = getBreadboardHoleGlobal(pinId, breadboardPosition);
      return hole ? { x: hole.x, y: hole.y } : null;
    }

    const component = availableComponents.find((item) => item.id === componentId);
    if (!component) return null;

    const pinPosition = getComponentPinWorldPosition(component, pinId);
    return pinPosition
      ? {
          x: pinPosition.x,
          y: pinPosition.y,
        }
      : null;
  }, [boardPins, boardPosition, breadboardPosition, components]);

  const getBreadboardSnapPositionForComponent = useCallback(
    (
      component: CircuitComponent,
      position: { x: number; y: number } = breadboardPosition
    ) => snapPinsToBreadboard(
      component.x,
      component.y,
      getRotatedPins(component.pins, component.rotation),
      position
    ),
    [breadboardPosition]
  );

  const resolveMultimeterProbeTargetPosition = useCallback(
    (component: CircuitComponent, slot: ProbeSlot) => {
      const keys = getProbeTargetKeys(slot);
      const targetComponentId = String(component.properties[keys.componentKey] ?? '').trim();
      const targetPinId = String(component.properties[keys.pinKey] ?? '').trim();

      if (!targetComponentId || !targetPinId) {
        return null;
      }

      return resolveWireEndpointPosition(targetComponentId, targetPinId);
    },
    [resolveWireEndpointPosition]
  );

  const getMultimeterProbeDockedWorldPosition = useCallback(
    (component: CircuitComponent, slot: ProbeSlot) => {
      const mode = getMultimeterMode(component.properties.mode);
      const tip = getProbeDockedLocalPosition(slot, mode);
      const rotated = rotatePoint(tip.x, tip.y, component.rotation);
      const position = getRenderedComponentPosition(component);

      return {
        x: position.x + rotated.x,
        y: position.y + rotated.y,
      };
    },
    [getRenderedComponentPosition]
  );

  const isMultimeterProbeDocked = useCallback(
    (component: CircuitComponent, slot: ProbeSlot) => {
      const explicitDocked = readBooleanProperty(
        component.properties[getProbeDockKey(slot)]
      );
      if (explicitDocked !== null) {
        return explicitDocked;
      }

      const keys = getProbeTargetKeys(slot);
      const hasTarget =
        String(component.properties[keys.componentKey] ?? '').trim().length > 0 &&
        String(component.properties[keys.pinKey] ?? '').trim().length > 0;

      if (hasTarget) {
        return false;
      }

      const stored = getProbeStoredWorldPosition(component, slot);
      const docked = getMultimeterProbeDockedWorldPosition(component, slot);
      const dx = stored.x - docked.x;
      const dy = stored.y - docked.y;
      return dx * dx + dy * dy <= PROBE_DOCK_SNAP_RADIUS_SQ;
    },
    [getMultimeterProbeDockedWorldPosition]
  );

  const getMultimeterProbeWorldPosition = useCallback(
    (component: CircuitComponent, slot: ProbeSlot) =>
      resolveMultimeterProbeTargetPosition(component, slot) ??
      (isMultimeterProbeDocked(component, slot)
        ? getMultimeterProbeDockedWorldPosition(component, slot)
        : getProbeStoredWorldPosition(component, slot)),
    [
      getMultimeterProbeDockedWorldPosition,
      isMultimeterProbeDocked,
      resolveMultimeterProbeTargetPosition,
    ]
  );

  const getMultimeterProbeAnchorWorldPosition = useCallback(
    (component: CircuitComponent, slot: ProbeSlot) => {
      const mode = getMultimeterMode(component.properties.mode);
      const anchor = getProbeAnchorLocalPosition(slot, mode);
      const rotated = rotatePoint(anchor.x, anchor.y, component.rotation);
      const position = getRenderedComponentPosition(component);

      return {
        x: position.x + rotated.x,
        y: position.y + rotated.y,
      };
    },
    [getRenderedComponentPosition]
  );

  const resolveProbeDockTargetPosition = useCallback(
    (
      component: CircuitComponent,
      slot: ProbeSlot,
      x: number,
      y: number
    ): { x: number; y: number } | null => {
      const dockedPosition = getMultimeterProbeDockedWorldPosition(component, slot);
      const anchorPosition = getMultimeterProbeAnchorWorldPosition(component, slot);
      const dockDx = dockedPosition.x - x;
      const dockDy = dockedPosition.y - y;
      const anchorDx = anchorPosition.x - x;
      const anchorDy = anchorPosition.y - y;

      if (
        dockDx * dockDx + dockDy * dockDy <= PROBE_DOCK_SNAP_RADIUS_SQ ||
        anchorDx * anchorDx + anchorDy * anchorDy <= PROBE_DOCK_SNAP_RADIUS_SQ
      ) {
        return dockedPosition;
      }

      return null;
    },
    [getMultimeterProbeAnchorWorldPosition, getMultimeterProbeDockedWorldPosition]
  );

  const isComponentMountedOnBreadboard = useCallback(
    (
      component: CircuitComponent,
      position: { x: number; y: number } = breadboardPosition
    ) => {
      const snapped = getBreadboardSnapPositionForComponent(component, position);
      if (!snapped) return false;

      return (
        Math.abs(snapped.x - component.x) < 0.75 &&
        Math.abs(snapped.y - component.y) < 0.75
      );
    },
    [breadboardPosition, getBreadboardSnapPositionForComponent]
  );

  const clearTransientCanvasState = useCallback(() => {
    setWiringStart(null);
    setWiringMouse(null);
    setHoveredBreadboardHole(null);
    setContextMenu(null);
  }, []);

  useEffect(() => {
    let hasChanges = false;

    const nextWires = wires.map((wire) => {
      const start = resolveWireEndpointPosition(
        wire.startComponentId,
        wire.startPinId
      );
      const end = resolveWireEndpointPosition(wire.endComponentId, wire.endPinId);

      if (!start || !end) {
        return wire;
      }

      const nextPoints =
        wire.points.length >= 4
          ? [...wire.points]
          : [start.x, start.y, end.x, end.y];

      nextPoints[0] = start.x;
      nextPoints[1] = start.y;
      nextPoints[nextPoints.length - 2] = end.x;
      nextPoints[nextPoints.length - 1] = end.y;

      const pointsChanged =
        nextPoints.length !== wire.points.length ||
        nextPoints.some((value, index) => value !== wire.points[index]);

      if (!pointsChanged) {
        return wire;
      }

      hasChanges = true;
      return { ...wire, points: nextPoints };
    });

    if (hasChanges) {
      useCircuitStore.setState({ wires: nextWires });
    }
  }, [resolveWireEndpointPosition, wires]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setStageSize({ width, height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (useCircuitStore.getState().canUndo()) {
          useCircuitStore.getState().undo();
          clearTransientCanvasState();
        }
        return;
      }

      const setToolMode = useCircuitStore.getState().setToolMode;
      const selId = useCircuitStore.getState().selectedComponentId;
      const selWireId = useCircuitStore.getState().selectedWireId;

      switch (e.key.toLowerCase()) {
        case 'v': setToolMode('select'); break;
        case 'w': setToolMode('wire'); break;
        case 'h': setToolMode('pan'); break;
        case 'd': setToolMode('delete'); break;
        case 'delete':
        case 'backspace':
          if (selId) useCircuitStore.getState().removeComponent(selId);
          if (selWireId) useCircuitStore.getState().removeWire(selWireId);
          break;
        case 'escape':
          selectComponent(null);
          selectWire(null);
          clearTransientCanvasState();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearTransientCanvasState, selectComponent, selectWire]);

  // Wheel zoom
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = zoom;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(0.2, Math.min(3, oldScale + direction * 0.1));

    setZoom(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, [zoom, stagePos]);

  // Drop handler for palette drag
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('componentType') as ComponentType;
    if (!type) return;

    const stage = stageRef.current;
    if (!stage) return;

    const rect = containerRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left - stagePos.x) / zoom;
    const y = (e.clientY - rect.top - stagePos.y) / zoom;

    const snapped = snapToBreadboard(x, y, type, undefined, breadboardPosition);
    addComponent(type, snapped.x, snapped.y);
  }, [zoom, stagePos, addComponent, breadboardPosition]);

  const getWorldPointerPosition = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;

    const pointer = stage.getPointerPosition();
    if (!pointer) return null;

    return {
      x: (pointer.x - stagePos.x) / zoom,
      y: (pointer.y - stagePos.y) / zoom,
    };
  }, [stagePos, zoom]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const openContextMenu = useCallback(
    (event: MouseEvent, target: ContextMenuTarget) => {
      event.preventDefault();

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const menuWidth = target.kind === 'board' ? 230 : 210;
      const menuHeight = target.kind === 'board' ? 250 : 220;
      const rawX = event.clientX - rect.left;
      const rawY = event.clientY - rect.top;

      const x = Math.max(8, Math.min(rawX, rect.width - menuWidth - 8));
      const y = Math.max(8, Math.min(rawY, rect.height - menuHeight - 8));

      if (target.kind === 'component') {
        selectComponent(target.componentId);
      } else if (target.kind === 'wire') {
        selectWire(target.wireId);
      } else if (selectedComponentId || selectedWireId) {
        selectComponent(null);
        selectWire(null);
      }

      setContextMenu({ x, y, target });
    },
    [selectComponent, selectWire, selectedComponentId, selectedWireId]
  );

  const resolveBreadboardHoleAtPointer = useCallback(() => {
    const pointer = getWorldPointerPosition();
    if (!pointer || !isNearBreadboardArea(pointer.x, pointer.y, breadboardPosition)) {
      return null;
    }

    const nearestHole = getNearestBreadboardHole(
      pointer.x,
      pointer.y,
      breadboardPosition
    );
    if (nearestHole.distSq > BREADBOARD_WIRE_SNAP_RADIUS_SQ) {
      return null;
    }

    return nearestHole;
  }, [breadboardPosition, getWorldPointerPosition]);

  const resolveProbeSnapTargetAtPosition = useCallback(
    (x: number, y: number, sourceComponentId: string): ProbeSnapTarget | null => {
      let bestTarget: ProbeSnapTarget | null = null;

      const considerTarget = (
        componentId: string,
        pinId: string,
        targetX: number,
        targetY: number,
        label: string
      ) => {
        const dx = targetX - x;
        const dy = targetY - y;
        const distSq = dx * dx + dy * dy;

        if (distSq > PROBE_SNAP_RADIUS_SQ) return;
        if (!bestTarget || distSq < bestTarget.distSq) {
          bestTarget = {
            componentId,
            pinId,
            x: targetX,
            y: targetY,
            label,
            distSq,
          };
        }
      };

      if (isNearBreadboardArea(x, y, breadboardPosition)) {
        const nearestHole = getNearestBreadboardHole(x, y, breadboardPosition);
        considerTarget(
          BREADBOARD_COMPONENT_ID,
          nearestHole.id,
          nearestHole.x,
          nearestHole.y,
          nearestHole.label
        );
      }

      for (const pin of boardPins) {
        considerTarget(
          ARDUINO_COMPONENT_ID,
          pin.id,
          boardPosition.x + pin.x,
          boardPosition.y + pin.y,
          pin.name
        );
      }

      for (const component of components) {
        if (component.id === sourceComponentId || component.type === 'multimeter') continue;

        for (const pin of component.pins) {
          const pinWorldPosition = getComponentPinWorldPosition(component, pin.id);
          if (!pinWorldPosition) continue;

          considerTarget(
            component.id,
            pin.id,
            pinWorldPosition.x,
            pinWorldPosition.y,
            pin.name
          );
        }
      }

      return bestTarget;
    },
    [boardPins, boardPosition, breadboardPosition, components]
  );

  const resetViewport = useCallback(() => {
    setZoom(1);
    setStagePos({ x: 0, y: 0 });
  }, [setStagePos, setZoom]);

  const persistMultimeterProbePosition = useCallback(
    (
      component: CircuitComponent,
      slot: ProbeSlot,
      nextPosition: { x: number; y: number },
      target: ProbeSnapTarget | null,
      docked: boolean
    ) => {
      const keys = getProbeTargetKeys(slot);
      const prefix = slot === 'black' ? 'blackProbe' : 'redProbe';
      const dockKey = getProbeDockKey(slot);

      updateComponent(component.id, {
        properties: {
          ...component.properties,
          [`${prefix}X`]: nextPosition.x,
          [`${prefix}Y`]: nextPosition.y,
          [dockKey]: docked,
          [keys.componentKey]: target?.componentId ?? '',
          [keys.pinKey]: target?.pinId ?? '',
        },
      });
    },
    [updateComponent]
  );

  const handleMultimeterProbeDragStart = useCallback(
    (componentId: string) => {
      closeContextMenu();
      selectComponent(componentId);
      selectWire(null);
      setRightTab('properties');
    },
    [closeContextMenu, selectComponent, selectWire, setRightTab]
  );

  const handleMultimeterProbeDragEnd = useCallback(
    (
      component: CircuitComponent,
      slot: ProbeSlot,
      event: Konva.KonvaEventObject<DragEvent>
    ) => {
      const currentPosition = {
        x: event.target.x(),
        y: event.target.y(),
      };
      const dockedPosition = resolveProbeDockTargetPosition(
        component,
        slot,
        currentPosition.x,
        currentPosition.y
      );
      if (dockedPosition) {
        event.target.x(dockedPosition.x);
        event.target.y(dockedPosition.y);
        persistMultimeterProbePosition(component, slot, dockedPosition, null, true);
        return;
      }

      const target = resolveProbeSnapTargetAtPosition(
        currentPosition.x,
        currentPosition.y,
        component.id
      );
      const nextPosition = target
        ? { x: target.x, y: target.y }
        : {
            x: snapToGrid(currentPosition.x),
            y: snapToGrid(currentPosition.y),
          };

      event.target.x(nextPosition.x);
      event.target.y(nextPosition.y);
      persistMultimeterProbePosition(component, slot, nextPosition, target, false);
    },
    [
      persistMultimeterProbePosition,
      resolveProbeDockTargetPosition,
      resolveProbeSnapTargetAtPosition,
    ]
  );

  // Component click
  const handleComponentClick = useCallback((
    comp: CircuitComponent,
    event?: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) => {
    if (event) {
      event.cancelBubble = true;
    }

    closeContextMenu();
    if (toolMode !== 'delete') {
      selectComponent(comp.id);
      selectWire(null);
      setRightTab('properties');
    }

    if (toolMode === 'select') {
      // Toggle button press on click during simulation
      if (comp.type === 'button' && simulation.running) {
        updateComponentProperty(comp.id, 'pressed', !comp.properties.pressed);
      }
      if (comp.type === 'switch') {
        updateComponentProperty(comp.id, 'closed', !comp.properties.closed);
      }
    } else if (toolMode === 'delete') {
      removeComponent(comp.id);
    }
  }, [toolMode, simulation.running, closeContextMenu, selectComponent, selectWire, setRightTab, updateComponentProperty, removeComponent]);

  // Pin click (wiring)
  const handlePinClick = useCallback((componentId: string, pinId: string, globalX: number, globalY: number) => {
    if (toolMode !== 'wire') return;

    if (!wiringStart) {
      setWiringStart({ componentId, pinId, x: globalX, y: globalY });
    } else {
      if (wiringStart.componentId !== componentId || wiringStart.pinId !== pinId) {
        addWire({
          startComponentId: wiringStart.componentId,
          startPinId: wiringStart.pinId,
          endComponentId: componentId,
          endPinId: pinId,
          color: wireColor,
          points: [wiringStart.x, wiringStart.y, globalX, globalY],
        });
      }
      setWiringStart(null);
      setWiringMouse(null);
    }
  }, [toolMode, wiringStart, wireColor, addWire]);

  // Stage click
  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === 'background';
    if (clickedOnEmpty) {
      closeContextMenu();
      if (toolMode === 'wire') {
        const hole = resolveBreadboardHoleAtPointer();
        if (hole) {
          handlePinClick(BREADBOARD_COMPONENT_ID, hole.id, hole.x, hole.y);
          return;
        }
      }

      selectComponent(null);
      selectWire(null);
      if (wiringStart) {
        setWiringStart(null);
        setWiringMouse(null);
      }
    }
  }, [toolMode, wiringStart, handlePinClick, resolveBreadboardHoleAtPointer, selectComponent, selectWire, closeContextMenu]);

  // Mouse move for wiring preview
  const handleMouseMove = useCallback((_e: Konva.KonvaEventObject<MouseEvent>) => {
    if (toolMode === 'wire') {
      const pointer = getWorldPointerPosition();
      const hoveredHole = resolveBreadboardHoleAtPointer();
      setHoveredBreadboardHole(hoveredHole);

      if (wiringStart && pointer) {
        setWiringMouse(
          hoveredHole
            ? { x: hoveredHole.x, y: hoveredHole.y }
            : pointer
        );
      }
      return;
    }

    setHoveredBreadboardHole(null);
  }, [toolMode, wiringStart, getWorldPointerPosition, resolveBreadboardHoleAtPointer]);

  const finalizeComponentDrag = useCallback((comp: CircuitComponent, node: Konva.Group) => {
    const snapped = snapToBreadboard(
      node.x(),
      node.y(),
      comp.type,
      comp.pins,
      breadboardPosition,
      comp.rotation
    );
    const newX = snapped.x;
    const newY = snapped.y;
    node.x(newX);
    node.y(newY);
    updateComponent(comp.id, { x: newX, y: newY });
  }, [breadboardPosition, updateComponent]);

  useEffect(() => {
    const win = window;

    win.snapToBreadboard = (
      x: number,
      y: number,
      type?: string,
      pins?: Array<{ x: number; y: number }>,
      rotation?: number
    ) => snapToBreadboard(x, y, type, pins, breadboardPosition, rotation);
    return () => {
      delete win.snapToBreadboard;
    };
  }, [breadboardPosition]);

  useEffect(() => {
    const handleExportCanvas = async () => {
      const stage = stageRef.current;
      if (!stage) return;

      const dataUrl = stage.toDataURL({ pixelRatio: 2 });

      if (window.electronAPI?.exportPng) {
        await window.electronAPI.exportPng(dataUrl, {
          title: t(language, 'exportPngDialogTitle'),
          defaultPath: t(language, 'pngFileName'),
          filterName: t(language, 'pngFilterName'),
        });
        return;
      }

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = t(language, 'pngFileName');
      link.click();
    };

    window.addEventListener('export-canvas-png', handleExportCanvas);
    return () => {
      window.removeEventListener('export-canvas-png', handleExportCanvas);
    };
  }, [language]);

  const stopMiddlePan = useCallback(() => {
    if (!middlePanActive) return;

    const stage = stageRef.current;
    if (stage) {
      if (stage.isDragging()) {
        stage.stopDrag();
      }
      setStagePos({ x: stage.x(), y: stage.y() });
      stage.draggable(toolMode === 'pan');
    }

    setMiddlePanActive(false);
  }, [middlePanActive, toolMode, setStagePos]);

  useEffect(() => {
    const handlePointerRelease = () => {
      const activeDrag = activeDragRef.current;
      if (!activeDrag?.node || !activeDrag.node.isDragging()) return;

      const currentComp = useCircuitStore.getState().components.find((item) => item.id === activeDrag.componentId);
      if (!currentComp) {
        activeDragRef.current = null;
        return;
      }

      activeDrag.node.stopDrag();
      activeDragRef.current = null;
      finalizeComponentDrag(currentComp, activeDrag.node);
      if (currentComp.type === 'multimeter') {
        delete draggedComponentPositionsRef.current[currentComp.id];
        setDragPreviewVersion((version) => version + 1);
      }
    };

    window.addEventListener('mouseup', handlePointerRelease);
    window.addEventListener('touchend', handlePointerRelease);

    return () => {
      window.removeEventListener('mouseup', handlePointerRelease);
      window.removeEventListener('touchend', handlePointerRelease);
    };
  }, [finalizeComponentDrag]);

  useEffect(() => {
    const handleMiddleRelease = () => stopMiddlePan();

    window.addEventListener('mouseup', handleMiddleRelease);
    window.addEventListener('blur', handleMiddleRelease);

    return () => {
      window.removeEventListener('mouseup', handleMiddleRelease);
      window.removeEventListener('blur', handleMiddleRelease);
    };
  }, [stopMiddlePan]);

  useEffect(() => {
    clearTransientCanvasState();
  }, [boardType, clearTransientCanvasState]);

  useEffect(() => {
    const handleDismiss = () => setContextMenu(null);

    window.addEventListener('resize', handleDismiss);
    window.addEventListener('scroll', handleDismiss, true);

    return () => {
      window.removeEventListener('resize', handleDismiss);
      window.removeEventListener('scroll', handleDismiss, true);
    };
  }, []);

  useEffect(() => {
    if (!contextMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      const menu = containerRef.current?.querySelector('.context-menu');
      if (menu?.contains(event.target as Node)) return;
      setContextMenu(null);
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [contextMenu]);

  const handleStageMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 2) {
      setContextMenu(null);
    }

    if (e.evt.button !== 1) return;

    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    setMiddlePanActive(true);
    stage.draggable(true);
    stage.startDrag();
  }, []);

  const handleDragStart = useCallback((comp: CircuitComponent, e: Konva.KonvaEventObject<DragEvent>) => {
    closeContextMenu();
    activeDragRef.current = {
      componentId: comp.id,
      node: e.target as Konva.Group,
    };
    selectComponent(comp.id);
    selectWire(null);
    setRightTab('properties');
  }, [closeContextMenu, selectComponent, selectWire, setRightTab]);

  const handleDragMove = useCallback((comp: CircuitComponent, e: Konva.KonvaEventObject<DragEvent>) => {
    if (comp.type !== 'multimeter') return;

    const nextPosition = {
      x: e.target.x(),
      y: e.target.y(),
    };
    const previousPosition = draggedComponentPositionsRef.current[comp.id];

    if (
      previousPosition &&
      previousPosition.x === nextPosition.x &&
      previousPosition.y === nextPosition.y
    ) {
      return;
    }

    draggedComponentPositionsRef.current[comp.id] = nextPosition;
    setDragPreviewVersion((version) => version + 1);
  }, []);

  const handleDragEnd = useCallback((comp: CircuitComponent, e: Konva.KonvaEventObject<DragEvent>) => {
    if (comp.type === 'multimeter') {
      draggedComponentPositionsRef.current[comp.id] = {
        x: e.target.x(),
        y: e.target.y(),
      };
    }
    activeDragRef.current = null;
    finalizeComponentDrag(comp, e.target as Konva.Group);
    if (comp.type === 'multimeter') {
      delete draggedComponentPositionsRef.current[comp.id];
      setDragPreviewVersion((version) => version + 1);
    }
  }, [finalizeComponentDrag]);

  const handleBoardDragStart = useCallback(() => {
    captureUndoSnapshot();
    closeContextMenu();
    selectComponent(null);
    selectWire(null);
  }, [captureUndoSnapshot, closeContextMenu, selectComponent, selectWire]);

  const handleBoardDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      setBoardPosition({ x: e.target.x(), y: e.target.y() });
    },
    [setBoardPosition]
  );

  const handleBoardDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const nextPosition = {
        x: snapToGrid(e.target.x()),
        y: snapToGrid(e.target.y()),
      };
      e.target.x(nextPosition.x);
      e.target.y(nextPosition.y);
      setBoardPosition(nextPosition);
    },
    [setBoardPosition]
  );

  const handleBreadboardDragStart = useCallback(() => {
    captureUndoSnapshot();
    closeContextMenu();
    selectComponent(null);
    selectWire(null);
    breadboardDragRef.current = {
      startPosition: { ...breadboardPosition },
      attachedComponents: components
        .filter((component) => isComponentMountedOnBreadboard(component))
        .map((component) => ({
          id: component.id,
          x: component.x,
          y: component.y,
        })),
    };
  }, [
    breadboardPosition,
    captureUndoSnapshot,
    closeContextMenu,
    components,
    isComponentMountedOnBreadboard,
    selectComponent,
    selectWire,
  ]);

  const handleBreadboardDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const nextPosition = { x: e.target.x(), y: e.target.y() };
      const dragState = breadboardDragRef.current;
      setBreadboardPosition(nextPosition);

      if (!dragState || dragState.attachedComponents.length === 0) {
        return;
      }

      const dx = nextPosition.x - dragState.startPosition.x;
      const dy = nextPosition.y - dragState.startPosition.y;
      const attachedMap = new Map(
        dragState.attachedComponents.map((component) => [component.id, component])
      );

      useCircuitStore.setState((state) => ({
        components: state.components.map((component) => {
          const attached = attachedMap.get(component.id);
          if (!attached) return component;

          return {
            ...component,
            x: attached.x + dx,
            y: attached.y + dy,
          };
        }),
      }));
    },
    [setBreadboardPosition]
  );

  const handleBreadboardDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const nextPosition = {
        x: snapToGrid(e.target.x()),
        y: snapToGrid(e.target.y()),
      };
      const dragState = breadboardDragRef.current;
      const dx = dragState
        ? nextPosition.x - dragState.startPosition.x
        : 0;
      const dy = dragState
        ? nextPosition.y - dragState.startPosition.y
        : 0;

      e.target.x(nextPosition.x);
      e.target.y(nextPosition.y);
      setBreadboardPosition(nextPosition);

      if (dragState?.attachedComponents.length) {
        const attachedMap = new Map(
          dragState.attachedComponents.map((component) => [component.id, component])
        );

        useCircuitStore.setState((state) => ({
          components: state.components.map((component) => {
            const attached = attachedMap.get(component.id);
            if (!attached) return component;

            const translated = {
              x: attached.x + dx,
              y: attached.y + dy,
            };
            const snapped = snapPinsToBreadboard(
              translated.x,
              translated.y,
              getRotatedPins(component.pins, component.rotation),
              nextPosition
            );

            return {
              ...component,
              x: snapped?.x ?? translated.x,
              y: snapped?.y ?? translated.y,
            };
          }),
        }));
      }

      breadboardDragRef.current = null;
    },
    [setBreadboardPosition]
  );

  const activeBreadboardHole =
    wiringStart?.componentId === BREADBOARD_COMPONENT_ID
      ? getBreadboardHoleGlobal(wiringStart.pinId, breadboardPosition)
      : null;

  // Memoized grid dots
  const gridDots = useMemo(() =>
    Array.from({ length: 100 }, (_, i) =>
      Array.from({ length: 80 }, (_, j) => (
        <Circle key={`g-${i}-${j}`} x={i * 20} y={j * 20} radius={0.5} fill="#1e1e3a" listening={false} />
      ))
    ), []);

  const componentTarget: Extract<ContextMenuTarget, { kind: 'component' }> | null =
    contextMenu?.target.kind === 'component' ? contextMenu.target : null;
  const wireTarget: Extract<ContextMenuTarget, { kind: 'wire' }> | null =
    contextMenu?.target.kind === 'wire' ? contextMenu.target : null;

  const selectedComponent =
    componentTarget
      ? components.find((comp) => comp.id === componentTarget.componentId) ?? null
      : null;

  const selectedWire =
    wireTarget
      ? wires.find((wire) => wire.id === wireTarget.wireId) ?? null
      : null;

  const renderContextMenuItems = () => {
    if (!contextMenu) return null;

    const action = (handler: () => void) => () => {
      handler();
      setContextMenu(null);
    };

    switch (contextMenu.target.kind) {
      case 'component':
        if (!selectedComponent) return null;
        return (
          <>
            <button className="context-menu-item" onClick={action(() => {
              selectComponent(selectedComponent.id);
              selectWire(null);
              setRightTab('properties');
            })}>
              <span>{t(language, 'select')}</span>
            </button>
            <button className="context-menu-item" onClick={action(() => {
              selectComponent(selectedComponent.id);
              selectWire(null);
              setToolMode('wire');
            })}>
              <span>{t(language, 'startWire')}</span>
            </button>
            <button className="context-menu-item" onClick={action(() => {
              const nextRotation = (selectedComponent.rotation + 90) % 360;
              const snapped = snapPinsToBreadboard(
                selectedComponent.x,
                selectedComponent.y,
                getRotatedPins(selectedComponent.pins, nextRotation),
                breadboardPosition
              );

              updateComponent(selectedComponent.id, {
                rotation: nextRotation,
                ...(snapped ? { x: snapped.x, y: snapped.y } : {}),
              });
            })}>
              <span>{t(language, 'rotate90')}</span>
            </button>
            <div className="context-menu-divider" />
            <button className="context-menu-item danger" onClick={action(() => {
              removeComponent(selectedComponent.id);
            })}>
              <span>{t(language, 'deleteTool')}</span>
            </button>
          </>
        );
      case 'wire':
        if (!selectedWire) return null;
        return (
          <>
            <button className="context-menu-item" onClick={action(() => {
              selectWire(selectedWire.id);
              selectComponent(null);
            })}>
              <span>{t(language, 'select')}</span>
            </button>
            <button className="context-menu-item" onClick={action(() => {
              setToolMode('wire');
              selectWire(selectedWire.id);
            })}>
              <span>{t(language, 'wireMode')}</span>
            </button>
            <div className="context-menu-divider" />
            <button className="context-menu-item danger" onClick={action(() => {
              removeWire(selectedWire.id);
            })}>
              <span>{t(language, 'deleteWire')}</span>
            </button>
          </>
        );
      case 'board':
        return (
          <>
            <div className="context-menu-label">{t(language, 'chooseBoard')}</div>
            {CONTROLLER_BOARD_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`context-menu-item${boardType === option.value ? ' active' : ''}`}
                onClick={action(() => {
                  setBoardType(option.value as ControllerBoardType);
                })}
              >
                <span>{option.label}</span>
              </button>
            ))}
            <div className="context-menu-divider" />
            <button className="context-menu-item" onClick={action(() => setToolMode('wire'))}>
              <span>{t(language, 'switchToWireMode')}</span>
            </button>
          </>
        );
      case 'background':
      default:
        return (
          <>
            <button className="context-menu-item" onClick={action(() => setToolMode('select'))}>
              <span>{t(language, 'selectionTool')}</span>
            </button>
            <button className="context-menu-item" onClick={action(() => setToolMode('wire'))}>
              <span>{t(language, 'wireToolMenu')}</span>
            </button>
            <button className="context-menu-item" onClick={action(() => setToolMode('pan'))}>
              <span>{t(language, 'pan')}</span>
            </button>
            <div className="context-menu-divider" />
            <button
              className={`context-menu-item${canUndo ? '' : ' disabled'}`}
              disabled={!canUndo}
              onClick={action(() => {
                if (useCircuitStore.getState().canUndo()) {
                  useCircuitStore.getState().undo();
                }
              })}
            >
              <span>{t(language, 'undo')}</span>
            </button>
            <button className="context-menu-item" onClick={action(resetViewport)}>
              <span>Zoom 100%</span>
            </button>
            <button className="context-menu-item" onClick={action(() => setRightTab('ai'))}>
              <span>{t(language, 'openAIPanel')}</span>
            </button>
          </>
        );
    }
  };

  return (
    <div
      ref={containerRef}
      className={`canvas-container mode-${toolMode}${middlePanActive ? ' middle-pan' : ''}`}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        scaleX={zoom}
        scaleY={zoom}
        x={stagePos.x}
        y={stagePos.y}
        draggable={isStagePanning}
        onDragEnd={(e) => {
          if (isStagePanning) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredBreadboardHole(null)}
        onContextMenu={(e) => {
          const targetName = e.target.name();
          const clickedOnEmpty = e.target === e.target.getStage() || targetName === 'background';
          if (!clickedOnEmpty) return;
          e.evt.preventDefault();
          openContextMenu(e.evt, { kind: 'background' });
        }}
      >
        <Layer>
          {/* Background */}
          <Rect
            name="background"
            x={-5000}
            y={-5000}
            width={10000}
            height={10000}
            fill="#0e0e1e"
          />

          {/* Grid dots â€” memoized */}
          {gridDots}

          {/* Controller board */}
          <Group
            x={boardPosition.x}
            y={boardPosition.y}
            draggable={toolMode === 'select' && !middlePanActive}
            onDragStart={handleBoardDragStart}
            onDragMove={handleBoardDragMove}
            onDragEnd={handleBoardDragEnd}
            onContextMenu={(e) => {
              e.evt.preventDefault();
              e.cancelBubble = true;
              openContextMenu(e.evt, { kind: 'board' });
            }}
          >
            <ControllerBoard board={currentBoard} />

            {/* Board clickable pins */}
            {toolMode === 'wire' &&
              boardPins.map((pin) => (
              <Circle
                key={pin.id}
                x={pin.x}
                y={pin.y}
                radius={boardPinRadius}
                fill="transparent"
                stroke={wiringStart?.componentId === ARDUINO_COMPONENT_ID && wiringStart?.pinId === pin.id ? '#fff' : 'transparent'}
                strokeWidth={1}
                onClick={(e) => {
                  e.cancelBubble = true;
                  handlePinClick(
                    ARDUINO_COMPONENT_ID,
                    pin.id,
                    boardPosition.x + pin.x,
                    boardPosition.y + pin.y
                  );
                }}
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  e.cancelBubble = true;
                  openContextMenu(e.evt, { kind: 'board' });
                }}
                onMouseEnter={(e) => {
                  const target = e.target as Konva.Circle;
                  target.stroke('#4ecca3');
                  target.radius(boardPinHoverRadius);
                  target.getLayer()?.batchDraw();
                }}
                onMouseLeave={(e) => {
                  const target = e.target as Konva.Circle;
                  target.stroke('transparent');
                  target.radius(boardPinRadius);
                  target.getLayer()?.batchDraw();
                }}
              />
            ))}
          </Group>

          {/* Breadboard */}
          <Group
            x={breadboardPosition.x}
            y={breadboardPosition.y}
            draggable={toolMode === 'select' && !middlePanActive}
            listening={toolMode === 'select'}
            onDragStart={handleBreadboardDragStart}
            onDragMove={handleBreadboardDragMove}
            onDragEnd={handleBreadboardDragEnd}
          >
            <Breadboard />
          </Group>

          {toolMode === 'wire' && hoveredBreadboardHole && (
            <Group listening={false}>
              <Circle
                x={hoveredBreadboardHole.x}
                y={hoveredBreadboardHole.y}
                radius={8}
                fill="rgba(78, 204, 163, 0.18)"
                stroke="#4ecca3"
                strokeWidth={1.4}
              />
              <Text
                text={hoveredBreadboardHole.label}
                x={hoveredBreadboardHole.x - 14}
                y={hoveredBreadboardHole.y - 18}
                width={28}
                align="center"
                fontSize={7}
                fill="#d5f5ea"
              />
            </Group>
          )}

          {toolMode === 'wire' && activeBreadboardHole && (
            <Circle
              x={activeBreadboardHole.x}
              y={activeBreadboardHole.y}
              radius={9}
              fill="rgba(255, 255, 255, 0.16)"
              stroke="#ffffff"
              strokeWidth={1.5}
              listening={false}
            />
          )}

          {/* Wires â€” 3D style */}
          {wires.map((wire) => {
            const isWireSelected = selectedWireId === wire.id;
            return (
              <Group key={wire.id}>
                {/* Shadow */}
                <Line points={wire.points.map((v, i) => i % 2 === 1 ? v + 1.5 : v)} stroke="#000" strokeWidth={4} opacity={0.2} lineCap="round" lineJoin="round" listening={false} />
                {/* Main cable */}
                <Line points={wire.points} stroke={wire.color} strokeWidth={3.2} lineCap="round" lineJoin="round" hitStrokeWidth={12}
                  onClick={() => {
                    if (toolMode === 'delete') { removeWire(wire.id); }
                    else {
                      selectWire(wire.id);
                      selectComponent(null);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.evt.preventDefault();
                    e.cancelBubble = true;
                    openContextMenu(e.evt, { kind: 'wire', wireId: wire.id });
                  }}
                />
                {/* Highlight stripe */}
                <Line points={wire.points.map((v, i) => i % 2 === 1 ? v - 0.6 : v)} stroke="#fff" strokeWidth={0.8} opacity={0.25} lineCap="round" lineJoin="round" listening={false} />
                {/* Selection indicator */}
                {isWireSelected && (
                  <Line points={wire.points} stroke="#fff" strokeWidth={5} dash={[4, 4]} opacity={0.5} lineCap="round" lineJoin="round" listening={false} />
                )}
                {/* End caps */}
                {wire.points.length >= 4 && (
                  <>
                    <Circle x={wire.points[0]} y={wire.points[1]} radius={2.5} fill={wire.color} stroke="#000" strokeWidth={0.5} listening={false} />
                    <Circle x={wire.points[wire.points.length - 2]} y={wire.points[wire.points.length - 1]} radius={2.5} fill={wire.color} stroke="#000" strokeWidth={0.5} listening={false} />
                  </>
                )}
              </Group>
            );
          })}

          {/* Wiring preview line */}
          {wiringStart && wiringMouse && (
            <Group>
              <Line points={[wiringStart.x, wiringStart.y, wiringMouse.x, wiringMouse.y]} stroke="#000" strokeWidth={4} opacity={0.15} lineCap="round" listening={false} />
              <Line points={[wiringStart.x, wiringStart.y, wiringMouse.x, wiringMouse.y]} stroke={wireColor} strokeWidth={2.5} dash={[6, 4]} lineCap="round" listening={false} />
            </Group>
          )}

          {/* Components */}
          {components.map((comp) => (
            <Group
              key={comp.id}
              x={comp.x}
              y={comp.y}
              rotation={comp.rotation}
              draggable={toolMode === 'select' && !middlePanActive}
              onDragStart={(e) => handleDragStart(comp, e)}
              onDragMove={(e) => handleDragMove(comp, e)}
              onDragEnd={(e) => handleDragEnd(comp, e)}
              onClick={(e) => handleComponentClick(comp, e)}
              onTap={(e) => handleComponentClick(comp, e)}
              onContextMenu={(e) => {
                e.evt.preventDefault();
                e.cancelBubble = true;
                openContextMenu(e.evt, { kind: 'component', componentId: comp.id });
              }}
            >
              <ComponentShape
                comp={comp}
                isSelected={selectedComponentId === comp.id}
                simulation={simulation}
                language={language}
              />
              {/* Clickable pin areas (for wiring) */}
              {toolMode === 'wire' &&
                getWirePinHandles(comp.pins).map((handle) => {
                  const isSelectedPin =
                    wiringStart?.componentId === comp.id &&
                    wiringStart?.pinId === handle.pin.id;
                  const pinWorldPosition = getComponentPinWorldPosition(
                    comp,
                    handle.pin.id
                  );

                  return (
                    <Group key={handle.pin.id}>
                      {handle.expanded && (
                        <>
                          <Line
                            points={[
                              handle.pin.x,
                              handle.pin.y,
                              handle.targetX,
                              handle.targetY,
                            ]}
                            stroke="#4ecca3"
                            strokeWidth={1.5}
                            dash={[3, 3]}
                            opacity={0.65}
                            listening={false}
                          />
                          <Circle
                            x={handle.pin.x}
                            y={handle.pin.y}
                            radius={3}
                            fill="#4ecca3"
                            opacity={0.9}
                            listening={false}
                          />
                          <Text
                            text={handle.label}
                            x={handle.targetX - 12}
                            y={handle.targetY - 18}
                            width={24}
                            align="center"
                            fontSize={7}
                            fill="#d5f5ea"
                            listening={false}
                          />
                        </>
                      )}
                      <Circle
                        x={handle.targetX}
                        y={handle.targetY}
                        radius={
                          handle.expanded
                            ? WIRE_PIN_FANOUT_RADIUS
                            : WIRE_PIN_RADIUS
                        }
                        fill={
                          isSelectedPin
                            ? 'rgba(255, 255, 255, 0.28)'
                            : 'rgba(78, 204, 163, 0.2)'
                        }
                        stroke={isSelectedPin ? '#fff' : '#4ecca3'}
                        strokeWidth={isSelectedPin ? 1.8 : 1.2}
                        hitStrokeWidth={18}
                        onClick={(e) => {
                          e.cancelBubble = true;
                          if (!pinWorldPosition) return;
                          handlePinClick(
                            comp.id,
                            handle.pin.id,
                            pinWorldPosition.x,
                            pinWorldPosition.y
                          );
                        }}
                        onTap={(e) => {
                          e.cancelBubble = true;
                          if (!pinWorldPosition) return;
                          handlePinClick(
                            comp.id,
                            handle.pin.id,
                            pinWorldPosition.x,
                            pinWorldPosition.y
                          );
                        }}
                      />
                    </Group>
                  );
                })}

              {/* Component name label */}
              <Text
                text={getCanvasComponentLabel(comp.type)}
                x={-20}
                y={25}
                width={40}
                align="center"
                fontSize={7}
                fill="#666"
                listening={false}
              />
            </Group>
          ))}

          {components
            .filter((comp) => comp.type === 'multimeter')
            .map((comp) => {
              const blackTip = getMultimeterProbeWorldPosition(comp, 'black');
              const redTip = getMultimeterProbeWorldPosition(comp, 'red');
              const blackAnchor = getMultimeterProbeAnchorWorldPosition(comp, 'black');
              const redAnchor = getMultimeterProbeAnchorWorldPosition(comp, 'red');
              const mode = getMultimeterMode(comp.properties.mode);
              const blackRotation =
                (Math.atan2(blackTip.y - blackAnchor.y, blackTip.x - blackAnchor.x) * 180) /
                  Math.PI -
                90;
              const redRotation =
                (Math.atan2(redTip.y - redAnchor.y, redTip.x - redAnchor.x) * 180) / Math.PI - 90;

              return (
                <Group key={`${comp.id}-multimeter-probes`}>
                  <Line
                    points={[
                      blackAnchor.x,
                      blackAnchor.y,
                      blackAnchor.x - 26,
                      blackAnchor.y + 12,
                      blackTip.x - 12,
                      blackTip.y - 28,
                      blackTip.x,
                      blackTip.y,
                    ]}
                    stroke="#05070a"
                    strokeWidth={4.4}
                    opacity={0.25}
                    bezier
                    lineCap="round"
                    listening={false}
                  />
                  <Line
                    points={[
                      blackAnchor.x,
                      blackAnchor.y,
                      blackAnchor.x - 24,
                      blackAnchor.y + 10,
                      blackTip.x - 10,
                      blackTip.y - 30,
                      blackTip.x,
                      blackTip.y,
                    ]}
                    stroke="#10161d"
                    strokeWidth={2.6}
                    bezier
                    lineCap="round"
                    listening={false}
                  />
                  <Line
                    points={[
                      redAnchor.x,
                      redAnchor.y,
                      redAnchor.x + (mode === 'current' ? -18 : 18),
                      redAnchor.y + 10,
                      redTip.x + 10,
                      redTip.y - 30,
                      redTip.x,
                      redTip.y,
                    ]}
                    stroke="#140406"
                    strokeWidth={4.4}
                    opacity={0.24}
                    bezier
                    lineCap="round"
                    listening={false}
                  />
                  <Line
                    points={[
                      redAnchor.x,
                      redAnchor.y,
                      redAnchor.x + (mode === 'current' ? -16 : 16),
                      redAnchor.y + 8,
                      redTip.x + 8,
                      redTip.y - 30,
                      redTip.x,
                      redTip.y,
                    ]}
                    stroke="#c94457"
                    strokeWidth={2.6}
                    bezier
                    lineCap="round"
                    listening={false}
                  />

                  <Group
                    x={blackTip.x}
                    y={blackTip.y}
                    offsetX={0}
                    offsetY={0}
                    rotation={blackRotation}
                    draggable={toolMode === 'select' && !middlePanActive}
                    onDragStart={() => handleMultimeterProbeDragStart(comp.id)}
                    onDragEnd={(event) => handleMultimeterProbeDragEnd(comp, 'black', event)}
                    onMouseDown={(event) => {
                      event.cancelBubble = true;
                    }}
                    onTouchStart={(event) => {
                      event.cancelBubble = true;
                    }}
                  >
                    <Circle radius={8} fill="rgba(255,255,255,0.001)" />
                    {multimeterBlackProbeImage && (
                      <KonvaImage
                        image={multimeterBlackProbeImage}
                        x={-PROBE_IMAGE_WIDTH / 2}
                        y={-PROBE_IMAGE_HEIGHT + 4}
                        width={PROBE_IMAGE_WIDTH}
                        height={PROBE_IMAGE_HEIGHT}
                      />
                    )}
                  </Group>

                  <Group
                    x={redTip.x}
                    y={redTip.y}
                    offsetX={0}
                    offsetY={0}
                    rotation={redRotation}
                    draggable={toolMode === 'select' && !middlePanActive}
                    onDragStart={() => handleMultimeterProbeDragStart(comp.id)}
                    onDragEnd={(event) => handleMultimeterProbeDragEnd(comp, 'red', event)}
                    onMouseDown={(event) => {
                      event.cancelBubble = true;
                    }}
                    onTouchStart={(event) => {
                      event.cancelBubble = true;
                    }}
                  >
                    <Circle radius={8} fill="rgba(255,255,255,0.001)" />
                    {multimeterRedProbeImage && (
                      <KonvaImage
                        image={multimeterRedProbeImage}
                        x={-PROBE_IMAGE_WIDTH / 2}
                        y={-PROBE_IMAGE_HEIGHT + 4}
                        width={PROBE_IMAGE_WIDTH}
                        height={PROBE_IMAGE_HEIGHT}
                      />
                    )}
                  </Group>
                </Group>
              );
            })}
        </Layer>
      </Stage>

      {/* Zoom indicator */}
      <div className="zoom-info">
        {Math.round(zoom * 100)}% | {t(language, 'componentsLabel')}: {components.length} | {t(language, 'wiresLabel')}: {wires.length}
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(e) => e.preventDefault()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {renderContextMenuItems()}
        </div>
      )}
    </div>
  );
};

export default CircuitCanvas;

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Stage, Layer, Group, Rect, Line, Circle, Text, Image as KonvaImage } from 'react-konva';
import { useCircuitStore } from '../store/circuitStore';
import { CircuitComponent, ComponentType, Pin, getDefaultPins } from '../models/types';
import {
  ARDUINO_COMPONENT_ID,
  ARDUINO_X,
  ARDUINO_Y,
  CONTROLLER_BOARD_OPTIONS,
  getControllerBoardDefinition,
  getControllerBoardPins,
  type ControllerBoardDefinition,
  type ControllerBoardType,
} from '../models/arduinoUno';
import {
  BREADBOARD_COMPONENT_ID,
  BREADBOARD_HOLE_MAP,
  type BreadboardHole,
  BB_BOTTOM,
  BB_COLS,
  BB_RIGHT,
  BB_X,
  BB_Y,
  HOLE_R,
  HOLE_SP,
  RAIL_H,
  getNearestBreadboardHole,
} from '../models/breadboard';
import type Konva from 'konva';
import { useComponentImage, SVG_CONFIGS } from '../hooks/useComponentImages';
import { t } from '../lib/i18n';

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

function isNearBreadboardArea(x: number, y: number): boolean {
  return x >= BB_X - 24 && x <= BB_RIGHT + 24 && y >= BB_Y - 24 && y <= BB_BOTTOM + 24;
}

function snapPinsToBreadboard(x: number, y: number, pins: Array<{ x: number; y: number }>): { x: number; y: number } | null {
  if (pins.length === 0) return null;

  let bestCandidate: { x: number; y: number; score: number } | null = null;

  for (const anchorPin of pins) {
    const anchorGlobalX = x + anchorPin.x;
    const anchorGlobalY = y + anchorPin.y;
    const nearestHole = getNearestBreadboardHole(anchorGlobalX, anchorGlobalY);

    if (!isNearBreadboardArea(anchorGlobalX, anchorGlobalY) && nearestHole.distSq > SNAP_RADIUS_SQ) {
      continue;
    }

    const candidateX = nearestHole.x - anchorPin.x;
    const candidateY = nearestHole.y - anchorPin.y;
    let score = 0;

    for (const pin of pins) {
      const pinGlobalX = candidateX + pin.x;
      const pinGlobalY = candidateY + pin.y;
      const snappedHole = getNearestBreadboardHole(pinGlobalX, pinGlobalY);

      score += snappedHole.distSq;
      if (!isNearBreadboardArea(pinGlobalX, pinGlobalY)) {
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
  pins?: Array<{ x: number; y: number }>
): { x: number; y: number } {
  const componentType = type && type in SVG_CONFIGS ? (type as ComponentType) : undefined;
  const pinLayout = pins ?? (componentType ? getDefaultPins(componentType) : []);
  const snapped = snapPinsToBreadboard(x, y, pinLayout);

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

// ===== SVG-Based Component Shape =====
const ComponentShape: React.FC<{
  comp: CircuitComponent;
  isSelected: boolean;
  simulation: any;
  language: 'en' | 'tr';
}> = ({ comp, isSelected, simulation, language }) => {
  const config = SVG_CONFIGS[comp.type];
  const image = useComponentImage(comp.type);

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
        fill="transparent"
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
        <Text text={`${(comp.properties.angle as number) || 90}°`} x={-8} y={-28} fontSize={8} fill="#aaa" listening={false} />
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
    <Group x={BB_X} y={BB_Y} listening={false}>
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
    <Group x={ARDUINO_X} y={ARDUINO_Y}>
      <Rect
        x={0}
        y={0}
        width={board.width}
        height={board.height}
        fill="transparent"
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
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [middlePanActive, setMiddlePanActive] = useState(false);
  const [wiringStart, setWiringStart] = useState<{ componentId: string; pinId: string; x: number; y: number } | null>(null);
  const [wiringMouse, setWiringMouse] = useState<{ x: number; y: number } | null>(null);
  const [hoveredBreadboardHole, setHoveredBreadboardHole] = useState<BreadboardHole | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

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
  const language = useCircuitStore((s) => s.language);

  const setZoom = useCircuitStore((s) => s.setZoom);
  const setStagePos = useCircuitStore((s) => s.setStagePos);
  const setToolMode = useCircuitStore((s) => s.setToolMode);
  const setRightTab = useCircuitStore((s) => s.setRightTab);
  const setBoardType = useCircuitStore((s) => s.setBoardType);
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
  const canUndo = useCircuitStore((s) => s.canUndo());
  const clearTransientCanvasState = useCallback(() => {
    setWiringStart(null);
    setWiringMouse(null);
    setHoveredBreadboardHole(null);
    setContextMenu(null);
  }, []);

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

    const snapped = snapToBreadboard(x, y, type);
    addComponent(type, snapped.x, snapped.y);
  }, [zoom, stagePos, addComponent]);

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
    if (!pointer || !isNearBreadboardArea(pointer.x, pointer.y)) {
      return null;
    }

    const nearestHole = getNearestBreadboardHole(pointer.x, pointer.y);
    if (nearestHole.distSq > BREADBOARD_WIRE_SNAP_RADIUS_SQ) {
      return null;
    }

    return nearestHole;
  }, [getWorldPointerPosition]);

  const resetViewport = useCallback(() => {
    setZoom(1);
    setStagePos({ x: 0, y: 0 });
  }, [setStagePos, setZoom]);

  // Component click
  const handleComponentClick = useCallback((comp: CircuitComponent) => {
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
    const snapped = snapToBreadboard(node.x(), node.y(), comp.type, comp.pins);
    const newX = snapped.x;
    const newY = snapped.y;
    node.x(newX);
    node.y(newY);
    updateComponent(comp.id, { x: newX, y: newY });

    // Update wire endpoints
    const state = useCircuitStore.getState();
    state.wires.forEach((wire) => {
      let updated = false;
      const newPoints = [...wire.points];
      if (wire.startComponentId === comp.id) {
        const pin = comp.pins.find((p) => p.id === wire.startPinId);
        if (pin) {
          newPoints[0] = newX + pin.x;
          newPoints[1] = newY + pin.y;
          updated = true;
        }
      }
      if (wire.endComponentId === comp.id) {
        const pin = comp.pins.find((p) => p.id === wire.endPinId);
        if (pin) {
          newPoints[newPoints.length - 2] = newX + pin.x;
          newPoints[newPoints.length - 1] = newY + pin.y;
          updated = true;
        }
      }
      if (updated) {
        // Direct state update for wire points
        useCircuitStore.setState((s) => ({
          wires: s.wires.map((w) => w.id === wire.id ? { ...w, points: newPoints } : w),
        }));
      }
    });
  }, [updateComponent]);

  useEffect(() => {
    const win = window as Window & {
      snapToBreadboard?: typeof snapToBreadboard;
    };

    win.snapToBreadboard = snapToBreadboard;
    return () => {
      delete win.snapToBreadboard;
    };
  }, []);

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

  const handleDragEnd = useCallback((comp: CircuitComponent, e: Konva.KonvaEventObject<DragEvent>) => {
    activeDragRef.current = null;
    finalizeComponentDrag(comp, e.target as Konva.Group);
  }, [finalizeComponentDrag]);

  const activeBreadboardHole =
    wiringStart?.componentId === BREADBOARD_COMPONENT_ID
      ? BREADBOARD_HOLE_MAP.get(wiringStart.pinId) ?? null
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
              updateComponent(selectedComponent.id, {
                rotation: (selectedComponent.rotation + 90) % 360,
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
            onContextMenu={(e) => {
              e.evt.preventDefault();
              e.cancelBubble = true;
              openContextMenu(e.evt, { kind: 'board' });
            }}
          >
            <ControllerBoard board={currentBoard} />
          </Group>

          {/* Board clickable pins */}
          {toolMode === 'wire' &&
            boardPins.map((pin) => (
              <Circle
                key={pin.id}
                x={ARDUINO_X + pin.x}
                y={ARDUINO_Y + pin.y}
                radius={6}
                fill="transparent"
                stroke={wiringStart?.componentId === ARDUINO_COMPONENT_ID && wiringStart?.pinId === pin.id ? '#fff' : 'transparent'}
                strokeWidth={1}
                onClick={(e) => {
                  e.cancelBubble = true;
                  handlePinClick(ARDUINO_COMPONENT_ID, pin.id, ARDUINO_X + pin.x, ARDUINO_Y + pin.y);
                }}
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  e.cancelBubble = true;
                  openContextMenu(e.evt, { kind: 'board' });
                }}
                onMouseEnter={(e) => {
                  const target = e.target as Konva.Circle;
                  target.stroke('#4ecca3');
                  target.radius(8);
                  target.getLayer()?.batchDraw();
                }}
                onMouseLeave={(e) => {
                  const target = e.target as Konva.Circle;
                  target.stroke('transparent');
                  target.radius(6);
                  target.getLayer()?.batchDraw();
                }}
              />
            ))}

          {/* Breadboard */}
          <Breadboard />

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
              onDragEnd={(e) => handleDragEnd(comp, e)}
              onClick={() => handleComponentClick(comp)}
              onTap={() => handleComponentClick(comp)}
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
                          handlePinClick(
                            comp.id,
                            handle.pin.id,
                            comp.x + handle.pin.x,
                            comp.y + handle.pin.y
                          );
                        }}
                        onTap={(e) => {
                          e.cancelBubble = true;
                          handlePinClick(
                            comp.id,
                            handle.pin.id,
                            comp.x + handle.pin.x,
                            comp.y + handle.pin.y
                          );
                        }}
                      />
                    </Group>
                  );
                })}

              {/* Component name label */}
              <Text
                text={comp.type.toUpperCase()}
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

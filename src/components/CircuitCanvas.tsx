import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Stage, Layer, Group, Rect, Line, Circle, Shape, Text, Image as KonvaImage } from 'react-konva';
import { useCircuitStore } from '../store/circuitStore';
import { useHardwareStore } from '../store/hardwareStore';
import {
  CircuitComponent,
  COMPONENT_CATALOG,
  ComponentType,
  Pin,
  SimulationState,
  Wire,
  getDefaultPins,
  WIRE_DEFAULT_WIDTH,
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
  getBreadboardPlacements,
  getBreadboardSpec,
  getBreadboardVariantForType,
  getNearestHoleAcrossBreadboards,
  isBreadboardType,
  type BreadboardVariant,
  type BreadboardPlacement,
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
  getComponentDisplayName,
  getCompileErrorDetail,
  getDamageLabel,
  getMultimeterModeLabel,
  getMultimeterStatusLabel,
  getLocalizedOscilloscopeDisplayText,
  getOscilloscopeStatusLabel,
  t,
} from '../lib/i18n';
import { getHalfBridgeStatus } from '../lib/driverStatus';
import {
  findSketchCompileError,
  findSketchDiagnostics,
  getCircuitWiringIssues,
  type SketchDiagnostic,
  type WiringIssue,
} from '../lib/mockArduinoRuntime';
import { getWirePinTargetSize } from '../lib/wirePinTargets';
import {
  getArtworkLeft,
  getComponentTransform,
  getMirroredPins,
  getTransformedPins,
  transformPoint,
  type ComponentTransform,
} from '../lib/componentTransform';
import { isCircuitScreenTarget, isTextEntryTarget } from '../lib/keyboardTarget';
import { getSolderedPinKeys, pinKey } from '../lib/solderedPins';
import { getBreadboardContacts } from '../lib/breadboardContacts';
import { getCanvasTheme } from '../lib/canvasTheme';
import { getFlowPace } from '../lib/flowPace';
import { getProbeFanAngles, rotateAround } from '../lib/probeFan';
import { getPrimaryProperty, stepPropertyValue } from '../lib/propertyRanges';
import { roundWirePoints } from '../lib/wireGeometry';
import {
  WIRE_DOUBLE_CLICK_MS,
  findWireBendInsertion,
  isSameGesture,
  withWireBendAt,
  type WireClick,
} from '../lib/wireBend';
import { applyBuzzerVoices, stopAllBuzzers } from '../lib/buzzerAudio';
import multimeterProbeRedSvg from '../assets/components/multimeter-probe-red.svg';
import multimeterProbeBlackSvg from '../assets/components/multimeter-probe-black.svg';

// ===== Constants =====
const GRID_SIZE = 10;
const GRID_SPACING = 20;
const GRID_COLUMNS = 100;
const GRID_ROWS = 80;
const GRID_DOT_RADIUS = 0.5;
const WIRE_BEND_HANDLE_RADIUS = 4.5;
const WIRE_PLUG_HANDLE_RADIUS = 6;
const SNAP_RADIUS_SQ = (HOLE_SP * 2.5) ** 2;
const BREADBOARD_WIRE_SNAP_RADIUS_SQ = (HOLE_SP * 1.8) ** 2;
const PROBE_SNAP_RADIUS_SQ = (HOLE_SP * 1.8) ** 2;
const PROBE_DOCK_SNAP_RADIUS_SQ = 24 ** 2;
const MULTIMETER_BLACK_ANCHOR = { x: 0, y: 103 };
const MULTIMETER_RED_V_ANCHOR = { x: 36, y: 103 };
const MULTIMETER_RED_A_ANCHOR = { x: -36, y: 103 };
const PROBE_IMAGE_WIDTH = 24;
const PROBE_IMAGE_HEIGHT = 72;
/**
 * Where a probe is picked up: the middle of the handle, not the needle.
 *
 * The grab circle used to sit on the tip, so two probes on one leg had exactly
 * coincident hit areas — leaning the bodies apart would have made them look
 * separate while the one underneath stayed impossible to catch. The handle runs
 * from about fourteen units above the tip to sixty; halfway up is both where
 * the drawing is and where a hand would go.
 */
const PROBE_GRIP_OFFSET = -34;
/** How far the pointer must travel before a click becomes a selection box. */
const MARQUEE_THRESHOLD = 4;
/** How near a wire has to be to level before it is pulled straight. */
const WIRE_STRAIGHTEN_TOLERANCE = 6;
/** Wheel notches this close together count as one turn, for undo. */
const WHEEL_UNDO_GROUPING_MS = 600;
/** Dragging a cable this far breaks it there rather than counting as a click. */
const WIRE_DRAG_BEND_THRESHOLD = 4;
/** Below this there is nothing worth drawing as a flow. */
const FLOW_MIN_CURRENT = 1e-6;
const FLOW_ARROW_SPACING = 140;
const FLOW_ARROW_LENGTH = 3;
const FLOW_ARROW_WIDTH = 2.4;
/**
 * The knob's pointer. A panel pot turns about 270 degrees, from seven o'clock
 * anticlockwise-most round to five o'clock, and stops there.
 */
const POT_MIN_ANGLE = -135;
const POT_SWEEP = 270;
const POT_POINTER_INNER = 2.5;
const POT_POINTER_OUTER = 8;

/** A component leg, where it has to be bent to reach its hole. */
const LEAD_COLOR = '#8c8c8c';
const LEAD_WIDTH = 2.2;
/** How round a cable turns a corner. */
const WIRE_CORNER_RADIUS = 7;
/** Marks on a cable carrying nothing: still, and pointing nowhere. */
const FLOW_IDLE_DASH = [2, 10];
const FLOW_IDLE_OPACITY = 0.45;

/**
 * Arrowheads marching along a cable, pointing the way the current runs.
 *
 * Moving dashes showed that something was happening but not which way it was
 * going — at a glance, or in a still, a dotted line looks the same in both
 * directions. An arrow does not.
 *
 * `travelled` is how far the marks have moved since the animation started;
 * `direction` is +1 along the cable's own points and -1 against them.
 */
function drawFlowArrows(
  context: Konva.Context,
  shape: Konva.Shape,
  points: number[],
  direction: number,
  travelled: number,
  requestedSpacing: number
): void {
  if (points.length < 4) return;

  // The run, cut into straight pieces, so a mark can be put a given distance
  // along it however many bends the cable has.
  const segments: Array<{ x: number; y: number; ux: number; uy: number; length: number }> = [];
  let total = 0;

  for (let i = 0; i + 3 < points.length; i += 2) {
    const x = points[i];
    const y = points[i + 1];
    const dx = points[i + 2] - x;
    const dy = points[i + 3] - y;
    const length = Math.hypot(dx, dy);
    if (length < 0.01) continue;

    segments.push({ x, y, ux: dx / length, uy: dy / length, length });
    total += length;
  }

  if (segments.length === 0 || total < FLOW_ARROW_LENGTH * 2) return;

  // Marks this far apart, except on a cable shorter than that: there the
  // spacing closes up to the cable's own length, which leaves exactly one mark
  // still travelling. Sparse everywhere else must not mean blank on the short
  // links, and a mark parked in the middle would not read as flow at all.
  const spacing = Math.min(requestedSpacing > 0 ? requestedSpacing : FLOW_ARROW_SPACING, total);

  // Where the first mark sits this frame; the rest follow at a fixed spacing.
  const start = (((direction * travelled) % spacing) + spacing) % spacing;

  for (let distance = start; distance < total; distance += spacing) {
    let remaining = distance;
    let segment = segments[0];
    for (const candidate of segments) {
      if (remaining <= candidate.length) {
        segment = candidate;
        break;
      }
      remaining -= candidate.length;
    }

    const px = segment.x + segment.ux * remaining;
    const py = segment.y + segment.uy * remaining;
    // Along the current, which may be against the way the cable was drawn.
    const ux = segment.ux * direction;
    const uy = segment.uy * direction;
    const nx = -uy;
    const ny = ux;

    context.beginPath();
    context.moveTo(px + ux * FLOW_ARROW_LENGTH, py + uy * FLOW_ARROW_LENGTH);
    context.lineTo(
      px - ux * FLOW_ARROW_LENGTH + nx * FLOW_ARROW_WIDTH,
      py - uy * FLOW_ARROW_LENGTH + ny * FLOW_ARROW_WIDTH
    );
    context.lineTo(
      px - ux * FLOW_ARROW_LENGTH - nx * FLOW_ARROW_WIDTH,
      py - uy * FLOW_ARROW_LENGTH - ny * FLOW_ARROW_WIDTH
    );
    context.closePath();
    context.fillStrokeShape(shape);
  }
}

type AlignGuide = {
  axis: 'horizontal' | 'vertical';
  from: { x: number; y: number };
  to: { x: number; y: number };
};

/**
 * Pulls a dragged point onto an anchor's axis when it is nearly there, and says
 * which lines to draw for it.
 *
 * One rule for three gestures: drawing a cable, reshaping one at a bend or a
 * plug, and sliding a part around in select mode. Two anchors can each claim an
 * axis — lining a part up with one neighbour across and another down is useful.
 * One anchor only ever gets the nearer axis, because taking both would drag the
 * point onto the anchor itself rather than into line with it.
 */
function snapToAlignment(
  point: { x: number; y: number },
  anchors: ReadonlyArray<{ x: number; y: number }>,
  tolerance = WIRE_STRAIGHTEN_TOLERANCE
): { point: { x: number; y: number }; guides: AlignGuide[] } {
  let horizontal: { anchor: { x: number; y: number }; distance: number } | null = null;
  let vertical: { anchor: { x: number; y: number }; distance: number } | null = null;

  for (const anchor of anchors) {
    const dy = Math.abs(point.y - anchor.y);
    if (dy <= tolerance && (!horizontal || dy < horizontal.distance)) {
      horizontal = { anchor, distance: dy };
    }

    const dx = Math.abs(point.x - anchor.x);
    if (dx <= tolerance && (!vertical || dx < vertical.distance)) {
      vertical = { anchor, distance: dx };
    }
  }

  if (
    horizontal &&
    vertical &&
    horizontal.anchor.x === vertical.anchor.x &&
    horizontal.anchor.y === vertical.anchor.y
  ) {
    if (horizontal.distance <= vertical.distance) vertical = null;
    else horizontal = null;
  }

  const snapped = {
    x: vertical ? vertical.anchor.x : point.x,
    y: horizontal ? horizontal.anchor.y : point.y,
  };

  const guides: AlignGuide[] = [];
  if (horizontal) guides.push({ axis: 'horizontal', from: horizontal.anchor, to: snapped });
  if (vertical) guides.push({ axis: 'vertical', from: vertical.anchor, to: snapped });

  return { point: snapped, guides };
}
/** Big enough to read as a bead on the leg, small enough not to hide the pin. */
const SOLDER_BLOB_RADIUS = 3.6;

/**
 * A pushbutton is held down, not switched. Only the latching kind toggles on a
 * click; the ordinary momentary one closes while the mouse is down and opens
 * again the moment it is let go, the way pressing the real part works.
 */
function isMomentaryButton(comp: CircuitComponent): boolean {
  return comp.type === 'button' && String(comp.properties.type ?? 'momentary') === 'momentary';
}

/** The two corners of a selection box, in world coordinates. */
type MarqueeRect = { x1: number; y1: number; x2: number; y2: number };

type WirePinHandle = {
  pin: Pin;
  targetX: number;
  targetY: number;
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
  // Parked out to opposite sides rather than straight down. Hanging them both
  // below their sockets left thirty-odd pixels between two probes wider than
  // that, so they sat on top of each other and you could not tell which lead
  // was which. The artwork turns to face wherever its tip is, so putting the
  // tips apart fans the two of them out on its own.
  return {
    x: anchor.x + (slot === 'black' ? -44 : 44),
    y: anchor.y + 48,
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

function getComponentPinWorldPosition(
  component: Pick<CircuitComponent, 'x' | 'y' | 'rotation' | 'scale' | 'flipX' | 'pins'>,
  pinId: string
) {
  const pin = component.pins.find((item) => item.id === pinId);
  if (!pin) return null;

  const moved = transformPoint(pin.x, pin.y, getComponentTransform(component));
  return {
    pin,
    x: component.x + moved.x,
    y: component.y + moved.y,
  };
}

/** Whether a point is over (or just outside) one particular board. */
function isNearBreadboardArea(
  x: number,
  y: number,
  breadboardPosition: { x: number; y: number } = DEFAULT_BREADBOARD_POSITION,
  variant: BreadboardVariant = 'full'
): boolean {
  const bounds = getBreadboardBounds(breadboardPosition, variant);
  return (
    x >= bounds.x - 24 &&
    x <= bounds.right + 24 &&
    y >= bounds.y - 24 &&
    y <= bounds.bottom + 24
  );
}

/** Whether a point is over any of the boards on the canvas. */
function isNearAnyBreadboard(
  x: number,
  y: number,
  boards: readonly BreadboardPlacement[]
): boolean {
  return boards.some((board) => isNearBreadboardArea(x, y, board, board.variant));
}

function snapPinsToBreadboard(
  x: number,
  y: number,
  pins: Array<{ x: number; y: number }>,
  board: BreadboardPlacement
): { x: number; y: number; score: number } | null {
  if (pins.length === 0) return null;

  let bestCandidate: { x: number; y: number; score: number } | null = null;

  for (const anchorPin of pins) {
    const anchorGlobalX = x + anchorPin.x;
    const anchorGlobalY = y + anchorPin.y;
    const nearestHole = getNearestBreadboardHole(
      anchorGlobalX,
      anchorGlobalY,
      board,
      board.variant
    );

    if (
      !isNearBreadboardArea(anchorGlobalX, anchorGlobalY, board, board.variant) &&
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
        board,
        board.variant
      );

      score += snappedHole.distSq;
      if (!isNearBreadboardArea(pinGlobalX, pinGlobalY, board, board.variant)) {
        score += SNAP_RADIUS_SQ;
      }
    }

    if (!bestCandidate || score < bestCandidate.score) {
      bestCandidate = { x: candidateX, y: candidateY, score };
    }
  }

  return bestCandidate;
}

/**
 * The best seat across every board on the canvas. Each board is asked on its
 * own and the closest fit wins, so dragging a part between two boards lands it
 * on whichever one it is actually over.
 */
function snapPinsToBreadboards(
  x: number,
  y: number,
  pins: Array<{ x: number; y: number }>,
  boards: readonly BreadboardPlacement[]
): { x: number; y: number } | null {
  let best: { x: number; y: number; score: number } | null = null;

  for (const board of boards) {
    const candidate = snapPinsToBreadboard(x, y, pins, board);
    if (candidate && (!best || candidate.score < best.score)) {
      best = candidate;
    }
  }

  return best ? { x: best.x, y: best.y } : null;
}

export function snapToBreadboard(
  x: number,
  y: number,
  type?: string,
  pins?: Array<{ x: number; y: number }>,
  boards: readonly BreadboardPlacement[] = [],
  transform?: ComponentTransform
): { x: number; y: number } {
  const componentType = type && type in SVG_CONFIGS ? (type as ComponentType) : undefined;
  const pinLayout = pins ?? (componentType ? getDefaultPins(componentType) : []);
  const placedPinLayout = getTransformedPins(pinLayout, transform);
  const snapped = snapPinsToBreadboards(x, y, placedPinLayout, boards);

  if (snapped) {
    return snapped;
  }

  return { x: snapToGrid(x), y: snapToGrid(y) };
}

// Every wire always starts and ends exactly on the pin's own tip — no fanned-out
// stand-in target away from the leg, even when several pins sit close together.
function getWirePinHandles(pins: Pin[]): WirePinHandle[] {
  return pins.map((pin) => ({
    pin,
    targetX: pin.x,
    targetY: pin.y,
  }));
}


/** Shared between the LED's glow overlay and its recolored body artwork. */
const LED_COLOR_HEX: Record<string, string> = {
  red: '#e74c3c',
  green: '#27ae60',
  blue: '#2980b9',
  yellow: '#f1c40f',
  white: '#dcdde1',
  orange: '#e67e22',
};

/** The placeholder red the led.svg artwork paints its "color_*" layers with. */
const LED_ARTWORK_PLACEHOLDER_HEX = '#E60000';

const ledRecoloredUrlCache = new Map<string, string>();

/**
 * led.svg is a flat raster once loaded, so recoloring it means building a
 * whole new image: swap the placeholder hex the artwork's color layers use
 * for the requested one, and hand back a fresh data URL for that variant.
 * Cached per color since there are only a handful.
 */
function getRecoloredLedSvgUrl(raw: string, color: string): string {
  const hex = LED_COLOR_HEX[color] ?? LED_COLOR_HEX.red;
  const cached = ledRecoloredUrlCache.get(hex);
  if (cached) return cached;

  const recolored = raw.split(LED_ARTWORK_PLACEHOLDER_HEX).join(hex);
  const url = `data:image/svg+xml;utf8,${encodeURIComponent(recolored)}`;
  ledRecoloredUrlCache.set(hex, url);
  return url;
}

const BATTERY_LABEL_LAYOUT: Partial<Record<ComponentType, { y: number; fontSize: number; color: string }>> = {
  'li-ion-battery': { y: 14, fontSize: 7, color: '#eafff4' },
  'li-po-battery': { y: 15, fontSize: 7, color: '#dfe9ff' },
  '9v-battery': { y: 21, fontSize: 6, color: '#f5efe4' },
  'aa-battery': { y: 9, fontSize: 5.5, color: '#eaf1ff' },
  'coin-cell-3v': { y: 24, fontSize: 7, color: '#2c333a' },
};

/** Bottom edge of a part's artwork in local coordinates, so the name label can clear it. */
function componentArtworkBottom(type: ComponentType): number {
  const config = SVG_CONFIGS[type];
  return config ? config.height - config.offsetY : 0;
}

/**
 * A part's artwork as an axis-aligned box in world coordinates. The four local
 * corners go through the same transform the artwork itself is drawn with, so a
 * rotated or mirrored part is still boxed where it actually appears.
 */
function getComponentWorldBounds(comp: CircuitComponent) {
  const config = SVG_CONFIGS[comp.type];
  if (!config) return { left: comp.x, top: comp.y, right: comp.x, bottom: comp.y };

  const left = -config.offsetX;
  const top = -config.offsetY;
  const right = config.width - config.offsetX;
  const bottom = config.height - config.offsetY;
  const transform = getComponentTransform(comp);

  const corners = [
    transformPoint(left, top, transform),
    transformPoint(right, top, transform),
    transformPoint(right, bottom, transform),
    transformPoint(left, bottom, transform),
  ];

  return {
    left: comp.x + Math.min(...corners.map((corner) => corner.x)),
    top: comp.y + Math.min(...corners.map((corner) => corner.y)),
    right: comp.x + Math.max(...corners.map((corner) => corner.x)),
    bottom: comp.y + Math.max(...corners.map((corner) => corner.y)),
  };
}

/** Every part the selection box touches — overlapping counts, not enclosing. */
function getComponentsInMarquee(components: CircuitComponent[], rect: MarqueeRect): string[] {
  const left = Math.min(rect.x1, rect.x2);
  const right = Math.max(rect.x1, rect.x2);
  const top = Math.min(rect.y1, rect.y2);
  const bottom = Math.max(rect.y1, rect.y2);

  return components
    .filter((comp) => {
      const bounds = getComponentWorldBounds(comp);
      return (
        bounds.left <= right &&
        bounds.right >= left &&
        bounds.top <= bottom &&
        bounds.bottom >= top
      );
    })
    .map((comp) => comp.id);
}

/**
 * Problems worth telling the user about, in two kinds.
 *
 * Static ones — a sketch that will not parse, wiring mistakes visible from the
 * graph alone — are found by inspecting the project, so they would also be
 * "found" the instant a part is dropped and has not been wired up yet. That is
 * not a mistake, it is a circuit halfway through being built, so these are only
 * surfaced when the user actually asks: Verify, Upload or Start.
 *
 * Live ones — a part that just burned out, a statement that threw, compiler
 * output from the board — are events that happen while something is already
 * running, which the user started themselves, so they show up as they occur.
 */
type CircuitWarning = {
  id: string;
  text: string;
  /** Present only for a warning that points at one specific part. */
  componentId?: string;
  /** Present only for a warning whose detail lives in a bottom-panel tab. */
  jumpToTab?: 'code' | 'serial' | 'device';
  /** True for something that happened just now rather than something found by inspection. */
  live?: boolean;
};

function mapWiringIssueToWarning(
  language: 'en' | 'tr',
  issue: WiringIssue,
  components: CircuitComponent[]
): CircuitWarning {
  if (issue.type === 'dead-short') {
    return {
      id: `wiring-short-${issue.net}`,
      text: t(language, 'circuitWarningDeadShort'),
      componentId: issue.componentId,
    };
  }

  const comp = components.find((item) => item.id === issue.componentId);
  const info = comp ? COMPONENT_CATALOG.find((item) => item.type === comp.type) : undefined;
  const name = comp ? getComponentDisplayName(language, comp.type, info?.name ?? comp.type) : '';

  // Shown the moment they are true rather than waiting for a check to be asked
  // for. Dropping a part you have not wired yet is work in progress; clipping
  // both probes of an ammeter onto one point is a mistake that is already
  // giving you a wrong number, and the sooner it says so the better.
  if (issue.type === 'meter-needs-series') {
    return {
      id: `wiring-meter-series-${issue.componentId}`,
      text: t(language, 'circuitWarningMeterSeries', { name }),
      componentId: issue.componentId,
      live: true,
    };
  }

  if (issue.type === 'meter-needs-parallel') {
    return {
      id: `wiring-meter-parallel-${issue.componentId}`,
      text: t(language, 'circuitWarningMeterParallel', { name }),
      componentId: issue.componentId,
      live: true,
    };
  }

  if (issue.type === 'floating-part') {
    return {
      id: `wiring-floating-${issue.componentId}`,
      text: t(language, 'circuitWarningFloatingPart', { name }),
      componentId: issue.componentId,
    };
  }

  if (issue.type === 'module-missing-supply') {
    return {
      id: `wiring-supply-${issue.componentId}`,
      text: t(language, 'circuitWarningModuleMissingSupply', { name }),
      componentId: issue.componentId,
    };
  }

  return {
    id: `wiring-no-resistor-${issue.componentId}`,
    text: t(language, 'circuitWarningPartNoResistor', { name }),
    componentId: issue.componentId,
  };
}

function getSketchDiagnosticText(
  language: 'en' | 'tr',
  diagnostic: SketchDiagnostic
): string {
  if (diagnostic.kind === 'undeclared-variable') {
    return t(language, 'circuitWarningUndeclared', {
      name: diagnostic.detail,
      line: diagnostic.line,
    });
  }

  if (diagnostic.kind === 'unknown-function') {
    return t(language, 'circuitWarningUnknownFunction', {
      name: diagnostic.detail,
      line: diagnostic.line,
    });
  }

  if (diagnostic.kind === 'unknown-member') {
    // The suggestion is the useful half of the message, so it gets its own
    // sentence — but only when the checker actually found a near miss.
    return diagnostic.suggestion
      ? t(language, 'circuitErrorUnknownMemberSuggestion', {
          object: diagnostic.object ?? '',
          name: diagnostic.detail,
          line: diagnostic.line,
          suggestion: diagnostic.suggestion,
        })
      : t(language, 'circuitErrorUnknownMember', {
          object: diagnostic.object ?? '',
          name: diagnostic.detail,
          line: diagnostic.line,
        });
  }

  return t(language, 'circuitWarningTypeMismatch', {
    detail: diagnostic.detail,
    line: diagnostic.line,
  });
}

function computeCircuitWarnings(
  language: 'en' | 'tr',
  running: boolean,
  code: string,
  components: CircuitComponent[],
  wires: Wire[],
  boardPins: Pin[],
  componentStates: SimulationState['componentStates'],
  runtimeError: string | null,
  hardwareError: string | null
): CircuitWarning[] {
  const warnings: CircuitWarning[] = [];

  const compileError = findSketchCompileError(code);
  if (compileError) {
    const detail =
      compileError.reason === 'unknown'
        ? compileError.detail
        : getCompileErrorDetail(language, compileError.reason, compileError.line);
    warnings.push({
      id: 'compile-error',
      text: t(language, 'circuitWarningCompileError', { error: detail }),
      jumpToTab: 'code',
    });
  } else {
    // Only worth saying "this name is unknown" once the sketch parses at all —
    // half-typed code would otherwise light up with noise on every keystroke.
    for (const diagnostic of findSketchDiagnostics(code)) {
      warnings.push({
        id: `${diagnostic.kind}-${diagnostic.line}-${diagnostic.detail}`,
        text: getSketchDiagnosticText(language, diagnostic),
        jumpToTab: 'code',
      });
    }
  }

  for (const issue of getCircuitWiringIssues(components, wires, boardPins)) {
    warnings.push(mapWiringIssueToWarning(language, issue, components));
  }

  if (running) {
    // Each burned part gets its own line — and its own click target — instead
    // of one flattened "N parts burned" sentence nobody can act on.
    for (const comp of components) {
      const state = componentStates[comp.id];
      if (state?.damaged !== true) continue;

      const info = COMPONENT_CATALOG.find((item) => item.type === comp.type);
      const name = getComponentDisplayName(language, comp.type, info?.name ?? comp.type);
      const reason = getDamageLabel(language, String(state.damageReason ?? ''));
      warnings.push({
        id: `damaged-${comp.id}`,
        text: `${name} — ${reason}`,
        componentId: comp.id,
        live: true,
      });
    }

    if (!/void\s+setup\s*\(/.test(code) || !/void\s+loop\s*\(/.test(code)) {
      warnings.push({ id: 'no-code', text: t(language, 'circuitWarningNoCode'), live: true });
    }

    if (runtimeError) {
      warnings.push({
        id: 'runtime-error',
        text: t(language, 'circuitWarningRuntimeError', { error: runtimeError }),
        jumpToTab: 'serial',
        live: true,
      });
    }
  }

  if (hardwareError) {
    // Compiler output can run to many lines; the banner shows just the first
    // and the rest waits in the device console it links to.
    const firstLine = hardwareError.split('\n')[0].trim();
    warnings.push({
      id: 'hardware-error',
      text: firstLine.length > 160 ? `${firstLine.slice(0, 160)}…` : firstLine,
      jumpToTab: 'device',
      live: true,
    });
  }

  return warnings;
}

function clampByte(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(255, Math.max(0, Math.round(num)));
}

function getCanvasComponentLabel(language: 'en' | 'tr', comp: CircuitComponent): string {
  if (comp.name?.trim()) return comp.name.trim();

  const type = comp.type;
  if (type === 'oscilloscope') return 'SCOPE';
  if (type === 'multimeter') return 'DMM';
  if (type === 'bme280') return 'BME280';
  if (type === 'ina219') return 'INA219';
  if (type === 'sx1276-lora') return 'LORA';
  if (type === 'a4988-driver') return 'A4988';

  const info = COMPONENT_CATALOG.find((item) => item.type === type);
  return getComponentDisplayName(language, type, info?.name ?? type).toUpperCase();
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
  const baseImage = useComponentImage(comp.type);
  const ledColor = comp.type === 'led' ? String(comp.properties.color ?? 'red') : null;
  const ledImageUrl = useMemo(
    () => (ledColor && config?.raw ? getRecoloredLedSvgUrl(config.raw, ledColor) : null),
    [ledColor, config?.raw]
  );
  const ledImage = useAssetImage(ledImageUrl ?? '');
  const image = ledImageUrl ? ledImage : baseImage;
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
  const halfBridgeStatus = getHalfBridgeStatus(language, comp.properties);

  if (!config || !image) {
    return <Circle radius={10} fill="#888" />;
  }

  return (
    <Group>
      <Group scaleX={comp.flipX ? -1 : 1}>
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
      </Group>

      {/* LED glow overlay */}
      {comp.type === 'led' && (() => {
        const ledState = simulation.ledStates[comp.id];
        const isOn = simulation.running && ledState?.on;
        const bri = ledState?.brightness ?? 0;
        const color = (comp.properties.color as string) || 'red';
        const c = LED_COLOR_HEX[color] ?? LED_COLOR_HEX.red;
        return isOn ? (
          <>
            <Circle radius={28} fill={c} opacity={0.12 * bri} listening={false} />
            <Circle radius={18} fill={c} opacity={0.22 * bri} listening={false} />
          </>
        ) : null;
      })()}

      {/* RGB LED glow overlay — one brightness per channel instead of a single color */}
      {comp.type === 'rgb-led' && (() => {
        const r = clampByte(comp.properties.red);
        const g = clampByte(comp.properties.green);
        const b = clampByte(comp.properties.blue);
        const isOn = simulation.running && (r > 12 || g > 12 || b > 12);
        if (!isOn) return null;
        const c = `rgb(${r}, ${g}, ${b})`;
        const bri = Math.max(r, g, b) / 255;
        return (
          <>
            <Circle radius={28} fill={c} opacity={0.12 * bri} listening={false} />
            <Circle radius={18} fill={c} opacity={0.22 * bri} listening={false} />
          </>
        );
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

      {/* Battery capacity — drawn live so it tracks the properties panel instead of
          being baked into the artwork. Position/size are tuned per body shape. */}
      {BATTERY_LABEL_LAYOUT[comp.type] && (
        <Text
          text={
            comp.type === 'li-ion-battery' || comp.type === 'li-po-battery'
              ? `${comp.properties.cells}S · ${comp.properties.capacityMah}mAh`
              : `${comp.properties.capacityMah}mAh`
          }
          x={-40}
          y={BATTERY_LABEL_LAYOUT[comp.type]!.y}
          width={80}
          align="center"
          fontSize={BATTERY_LABEL_LAYOUT[comp.type]!.fontSize}
          fontStyle="bold"
          fill={BATTERY_LABEL_LAYOUT[comp.type]!.color}
          listening={false}
        />
      )}

      {/* Servo angle */}
      {/* Which leg is which. A TO-92 reads C-B-E left to right and nothing on
          screen said so, so collector and emitter were easy to swap — and a
          transistor with those two the wrong way round does not conduct, on a
          bench or here. */}
      {(comp.type === 'transistor-npn' || comp.type === 'transistor-pnp') && (
        <>
          {(
            [
              ['C', -9.5],
              ['B', 0],
              ['E', 9.5],
            ] as const
          ).map(([label, x]) => (
            <Text
              key={label}
              text={label}
              x={x - 3}
              y={20}
              width={6}
              align="center"
              fontSize={6}
              fontStyle="bold"
              fill="#9aa4b2"
              listening={false}
            />
          ))}
        </>
      )}

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

      {/* A sounding buzzer, so it is obvious even with the volume down. */}
      {comp.type === 'buzzer' && Boolean(comp.properties.sounding) && (
        <>
          <Shape
            x={19}
            y={4}
            stroke="#f7e38b"
            strokeWidth={1.3}
            listening={false}
            sceneFunc={(ctx, shape) => {
              for (let ring = 0; ring < 3; ring += 1) {
                ctx.beginPath();
                ctx.arc(0, 0, 5 + ring * 4.5, -Math.PI / 3.4, Math.PI / 3.4, false);
                ctx.strokeShape(shape);
              }
            }}
          />
          <Text
            text={`${Math.round(Number(comp.properties.frequency) || 0)} Hz`}
            x={-24}
            y={-26}
            width={48}
            align="center"
            fontSize={7}
            fill="#f7e38b"
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

      {/* Potentiometer: the knob's pointer, turned to the wiper's setting.
          Drawn here rather than baked into the artwork so that turning the knob
          actually turns something — before this the only sign a pot had moved
          was the percentage above it. */}
      {comp.type === 'potentiometer' && (() => {
        const position = getNumericValue(comp.properties.position, 50);
        // Panel pots sweep about 270°, from seven o'clock round to five.
        const sweptDegrees = POT_MIN_ANGLE + (POT_SWEEP * Math.min(100, Math.max(0, position))) / 100;
        const radians = ((sweptDegrees - 90) * Math.PI) / 180;

        return (
          <>
            <Line
              points={[
                Math.cos(radians) * POT_POINTER_INNER,
                Math.sin(radians) * POT_POINTER_INNER,
                Math.cos(radians) * POT_POINTER_OUTER,
                Math.sin(radians) * POT_POINTER_OUTER,
              ]}
              stroke="#f2f6fa"
              strokeWidth={1.8}
              lineCap="round"
              shadowColor="#000"
              shadowBlur={2}
              listening={false}
              perfectDrawEnabled={false}
            />
            <Text
              text={`${Math.round(position)}%`}
              x={-19}
              y={-30}
              width={38}
              align="center"
              fontSize={8}
              fill="#aaa"
              listening={false}
            />
          </>
        );
      })()}

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
          text={`A:${t(language, comp.properties.enabledA ? 'on' : 'off')} B:${t(language, comp.properties.enabledB ? 'on' : 'off')}`}
          x={-30}
          y={-24}
          width={60}
          align="center"
          fontSize={7}
          fill="#f7e38b"
          listening={false}
        />
      )}

      {comp.type === 'bts7960-driver' && (
        <Text
          text={halfBridgeStatus.text}
          x={-45}
          y={17}
          width={90}
          align="center"
          fontSize={8}
          fill={halfBridgeStatus.active ? '#f7e38b' : '#8a909c'}
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
          text={t(language, comp.properties.activated ? 'on' : 'off')}
          x={-10} y={6} width={20} align="center" fontSize={7}
          fill={comp.properties.activated ? '#4ecca3' : '#e74c3c'} fontStyle="bold" listening={false}
        />
      )}

      {/* A part that let the smoke out: charred, smoking and clearly dead. */}
      {comp.properties.damaged === true && (
        <>
          <Rect
            x={getArtworkLeft(config, comp.flipX)}
            y={-config.offsetY}
            width={config.width}
            height={config.height}
            fill="#000000"
            opacity={0.55}
            cornerRadius={3}
            listening={false}
          />
          <Circle x={-9} y={-config.offsetY - 6} radius={6} fill="#7b8794" opacity={0.35} listening={false} />
          <Circle x={2} y={-config.offsetY - 14} radius={8} fill="#98a2ad" opacity={0.28} listening={false} />
          <Circle x={12} y={-config.offsetY - 24} radius={10} fill="#b6bfc9" opacity={0.2} listening={false} />
          <Line
            points={[-10, 0, -3, -4, 0, -12, 3, -4, 11, 0, 3, 4, 0, 12, -3, 4]}
            closed
            fill="#f6a623"
            opacity={0.9}
            listening={false}
          />
          <Text
            text={t(language, 'burned')}
            x={-40}
            y={config.height - config.offsetY - 4}
            width={80}
            align="center"
            fontSize={9}
            fontStyle="bold"
            fill="#ff6b6b"
            listening={false}
          />
        </>
      )}

      {/* Selection outline */}
      {isSelected && (
        <Rect
          x={getArtworkLeft(config, comp.flipX) - 2}
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
const Breadboard: React.FC<{ variant?: BreadboardVariant }> = React.memo(
  ({ variant = 'full' }) => {
    const spec = getBreadboardSpec(variant);
    const boardW = spec.width;
    const totalH = spec.height;
    const railH = spec.hasRails ? RAIL_H : 0;
    const mainStartY = spec.mainOffsetY;

    const holes = useMemo(() => {
      const els: React.ReactElement[] = [];

      // ── Power rails (top & bottom), on the full-size board only ──
      if (spec.hasRails) {
        for (let rail = 0; rail < 2; rail++) {
          const ry = rail === 0 ? 14 : totalH - 28;
          els.push(
            <Rect key={`rs-r-${rail}`} x={18} y={ry - 1} width={boardW - 36} height={1.2} fill="#e74c3c" opacity={0.5} />,
            <Rect key={`rs-b-${rail}`} x={18} y={ry + HOLE_SP + 1} width={boardW - 36} height={1.2} fill="#3498db" opacity={0.5} />
          );
          for (let col = 0; col < spec.cols; col++) {
            const hx = 20 + col * HOLE_SP;
            for (let r = 0; r < 2; r++) {
              const hy = ry + r * HOLE_SP;
              els.push(
                <Circle key={`pr-${rail}-${col}-${r}`} x={hx} y={hy} radius={HOLE_R + 0.5} fill="#999" />,
                <Circle key={`prh-${rail}-${col}-${r}`} x={hx} y={hy} radius={HOLE_R} fill="#1a1a1a" />
              );
            }
          }
          els.push(
            <Text key={`rl+${rail}`} x={6} y={ry - 5} text="+" fill="#e74c3c" fontSize={10} fontStyle="bold" />,
            <Text key={`rl-${rail}`} x={6} y={ry + HOLE_SP - 5} text="−" fill="#3498db" fontSize={10} fontStyle="bold" />
          );
        }
      }

      // ── Main hole area (rows A-E, F-J) ──
      for (let section = 0; section < 2; section++) {
        for (let row = 0; row < 5; row++) {
          const label = String.fromCharCode(65 + section * 5 + row);
          const hy = mainStartY + (section * 6 + row) * HOLE_SP;
          els.push(
            <Text key={`lb-${label}`} x={5} y={hy - 4} text={label} fill="#aaa" fontSize={7} fontFamily="monospace" />
          );
          for (let col = 0; col < spec.cols; col++) {
            const hx = 20 + col * HOLE_SP;
            els.push(
              <Circle key={`h-${section}-${row}-${col}`} x={hx} y={hy} radius={HOLE_R + 0.5} fill="#999" />,
              <Circle key={`hi-${section}-${row}-${col}`} x={hx} y={hy} radius={HOLE_R} fill="#1a1a1a" />
            );
          }
        }
      }

      // ── Column numbers ──
      //
      // Every column, on every board. Numbering every fifth one left the reader
      // counting holes across a gap to work out where a leg actually sits, and
      // the column a leg is in is the whole game on a breadboard.
      for (let col = 0; col < spec.cols; col += 1) {
        const text = String(col + 1);
        // Two-digit numbers need pulling left to stay over their column.
        const x = 20 + col * HOLE_SP - (text.length > 1 ? 3.4 : 1.6);
        els.push(
          <Text key={`cn-t-${col}`} x={x} y={mainStartY - 12} text={text} fill="#aaa" fontSize={6} fontFamily="monospace" />,
          // Repeated under the board so a leg in rows F-J can be read off too.
          <Text key={`cn-b-${col}`} x={x} y={mainStartY + 10 * HOLE_SP + 4} text={text} fill="#aaa" fontSize={6} fontFamily="monospace" />
        );
      }

      return els;
    }, [boardW, mainStartY, spec, totalH]);

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
        {/* Branding, only where there is room for it */}
        {spec.hasRails && (
          <Text x={boardW / 2 - 30} y={gapY} text="AI DEVRE" fontSize={8} fill="#c0c0b8" fontStyle="bold" letterSpacing={3} />
        )}
        {holes}
      </Group>
    );
  }
);

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

const ControllerBoard: React.FC<{
  board: ControllerBoardDefinition;
  builtinLedBrightness: number;
}> = React.memo(({ board, builtinLedBrightness }) => {
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

      {/* Onboard "L" LED, lit by whatever the sketch writes to its pin */}
      {board.builtinLed && builtinLedBrightness > 0 && (
        <Group listening={false}>
          <Circle
            x={board.builtinLed.x}
            y={board.builtinLed.y}
            radius={16}
            fill="#ffe066"
            opacity={0.16 * builtinLedBrightness}
          />
          <Circle
            x={board.builtinLed.x}
            y={board.builtinLed.y}
            radius={8}
            fill="#ffe066"
            opacity={0.32 * builtinLedBrightness}
          />
          <Rect
            x={board.builtinLed.x - 3.6}
            y={board.builtinLed.y - 2.3}
            width={7.2}
            height={4.6}
            cornerRadius={1}
            fill="#fff6b0"
            opacity={0.5 + 0.5 * builtinLedBrightness}
          />
        </Group>
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
  /**
   * Only set while dragging with the *entire* circuit selected — that's the
   * one case where towing the rest along is what the user wants, so the board
   * can be repositioned as a block instead of one part at a time.
   */
  const groupDragRef = useRef<{
    origin: { x: number; y: number };
    others: Array<{ id: string; x: number; y: number }>;
    /** The block moves in the store as it is dragged, so its undo step has to
     *  be taken before the first of those moves, not after the last. */
    snapshotTaken: boolean;
  } | null>(null);
  const draggedComponentPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const breadboardDragRef = useRef<{
    startPosition: { x: number; y: number };
    attachedComponents: Array<{ id: string; x: number; y: number }>;
  } | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const stageSizeRef = useRef(stageSize);
  stageSizeRef.current = stageSize;
  const [middlePanActive, setMiddlePanActive] = useState(false);
  const [wiringStart, setWiringStart] = useState<{ componentId: string; pinId: string; x: number; y: number } | null>(null);
  const [wiringMouse, setWiringMouse] = useState<{ x: number; y: number } | null>(null);
  /** The axes something has snapped to, so guides can be drawn along them. */
  const [alignGuides, setAlignGuides] = useState<AlignGuide[]>([]);
  /** Shift shows where the current is going, for as long as it is held. */
  const [flowVisible, setFlowVisible] = useState(false);

  /**
   * Whether the "press Shift" hint has been answered this run.
   *
   * Deliberately not `flowVisible`: that is a toggle, so reading it would bring
   * the hint back the moment someone turned the arrows off again — which is
   * exactly when they have proved they did not need telling.
   */
  const [flowHintAnswered, setFlowHintAnswered] = useState(false);
  /** Bend points placed since the wire was started, as a flat x,y list. */
  const [wiringPath, setWiringPath] = useState<number[]>([]);
  /** Mirror of the wiring state so the keyboard handler can read it. */
  const wiringStateRef = useRef<{ active: boolean; bendCount: number }>({
    active: false,
    bendCount: 0,
  });
  const [hoveredBreadboardHole, setHoveredBreadboardHole] = useState<BreadboardHole | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  /** The wire end currently being dragged out of its socket, if any. */
  const [wireDrag, setWireDrag] = useState<{
    wireId: string;
    end: 'start' | 'end';
    target: ProbeSnapTarget | null;
  } | null>(null);
  const [, setDragPreviewVersion] = useState(0);

  const components = useCircuitStore((s) => s.components);
  const wires = useCircuitStore((s) => s.wires);
  const selectedComponentId = useCircuitStore((s) => s.selectedComponentId);
  const selectedWireId = useCircuitStore((s) => s.selectedWireId);

  /** Konva cannot read a stylesheet, so the board's own colours come from here. */
  const canvasTheme = getCanvasTheme(useCircuitStore((s) => s.theme));

  /**
   * Whether a selected cable's bend and plug handles will answer the mouse yet.
   *
   * They only exist while the cable is selected, so the first click of a
   * double-click — the one that selects it — drops new targets under a cursor
   * that is about to be clicked again. The second click then landed on a handle
   * instead of the cable: it deleted a bend, or pulled a plug out of its
   * socket, or simply broke the double-click in half so nothing happened at
   * all. Holding them back until the gesture is over lets the cable answer both
   * halves of its own double-click.
   */
  const [wireHandlesArmed, setWireHandlesArmed] = useState(false);
  useEffect(() => {
    if (!selectedWireId) {
      setWireHandlesArmed(false);
      return;
    }

    setWireHandlesArmed(false);
    const timer = window.setTimeout(() => setWireHandlesArmed(true), WIRE_DOUBLE_CLICK_MS);
    return () => window.clearTimeout(timer);
  }, [selectedWireId]);
  const toolMode = useCircuitStore((s) => s.toolMode);
  const zoom = useCircuitStore((s) => s.zoom);
  const stagePos = useCircuitStore((s) => s.stagePos);
  const viewResetToken = useCircuitStore((s) => s.viewResetToken);
  const wireColor = useCircuitStore((s) => s.wireColor);
  const simulation = useCircuitStore((s) => s.simulation);
  const code = useCircuitStore((s) => s.code);
  const boardType = useCircuitStore((s) => s.boardType);
  const boardPosition = useCircuitStore((s) => s.boardPosition);
  /**
   * While the simulation runs the circuit cannot be edited — pressing a button
   * and turning a value are the interactive part, moving and rewiring are not.
   * The store refuses these outright; this is what stops the canvas offering
   * them in the first place, so nothing feels broken.
   */
  const circuitLocked = simulation.running;

  /** Every breadboard on the canvas, derived from the parts themselves. */
  const breadboards = useMemo(() => getBreadboardPlacements(components), [components]);

  // Needed by circuitWarnings below, so it's declared here rather than lower
  // down where it's otherwise used (with the rest of the board-rendering
  // values it groups with).
  const boardPins = useMemo(() => getControllerBoardPins(boardType), [boardType]);
  const language = useCircuitStore((s) => s.language);
  const setBottomTab = useCircuitStore((s) => s.setBottomTab);
  const bottomPanelCollapsed = useCircuitStore((s) => s.bottomPanelCollapsed);
  const toggleBottomPanel = useCircuitStore((s) => s.toggleBottomPanel);
  const hardwareError = useHardwareStore((s) => s.lastError);
  const circuitWarnings = useMemo(
    () =>
      computeCircuitWarnings(
        language,
        simulation.running,
        code,
        components,
        wires,
        boardPins,
        simulation.componentStates,
        simulation.runtimeError,
        hardwareError
      ),
    [
      language,
      simulation.running,
      code,
      components,
      wires,
      boardPins,
      simulation.componentStates,
      simulation.runtimeError,
      hardwareError,
    ]
  );
  const [hoveredComponentId, setHoveredComponentId] = useState<string | null>(null);
  /** Which wiring target the cursor is over, so its name can be shown. */
  const [hoveredPin, setHoveredPin] = useState<{ componentId: string; pinId: string } | null>(null);
  /** True while the background itself is being dragged, which only pans. */
  const [stageDragging, setStageDragging] = useState(false);
  /** The selection rectangle being dragged across empty space in select mode. */
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  /** True once the current drag has grown past the click threshold. */
  const marqueeMovedRef = useRef(false);
  /** The live rectangle. Kept beside the state because the release can arrive
   *  before React has committed the last mouse move, and the selection has to
   *  be made from where the box actually is, not where it was a frame ago. */
  const marqueeRectRef = useRef<MarqueeRect | null>(null);
  /** Set when a marquee has just made a selection, so the click that ends the
   *  same gesture does not narrow it straight back down. */
  const suppressClickRef = useRef(false);
  /** The momentary button currently held down, so it is released wherever the
   *  mouse happens to come up — including off the part, or off the window. */
  const heldButtonRef = useRef<string | null>(null);

  /** Legs that a cable reaches or that sit in a breadboard hole — the ones the
   *  selected part is drawn with a solder blob on. */
  const solderedPinKeys = useMemo(
    () => getSolderedPinKeys(components, wires),
    [components, wires]
  );

  /**
   * The bent bit of a leg: from where the artwork leaves it to the hole it is
   * actually in.
   *
   * Seating a part lands one leg exactly on a hole and leaves the rest wherever
   * the artwork's own leg spacing puts them — a resistor's legs are 7.46 holes
   * apart, so its far leg stops about five pixels short of the hole it is
   * connected to. It was connected all along; it just did not look it. A real
   * part's legs are bent to reach, and now these are drawn bent too.
   */
  const breadboardLeads = useMemo(
    () =>
      getBreadboardContacts(components).filter(
        (contact) => Math.hypot(contact.pinX - contact.holeX, contact.pinY - contact.holeY) > 0.5
      ),
    [components]
  );

  const [dismissedWarningsKey, setDismissedWarningsKey] = useState<string | null>(null);

  const liveWarnings = useMemo(
    () => circuitWarnings.filter((warning) => warning.live),
    [circuitWarnings]
  );

  // Findings from inspecting the project are held back until the user asks for
  // a check, then kept on screen as that check's result. Otherwise dropping a
  // part that is not wired up yet would immediately be called a mistake.
  const validationRequestId = useCircuitStore((s) => s.validationRequestId);
  const [staticFindings, setStaticFindings] = useState<CircuitWarning[]>([]);
  const staticWarningsRef = useRef<CircuitWarning[]>([]);
  staticWarningsRef.current = circuitWarnings.filter((warning) => !warning.live);

  const reportErrors = useCircuitStore((s) => s.reportErrors);
  useEffect(() => {
    if (validationRequestId === 0) return;

    const found = staticWarningsRef.current;
    setStaticFindings(found);
    setDismissedWarningsKey(null);

    if (found.length > 0) {
      reportErrors(found.map((warning) => ({ sourceId: warning.id, text: warning.text })));
    }
  }, [validationRequestId, reportErrors]);

  // A part burning out or a statement throwing happens while something the
  // user started is already running, so those are reported as they occur.
  const knownLiveIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const appeared = liveWarnings.filter((warning) => !knownLiveIdsRef.current.has(warning.id));
    knownLiveIdsRef.current = new Set(liveWarnings.map((warning) => warning.id));

    if (appeared.length > 0) {
      reportErrors(appeared.map((warning) => ({ sourceId: warning.id, text: warning.text })));
    }
  }, [liveWarnings, reportErrors]);

  // Only findings from the last check that are still true: fixing a wire
  // clears its warning straight away, while a problem introduced afterwards
  // waits for the next check rather than interrupting the work.
  const shownWarnings = useMemo(() => {
    const stillPresent = new Set(
      circuitWarnings.filter((warning) => !warning.live).map((warning) => warning.id)
    );
    return [
      ...staticFindings.filter((warning) => stillPresent.has(warning.id)),
      ...liveWarnings,
    ];
  }, [staticFindings, liveWarnings, circuitWarnings]);
  const warningsKey = shownWarnings.map((warning) => warning.id).join('|');
  const visibleWarnings = warningsKey === dismissedWarningsKey ? [] : shownWarnings;

  const setZoom = useCircuitStore((s) => s.setZoom);
  const setStagePos = useCircuitStore((s) => s.setStagePos);
  const setToolMode = useCircuitStore((s) => s.setToolMode);
  const setRightTab = useCircuitStore((s) => s.setRightTab);
  const setBoardType = useCircuitStore((s) => s.setBoardType);
  const setBoardPosition = useCircuitStore((s) => s.setBoardPosition);
  const captureUndoSnapshot = useCircuitStore((s) => s.captureUndoSnapshot);
  const addComponent = useCircuitStore((s) => s.addComponent);
  const selectComponent = useCircuitStore((s) => s.selectComponent);
  const selectedComponentIds = useCircuitStore((s) => s.selectedComponentIds);
  const toggleComponentSelection = useCircuitStore((s) => s.toggleComponentSelection);
  const updateComponent = useCircuitStore((s) => s.updateComponent);
  const updateComponentProperties = useCircuitStore((s) => s.updateComponentProperties);
  const removeComponent = useCircuitStore((s) => s.removeComponent);
  const addWire = useCircuitStore((s) => s.addWire);
  const removeWire = useCircuitStore((s) => s.removeWire);
  const updateWirePoints = useCircuitStore((s) => s.updateWirePoints);
  const updateWireEndpoint = useCircuitStore((s) => s.updateWireEndpoint);
  const selectWire = useCircuitStore((s) => s.selectWire);
  const updateComponentProperty = useCircuitStore((s) => s.updateComponentProperty);
  const isStagePanning = toolMode === 'pan' || middlePanActive;
  const currentBoard = useMemo(() => getControllerBoardDefinition(boardType), [boardType]);
  const builtinLedBrightness = useMemo(() => {
    const led = currentBoard.builtinLed;
    if (!led || !simulation.running) return 0;
    return Math.max(0, Math.min(1, (simulation.pinStates[led.pin] ?? 0) / 255));
  }, [currentBoard, simulation.pinStates, simulation.running]);
  const boardPinRadius = currentBoard.pinDefs.length > 30 ? 4 : 6;
  const boardPinHoverRadius = currentBoard.pinDefs.length > 30 ? 5.5 : 8;
  const canUndo = useCircuitStore((s) => s.canUndo());
  const canRedo = useCircuitStore((s) => s.canRedo());
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

    const component = availableComponents.find((item) => item.id === componentId);
    if (!component) return null;

    // A wire on a hole names the board it is plugged into, so the hole is
    // looked up against that board's own position.
    if (isBreadboardType(component.type)) {
      // Hole ids repeat across sizes, so the size has to come along or a mini's
      // A1 is resolved against the full-size board's geometry.
      const hole = getBreadboardHoleGlobal(
        pinId,
        component,
        getBreadboardVariantForType(component.type)
      );
      return hole ? { x: hole.x, y: hole.y } : null;
    }

    const pinPosition = getComponentPinWorldPosition(component, pinId);
    return pinPosition
      ? {
          x: pinPosition.x,
          y: pinPosition.y,
        }
      : null;
  }, [boardPins, boardPosition, components]);

  const getBreadboardSnapPositionForComponent = useCallback(
    (component: CircuitComponent, boards: readonly BreadboardPlacement[] = breadboards) =>
      snapPinsToBreadboards(
        component.x,
        component.y,
        getTransformedPins(component.pins, getComponentTransform(component)),
        boards
      ),
    [breadboards]
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
      const rotated = transformPoint(tip.x, tip.y, getComponentTransform(component));
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
      const rotated = transformPoint(anchor.x, anchor.y, getComponentTransform(component));
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
    (component: CircuitComponent, boards: readonly BreadboardPlacement[] = breadboards) => {
      const snapped = getBreadboardSnapPositionForComponent(component, boards);
      if (!snapped) return false;

      return (
        Math.abs(snapped.x - component.x) < 0.75 &&
        Math.abs(snapped.y - component.y) < 0.75
      );
    },
    [breadboards, getBreadboardSnapPositionForComponent]
  );

  useEffect(() => {
    wiringStateRef.current = {
      active: Boolean(wiringStart),
      bendCount: wiringPath.length / 2,
    };
  }, [wiringStart, wiringPath]);

  const clearTransientCanvasState = useCallback(() => {
    setWiringStart(null);
    setWiringMouse(null);
    setWiringPath([]);
    setAlignGuides([]);
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

      // An end being dragged out of its socket follows the cursor instead of
      // being pulled back to the pin it is still recorded against.
      const heldEnd = wireDrag?.wireId === wire.id ? wireDrag.end : null;

      if (heldEnd !== 'start') {
        nextPoints[0] = start.x;
        nextPoints[1] = start.y;
      }

      if (heldEnd !== 'end') {
        nextPoints[nextPoints.length - 2] = end.x;
        nextPoints[nextPoints.length - 1] = end.y;
      }

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
  }, [resolveWireEndpointPosition, wireDrag, wires]);

  // Shift switches the arrows on, and Shift again switches them off. Holding it
  // down would have meant keeping a finger on the key to watch anything.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key !== 'Shift') return;
      // Held down, the key repeats; one press should be one toggle.
      if (e.repeat) return;
      // Shift is a modifier as often as it is a key: Ctrl+Shift+Z is a redo,
      // and a capital letter in the code editor is not a request for this.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTextEntryTarget(e.target)) return;
      if (!isCircuitScreenTarget(e.target, containerRef.current)) return;

      setFlowVisible((visible) => !visible);
      setFlowHintAnswered(true);
    };

    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  const flowRunning = flowVisible && simulation.running;

  // Every run asks again. Someone who knows the shortcut dismisses it with the
  // shortcut itself, which costs them nothing; someone who does not gets told
  // every time until they do.
  const simulationRunning = simulation.running;
  useEffect(() => {
    if (simulationRunning) setFlowHintAnswered(false);
  }, [simulationRunning]);

  // The latest currents, for the animation to read without being restarted.
  const wireFlowRef = useRef(simulation.wireFlow);
  wireFlowRef.current = simulation.wireFlow;
  const partFlowRef = useRef(simulation.partFlow);
  partFlowRef.current = simulation.partFlow;

  useEffect(() => {
    if (!flowRunning) return;

    const stage = stageRef.current;
    const layer = stage?.getLayers()[0];
    if (!layer) return;

    let frame = 0;
    let phase = 0;
    let last = performance.now();

    const step = (now: number) => {
      const elapsed = (now - last) / 1000;
      last = now;
      phase += elapsed;

      // Straight onto the nodes. Putting the phase in React state re-rendered
      // every part on the canvas sixty times a second for an effect that only
      // moves a dash offset.
      for (const node of layer.find('.flow-mark')) {
        const id = node.id();
        const current = id.startsWith('partflow-')
          ? partFlowRef.current[id.slice('partflow-'.length)] ?? 0
          : wireFlowRef.current[id.slice('flow-'.length)] ?? 0;
        if (current === 0) continue;

        // Speed and spacing come from the same reading on the same frame, so
        // they can never describe two different currents. The spacing rides
        // along as an attribute for the same reason the phase does: putting it
        // in React state would redraw every part on the canvas sixty times a
        // second to move an arrowhead.
        const pace = getFlowPace(current);
        node.setAttr('flowTravelled', phase * pace.speed);
        node.setAttr('flowSpacing', pace.spacing);
      }

      layer.batchDraw();
      frame = window.requestAnimationFrame(step);
    };

    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [flowRunning]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      // The first measurement can land before the layout settles, and a
      // 0x0 stage takes Konva's buffer canvas down to 0x0 with it — every
      // shape that draws through it then throws InvalidStateError on
      // drawImage and the whole canvas falls into the error boundary.
      // Keep the last usable size until a real one arrives.
      if (width < 1 || height < 1) return;
      setStageSize({ width, height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Buzzers actually buzz. The runtime says which ones are sounding and at what
  // pitch; this is the only thing that turns that into a noise, and it goes
  // quiet the moment the simulation stops or the canvas unmounts.
  useEffect(() => {
    if (!simulation.running) {
      stopAllBuzzers();
      return;
    }

    applyBuzzerVoices(
      components
        .filter((comp) => comp.type === 'buzzer')
        .map((comp) => {
          const state = simulation.componentStates[comp.id] ?? {};
          return {
            id: comp.id,
            frequency: Number(state.frequency) || 0,
            volume: state.sounding === true ? Number(state.volume) || 1 : 0,
          };
        })
    );
  }, [components, simulation.componentStates, simulation.running]);

  useEffect(() => stopAllBuzzers, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Whatever the user is typing into keeps its own keys. This has to ask the
      // target rather than match a tag name: Monaco's input is a plain <div>
      // once the EditContext API is in play, and matching on tag alone let
      // Ctrl+V paste parts instead of text and Backspace delete the selected
      // part while the user was writing code.
      if (isTextEntryTarget(e.target)) return;

      // …and the rest belong to the circuit screen alone. Browsing the palette
      // or reading the serial monitor should not be able to delete a part.
      if (!isCircuitScreenTarget(e.target, containerRef.current)) return;

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (useCircuitStore.getState().canUndo()) {
          useCircuitStore.getState().undo();
          clearTransientCanvasState();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        useCircuitStore.getState().copySelection();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        // Paste where the user is looking. With the pointer off the canvas
        // there is no such place, so the copy steps away from the original
        // instead.
        const at = pointerInsideRef.current ? worldPointerRef.current() : null;
        useCircuitStore.getState().pasteClipboard(at ?? undefined);
        clearTransientCanvasState();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const state = useCircuitStore.getState();
        state.selectComponents(state.components.map((component) => component.id));
        return;
      }

      // Both of the shapes Windows editors use for redo.
      if (
        (e.ctrlKey || e.metaKey) &&
        ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        if (useCircuitStore.getState().canRedo()) {
          useCircuitStore.getState().redo();
          clearTransientCanvasState();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('trigger-save'));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('trigger-open'));
        return;
      }

      const setToolMode = useCircuitStore.getState().setToolMode;
      const selId = useCircuitStore.getState().selectedComponentId;
      const selWireId = useCircuitStore.getState().selectedWireId;

      switch (e.key.toLowerCase()) {
        case 's': setToolMode('select'); break;
        case 'w': setToolMode('wire'); break;
        case 'p': setToolMode('pan'); break;
        case 'd': setToolMode('delete'); break;
        case '[':
          if (selWireId) useCircuitStore.getState().thinWire(selWireId);
          break;
        case ']':
          if (selWireId) useCircuitStore.getState().thickenWire(selWireId);
          break;
        case 'delete':
        case 'backspace':
          if (wiringStateRef.current.active && wiringStateRef.current.bendCount > 0) {
            e.preventDefault();
            setWiringPath((current) => current.slice(0, -2));
            break;
          }
          for (const id of useCircuitStore.getState().selectedComponentIds) {
            useCircuitStore.getState().removeComponent(id);
          }
          if (selId && useCircuitStore.getState().selectedComponentIds.length === 0) {
            useCircuitStore.getState().removeComponent(selId);
          }
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

  /**
   * One undo point per turn of the wheel.
   *
   * A notch at a time would bury the circuit under a snapshot for every click
   * of the wheel, so the first notch of a turn records one and the rest ride
   * along; a pause long enough to have let go starts a fresh one.
   */
  const wheelUndoAtRef = useRef(0);
  const captureWheelUndoSnapshot = useCallback(() => {
    const now = Date.now();
    if (now - wheelUndoAtRef.current > WHEEL_UNDO_GROUPING_MS) captureUndoSnapshot();
    wheelUndoAtRef.current = now;
  }, [captureUndoSnapshot]);

  // Wheel zoom
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = zoom;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // The wheel over a part turns its value instead of the view — whichever
    // value that part is mostly reached for: a resistance, a knob's position, a
    // servo's angle, a battery's charge. Ctrl does the same, so the habit from
    // before still works; over empty board it is the view that moves.
    const world = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };

    // Topmost first, so the part drawn over the others is the one that answers
    // — and boards are always drawn underneath whatever sits on them, whatever
    // order they happen to occupy in the list. A part with no value to turn is
    // looked straight past, down to the one below it.
    const under = components.filter((comp) => {
      const box = getComponentWorldBounds(comp);
      return (
        world.x >= box.left &&
        world.x <= box.right &&
        world.y >= box.top &&
        world.y <= box.bottom
      );
    });
    const inPaintOrder = [
      ...under.filter((comp) => isBreadboardType(comp.type)),
      ...under.filter((comp) => !isBreadboardType(comp.type)),
    ].reverse();

    for (const comp of inPaintOrder) {
      const key = getPrimaryProperty(comp.type, comp.properties);
      if (!key) continue;

      const current = getNumericValue(comp.properties[key], 0);
      const next = stepPropertyValue(comp.type, key, current, e.evt.deltaY > 0 ? -1 : 1);
      if (next !== current) {
        // One snapshot for the whole turn of the wheel, not one per notch:
        // undo should step back to before you started turning it.
        captureWheelUndoSnapshot();
        updateComponentProperty(comp.id, key, next, { recordHistory: false });
      }
      return;
    }

    // Over empty board: the view moves instead, anchored on whatever is under
    // the pointer so it stays under the pointer.
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(0.2, Math.min(3, oldScale + direction * 0.1));

    setZoom(newScale);
    setStagePos({
      x: pointer.x - world.x * newScale,
      y: pointer.y - world.y * newScale,
    });
  }, [captureWheelUndoSnapshot, components, stagePos, updateComponentProperty, zoom]);

  // Drop handler for palette drag
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (useCircuitStore.getState().simulation.running) return;

    const type = e.dataTransfer.getData('componentType') as ComponentType;
    if (!type) return;

    const stage = stageRef.current;
    if (!stage) return;

    const rect = containerRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left - stagePos.x) / zoom;
    const y = (e.clientY - rect.top - stagePos.y) / zoom;

    // A board is placed where it is dropped; everything else looks for a seat.
    const snapped =
      isBreadboardType(type ?? '')
        ? { x: snapToGrid(x), y: snapToGrid(y) }
        : snapToBreadboard(x, y, type, undefined, breadboards);
    addComponent(type, snapped.x, snapped.y);
  }, [zoom, stagePos, addComponent, breadboards]);

  const getWorldPointerPosition = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;

    // Asked of the stage itself rather than worked out from the stored pan and
    // zoom. Middle-button panning moves the Konva node before the store hears
    // about it, and a wheel burst reads one stale anchor for the whole batch —
    // either way the two disagree for a few frames, and anything placed from
    // this during them landed offset by exactly that disagreement.
    const pointer = stage.getRelativePointerPosition();
    if (!pointer || !Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return null;

    return { x: pointer.x, y: pointer.y };
  }, []);

  /** Latest pointer reader, so the window key handler can use it without being
   *  torn down and rebuilt every time the view is panned or zoomed. */
  const worldPointerRef = useRef(getWorldPointerPosition);
  useEffect(() => {
    worldPointerRef.current = getWorldPointerPosition;
  }, [getWorldPointerPosition]);

  /** Whether the pointer is over the canvas at all; Konva keeps reporting the
   *  last position it saw once the mouse has left. */
  const pointerInsideRef = useRef(false);

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
        const { selectedComponentIds: current, selectComponents } = useCircuitStore.getState();
        if (current.length > 1 && current.includes(target.componentId)) {
          // Right-clicking one of several selected parts is asking what can be
          // done to the block, not picking a new part — so the block stays
          // selected, with the one under the cursor as its primary.
          selectComponents([
            ...current.filter((id) => id !== target.componentId),
            target.componentId,
          ]);
        } else {
          selectComponent(target.componentId);
        }
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

  /** The hole under the cursor, and which board it belongs to. */
  const resolveBreadboardHoleAtPointer = useCallback(() => {
    const pointer = getWorldPointerPosition();
    if (!pointer || !isNearAnyBreadboard(pointer.x, pointer.y, breadboards)) {
      return null;
    }

    const nearest = getNearestHoleAcrossBreadboards(pointer.x, pointer.y, breadboards);
    if (!nearest || nearest.distSq > BREADBOARD_WIRE_SNAP_RADIUS_SQ) {
      return null;
    }

    return { breadboardId: nearest.breadboardId, ...nearest.hole };
  }, [breadboards, getWorldPointerPosition]);

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

      const nearestHole = getNearestHoleAcrossBreadboards(x, y, breadboards);
      if (nearestHole) {
        considerTarget(
          nearestHole.breadboardId,
          nearestHole.hole.id,
          nearestHole.hole.x,
          nearestHole.hole.y,
          nearestHole.hole.label
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
    [boardPins, boardPosition, breadboards, components]
  );

  const resetViewport = useCallback(() => {
    setZoom(1);
    setStagePos({ x: 0, y: 0 });
  }, [setStagePos, setZoom]);

  /**
   * Points the view at whatever is on the canvas: everything visible, centred.
   *
   * Opening a project used to leave the camera wherever it happened to be, so a
   * circuit drawn far from the origin — or saved while zoomed in — opened onto
   * empty space. Reads the circuit off the store rather than a closure so it is
   * never looking at the project that was there a moment ago.
   */
  const fitViewToCircuit = useCallback(() => {
    const { width: viewWidth, height: viewHeight } = stageSizeRef.current;
    if (viewWidth < 1 || viewHeight < 1) return;

    const state = useCircuitStore.getState();
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    const include = (x1: number, y1: number, x2: number, y2: number) => {
      left = Math.min(left, x1, x2);
      top = Math.min(top, y1, y2);
      right = Math.max(right, x1, x2);
      bottom = Math.max(bottom, y1, y2);
    };

    const board = getControllerBoardDefinition(state.boardType);
    include(
      state.boardPosition.x,
      state.boardPosition.y,
      state.boardPosition.x + board.width,
      state.boardPosition.y + board.height
    );

    for (const comp of state.components) {
      if (isBreadboardType(comp.type)) {
        // Boards are drawn with Konva shapes, so they have no SVG box to ask.
        const spec = getBreadboardSpec(getBreadboardVariantForType(comp.type));
        include(comp.x, comp.y, comp.x + spec.width, comp.y + spec.height);
        continue;
      }

      const box = getComponentWorldBounds(comp);
      include(box.left, box.top, box.right, box.bottom);
    }

    for (const wire of state.wires) {
      for (let i = 0; i + 1 < wire.points.length; i += 2) {
        include(wire.points[i], wire.points[i + 1], wire.points[i], wire.points[i + 1]);
      }
    }

    if (!Number.isFinite(left) || !Number.isFinite(top)) {
      resetViewport();
      return;
    }

    const margin = 48;
    const contentWidth = Math.max(1, right - left);
    const contentHeight = Math.max(1, bottom - top);
    // Never blown up past life size: a lone resistor filling the screen helps
    // nobody. Only a circuit too big to fit gets pulled back.
    const nextZoom = Math.min(
      1,
      (viewWidth - margin * 2) / contentWidth,
      (viewHeight - margin * 2) / contentHeight
    );

    setZoom(nextZoom);
    setStagePos({
      x: viewWidth / 2 - ((left + right) / 2) * nextZoom,
      y: viewHeight / 2 - ((top + bottom) / 2) * nextZoom,
    });
  }, [resetViewport, setStagePos, setZoom]);

  // A different circuit means the view has to be pointed at it again. Only the
  // token is watched, so ordinary edits leave the camera alone.
  const fitViewRef = useRef(fitViewToCircuit);
  fitViewRef.current = fitViewToCircuit;
  useEffect(() => {
    if (viewResetToken === 0) return;
    fitViewRef.current();
  }, [viewResetToken]);

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

      // Values rather than a whole-component update, so a probe can still be
      // moved onto a live circuit — which is the only reason to hold one.
      updateComponentProperties(component.id, {
        [`${prefix}X`]: nextPosition.x,
        [`${prefix}Y`]: nextPosition.y,
        [dockKey]: docked,
        [keys.componentKey]: target?.componentId ?? '',
        [keys.pinKey]: target?.pinId ?? '',
      });
    },
    [updateComponentProperties]
  );

  const handleMultimeterProbeDragStart = useCallback(
    (componentId: string) => {
      closeContextMenu();
      selectComponent(componentId);
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

    // A selection box released over a part would otherwise end as a click on
    // it, narrowing the whole selection back down to that one part.
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    closeContextMenu();
    const addToSelection = Boolean(
      event && 'ctrlKey' in event.evt && (event.evt.ctrlKey || event.evt.metaKey)
    );

    if (toolMode !== 'delete') {
      // A plain click narrows the selection to the one part, the way every
      // editor behaves. Dragging a group still works: Konva starts the drag
      // before the click, and swallows the click once something has moved.
      if (addToSelection) {
        toggleComponentSelection(comp.id);
      } else {
        selectComponent(comp.id);
      }
      setRightTab('properties');
    }

    if (toolMode === 'select') {
      // A momentary button is pressed and held instead — see the group's
      // onMouseDown below. Only a latching one flips on a click.
      if (comp.type === 'button' && !isMomentaryButton(comp)) {
        updateComponentProperty(comp.id, 'pressed', !comp.properties.pressed);
      }
      if (comp.type === 'switch') {
        updateComponentProperty(comp.id, 'closed', !comp.properties.closed);
      }
    } else if (toolMode === 'delete') {
      removeComponent(comp.id);
    }
  }, [
    toolMode,
    simulation.running,
    closeContextMenu,
    selectComponent,
    selectedComponentIds,
    toggleComponentSelection,
    setRightTab,
    updateComponentProperty,
    removeComponent,
  ]);

  /**
   * Double clicking a part is the way back to the select tool: you can be in the
   * middle of wiring, spot something to move, and just grab it. It works
   * anywhere on the part, pins included — on a small part like an LED the pins
   * cover most of the body, and a double click there is a slip, not a wire.
   */
  const handleComponentDoubleClick = useCallback((
    comp: CircuitComponent,
    event?: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) => {
    if (event) {
      event.cancelBubble = true;
    }

    // The first click of the pair already removed the part in delete mode.
    if (toolMode === 'delete') return;

    clearTransientCanvasState();
    if (toolMode !== 'select') {
      setToolMode('select');
    }
    selectComponent(comp.id);
    setRightTab('properties');
  }, [toolMode, clearTransientCanvasState, setToolMode, selectComponent, setRightTab]);

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
          points: [wiringStart.x, wiringStart.y, ...wiringPath, globalX, globalY],
        });
      }
      setWiringStart(null);
      setWiringMouse(null);
      setWiringPath([]);
    }
  }, [toolMode, wiringStart, wiringPath, wireColor, addWire]);

  // Stage click
  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // A selection box ends with a click on the background; letting it through
    // would clear the selection the box had just made.
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === 'background';
    if (clickedOnEmpty) {
      closeContextMenu();
      if (toolMode === 'wire') {
        const hole = resolveBreadboardHoleAtPointer();
        if (hole) {
          // The board that was actually clicked, not the first one ever added.
          // Naming a fixed id here wrote every wire against the full-size board,
          // so a cable plugged into a mini stayed where it was when the mini
          // moved — it was never attached to it in the first place.
          handlePinClick(hole.breadboardId, hole.id, hole.x, hole.y);
          return;
        }

        // Wiring in progress: the click bends the cable here instead of
        // dropping it, the way Tinkercad routes wires.
        if (wiringStart) {
          // Where the preview is drawn, so a bend lands on the straightened
          // line rather than a pixel off it.
          const bend = wiringMouse ?? getWorldPointerPosition();
          if (bend) {
            setWiringPath((current) => [...current, bend.x, bend.y]);
            setAlignGuides([]);
            return;
          }
        }
      }

      selectComponent(null);
      selectWire(null);
      if (wiringStart) {
        setWiringStart(null);
        setWiringMouse(null);
        setWiringPath([]);
      }
    }
  }, [toolMode, wiringStart, handlePinClick, resolveBreadboardHoleAtPointer, getWorldPointerPosition, selectComponent, selectWire, closeContextMenu]);

  // Mouse move for wiring preview
  const handleMouseMove = useCallback((_e: Konva.KonvaEventObject<MouseEvent>) => {
    pointerInsideRef.current = true;

    const marqueeStart = marqueeStartRef.current;
    if (marqueeStart) {
      const pointer = getWorldPointerPosition();
      if (pointer) {
        if (
          Math.abs(pointer.x - marqueeStart.x) > MARQUEE_THRESHOLD ||
          Math.abs(pointer.y - marqueeStart.y) > MARQUEE_THRESHOLD
        ) {
          marqueeMovedRef.current = true;
        }
        if (marqueeMovedRef.current) {
          const rect = { x1: marqueeStart.x, y1: marqueeStart.y, x2: pointer.x, y2: pointer.y };
          marqueeRectRef.current = rect;
          setMarquee(rect);
        }
      }
      return;
    }

    if (toolMode === 'wire') {
      const pointer = getWorldPointerPosition();
      const hoveredHole = resolveBreadboardHoleAtPointer();
      setHoveredBreadboardHole(hoveredHole);

      if (wiringStart && pointer) {
        if (hoveredHole) {
          // Landing in the right hole beats looking tidy.
          setWiringMouse({ x: hoveredHole.x, y: hoveredHole.y });
          setAlignGuides([]);
          return;
        }

        // Where this segment starts: the last bend placed, or the pin the
        // cable came from.
        const anchor =
          wiringPath.length >= 2
            ? { x: wiringPath[wiringPath.length - 2], y: wiringPath[wiringPath.length - 1] }
            : { x: wiringStart.x, y: wiringStart.y };

        const aligned = snapToAlignment(pointer, [anchor]);
        setWiringMouse(aligned.point);
        setAlignGuides(aligned.guides);
      }
      return;
    }

    setHoveredBreadboardHole(null);
  }, [
    toolMode,
    wiringStart,
    wiringPath,
    getWorldPointerPosition,
    resolveBreadboardHoleAtPointer,
  ]);

  const handleWireBendDrag = useCallback(
    (wireId: string, pointIndex: number, x: number, y: number) => {
      const wire = useCircuitStore.getState().wires.find((item) => item.id === wireId);
      if (!wire) return null;

      // Its neighbours down the cable: lining up with either makes that run
      // level, which is the whole reason to drag a bend.
      const neighbours: Array<{ x: number; y: number }> = [];
      if (pointIndex >= 2) {
        neighbours.push({ x: wire.points[pointIndex - 2], y: wire.points[pointIndex - 1] });
      }
      if (pointIndex + 3 < wire.points.length) {
        neighbours.push({ x: wire.points[pointIndex + 2], y: wire.points[pointIndex + 3] });
      }

      const aligned = snapToAlignment({ x, y }, neighbours);
      setAlignGuides(aligned.guides);

      const nextPoints = [...wire.points];
      nextPoints[pointIndex] = aligned.point.x;
      nextPoints[pointIndex + 1] = aligned.point.y;
      updateWirePoints(wireId, nextPoints);

      return aligned.point;
    },
    [updateWirePoints]
  );

  const handleWireBendRemove = useCallback(
    (wireId: string, pointIndex: number) => {
      const wire = useCircuitStore.getState().wires.find((item) => item.id === wireId);
      if (!wire || wire.points.length <= 4) return;

      captureUndoSnapshot();
      const nextPoints = [...wire.points];
      nextPoints.splice(pointIndex, 2);
      updateWirePoints(wireId, nextPoints);
    },
    [captureUndoSnapshot, updateWirePoints]
  );

  /**
   * Where the last click on a cable landed, so a double-click can be checked.
   *
   * Konva's own double-click window is global and takes no account of where the
   * two clicks were, and it is not cleared once it has fired — so two ordinary
   * clicks anywhere on the same cable within four hundred milliseconds counted
   * as a double-click and put a bend in, and a third quick click put in
   * another. That is where the bends nobody asked for came from.
   */
  /**
   * The click before this one, kept apart from this one.
   *
   * Konva fires `click` and then `dblclick` off the same button release, so a
   * single ref would be overwritten by the second click before the check ran —
   * and the second click always agrees with itself.
   */
  const wireClicksRef = useRef<{ previous: WireClick | null; latest: WireClick | null }>({
    previous: null,
    latest: null,
  });

  const noteWireClick = useCallback(
    (wireId: string) => {
      const pointer = getWorldPointerPosition();
      if (!pointer) return;
      wireClicksRef.current = {
        previous: wireClicksRef.current.latest,
        latest: { wireId, x: pointer.x, y: pointer.y, at: Date.now() },
      };
    },
    [getWorldPointerPosition]
  );

  /** Whether the click before this one was the other half of the same gesture. */
  const isDeliberateDoubleClick = useCallback(
    (wireId: string, x: number, y: number) =>
      isSameGesture(wireClicksRef.current.previous, { wireId, x, y, at: Date.now() }),
    []
  );

  /**
   * Dragging a cable's body breaks it there and drags the new bend.
   *
   * The double-click is kept, but it can never be the only way in: a gesture
   * that has to be recognised from timing is a gesture that fires when you did
   * not mean it. Pulling the cable where you want it to go cannot be mistaken
   * for anything else, and it shows you the result as you make it.
   */
  const wireDragBendRef = useRef<{
    wireId: string;
    startX: number;
    startY: number;
    pointIndex: number | null;
  } | null>(null);

  const beginWireDragBend = useCallback(
    (wireId: string, event: Konva.KonvaEventObject<MouseEvent>) => {
      if (event.evt.button !== 0) return;
      const pointer = getWorldPointerPosition();
      if (!pointer) return;

      // Dragging from the cable must not also start a pan or a selection box.
      event.cancelBubble = true;
      wireDragBendRef.current = { wireId, startX: pointer.x, startY: pointer.y, pointIndex: null };
    },
    [getWorldPointerPosition]
  );

  useEffect(() => {
    const handleMove = () => {
      const drag = wireDragBendRef.current;
      if (!drag) return;

      const pointer = getWorldPointerPosition();
      if (!pointer) return;

      if (drag.pointIndex === null) {
        const travelled = Math.hypot(pointer.x - drag.startX, pointer.y - drag.startY);
        if (travelled < WIRE_DRAG_BEND_THRESHOLD) return;

        const wire = useCircuitStore.getState().wires.find((item) => item.id === drag.wireId);
        if (!wire) return;

        // The bend goes in where the drag *started* — the point on the cable
        // the user took hold of — and follows the pointer from there.
        const insertion = findWireBendInsertion(wire.points, drag.startX, drag.startY);
        if (!insertion) return;

        captureUndoSnapshot();
        const nextPoints = [...wire.points];
        nextPoints.splice(insertion.index + 2, 0, insertion.x, insertion.y);
        updateWirePoints(drag.wireId, nextPoints);
        selectWire(drag.wireId);
        drag.pointIndex = insertion.index + 2;
      }

      handleWireBendDrag(drag.wireId, drag.pointIndex, pointer.x, pointer.y);
    };

    const handleUp = () => {
      if (!wireDragBendRef.current) return;
      wireDragBendRef.current = null;
      setAlignGuides([]);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [captureUndoSnapshot, getWorldPointerPosition, handleWireBendDrag, selectWire, updateWirePoints]);

  /** Double-clicking a cable adds a bend on the segment nearest the pointer. */
  const handleWireAddBend = useCallback(
    (wireId: string) => {
      const wire = useCircuitStore.getState().wires.find((item) => item.id === wireId);
      const pointer = getWorldPointerPosition();
      if (!wire || !pointer) return;
      if (!isDeliberateDoubleClick(wireId, pointer.x, pointer.y)) return;

      // Spent: whatever happens next is a new gesture, not a third click of
      // this one.
      wireClicksRef.current = { previous: null, latest: null };

      const nextPoints = withWireBendAt(wire.points, pointer.x, pointer.y);
      if (!nextPoints) return;

      captureUndoSnapshot();
      updateWirePoints(wireId, nextPoints);
      selectWire(wireId);
    },
    [captureUndoSnapshot, getWorldPointerPosition, isDeliberateDoubleClick, selectWire, updateWirePoints]
  );

  const handleWireEndDragMove = useCallback(
    (wireId: string, end: 'start' | 'end', x: number, y: number) => {
      const wire = useCircuitStore.getState().wires.find((item) => item.id === wireId);
      if (!wire) return;

      // Lining the plug up with the point next to it keeps that run level.
      const neighbour =
        end === 'start'
          ? { x: wire.points[2], y: wire.points[3] }
          : { x: wire.points[wire.points.length - 4], y: wire.points[wire.points.length - 3] };
      const aligned =
        Number.isFinite(neighbour?.x) && Number.isFinite(neighbour?.y)
          ? snapToAlignment({ x, y }, [neighbour])
          : { point: { x, y }, guides: [] as AlignGuide[] };
      setAlignGuides(aligned.guides);

      // The cable follows the cursor while it is unplugged.
      const nextPoints = [...wire.points];
      if (end === 'start') {
        nextPoints[0] = aligned.point.x;
        nextPoints[1] = aligned.point.y;
      } else {
        nextPoints[nextPoints.length - 2] = aligned.point.x;
        nextPoints[nextPoints.length - 1] = aligned.point.y;
      }
      updateWirePoints(wireId, nextPoints);

      const target = resolveProbeSnapTargetAtPosition(aligned.point.x, aligned.point.y, '');
      setWireDrag((current) =>
        current && current.wireId === wireId && current.end === end
          ? { ...current, target }
          : current
      );

      return aligned.point;
    },
    [resolveProbeSnapTargetAtPosition, updateWirePoints]
  );

  const handleWireEndDragEnd = useCallback(
    (wireId: string, end: 'start' | 'end', x: number, y: number) => {
      const target = resolveProbeSnapTargetAtPosition(x, y, '');
      setWireDrag(null);
      setAlignGuides([]);

      if (target) {
        updateWireEndpoint(wireId, end, target.componentId, target.pinId, {
          x: target.x,
          y: target.y,
        });
        return;
      }

      // Nothing to plug into: the end springs back to its socket.
      const wire = useCircuitStore.getState().wires.find((item) => item.id === wireId);
      if (!wire) return;

      const home =
        end === 'start'
          ? resolveWireEndpointPosition(wire.startComponentId, wire.startPinId)
          : resolveWireEndpointPosition(wire.endComponentId, wire.endPinId);
      if (!home) return;

      const nextPoints = [...wire.points];
      if (end === 'start') {
        nextPoints[0] = home.x;
        nextPoints[1] = home.y;
      } else {
        nextPoints[nextPoints.length - 2] = home.x;
        nextPoints[nextPoints.length - 1] = home.y;
      }
      updateWirePoints(wireId, nextPoints);
    },
    [resolveProbeSnapTargetAtPosition, resolveWireEndpointPosition, updateWireEndpoint, updateWirePoints]
  );

  const finalizeComponentDrag = useCallback((
    comp: CircuitComponent,
    node: Konva.Group,
    options?: { recordHistory?: boolean }
  ) => {
    // A board itself is never seated in a board; it just lands on the grid.
    const snapped =
      isBreadboardType(comp.type)
        ? { x: snapToGrid(node.x()), y: snapToGrid(node.y()) }
        : snapToBreadboard(
            node.x(),
            node.y(),
            comp.type,
            comp.pins,
            breadboards,
            getComponentTransform(comp)
          );
    const newX = snapped.x;
    const newY = snapped.y;
    node.x(newX);
    node.y(newY);
    updateComponent(comp.id, { x: newX, y: newY }, options);
  }, [breadboards, updateComponent]);

  useEffect(() => {
    const win = window;

    win.snapToBreadboard = (
      x: number,
      y: number,
      type?: string,
      pins?: Array<{ x: number; y: number }>,
      rotation?: number
    ) => snapToBreadboard(x, y, type, pins, breadboards, { rotation });
    return () => {
      delete win.snapToBreadboard;
    };
  }, [breadboards]);

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
  }, [finalizeComponentDrag, updateComponent]);

  useEffect(() => {
    const handleMiddleRelease = () => stopMiddlePan();

    window.addEventListener('mouseup', handleMiddleRelease);
    window.addEventListener('blur', handleMiddleRelease);

    return () => {
      window.removeEventListener('mouseup', handleMiddleRelease);
      window.removeEventListener('blur', handleMiddleRelease);
    };
  }, [stopMiddlePan]);

  // Closing the selection box. Bound to the window rather than the stage so a
  // drag that ends off-canvas still selects instead of leaving the box behind.
  //
  // In the capture phase, and that is not a detail: Konva listens for mouseup on
  // the stage's own content div, which the event reaches first on the way up, and
  // synthesises its click from there. Released on empty space — the ordinary way
  // to finish a selection box — the press and the release are both on the
  // background rect, so Konva does fire that click, handleStageClick eats the
  // gesture, and a listener sitting in the bubble phase would run afterwards with
  // nothing left to do. Capture on the window runs before any of it.
  useEffect(() => {
    const finishMarquee = () => {
      const start = marqueeStartRef.current;
      const rect = marqueeRectRef.current;
      const moved = marqueeMovedRef.current;

      marqueeStartRef.current = null;
      marqueeRectRef.current = null;
      marqueeMovedRef.current = false;

      if (!start) return;

      if (moved && rect) {
        const { components: current, selectComponents: select } = useCircuitStore.getState();
        select(getComponentsInMarquee(current, rect));
        // Konva only fires its click when the press and the release land on the
        // same shape, so this flag cannot rely on being consumed — it is cleared
        // again on the next mouse down.
        suppressClickRef.current = true;
      }

      setMarquee(null);
    };

    const cancelMarquee = () => {
      marqueeStartRef.current = null;
      marqueeRectRef.current = null;
      marqueeMovedRef.current = false;
      suppressClickRef.current = false;
      setMarquee(null);
    };

    window.addEventListener('mouseup', finishMarquee, true);
    window.addEventListener('blur', cancelMarquee);

    return () => {
      window.removeEventListener('mouseup', finishMarquee, true);
      window.removeEventListener('blur', cancelMarquee);
    };
  }, []);

  // Letting go of a held button. On the window because the mouse is often no
  // longer over the part by the time it comes up — and a button left stuck down
  // would keep the circuit closed with nothing on screen to say why.
  useEffect(() => {
    const release = () => {
      const held = heldButtonRef.current;
      if (!held) return;

      heldButtonRef.current = null;
      useCircuitStore
        .getState()
        .updateComponentProperty(held, 'pressed', false, { recordHistory: false });
    };

    window.addEventListener('mouseup', release);
    window.addEventListener('blur', release);

    return () => {
      window.removeEventListener('mouseup', release);
      window.removeEventListener('blur', release);
    };
  }, []);

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
    // A suppression the last selection box left behind must never reach a fresh
    // gesture and swallow an ordinary click.
    suppressClickRef.current = false;

    if (e.evt.button !== 2) {
      setContextMenu(null);
    }

    if (e.evt.button === 0 && toolMode === 'select') {
      const startedOnEmpty =
        e.target === e.target.getStage() || e.target.name() === 'background';
      if (startedOnEmpty) {
        const pointer = getWorldPointerPosition();
        if (pointer) {
          marqueeStartRef.current = pointer;
          marqueeMovedRef.current = false;
          marqueeRectRef.current = null;
        }
      }
      return;
    }

    if (e.evt.button !== 1) return;

    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    setMiddlePanActive(true);
    stage.draggable(true);
    stage.startDrag();
  }, [toolMode, getWorldPointerPosition]);

  const handleDragStart = useCallback((comp: CircuitComponent, e: Konva.KonvaEventObject<DragEvent>) => {
    closeContextMenu();
    activeDragRef.current = {
      componentId: comp.id,
      node: e.target as Konva.Group,
    };

    if (!selectedComponentIds.includes(comp.id)) {
      selectComponent(comp.id);
    }

    // What comes along: everything else in the selection, plus whatever is
    // plugged into any board that is moving. Dragging one of several selected
    // parts used to move only that one unless the entire circuit happened to be
    // selected, which is not what picking several parts is for.
    const selection =
      selectedComponentIds.length > 1 && selectedComponentIds.includes(comp.id)
        ? selectedComponentIds
        : [comp.id];

    const movingIds = new Set(selection);
    const movingBoards = getBreadboardPlacements(
      components.filter((item) => movingIds.has(item.id) && isBreadboardType(item.type))
    );

    if (movingBoards.length > 0) {
      // Lifting a real breadboard takes what is seated on it, selected or not.
      for (const item of components) {
        if (isBreadboardType(item.type)) continue;
        if (isComponentMountedOnBreadboard(item, movingBoards)) movingIds.add(item.id);
      }
    }

    movingIds.delete(comp.id);

    groupDragRef.current =
      movingIds.size > 0
        ? {
            origin: { x: comp.x, y: comp.y },
            others: components
              .filter((item) => movingIds.has(item.id))
              .map((item) => ({ id: item.id, x: item.x, y: item.y })),
            snapshotTaken: false,
          }
        : null;

    setRightTab('properties');
  }, [
    closeContextMenu,
    components,
    isComponentMountedOnBreadboard,
    selectComponent,
    selectedComponentIds,
    setRightTab,
  ]);

  const handleDragMove = useCallback((comp: CircuitComponent, e: Konva.KonvaEventObject<DragEvent>) => {
    // Lining a part up with another one, the same cue a cable gets. Skipped
    // over a breadboard, where seating in a hole governs and a guide would only
    // promise something the drop is about to overrule.
    if (!isBreadboardType(comp.type) && !isNearAnyBreadboard(e.target.x(), e.target.y(), breadboards)) {
      const anchors = components
        .filter((item) => item.id !== comp.id)
        .map((item) => ({ x: item.x, y: item.y }));
      anchors.push({ x: boardPosition.x, y: boardPosition.y });

      const aligned = snapToAlignment({ x: e.target.x(), y: e.target.y() }, anchors);
      setAlignGuides(aligned.guides);
      if (aligned.guides.length > 0) {
        e.target.x(aligned.point.x);
        e.target.y(aligned.point.y);
      }
    } else {
      setAlignGuides([]);
    }

    // The rest of the block follows the cursor rather than catching up when the
    // part is dropped, so nothing is ever dragged out from under anything else.
    const group = groupDragRef.current;
    if (group && group.others.length > 0) {
      const dx = e.target.x() - group.origin.x;
      const dy = e.target.y() - group.origin.y;

      if (dx !== 0 || dy !== 0) {
        if (!group.snapshotTaken) {
          // Before the first move, or undo would restore a half-dragged block.
          group.snapshotTaken = true;
          captureUndoSnapshot();
        }

        const moved = new Map(group.others.map((item) => [item.id, item]));
        useCircuitStore.setState((state) => ({
          components: state.components.map((component) => {
            const start = moved.get(component.id);
            return start ? { ...component, x: start.x + dx, y: start.y + dy } : component;
          }),
        }));
      }
    }

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
  }, [boardPosition, breadboards, captureUndoSnapshot, components]);

  const handleDragEnd = useCallback((comp: CircuitComponent, e: Konva.KonvaEventObject<DragEvent>) => {
    if (comp.type === 'multimeter') {
      draggedComponentPositionsRef.current[comp.id] = {
        x: e.target.x(),
        y: e.target.y(),
      };
    }
    activeDragRef.current = null;
    setAlignGuides([]);

    const group = groupDragRef.current;
    groupDragRef.current = null;
    const hasGroup = Boolean(group) && group!.others.length > 0;

    // The dragged part settles first — onto a hole, or onto the grid — and the
    // block then moves by however far it actually ended up going. Taking the
    // raw cursor delta instead left the others a snap's width out of place.
    finalizeComponentDrag(comp, e.target as Konva.Group, hasGroup ? { recordHistory: false } : undefined);

    if (hasGroup) {
      const dx = e.target.x() - group!.origin.x;
      const dy = e.target.y() - group!.origin.y;

      if (dx !== 0 || dy !== 0) {
        if (!group!.snapshotTaken) captureUndoSnapshot();
        for (const other of group!.others) {
          updateComponent(other.id, { x: other.x + dx, y: other.y + dy }, { recordHistory: false });
        }
      }
    }

    if (comp.type === 'multimeter') {
      delete draggedComponentPositionsRef.current[comp.id];
      setDragPreviewVersion((version) => version + 1);
    }
  }, [captureUndoSnapshot, finalizeComponentDrag, updateComponent]);

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

  const activeBreadboardHole = (() => {
    if (!wiringStart) return null;

    const board = breadboards.find((item) => item.id === wiringStart.componentId);
    return board ? getBreadboardHoleGlobal(wiringStart.pinId, board, board.variant) : null;
  })();

  // One canvas shape instead of 8000 Konva nodes. Redrawn when the theme
  // changes, which the dependency below is the whole reason for: the shape is
  // memoised, so without it the dots would keep the colour they were born with.
  const gridColor = canvasTheme.grid;
  const gridDots = useMemo(
    () => (
      <Shape
        listening={false}
        perfectDrawEnabled={false}
        sceneFunc={(context) => {
          context.beginPath();
          for (let column = 0; column < GRID_COLUMNS; column += 1) {
            for (let row = 0; row < GRID_ROWS; row += 1) {
              const x = column * GRID_SPACING;
              const y = row * GRID_SPACING;
              context.moveTo(x + GRID_DOT_RADIUS, y);
              context.arc(x, y, GRID_DOT_RADIUS, 0, Math.PI * 2, false);
            }
          }
          context.fillStyle = gridColor;
          context.fill();
        }}
      />
    ),
    [gridColor]
  );

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
              setRightTab('properties');
            })}>
              <span>{t(language, 'select')}</span>
            </button>
            <button className="context-menu-item" onClick={action(() => {
              selectComponent(selectedComponent.id);
              setToolMode('wire');
            })}>
              <span>{t(language, 'startWire')}</span>
            </button>
            <button className="context-menu-item" onClick={action(() => {
              // Every selected part turns by ninety degrees, each about itself
              // and each re-seated on its own holes. A quarter turn is a
              // relative move, so parts that were at different angles stay that
              // way rather than being flattened to a single one.
              const turning = selectedComponentIds.includes(selectedComponent.id)
                ? components.filter((item) => selectedComponentIds.includes(item.id))
                : [selectedComponent];

              captureUndoSnapshot();
              for (const item of turning) {
                const nextRotation = (item.rotation + 90) % 360;
                const snapped = snapPinsToBreadboards(
                  item.x,
                  item.y,
                  getTransformedPins(item.pins, {
                    ...getComponentTransform(item),
                    rotation: nextRotation,
                  }),
                  breadboards
                );

                updateComponent(
                  item.id,
                  {
                    rotation: nextRotation,
                    ...(snapped ? { x: snapped.x, y: snapped.y } : {}),
                  },
                  { recordHistory: false }
                );
              }
            })}>
              <span>{t(language, 'rotate90')}</span>
            </button>
            <button className="context-menu-item" onClick={action(() => {
              useCircuitStore.getState().duplicateComponent(selectedComponent.id);
            })}>
              <span>{t(language, 'contextMenuDuplicate')}</span>
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
            <button
              className={`context-menu-item${canRedo ? '' : ' disabled'}`}
              disabled={!canRedo}
              onClick={action(() => {
                if (useCircuitStore.getState().canRedo()) {
                  useCircuitStore.getState().redo();
                }
              })}
            >
              <span>{t(language, 'redo')}</span>
            </button>
            <button className="context-menu-item" onClick={action(resetViewport)}>
              <span>{t(language, 'resetZoom')}</span>
            </button>
            <button className="context-menu-item" onClick={action(() => setRightTab('ai'))}>
              <span>{t(language, 'openAIPanel')}</span>
            </button>
          </>
        );
    }
  };

  /**
   * One part, drawn where it sits.
   *
   * Called twice below: once for the boards and once for everything else,
   * because a cable run to a board has to lie on top of it. Drawing every
   * part in one pass put the boards over the wiring and hid it.
   */
  const renderComponent = (comp: CircuitComponent) => (
            <Group
              key={comp.id}
              x={comp.x}
              y={comp.y}
              rotation={comp.rotation}
              scaleX={comp.scale ?? 1}
              scaleY={comp.scale ?? 1}
              draggable={toolMode === 'select' && !middlePanActive && !circuitLocked}
              // A board stops listening while wiring so a click reaches the
              // stage, which is what turns a point into the hole under it.
              listening={!isBreadboardType(comp.type) || toolMode === 'select'}
              onMouseDown={(e) => {
                // Pressing the part is the whole gesture for a momentary
                // button: it closes here and opens again on the window's mouse
                // up. Deliberately not cancelling the bubble — the stage still
                // needs this event to clear its own click suppression.
                if (e.evt.button !== 0 || toolMode !== 'select') return;
                if (!isMomentaryButton(comp)) return;

                heldButtonRef.current = comp.id;
                updateComponentProperty(comp.id, 'pressed', true, { recordHistory: false });
              }}
              onDragStart={(e) => handleDragStart(comp, e)}
              onDragMove={(e) => handleDragMove(comp, e)}
              onDragEnd={(e) => handleDragEnd(comp, e)}
              onClick={(e) => handleComponentClick(comp, e)}
              onTap={(e) => handleComponentClick(comp, e)}
              onDblClick={(e) => handleComponentDoubleClick(comp, e)}
              onDblTap={(e) => handleComponentDoubleClick(comp, e)}
              onMouseEnter={() => {
                // Hovering mid-pan would re-render and yank the view back, so
                // labels stay quiet until the background is let go of.
                if (stageDragging) return;
                setHoveredComponentId(comp.id);
              }}
              onMouseLeave={() =>
                setHoveredComponentId((current) => (current === comp.id ? null : current))
              }
              onContextMenu={(e) => {
                e.evt.preventDefault();
                e.cancelBubble = true;
                openContextMenu(e.evt, { kind: 'component', componentId: comp.id });
              }}
            >
              {isBreadboardType(comp.type) ? (
                <Breadboard variant={getBreadboardVariantForType(comp.type)} />
              ) : (
                <ComponentShape
                  comp={comp}
                  isSelected={
                    selectedComponentIds.includes(comp.id) || selectedComponentId === comp.id
                  }
                  simulation={simulation}
                  language={language}
                />
              )}

              {/* Solder blobs on the legs that actually took hold. Whether a
                  part is truly connected is the one thing a flat drawing hides,
                  so every leg a cable reaches or a breadboard hole holds wears
                  one, all the time — the question is worth answering at a
                  glance, not only for whatever happens to be selected. Drawn
                  inside the part's own group, so they follow it through
                  rotation, mirroring and scale. */}
              {getMirroredPins(comp.pins, comp.flipX)
                  .filter((pin) => solderedPinKeys.has(pinKey(comp.id, pin.id)))
                  .map((pin) => (
                    <Circle
                      key={`solder-${pin.id}`}
                      x={pin.x}
                      y={pin.y}
                      radius={SOLDER_BLOB_RADIUS}
                      fillRadialGradientStartPoint={{ x: -1.3, y: -1.3 }}
                      fillRadialGradientStartRadius={0}
                      fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                      fillRadialGradientEndRadius={SOLDER_BLOB_RADIUS}
                      fillRadialGradientColorStops={[
                        0, '#f4f8fc',
                        0.45, '#b9c6d4',
                        1, '#6b7a8a',
                      ]}
                      stroke="#39434e"
                      strokeWidth={0.4}
                      shadowColor="#000"
                      shadowBlur={2}
                      shadowOpacity={0.45}
                      shadowOffsetY={0.6}
                      // Fill + stroke + shadow would otherwise route every blob
                      // through the stage-sized buffer canvas: needless work per
                      // blob, and the one shape that crashed on a 0x0 stage.
                      perfectDrawEnabled={false}
                      shadowForStrokeEnabled={false}
                      listening={false}
                    />
                  ))}

              {/* Clickable pin areas (for wiring) */}
              {toolMode === 'wire' && (() => {
                const mirroredPins = getMirroredPins(comp.pins, comp.flipX);
                const { radius: pinRadius, hitStrokeWidth } = getWirePinTargetSize(mirroredPins);

                return getWirePinHandles(mirroredPins).map((handle) => {
                  const isSelectedPin =
                    wiringStart?.componentId === comp.id &&
                    wiringStart?.pinId === handle.pin.id;
                  const isHoveredPin =
                    hoveredPin?.componentId === comp.id && hoveredPin?.pinId === handle.pin.id;
                  const pinWorldPosition = getComponentPinWorldPosition(
                    comp,
                    handle.pin.id
                  );
                  const connect = (e: Konva.KonvaEventObject<Event>) => {
                    e.cancelBubble = true;
                    if (!pinWorldPosition) return;
                    handlePinClick(
                      comp.id,
                      handle.pin.id,
                      pinWorldPosition.x,
                      pinWorldPosition.y
                    );
                  };

                  return (
                    <Group key={handle.pin.id}>
                      <Circle
                        x={handle.targetX}
                        y={handle.targetY}
                        radius={isHoveredPin ? pinRadius * 1.35 : pinRadius}
                        fill={
                          isSelectedPin
                            ? 'rgba(255, 255, 255, 0.28)'
                            : isHoveredPin
                              ? 'rgba(78, 204, 163, 0.45)'
                              : 'rgba(78, 204, 163, 0.2)'
                        }
                        stroke={isSelectedPin || isHoveredPin ? '#fff' : '#4ecca3'}
                        strokeWidth={isSelectedPin || isHoveredPin ? 1.8 : 1.2}
                        hitStrokeWidth={hitStrokeWidth}
                        onMouseEnter={() =>
                          setHoveredPin({ componentId: comp.id, pinId: handle.pin.id })
                        }
                        onMouseLeave={() =>
                          setHoveredPin((current) =>
                            current?.componentId === comp.id && current?.pinId === handle.pin.id
                              ? null
                              : current
                          )
                        }
                        onClick={connect}
                        onTap={connect}
                      />
                      {/* Which leg the click will actually take, spelled out —
                          on a part with legs this close together the circles
                          alone are too small to tell apart. Sits on its own
                          plate so it stays readable over the artwork. */}
                      {isHoveredPin && (
                        <>
                          <Rect
                            x={handle.targetX - 30}
                            y={handle.targetY - pinRadius - 16}
                            width={60}
                            height={13}
                            cornerRadius={3}
                            fill={canvasTheme.pinLabelFill}
                            stroke="#4ecca3"
                            strokeWidth={0.6}
                            listening={false}
                          />
                          <Text
                            text={handle.pin.name || handle.pin.id}
                            x={handle.targetX - 30}
                            y={handle.targetY - pinRadius - 13}
                            width={60}
                            align="center"
                            fontSize={8.5}
                            fontStyle="bold"
                            fill="#eaf6f1"
                            listening={false}
                          />
                        </>
                      )}
                    </Group>
                  );
                });
              })()}

              {/* Component name label — only while hovered, so it doesn't clutter a
                  full canvas; the selected component's name already shows in the
                  properties panel, so selection alone no longer reveals it here */}
              {hoveredComponentId === comp.id && (
                <Text
                  text={getCanvasComponentLabel(language, comp)}
                  x={-32}
                  y={Math.max(25, componentArtworkBottom(comp.type) + 3)}
                  width={64}
                  align="center"
                  fontSize={7}
                  fill="#666"
                  listening={false}
                />
              )}
            </Group>
  );

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
        // Only the pan tool (and the middle mouse button) moves the view.
        // Select mode used to drag the background too, which shifted every part
        // while the board and the breadboard stayed put — tearing the circuit
        // apart. There, dragging empty space draws a selection box instead.
        draggable={isStagePanning}
        onDragStart={(e) => {
          if (e.target !== e.target.getStage()) return;
          setStageDragging(true);
        }}
        onDragMove={(e) => {
          if (e.target !== e.target.getStage()) return;
          // The stage's x/y are controlled props, so any re-render during the
          // drag (a hover changing, the simulation ticking) would otherwise
          // slam the view back to the last committed position — which is what
          // made panning snap back instead of following the cursor.
          if (isStagePanning) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onDragEnd={(e) => {
          // A dragged part's own dragend bubbles up here too; only the stage's
          // own drag (started on empty background — a part's Group is a
          // closer draggable ancestor and takes the gesture first) is ours.
          if (e.target !== e.target.getStage()) return;

          setStageDragging(false);
          setStagePos({ x: e.target.x(), y: e.target.y() });
        }}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          pointerInsideRef.current = false;
          setHoveredBreadboardHole(null);
        }}
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
            fill={canvasTheme.background}
          />

          {/* Grid dots */}
          {gridDots}

          {/* Controller board */}
          <Group
            x={boardPosition.x}
            y={boardPosition.y}
            draggable={toolMode === 'select' && !middlePanActive && !circuitLocked}
            onDragStart={handleBoardDragStart}
            onDragMove={handleBoardDragMove}
            onDragEnd={handleBoardDragEnd}
            onContextMenu={(e) => {
              e.evt.preventDefault();
              e.cancelBubble = true;
              openContextMenu(e.evt, { kind: 'board' });
            }}
          >
            <ControllerBoard
              board={currentBoard}
              builtinLedBrightness={builtinLedBrightness}
            />

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

          {/* Boards, under the wiring: a cable run across one lies on it. */}
          {components
            .filter((comp) => isBreadboardType(comp.type))
            .map(renderComponent)}

          {/* Legs bent to reach their holes. Over the board, under the parts:
              the lead comes out from beneath the body, the way it does on a
              real one. */}
          {breadboardLeads.map((lead) => (
            <Line
              key={`lead-${lead.componentId}-${lead.pinId}`}
              points={[lead.pinX, lead.pinY, lead.holeX, lead.holeY]}
              stroke={LEAD_COLOR}
              strokeWidth={LEAD_WIDTH}
              lineCap="round"
              listening={false}
              perfectDrawEnabled={false}
            />
          ))}

          {/* Wires - 3D style */}
          {wires.map((wire) => {
            const isWireSelected = selectedWireId === wire.id;
            const wireWidth = wire.width ?? WIRE_DEFAULT_WIDTH;
            // Every layer of the cable, and the arrows over it, draw from the
            // same rounded run so nothing drifts off the corners.
            const drawPoints = roundWirePoints(wire.points, WIRE_CORNER_RADIUS);
            const bendIndices: number[] = [];
            for (let i = 2; i + 2 < wire.points.length; i += 2) {
              bendIndices.push(i);
            }
            return (
              <Group key={wire.id}>
                {/* Shadow */}
                <Line points={drawPoints.map((v, i) => i % 2 === 1 ? v + 1.5 : v)} stroke="#000" strokeWidth={wireWidth + 0.8} opacity={0.2} lineCap="round" lineJoin="round" listening={false} />
                {/* Main cable */}
                <Line points={drawPoints} stroke={wire.color} strokeWidth={wireWidth} lineCap="round" lineJoin="round" hitStrokeWidth={Math.max(12, wireWidth + 8)}
                  // A cable stops listening while wiring, the same as a board
                  // does. Its click band is wider than a hole pitch and sits
                  // right on the hole it ends in, so it was catching the click
                  // meant for that hole — which is why a second cable could not
                  // be plugged in beside the first one. The hole even lit up
                  // green, because the highlight never asked the hit test.
                  listening={toolMode !== 'wire'}
                  onMouseDown={(e) => {
                    if (toolMode !== 'select') return;
                    beginWireDragBend(wire.id, e);
                  }}
                  onClick={() => {
                    if (toolMode === 'delete') { removeWire(wire.id); }
                    else {
                      noteWireClick(wire.id);
                      selectWire(wire.id);
                    }
                  }}
                  onDblClick={(e) => {
                    if (toolMode === 'delete') return;
                    e.cancelBubble = true;
                    handleWireAddBend(wire.id);
                  }}
                  onContextMenu={(e) => {
                    e.evt.preventDefault();
                    e.cancelBubble = true;
                    openContextMenu(e.evt, { kind: 'wire', wireId: wire.id });
                  }}
                />
                {/* Highlight stripe */}
                <Line points={drawPoints.map((v, i) => i % 2 === 1 ? v - 0.6 : v)} stroke="#fff" strokeWidth={wireWidth * 0.25} opacity={0.25} lineCap="round" lineJoin="round" listening={false} />
                {/* Where the current is going, while Shift is held. Round dashes
                    marching along the cable: the offset runs backwards so they
                    travel from the supply towards ground, which is the way the
                    sign points. */}
                {(() => {
                  if (!flowRunning) return null;
                  const current = simulation.wireFlow[wire.id] ?? 0;

                  // Carrying nothing — a cable to nowhere, a branch that is
                  // switched off. It still gets marked, because "show the
                  // current everywhere" has to answer for the cables with none;
                  // grey and still, and pointing nowhere, because inventing a
                  // direction for a zero is how arrows come out backwards.
                  if (Math.abs(current) < FLOW_MIN_CURRENT) {
                    return (
                      <Line
                        points={drawPoints}
                        stroke={canvasTheme.flowIdle}
                        strokeWidth={Math.max(1, wireWidth * 0.5)}
                        dash={FLOW_IDLE_DASH}
                        opacity={FLOW_IDLE_OPACITY}
                        lineCap="round"
                        lineJoin="round"
                        listening={false}
                      />
                    );
                  }

                  const direction = current > 0 ? 1 : -1;

                  return (
                    <Shape
                      id={`flow-${wire.id}`}
                      name="flow-mark"
                      fill={canvasTheme.flowFill}
                      stroke={canvasTheme.flowStroke}
                      strokeWidth={0.5}
                      shadowColor={canvasTheme.flowGlow}
                      shadowBlur={5}
                      opacity={0.98}
                      perfectDrawEnabled={false}
                      shadowForStrokeEnabled={false}
                      listening={false}
                      sceneFunc={(context, shape) => {
                        drawFlowArrows(
                          context,
                          shape,
                          drawPoints,
                          direction,
                          Number(shape.getAttr('flowTravelled')) || 0,
                          Number(shape.getAttr('flowSpacing')) || 0
                        );
                      }}
                    />
                  );
                })()}
                {/* Selection indicator */}
                {isWireSelected && (
                  <Line points={drawPoints} stroke="#fff" strokeWidth={wireWidth + 1.8} dash={[4, 4]} opacity={0.5} lineCap="round" lineJoin="round" listening={false} />
                )}
                {/* Bend handles: drag to reshape, double-click to remove */}
                {isWireSelected && toolMode === 'select' &&
                  bendIndices.map((pointIndex) => (
                    <Circle
                      key={`${wire.id}-bend-${pointIndex}`}
                      x={wire.points[pointIndex]}
                      y={wire.points[pointIndex + 1]}
                      radius={WIRE_BEND_HANDLE_RADIUS}
                      fill="rgba(255, 255, 255, 0.9)"
                      stroke={wire.color}
                      strokeWidth={1.6}
                      hitStrokeWidth={14}
                      listening={wireHandlesArmed}
                      draggable
                      onDragStart={(e) => {
                        e.cancelBubble = true;
                        captureUndoSnapshot();
                      }}
                      onDragMove={(e) => {
                        e.cancelBubble = true;
                        const snapped = handleWireBendDrag(
                          wire.id,
                          pointIndex,
                          e.target.x(),
                          e.target.y()
                        );
                        if (snapped) {
                          e.target.x(snapped.x);
                          e.target.y(snapped.y);
                        }
                      }}
                      onDragEnd={(e) => {
                        e.cancelBubble = true;
                        setAlignGuides([]);
                      }}
                      onDblClick={(e) => {
                        e.cancelBubble = true;
                        handleWireBendRemove(wire.id, pointIndex);
                      }}
                      onMouseDown={(e) => {
                        e.cancelBubble = true;
                      }}
                    />
                  ))}
                {/* End caps double as the plugs you can pull out */}
                {wire.points.length >= 4 && (
                  <>
                    <Circle x={wire.points[0]} y={wire.points[1]} radius={2.5} fill={wire.color} stroke="#000" strokeWidth={0.5} listening={false} />
                    <Circle x={wire.points[wire.points.length - 2]} y={wire.points[wire.points.length - 1]} radius={2.5} fill={wire.color} stroke="#000" strokeWidth={0.5} listening={false} />
                  </>
                )}
                {isWireSelected && toolMode === 'select' && wire.points.length >= 4 &&
                  (['start', 'end'] as const).map((end) => {
                    const index = end === 'start' ? 0 : wire.points.length - 2;
                    const dragging = wireDrag?.wireId === wire.id && wireDrag.end === end;

                    return (
                      <Circle
                        key={`${wire.id}-plug-${end}`}
                        x={wire.points[index]}
                        y={wire.points[index + 1]}
                        radius={WIRE_PLUG_HANDLE_RADIUS}
                        listening={wireHandlesArmed}
                        fill={dragging ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.14)'}
                        stroke="#fff"
                        strokeWidth={1.8}
                        hitStrokeWidth={16}
                        draggable
                        onMouseDown={(e) => {
                          e.cancelBubble = true;
                        }}
                        onDragStart={(e) => {
                          e.cancelBubble = true;
                          captureUndoSnapshot();
                          setWireDrag({ wireId: wire.id, end, target: null });
                        }}
                        onDragMove={(e) => {
                          e.cancelBubble = true;
                          const snapped = handleWireEndDragMove(
                            wire.id,
                            end,
                            e.target.x(),
                            e.target.y()
                          );
                          if (snapped) {
                            e.target.x(snapped.x);
                            e.target.y(snapped.y);
                          }
                        }}
                        onDragEnd={(e) => {
                          e.cancelBubble = true;
                          handleWireEndDragEnd(wire.id, end, e.target.x(), e.target.y());
                        }}
                      />
                    );
                  })}
              </Group>
            );
          })}

          {/* The lines that say "this is in line with that" — the same cue
              Tinkercad gives, drawn along whichever axis snapped and stretched
              a little past both ends so they read as guides, not as parts of
              the circuit. Set while drawing a cable, while reshaping one at a
              bend or a plug, and while sliding a part around. */}
          {alignGuides.length > 0 && (
            <Group listening={false}>
              {alignGuides.map((guide, index) => (
                <Line
                  key={`align-${guide.axis}-${index}`}
                  points={
                    guide.axis === 'horizontal'
                      ? [
                          Math.min(guide.from.x, guide.to.x) - 26,
                          guide.from.y,
                          Math.max(guide.from.x, guide.to.x) + 26,
                          guide.from.y,
                        ]
                      : [
                          guide.from.x,
                          Math.min(guide.from.y, guide.to.y) - 26,
                          guide.from.x,
                          Math.max(guide.from.y, guide.to.y) + 26,
                        ]
                  }
                  stroke="#4aa3ff"
                  strokeWidth={1}
                  dash={[5, 4]}
                  opacity={0.9}
                  listening={false}
                />
              ))}
            </Group>
          )}

          {/* Where the plug in hand would land */}
          {wireDrag?.target && (
            <Group listening={false}>
              <Circle
                x={wireDrag.target.x}
                y={wireDrag.target.y}
                radius={9}
                fill="rgba(78, 204, 163, 0.22)"
                stroke="#4ecca3"
                strokeWidth={1.6}
              />
              <Text
                text={wireDrag.target.label}
                x={wireDrag.target.x - 22}
                y={wireDrag.target.y - 20}
                width={44}
                align="center"
                fontSize={8}
                fill="#d5f5ea"
              />
            </Group>
          )}

          {/* Wiring preview line */}
          {wiringStart && wiringMouse && (() => {
            const previewPoints = roundWirePoints(
              [wiringStart.x, wiringStart.y, ...wiringPath, wiringMouse.x, wiringMouse.y],
              WIRE_CORNER_RADIUS
            );
            return (
              <Group listening={false}>
                <Line points={previewPoints} stroke="#000" strokeWidth={4} opacity={0.15} lineCap="round" lineJoin="round" listening={false} />
                <Line points={previewPoints} stroke={wireColor} strokeWidth={2.5} dash={[6, 4]} lineCap="round" lineJoin="round" listening={false} />
                {/* Bends placed so far */}
                {Array.from({ length: wiringPath.length / 2 }, (_, index) => (
                  <Circle
                    key={`wiring-bend-${index}`}
                    x={wiringPath[index * 2]}
                    y={wiringPath[index * 2 + 1]}
                    radius={3.2}
                    fill="#fff"
                    stroke={wireColor}
                    strokeWidth={1.4}
                    listening={false}
                  />
                ))}
              </Group>
            );
          })()}

          {/* The parts themselves, over the wiring they are joined by. */}
          {components
            .filter((comp) => !isBreadboardType(comp.type))
            .map(renderComponent)}

          {/* The current running through the parts themselves. Without these the
              arrows stop at every resistor and LED and the loop reads as broken.
              Drawn over the parts: under them the artwork covered its own
              arrow, which is exactly the bit worth seeing. */}
          {flowRunning &&
            components.map((comp) => {
              const branches = Object.entries(simulation.partFlow).filter(([key]) =>
                key.startsWith(`${comp.id}|`)
              );
              if (branches.length === 0) return null;

              return (
                <Group key={`partflow-${comp.id}`} listening={false}>
                  {branches.map(([key, current]) => {
                    const [, fromPin, toPin] = key.split('|');
                    const from = getComponentPinWorldPosition(comp, fromPin);
                    const to = getComponentPinWorldPosition(comp, toPin);
                    if (!from || !to) return null;

                    // Nothing through this leg: marked the same grey as a dead
                    // cable, so a switched-off part reads as part of the circuit
                    // rather than as something the display forgot.
                    if (Math.abs(current) < FLOW_MIN_CURRENT) {
                      return (
                        <Line
                          key={key}
                          points={[from.x, from.y, to.x, to.y]}
                          stroke={canvasTheme.flowIdle}
                          strokeWidth={1.4}
                          dash={FLOW_IDLE_DASH}
                          opacity={FLOW_IDLE_OPACITY}
                          lineCap="round"
                          listening={false}
                        />
                      );
                    }

                    const direction = current > 0 ? 1 : -1;
                    return (
                      <Shape
                        key={key}
                        id={`partflow-${key}`}
                        name="flow-mark"
                        fill={canvasTheme.flowFill}
                        stroke={canvasTheme.flowStroke}
                        strokeWidth={0.5}
                        shadowColor={canvasTheme.flowGlow}
                        shadowBlur={5}
                        opacity={0.98}
                        perfectDrawEnabled={false}
                        shadowForStrokeEnabled={false}
                        listening={false}
                        sceneFunc={(context, shape) => {
                          drawFlowArrows(
                            context,
                            shape,
                            [from.x, from.y, to.x, to.y],
                            direction,
                            Number(shape.getAttr('flowTravelled')) || 0,
                            Number(shape.getAttr('flowSpacing')) || 0
                          );
                        }}
                      />
                    );
                  })}
                </Group>
              );
            })}

          {components
            .filter((comp) => comp.type === 'multimeter')
            .map((comp) => {
              // Straight from the pin: a tip sits on what it is measuring and
              // stays there. Only the bodies move.
              const blackTip = getMultimeterProbeWorldPosition(comp, 'black');
              const redTip = getMultimeterProbeWorldPosition(comp, 'red');
              const fan = getProbeFanAngles(blackTip, redTip);
              const blackAnchor = getMultimeterProbeAnchorWorldPosition(comp, 'black');
              const redAnchor = getMultimeterProbeAnchorWorldPosition(comp, 'red');
              const mode = getMultimeterMode(comp.properties.mode);
              const blackRotation =
                (Math.atan2(blackTip.y - blackAnchor.y, blackTip.x - blackAnchor.x) * 180) /
                  Math.PI -
                90 +
                fan.black;
              const redRotation =
                (Math.atan2(redTip.y - redAnchor.y, redTip.x - redAnchor.x) * 180) / Math.PI -
                90 +
                fan.red;

              /**
               * Where the lead actually joins the probe: the boot at the back of
               * the handle, not the needle. The probe artwork is drawn tip-first
               * at the touch point and turned to face it, so its back sits one
               * probe-length up that same line.
               */
              const cableEnd = (
                tip: { x: number; y: number },
                anchor: { x: number; y: number }
              ) => {
                const dx = tip.x - anchor.x;
                const dy = tip.y - anchor.y;
                const length = Math.hypot(dx, dy);
                if (length < 1) return tip;

                // A docked probe sits close to the meter; the lead cannot reach
                // further back than the meter itself.
                const back = Math.min(PROBE_IMAGE_HEIGHT - 4, length * 0.6);
                return { x: tip.x - (dx / length) * back, y: tip.y - (dy / length) * back };
              };

              // Turned with the body it joins, or the lead would hang in mid
              // air where the handle used to be.
              const blackCable = rotateAround(cableEnd(blackTip, blackAnchor), blackTip, fan.black);
              const redCable = rotateAround(cableEnd(redTip, redAnchor), redTip, fan.red);

              return (
                <Group key={`${comp.id}-multimeter-probes`}>
                  <Line
                    points={[
                      blackAnchor.x,
                      blackAnchor.y,
                      blackAnchor.x - 26,
                      blackAnchor.y + 12,
                      blackCable.x - 12,
                      blackCable.y - 28,
                      blackCable.x,
                      blackCable.y,
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
                      blackCable.x - 10,
                      blackCable.y - 30,
                      blackCable.x,
                      blackCable.y,
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
                      redCable.x + 10,
                      redCable.y - 30,
                      redCable.x,
                      redCable.y,
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
                      redCable.x + 8,
                      redCable.y - 30,
                      redCable.x,
                      redCable.y,
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
                    <Circle
                      y={PROBE_GRIP_OFFSET}
                      radius={11}
                      fill="rgba(255,255,255,0.001)"
                    />
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
                    <Circle
                      y={PROBE_GRIP_OFFSET}
                      radius={11}
                      fill="rgba(255,255,255,0.001)"
                    />
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

          {/* Selection box */}
          {marquee && (
            <Rect
              x={Math.min(marquee.x1, marquee.x2)}
              y={Math.min(marquee.y1, marquee.y2)}
              width={Math.abs(marquee.x2 - marquee.x1)}
              height={Math.abs(marquee.y2 - marquee.y1)}
              fill={canvasTheme.marqueeFill}
              stroke="#5ea0ff"
              strokeWidth={1}
              dash={[4, 4]}
              listening={false}
            />
          )}
        </Layer>
      </Stage>

      {/* How to see the current. Dropped below the warnings bar when there is
          one: that sits top-centre and grows to nine tenths of a narrow canvas,
          so the two would meet. Hiding the hint instead would have meant nobody
          with a warning on screen — which is most people, most of the time —
          ever saw it. */}
      {simulation.running && !flowHintAnswered && (
        <div className={`flow-hint${visibleWarnings.length > 0 ? ' below-warnings' : ''}`}>
          {t(language, 'flowHint')}
        </div>
      )}

      {/* Zoom indicator */}
      <div className="zoom-info">
        {Math.round(zoom * 100)}% | {t(language, 'componentsLabel')}: {components.length} | {t(language, 'wiresLabel')}: {wires.length}
      </div>

      {/* Circuit warnings — burned parts, a sketch with nothing to run, a failed verify, etc. */}
      {visibleWarnings.length > 0 && (
        <div className="circuit-warnings">
          <div className="circuit-warnings-header">
            <div className="circuit-warnings-title">
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                <path
                  d="M12 3.5 22 20.5H2z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <rect x="11.1" y="9.5" width="1.8" height="5.5" rx="0.9" fill="currentColor" />
                <circle cx="12" cy="17.3" r="1" fill="currentColor" />
              </svg>
              {t(language, 'circuitWarningsTitle')}
            </div>
            <button
              type="button"
              className="circuit-warnings-dismiss"
              aria-label={t(language, 'close')}
              onClick={() => setDismissedWarningsKey(warningsKey)}
            >
              ×
            </button>
          </div>
          {visibleWarnings.map((warning) => {
            const clickable = Boolean(warning.componentId || warning.jumpToTab);
            const onActivate = () => {
              if (warning.componentId) {
                selectComponent(warning.componentId);
                setRightTab('properties');
              } else if (warning.jumpToTab) {
                setBottomTab(warning.jumpToTab);
                if (bottomPanelCollapsed) toggleBottomPanel();
              }
            };

            return (
              <div
                key={warning.id}
                className={`circuit-warnings-item${clickable ? ' is-clickable' : ''}`}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? onActivate : undefined}
                onKeyDown={
                  clickable
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onActivate();
                        }
                      }
                    : undefined
                }
              >
                {warning.text}
              </div>
            );
          })}
        </div>
      )}

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

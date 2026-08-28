import {
  CircuitComponent,
  ComponentType,
  COMPONENT_CATALOG,
  Pin,
  PinType,
  Wire,
  WIRE_COLORS,
  WIRE_MIN_WIDTH,
  WIRE_MAX_WIDTH,
  getDefaultPins,
} from '../models/types';
import {
  ARDUINO_COMPONENT_ID,
  DEFAULT_CONTROLLER_BOARD_POSITION,
  DEFAULT_CONTROLLER_BOARD_TYPE,
  isControllerBoardType,
  type ControllerBoardType,
} from '../models/arduinoUno';
import {
  BREADBOARD_COMPONENT_ID,
  DEFAULT_BREADBOARD_POSITION,
} from '../models/breadboard';
import { clampComponentScale } from './componentTransform';
import { v4 as uuidv4 } from 'uuid';

export interface ProjectData {
  components: CircuitComponent[];
  wires: Wire[];
  code: string;
  boardType: ControllerBoardType;
  boardPosition: { x: number; y: number };
  breadboardPosition: { x: number; y: number };
}

const KNOWN_COMPONENT_TYPES = new Set<string>(
  COMPONENT_CATALOG.map((item) => item.type)
);

const KNOWN_PIN_TYPES = new Set<string>([
  'digital',
  'analog',
  'power',
  'ground',
  'pwm',
  'passive',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readPosition = (
  value: unknown,
  fallback: { x: number; y: number }
): { x: number; y: number } => {
  if (!isRecord(value)) return { ...fallback };

  return {
    x: readNumber(value.x, fallback.x),
    y: readNumber(value.y, fallback.y),
  };
};

/**
 * Pin positions belong to the artwork, not to the saved file — nothing in the
 * app can move a pin. So a part whose artwork has since been corrected takes
 * the current geometry rather than the coordinates it was stored with,
 * otherwise a part placed before the fix would keep its old, wrong pin
 * positions forever and its wires would hang off the wrong spot.
 *
 * A saved pin the artwork no longer defines is kept as-is: a wire may still
 * reference it, and dropping it would break that connection.
 */
const sanitizePins = (value: unknown, type: ComponentType): Pin[] => {
  const defaults = getDefaultPins(type);
  if (!Array.isArray(value)) return defaults;

  const seen = new Set<string>();
  const strays = value.flatMap((item): Pin[] => {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id) return [];
    seen.add(item.id);
    if (defaults.some((pin) => pin.id === item.id)) return [];

    const pinType =
      typeof item.type === 'string' && KNOWN_PIN_TYPES.has(item.type)
        ? (item.type as PinType)
        : 'passive';

    return [
      {
        id: item.id,
        name: typeof item.name === 'string' ? item.name : item.id,
        type: pinType,
        x: readNumber(item.x, 0),
        y: readNumber(item.y, 0),
      },
    ];
  });

  if (seen.size === 0) return defaults;

  return [...defaults, ...strays];
};

const sanitizeProperties = (value: unknown): CircuitComponent['properties'] => {
  if (!isRecord(value)) return {};

  const properties: CircuitComponent['properties'] = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'boolean'
    ) {
      properties[key] = item;
    }
  }

  return properties;
};

const sanitizeComponents = (value: unknown): CircuitComponent[] => {
  if (!Array.isArray(value)) return [];

  const usedIds = new Set<string>();

  return value.flatMap((item): CircuitComponent[] => {
    if (!isRecord(item)) return [];
    if (typeof item.type !== 'string' || !KNOWN_COMPONENT_TYPES.has(item.type)) {
      return [];
    }

    const type = item.type as ComponentType;
    const id =
      typeof item.id === 'string' && item.id && !usedIds.has(item.id)
        ? item.id
        : uuidv4();
    usedIds.add(id);

    const name = typeof item.name === 'string' ? item.name.trim().slice(0, 200) : '';
    const description =
      typeof item.description === 'string' ? item.description.slice(0, 2000) : '';

    return [
      {
        id,
        type,
        x: readNumber(item.x, 0),
        y: readNumber(item.y, 0),
        rotation: readNumber(item.rotation, 0),
        // Both are newer than the file format, so a project saved before them
        // simply gets the defaults: full size, not mirrored.
        scale: clampComponentScale(readNumber(item.scale, 1)),
        flipX: item.flipX === true,
        pins: sanitizePins(item.pins, type),
        properties: sanitizeProperties(item.properties),
        ...(name ? { name } : {}),
        ...(description ? { description } : {}),
      },
    ];
  });
};

const sanitizeWires = (value: unknown, components: CircuitComponent[]): Wire[] => {
  if (!Array.isArray(value)) return [];

  const knownComponentIds = new Set(components.map((component) => component.id));
  const isKnownEndpoint = (id: string) =>
    id === ARDUINO_COMPONENT_ID ||
    id === BREADBOARD_COMPONENT_ID ||
    knownComponentIds.has(id);

  return value.flatMap((item): Wire[] => {
    if (!isRecord(item)) return [];

    const { startComponentId, startPinId, endComponentId, endPinId } = item;
    if (
      typeof startComponentId !== 'string' ||
      typeof startPinId !== 'string' ||
      typeof endComponentId !== 'string' ||
      typeof endPinId !== 'string'
    ) {
      return [];
    }

    if (!isKnownEndpoint(startComponentId) || !isKnownEndpoint(endComponentId)) {
      return [];
    }

    const points = Array.isArray(item.points)
      ? item.points.filter((point): point is number => Number.isFinite(point))
      : [];

    const width =
      typeof item.width === 'number' && Number.isFinite(item.width)
        ? Math.min(WIRE_MAX_WIDTH, Math.max(WIRE_MIN_WIDTH, item.width))
        : undefined;

    return [
      {
        id: typeof item.id === 'string' && item.id ? item.id : uuidv4(),
        startComponentId,
        startPinId,
        endComponentId,
        endPinId,
        color: typeof item.color === 'string' ? item.color : WIRE_COLORS[0].value,
        points: points.length >= 4 ? points : [0, 0, 0, 0],
        ...(width !== undefined ? { width } : {}),
      },
    ];
  });
};

/**
 * Project files come from disk, so every field is treated as untrusted input.
 * Returns null when the payload cannot be read as a project at all.
 */
export function sanitizeProjectData(
  data: unknown,
  fallbackCode: string
): ProjectData | null {
  if (!isRecord(data)) return null;
  if (!Array.isArray(data.components) && !Array.isArray(data.wires)) return null;

  const components = sanitizeComponents(data.components);

  return {
    components,
    wires: sanitizeWires(data.wires, components),
    code: typeof data.code === 'string' ? data.code : fallbackCode,
    boardType: isControllerBoardType(data.boardType)
      ? data.boardType
      : DEFAULT_CONTROLLER_BOARD_TYPE,
    boardPosition: readPosition(
      data.boardPosition,
      DEFAULT_CONTROLLER_BOARD_POSITION
    ),
    breadboardPosition: readPosition(
      data.breadboardPosition,
      DEFAULT_BREADBOARD_POSITION
    ),
  };
}

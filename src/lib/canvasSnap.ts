import {
  DEFAULT_BREADBOARD_POSITION,
  HOLE_SP,
  getBreadboardBounds,
  getNearestBreadboardHole,
} from '../models/breadboard';
import {
  type CircuitComponent,
  type ComponentType,
  getDefaultPins,
} from '../models/types';
import { SVG_CONFIGS } from '../hooks/useComponentImages';

const GRID_SIZE = 10;
const SNAP_RADIUS_SQ = (HOLE_SP * 2.5) ** 2;

export function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export function normalizeRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

export function rotatePoint(
  x: number,
  y: number,
  rotation = 0
): { x: number; y: number } {
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

export function getRotatedPins<T extends { x: number; y: number }>(
  pins: T[],
  rotation = 0
): T[] {
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

export function getComponentPinWorldPosition(
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
  const componentType =
    type && type in SVG_CONFIGS ? (type as ComponentType) : undefined;
  const pinLayout = pins ?? (componentType ? getDefaultPins(componentType) : []);
  const rotatedPinLayout = getRotatedPins(pinLayout, rotation);
  const snapped = snapPinsToBreadboard(
    x,
    y,
    rotatedPinLayout,
    breadboardPosition
  );

  if (snapped) {
    return snapped;
  }

  return { x: snapToGrid(x), y: snapToGrid(y) };
}

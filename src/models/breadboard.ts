import type { Pin } from './types';

export const BREADBOARD_COMPONENT_ID = 'breadboard-fixed';
export const BB_X = 60;
export const BB_Y = 240;
export const DEFAULT_BREADBOARD_POSITION = { x: BB_X, y: BB_Y };
export const BB_COLS = 63;
export const HOLE_SP = 11.5;
export const HOLE_R = 2.2;
export const RAIL_H = 18;
export const BB_BOARD_W = BB_COLS * HOLE_SP + 40;
export const BB_MAIN_H = 10 * HOLE_SP + HOLE_SP + 50;
export const BB_TOTAL_H = BB_MAIN_H + RAIL_H * 2 + 30;
export const BB_RIGHT = BB_X + BB_BOARD_W;
export const BB_BOTTOM = BB_Y + BB_TOTAL_H;

export type BreadboardHole = {
  id: string;
  label: string;
  rowLabel: string;
  col: number;
  x: number;
  y: number;
  stripId: string;
  pin: Pin;
};

function getBreadboardOffset(position: { x: number; y: number }) {
  return {
    x: position.x - BB_X,
    y: position.y - BB_Y,
  };
}

function withBreadboardOffset(
  hole: BreadboardHole,
  position: { x: number; y: number }
): BreadboardHole {
  const offset = getBreadboardOffset(position);
  return {
    ...hole,
    x: hole.x + offset.x,
    y: hole.y + offset.y,
    pin: {
      ...hole.pin,
      x: hole.pin.x + offset.x,
      y: hole.pin.y + offset.y,
    },
  };
}

type RowDefinition = {
  rowLabel: string;
  y: number;
  stripId: (col: number) => string;
};

const mainStartY = BB_Y + RAIL_H + 28;
const topRailY = BB_Y + 14;
const bottomRailY = BB_Y + BB_TOTAL_H - 28;
const BB_HOLE_X0 = BB_X + 20;

const ROW_DEFINITIONS: RowDefinition[] = [
  {
    rowLabel: 'T+',
    y: topRailY,
    stripId: () => 'rail-top-pos',
  },
  {
    rowLabel: 'T-',
    y: topRailY + HOLE_SP,
    stripId: () => 'rail-top-neg',
  },
  ...['A', 'B', 'C', 'D', 'E'].map((rowLabel, index) => ({
    rowLabel,
    y: mainStartY + index * HOLE_SP,
    stripId: (col: number) => `upper-strip-${col + 1}`,
  })),
  ...['F', 'G', 'H', 'I', 'J'].map((rowLabel, index) => ({
    rowLabel,
    y: mainStartY + (index + 6) * HOLE_SP,
    stripId: (col: number) => `lower-strip-${col + 1}`,
  })),
  {
    rowLabel: 'B+',
    y: bottomRailY,
    stripId: () => 'rail-bottom-pos',
  },
  {
    rowLabel: 'B-',
    y: bottomRailY + HOLE_SP,
    stripId: () => 'rail-bottom-neg',
  },
];

export const BREADBOARD_HOLES: BreadboardHole[] = ROW_DEFINITIONS.flatMap(
  (row) =>
    Array.from({ length: BB_COLS }, (_, col) => {
      const label = `${row.rowLabel}${col + 1}`;
      const id = `bb-${row.rowLabel.replace(/[^a-z0-9+-]/gi, '').toLowerCase()}-${col + 1}`;
      const x = BB_HOLE_X0 + col * HOLE_SP;
      const y = row.y;

      return {
        id,
        label,
        rowLabel: row.rowLabel,
        col,
        x,
        y,
        stripId: row.stripId(col),
        pin: {
          id,
          name: label,
          type: 'passive',
          x,
          y,
        },
      } satisfies BreadboardHole;
    })
);

export const BREADBOARD_HOLE_MAP = new Map(
  BREADBOARD_HOLES.map((hole) => [hole.id, hole])
);

export const BREADBOARD_STRIP_GROUPS = (() => {
  const groups = new Map<string, BreadboardHole[]>();
  for (const hole of BREADBOARD_HOLES) {
    if (!groups.has(hole.stripId)) {
      groups.set(hole.stripId, []);
    }
    groups.get(hole.stripId)!.push(hole);
  }

  return Array.from(groups.values());
})();

export function isBreadboardReference(ref: string): boolean {
  const normalized = ref.trim().toLowerCase();
  return normalized === 'breadboard' || normalized === BREADBOARD_COMPONENT_ID;
}

export function findBreadboardHole(pinId: string): BreadboardHole | null {
  const normalized = pinId.trim().toLowerCase();

  return (
    BREADBOARD_HOLES.find(
      (hole) =>
        hole.id.toLowerCase() === normalized ||
        hole.label.toLowerCase() === normalized
    ) ?? null
  );
}

export function getBreadboardHoleGlobal(
  pinId: string,
  position: { x: number; y: number } = DEFAULT_BREADBOARD_POSITION
): BreadboardHole | null {
  const hole = findBreadboardHole(pinId);
  return hole ? withBreadboardOffset(hole, position) : null;
}

export function getBreadboardBounds(
  position: { x: number; y: number } = DEFAULT_BREADBOARD_POSITION
) {
  return {
    x: position.x,
    y: position.y,
    right: position.x + BB_BOARD_W,
    bottom: position.y + BB_TOTAL_H,
  };
}

export function getNearestBreadboardHole(
  x: number,
  y: number,
  position: { x: number; y: number } = DEFAULT_BREADBOARD_POSITION
): BreadboardHole & { distSq: number } {
  const offset = getBreadboardOffset(position);
  const localX = x - offset.x;
  const localY = y - offset.y;
  let bestHole = BREADBOARD_HOLES[0];
  let bestDistSq = Infinity;

  for (const hole of BREADBOARD_HOLES) {
    const dx = hole.x - localX;
    const dy = hole.y - localY;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestHole = hole;
    }
  }

  return {
    ...withBreadboardOffset(bestHole, position),
    distSq: bestDistSq,
  };
}

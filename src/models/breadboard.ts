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

/**
 * Which board this is.
 *
 * A full-size board is the 63-column one with power rails down both edges. A
 * mini is the 170 tie-point kind: seventeen columns, rows A-J across the same
 * centre channel, and no rails at all — power comes in on a column like
 * everything else.
 */
export type BreadboardVariant = 'full' | 'mini';

export const MINI_BB_COLS = 17;

const BB_HOLE_X0 = BB_X + 20;

/** Rows A-E above the channel and F-J below it, the part every board shares. */
function mainRows(mainStartY: number): RowDefinition[] {
  return [
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
  ];
}

export type BreadboardSpec = {
  variant: BreadboardVariant;
  cols: number;
  hasRails: boolean;
  /** Where rows A-J start, measured from the board's own top edge. */
  mainOffsetY: number;
  width: number;
  height: number;
  holes: BreadboardHole[];
  holeMap: Map<string, BreadboardHole>;
  stripGroups: BreadboardHole[][];
};

function buildHoles(rows: RowDefinition[], cols: number): BreadboardHole[] {
  return rows.flatMap((row) =>
    Array.from({ length: cols }, (_, col) => {
      const label = `${row.rowLabel}${col + 1}`;
      const id = `bb-${row.rowLabel.replace(/[^a-z0-9+-]/gi, '').toLowerCase()}-${col + 1}`;
      const x = BB_HOLE_X0 + col * HOLE_SP;

      return {
        id,
        label,
        rowLabel: row.rowLabel,
        col,
        x,
        y: row.y,
        stripId: row.stripId(col),
        pin: {
          id,
          name: label,
          type: 'passive',
          x,
          y: row.y,
        },
      } satisfies BreadboardHole;
    })
  );
}

function groupByStrip(holes: BreadboardHole[]): BreadboardHole[][] {
  const groups = new Map<string, BreadboardHole[]>();
  for (const hole of holes) {
    if (!groups.has(hole.stripId)) groups.set(hole.stripId, []);
    groups.get(hole.stripId)!.push(hole);
  }
  return Array.from(groups.values());
}

function buildSpec(variant: BreadboardVariant): BreadboardSpec {
  const isMini = variant === 'mini';
  const cols = isMini ? MINI_BB_COLS : BB_COLS;
  // A mini has no rails, so its rows start just inside the top edge.
  const mainOffsetY = isMini ? 16 : RAIL_H + 28;
  const mainStartY = BB_Y + mainOffsetY;

  const rows: RowDefinition[] = isMini
    ? mainRows(mainStartY)
    : [
        { rowLabel: 'T+', y: BB_Y + 14, stripId: () => 'rail-top-pos' },
        { rowLabel: 'T-', y: BB_Y + 14 + HOLE_SP, stripId: () => 'rail-top-neg' },
        ...mainRows(mainStartY),
        { rowLabel: 'B+', y: BB_Y + BB_TOTAL_H - 28, stripId: () => 'rail-bottom-pos' },
        {
          rowLabel: 'B-',
          y: BB_Y + BB_TOTAL_H - 28 + HOLE_SP,
          stripId: () => 'rail-bottom-neg',
        },
      ];

  const holes = buildHoles(rows, cols);

  return {
    variant,
    cols,
    hasRails: !isMini,
    mainOffsetY,
    width: cols * HOLE_SP + 40,
    // Row J sits ten pitches below row A; the same margin closes the board off.
    height: isMini ? mainOffsetY * 2 + 10 * HOLE_SP : BB_TOTAL_H,
    holes,
    holeMap: new Map(holes.map((hole) => [hole.id, hole])),
    stripGroups: groupByStrip(holes),
  };
}

const BREADBOARD_SPECS: Record<BreadboardVariant, BreadboardSpec> = {
  full: buildSpec('full'),
  mini: buildSpec('mini'),
};

export function getBreadboardSpec(variant: BreadboardVariant = 'full'): BreadboardSpec {
  return BREADBOARD_SPECS[variant] ?? BREADBOARD_SPECS.full;
}

/** The component types that are breadboards, whatever size. */
export function isBreadboardType(type: string): boolean {
  return type === 'breadboard' || type === 'breadboard-mini';
}

export function getBreadboardVariantForType(type: string): BreadboardVariant {
  return type === 'breadboard-mini' ? 'mini' : 'full';
}

export const BREADBOARD_HOLES: BreadboardHole[] = BREADBOARD_SPECS.full.holes;

export const BREADBOARD_HOLE_MAP = BREADBOARD_SPECS.full.holeMap;

export const BREADBOARD_STRIP_GROUPS = BREADBOARD_SPECS.full.stripGroups;

export function isBreadboardReference(ref: string): boolean {
  const normalized = ref.trim().toLowerCase();
  return normalized === 'breadboard' || normalized === BREADBOARD_COMPONENT_ID;
}

export function findBreadboardHole(
  pinId: string,
  variant: BreadboardVariant = 'full'
): BreadboardHole | null {
  const normalized = pinId.trim().toLowerCase();

  return (
    getBreadboardSpec(variant).holes.find(
      (hole) =>
        hole.id.toLowerCase() === normalized ||
        hole.label.toLowerCase() === normalized
    ) ?? null
  );
}

export function getBreadboardHoleGlobal(
  pinId: string,
  position: { x: number; y: number } = DEFAULT_BREADBOARD_POSITION,
  variant: BreadboardVariant = 'full'
): BreadboardHole | null {
  const hole = findBreadboardHole(pinId, variant);
  return hole ? withBreadboardOffset(hole, position) : null;
}

export function getBreadboardBounds(
  position: { x: number; y: number } = DEFAULT_BREADBOARD_POSITION,
  variant: BreadboardVariant = 'full'
) {
  const spec = getBreadboardSpec(variant);

  return {
    x: position.x,
    y: position.y,
    right: position.x + spec.width,
    bottom: position.y + spec.height,
  };
}

export function getNearestBreadboardHole(
  x: number,
  y: number,
  position: { x: number; y: number } = DEFAULT_BREADBOARD_POSITION,
  variant: BreadboardVariant = 'full'
): BreadboardHole & { distSq: number } {
  const offset = getBreadboardOffset(position);
  const localX = x - offset.x;
  const localY = y - offset.y;
  const holes = getBreadboardSpec(variant).holes;
  let bestHole = holes[0];
  let bestDistSq = Infinity;

  for (const hole of holes) {
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

// ===== More than one board =====
//
// A breadboard is an ordinary component now, so a project can hold as many as
// it likes. Hole ids stay local to a board — every board has its own `bb-a-1` —
// because an endpoint is already written as `componentId:pinId`, and the
// component id is what tells two boards apart. That keeps every wire, contact
// and strip that was ever saved working exactly as before.

/** One breadboard on the canvas: where it is, which one it is, and how big. */
export type BreadboardPlacement = {
  id: string;
  x: number;
  y: number;
  variant: BreadboardVariant;
};

export type BreadboardComponentLike = {
  id: string;
  type: string;
  x: number;
  y: number;
};

export function getBreadboardPlacements(
  components: readonly BreadboardComponentLike[]
): BreadboardPlacement[] {
  return components
    .filter((component) => isBreadboardType(component.type))
    .map((component) => ({
      id: component.id,
      x: component.x,
      y: component.y,
      variant: getBreadboardVariantForType(component.type),
    }));
}

export type NearestBreadboardHole = {
  breadboardId: string;
  hole: BreadboardHole;
  distSq: number;
};

/** The closest hole on any board — null when the canvas has no board at all. */
export function getNearestHoleAcrossBreadboards(
  x: number,
  y: number,
  boards: readonly BreadboardPlacement[]
): NearestBreadboardHole | null {
  let best: NearestBreadboardHole | null = null;

  for (const board of boards) {
    const { distSq, ...hole } = getNearestBreadboardHole(x, y, board, board.variant);
    if (!best || distSq < best.distSq) {
      best = { breadboardId: board.id, hole, distSq };
    }
  }

  return best;
}

/** One named hole on one board, in world coordinates. */
export function getBreadboardHoleOn(
  board: BreadboardPlacement,
  pinId: string
): BreadboardHole | null {
  return getBreadboardHoleGlobal(pinId, board, board.variant);
}

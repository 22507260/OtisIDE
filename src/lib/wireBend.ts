/**
 * Where a new bend goes when you break a cable.
 *
 * Two things used to go wrong here. The bend was placed at the pointer rather
 * than on the cable — the click band is nearly four times wider than the cable
 * is drawn, and the drawn corners are rounded away from the polyline on top of
 * that, so a click that looked dead-centre could drop a vertex a dozen units to
 * one side and visibly kink the run. And a single stray `NaN` anywhere in the
 * points made every comparison below false, so the bend went into the *first*
 * segment however far away that was.
 *
 * The foot of the perpendicular was always being computed; it was just thrown
 * away. Now it is what gets inserted.
 */

/** One click on a cable: which cable, where, and when. */
export type WireClick = { wireId: string; x: number; y: number; at: number };

/** How long two clicks may be apart and still be one gesture. */
export const WIRE_DOUBLE_CLICK_MS = 400;
/** ...and how far apart, in world units. A double-click is one place, twice. */
export const WIRE_DOUBLE_CLICK_SLOP = 8;

/**
 * Whether two clicks are the two halves of one double-click.
 *
 * The host's own double-click window is global, takes no account of *where* the
 * two clicks were, and is not cleared once it has fired — so two ordinary
 * clicks anywhere on the same cable counted as one, and a third quick click
 * counted again. Both halves have to be on the same cable, in the same place,
 * near enough in time.
 */
export function isSameGesture(previous: WireClick | null, click: WireClick): boolean {
  if (!previous) return false;
  if (previous.wireId !== click.wireId) return false;
  if (click.at - previous.at > WIRE_DOUBLE_CLICK_MS) return false;
  if (click.at < previous.at) return false;
  return Math.hypot(previous.x - click.x, previous.y - click.y) <= WIRE_DOUBLE_CLICK_SLOP;
}

export type WireBendInsertion = {
  /** Flat index of the segment's first point; the bend is spliced after it. */
  index: number;
  /** The point on the cable itself, not where the pointer happened to land. */
  x: number;
  y: number;
  /** How far the pointer was from the cable, for callers that want to refuse. */
  distance: number;
};

/**
 * The point on `points` nearest to (x, y), and which segment it belongs to.
 *
 * Returns null for a degenerate run or a non-finite input rather than guessing:
 * a bend nobody asked for is worse than no bend.
 */
export function findWireBendInsertion(
  points: readonly number[],
  x: number,
  y: number
): WireBendInsertion | null {
  if (points.length < 4) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  let best: WireBendInsertion | null = null;
  let bestDistanceSq = Infinity;

  for (let i = 0; i + 3 < points.length; i += 2) {
    const ax = points[i];
    const ay = points[i + 1];
    const bx = points[i + 2];
    const by = points[i + 3];
    if (!Number.isFinite(ax) || !Number.isFinite(ay)) return null;
    if (!Number.isFinite(bx) || !Number.isFinite(by)) return null;

    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    // Clamped, so the foot stays on the finite segment and a click past a
    // corner falls to the corner rather than off the end of the line.
    const t =
      lengthSq === 0
        ? 0
        : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSq));
    const footX = ax + t * dx;
    const footY = ay + t * dy;
    const distanceSq = (x - footX) ** 2 + (y - footY) ** 2;

    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      best = { index: i, x: footX, y: footY, distance: Math.sqrt(distanceSq) };
    }
  }

  return best;
}

/**
 * The points a cable would have with a bend added at (x, y).
 *
 * Returns null when there is nothing sensible to add — including a bend that
 * would land on top of a point the cable already has, which is a vertex that
 * does nothing but sit there waiting to be dragged by accident.
 */
export function withWireBendAt(
  points: readonly number[],
  x: number,
  y: number,
  minimumSeparation = 1
): number[] | null {
  const insertion = findWireBendInsertion(points, x, y);
  if (!insertion) return null;

  for (let i = 0; i + 1 < points.length; i += 2) {
    const away = Math.hypot(points[i] - insertion.x, points[i + 1] - insertion.y);
    if (away < minimumSeparation) return null;
  }

  const next = [...points];
  next.splice(insertion.index + 2, 0, insertion.x, insertion.y);
  return next;
}

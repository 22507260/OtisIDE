/**
 * Where a new bend goes when you break a cable.
 *
 * It goes where the pointer is. That sounds obvious and it is, but this file
 * spent a version doing the opposite: it dropped the foot of the perpendicular
 * on the cable and inserted *that*, on the reasoning that the click band is
 * nearly four times wider than the cable is drawn, so a click that misses by a
 * few units would visibly kink the run.
 *
 * The reasoning was wrong about what people are doing when they break a cable.
 * They are not selecting a point on a line, they are pulling it somewhere — and
 * the place they want it is under the cursor, not the nearest place on a route
 * they are in the middle of changing. Projecting made the bend appear a
 * centimetre from the click, and worse, near a corner the foot clamps to the
 * corner itself and the "don't stack two points" guard below then refused the
 * bend outright: you double-clicked an elbow and nothing at all happened.
 *
 * So the foot is still computed, but only to answer two questions the pointer
 * cannot answer on its own — which segment was meant, and whether the click was
 * near enough to the cable to have meant anything. It is returned as well, for
 * callers that want to know.
 */

/** One click on a cable: which cable, where, and when. */
export type WireClick = { wireId: string; x: number; y: number; at: number };

/** How long two clicks may be apart and still be one gesture. */
export const WIRE_DOUBLE_CLICK_MS = 400;
/** ...and how far apart, in world units. A double-click is one place, twice. */
export const WIRE_DOUBLE_CLICK_SLOP = 8;

/**
 * How far off the cable a click may be and still be a click on the cable.
 *
 * The hit band is twelve world units wide, so six is as far as Konva will let a
 * click land; the drawn corners are rounded away from the polyline by up to
 * another three and a half. Twelve covers both with room to spare, and still
 * refuses a click that clearly meant something else — which matters because
 * this picks the nearest segment of the *whole* cable, and on a run that folds
 * back on itself the nearest segment can be one the pointer is nowhere near.
 */
export const WIRE_BEND_MAX_DISTANCE = 12;

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
  /** Where the bend goes: the pointer, unchanged. */
  x: number;
  y: number;
  /** The nearest point on the cable, for callers that want it. */
  footX: number;
  footY: number;
  /** How far the pointer was from the cable. */
  distance: number;
};

/**
 * Which segment of `points` a click at (x, y) belongs to, and where the bend
 * goes — which is the click itself.
 *
 * Returns null for a degenerate run, a non-finite input, or a click further
 * than `maxDistance` from the cable, rather than guessing: a bend nobody asked
 * for is worse than no bend.
 */
export function findWireBendInsertion(
  points: readonly number[],
  x: number,
  y: number,
  maxDistance = WIRE_BEND_MAX_DISTANCE
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
    // corner is measured from the corner rather than from the line extended.
    const t =
      lengthSq === 0
        ? 0
        : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSq));
    const footX = ax + t * dx;
    const footY = ay + t * dy;
    const distanceSq = (x - footX) ** 2 + (y - footY) ** 2;

    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      best = { index: i, x, y, footX, footY, distance: Math.sqrt(distanceSq) };
    }
  }

  if (best && best.distance > maxDistance) return null;
  return best;
}

export type WireBend = {
  /** The cable's points with the new one spliced in. */
  points: number[];
  /** Flat index of the point that was added, for a caller about to drag it. */
  index: number;
};

/**
 * The points a cable would have with a bend added at (x, y).
 *
 * Returns null when there is nothing sensible to add — including a bend that
 * would land on top of a point the cable already has, which is a vertex that
 * does nothing but sit there waiting to be dragged by accident. That test is
 * against the pointer, so double-clicking just beside an existing corner adds
 * the bend you asked for instead of silently doing nothing.
 */
export function withWireBendAt(
  points: readonly number[],
  x: number,
  y: number,
  minimumSeparation = 1,
  maxDistance = WIRE_BEND_MAX_DISTANCE
): WireBend | null {
  const insertion = findWireBendInsertion(points, x, y, maxDistance);
  if (!insertion) return null;

  for (let i = 0; i + 1 < points.length; i += 2) {
    const away = Math.hypot(points[i] - insertion.x, points[i + 1] - insertion.y);
    if (away < minimumSeparation) return null;
  }

  const index = insertion.index + 2;
  const next = [...points];
  next.splice(index, 0, insertion.x, insertion.y);
  return { points: next, index };
}

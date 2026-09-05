/**
 * Two meter probes on one point, told apart.
 *
 * Clipped to the same leg the two probes cover each other completely: same
 * angle, same place, no way to see which is which or to catch the one
 * underneath. An earlier attempt slid the two *tips* apart, which is the one
 * thing that must not move — a tip sits on what it is measuring.
 *
 * What overlaps is the bodies, and a body turns about its own tip. Leaning them
 * apart is how anyone holds two probes on one point: needles together, handles
 * apart.
 */

export type Point = { x: number; y: number };

/** Nearer than this and two probes need fanning to be told apart. */
export const PROBE_FAN_DISTANCE = 34;
/** How far each one leans off its own line, in degrees. */
export const PROBE_FAN_ANGLE = 26;

/**
 * The lean for each probe, in degrees, or nothing once they are far enough
 * apart to read on their own.
 *
 * Full lean when they coincide, easing off as they separate, so a probe being
 * dragged away straightens up rather than snapping upright.
 */
export function getProbeFanAngles(black: Point, red: Point): { black: number; red: number } {
  const distance = Math.hypot(red.x - black.x, red.y - black.y);
  if (!Number.isFinite(distance) || distance >= PROBE_FAN_DISTANCE) {
    return { black: 0, red: 0 };
  }

  const lean = PROBE_FAN_ANGLE * (1 - distance / PROBE_FAN_DISTANCE);
  return { black: -lean, red: lean };
}

/** A point turned about another, for putting the lead back on a leaned probe. */
export function rotateAround(point: Point, pivot: Point, degrees: number): Point {
  if (degrees === 0) return point;

  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;

  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos,
  };
}

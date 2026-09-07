/**
 * The route a cable is taking while it is still being drawn.
 *
 * Every click on empty space puts a bend in. The bug this file exists to close
 * was that the click read the pointer position out of React state, from a
 * closure whose dependency list did not name it — so the handler was rebuilt
 * only when the path changed, which is to say once per bend, and each bend
 * landed on the one before it.
 *
 * The lesson is not "add the dependency". It is that a click should read where
 * the pointer is now, not where a render thought it was, and that the two
 * places deciding where a point goes — the preview following the mouse and the
 * click committing it — must apply the same rule. Both call in here.
 */

export type WiringPoint = { x: number; y: number };

/**
 * Where the segment being drawn starts from: the last bend placed, or the pin
 * the cable came out of if there are none yet.
 *
 * This is what the new point is straightened against, so the preview and the
 * click have to agree on it.
 */
export function getWiringAnchor(path: readonly number[], start: WiringPoint): WiringPoint {
  if (path.length >= 2) {
    const x = path[path.length - 2];
    const y = path[path.length - 1];
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }

  return { x: start.x, y: start.y };
}

/**
 * The path with `point` added, or null if there is nothing sensible to add.
 *
 * Refused when the point is not a point at all, and when it lands on top of one
 * the cable already has: a vertex on a vertex draws as nothing and waits to be
 * dragged by accident. The same rule the finished cable's bends follow.
 */
export function appendWiringBend(
  path: readonly number[],
  point: WiringPoint,
  minimumSeparation = 1
): number[] | null {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

  for (let i = 0; i + 1 < path.length; i += 2) {
    if (Math.hypot(path[i] - point.x, path[i + 1] - point.y) < minimumSeparation) return null;
  }

  return [...path, point.x, point.y];
}

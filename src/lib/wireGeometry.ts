/**
 * Cable corners, rounded.
 *
 * A jumper wire does not fold to a point where it turns; it bends through an
 * arc as tight as the copper will go. Konva's `tension` would give a curve, but
 * it curves the *whole* run — the straight stretches bow out with it, and the
 * flow arrows, which walk their own straight-segment table over the same
 * points, would drift off the drawn cable at every bend.
 *
 * So the rounding is done to the points themselves: each interior corner is
 * replaced by a short arc and everything else is left exactly where it was.
 * Whatever draws from the result — cable, shadow, highlight, arrows — agrees.
 */

/** How many points an arc is cut into. Six is smooth at any zoom worth using. */
const ARC_STEPS = 6;

/** Below this a corner is already round enough to leave alone. */
const MIN_ARC_RADIUS = 0.5;

/**
 * Rounds every interior corner of a polyline.
 *
 * The radius is trimmed to half of the shorter neighbouring segment, so two
 * corners sharing a segment can never eat into one another, and a bend dragged
 * hard against its neighbour degrades to a sharp corner rather than a knot.
 * Endpoints come back untouched: a cable has to stay plugged in.
 */
export function roundWirePoints(points: number[], radius: number): number[] {
  // Two points is a straight run, and there is nothing to round.
  if (points.length < 6 || radius < MIN_ARC_RADIUS) return points;

  const rounded: number[] = [points[0], points[1]];

  for (let i = 2; i + 2 < points.length; i += 2) {
    const cornerX = points[i];
    const cornerY = points[i + 1];

    // Both directions point *away* from the corner, which is where the arc goes.
    const inX = points[i - 2] - cornerX;
    const inY = points[i - 1] - cornerY;
    const outX = points[i + 2] - cornerX;
    const outY = points[i + 3] - cornerY;

    const inLength = Math.hypot(inX, inY);
    const outLength = Math.hypot(outX, outY);
    if (inLength < 1e-6 || outLength < 1e-6) {
      rounded.push(cornerX, cornerY);
      continue;
    }

    const inUnitX = inX / inLength;
    const inUnitY = inY / inLength;
    const outUnitX = outX / outLength;
    const outUnitY = outY / outLength;

    // Straight through: no corner to round, and an arc here would be a wobble.
    const cross = inUnitX * outUnitY - inUnitY * outUnitX;
    if (Math.abs(cross) < 1e-6) {
      rounded.push(cornerX, cornerY);
      continue;
    }

    const arcRadius = Math.min(radius, inLength / 2, outLength / 2);
    if (arcRadius < MIN_ARC_RADIUS) {
      rounded.push(cornerX, cornerY);
      continue;
    }

    const startX = cornerX + inUnitX * arcRadius;
    const startY = cornerY + inUnitY * arcRadius;
    const endX = cornerX + outUnitX * arcRadius;
    const endY = cornerY + outUnitY * arcRadius;

    // A quadratic through the corner: the corner is the control point, so the
    // curve leaves along one segment and arrives along the other.
    for (let step = 0; step <= ARC_STEPS; step += 1) {
      const t = step / ARC_STEPS;
      const inverse = 1 - t;
      const a = inverse * inverse;
      const b = 2 * inverse * t;
      const c = t * t;
      rounded.push(a * startX + b * cornerX + c * endX, a * startY + b * cornerY + c * endY);
    }
  }

  rounded.push(points[points.length - 2], points[points.length - 1]);
  return rounded;
}

import { describe, expect, it } from 'vitest';
import { roundWirePoints } from '../wireGeometry';

/** Pulls the (x, y) at a point index out of a flat coordinate array. */
const at = (points: number[], index: number) => ({
  x: points[index * 2],
  y: points[index * 2 + 1],
});

const last = (points: number[]) => at(points, points.length / 2 - 1);

describe('roundWirePoints', () => {
  it('leaves a straight two-point cable alone', () => {
    const points = [0, 0, 100, 0];
    expect(roundWirePoints(points, 8)).toBe(points);
  });

  it('keeps both ends exactly where they were plugged in', () => {
    const rounded = roundWirePoints([0, 0, 100, 0, 100, 100], 8);

    expect(at(rounded, 0)).toEqual({ x: 0, y: 0 });
    expect(last(rounded)).toEqual({ x: 100, y: 100 });
  });

  it('replaces a right-angle corner with an arc that misses the corner', () => {
    const rounded = roundWirePoints([0, 0, 100, 0, 100, 100], 10);

    // Nothing sits on the corner itself any more...
    expect(rounded.some((_, i) => i % 2 === 0 && rounded[i] === 100 && rounded[i + 1] === 0)).toBe(
      false
    );

    // ...and the cut corner is pulled inwards, towards the inside of the turn.
    const inner = rounded.filter((_, i) => i % 2 === 0).map((x, i) => ({ x, y: rounded[i * 2 + 1] }));
    const closest = inner.reduce((best, p) =>
      Math.hypot(p.x - 100, p.y - 0) < Math.hypot(best.x - 100, best.y - 0) ? p : best
    );
    expect(closest.x).toBeLessThan(100);
    expect(closest.y).toBeGreaterThan(0);
  });

  it('never strays further from the corner than the radius asked for', () => {
    const radius = 10;
    const rounded = roundWirePoints([0, 0, 100, 0, 100, 100], radius);

    for (let i = 0; i + 1 < rounded.length; i += 2) {
      const onFirstLeg = rounded[i + 1] === 0 && rounded[i] <= 100;
      const onSecondLeg = rounded[i] === 100 && rounded[i + 1] >= 0;
      if (onFirstLeg || onSecondLeg) continue;
      // Anything off the two legs is arc, and the arc lives inside the radius.
      expect(Math.hypot(rounded[i] - 100, rounded[i + 1] - 0)).toBeLessThanOrEqual(radius + 1e-6);
    }
  });

  it('trims the radius so two corners sharing a short segment cannot overlap', () => {
    // The middle segment is only 10 long: each corner may use at most 5.
    const rounded = roundWirePoints([0, 0, 100, 0, 110, 0, 110, 100], 40);
    const xs = rounded.filter((_, i) => i % 2 === 0);

    // With an untrimmed radius of 40 the first arc would run back past x = 60.
    expect(Math.min(...xs.filter((x) => x > 0))).toBeGreaterThan(90);
  });

  it('leaves a collinear "corner" untouched', () => {
    const points = [0, 0, 50, 0, 100, 0];
    const rounded = roundWirePoints(points, 8);

    expect(rounded).toEqual(points);
  });

  it('leaves the points alone when no rounding was asked for', () => {
    const points = [0, 0, 100, 0, 100, 100];
    expect(roundWirePoints(points, 0)).toBe(points);
  });

  it('keeps the run continuous — no jumps between consecutive points', () => {
    const rounded = roundWirePoints([0, 0, 100, 0, 100, 100, 200, 100], 12);

    for (let i = 0; i + 3 < rounded.length; i += 2) {
      const step = Math.hypot(rounded[i + 2] - rounded[i], rounded[i + 3] - rounded[i + 1]);
      expect(step).toBeLessThan(100);
    }
  });
});

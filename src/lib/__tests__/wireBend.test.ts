import { describe, expect, it } from 'vitest';
import { findWireBendInsertion, isSameGesture, withWireBendAt } from '../wireBend';

/** Shortest distance from a point to a polyline, for checking a bend landed on it. */
function distanceToRun(points: number[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i + 3 < points.length; i += 2) {
    const ax = points[i];
    const ay = points[i + 1];
    const dx = points[i + 2] - ax;
    const dy = points[i + 3] - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSq));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
}

describe('findWireBendInsertion', () => {
  const elbow = [0, 0, 100, 0, 100, 100];

  it('puts the bend on the cable, not where the pointer was', () => {
    // Nine units to one side of the first leg — inside the click band, well
    // outside the drawn cable.
    const insertion = findWireBendInsertion(elbow, 40, 9);

    expect(insertion).not.toBeNull();
    expect(insertion!.x).toBeCloseTo(40, 6);
    expect(insertion!.y).toBeCloseTo(0, 6);
    expect(insertion!.distance).toBeCloseTo(9, 6);
  });

  it('picks the segment the pointer is actually nearest', () => {
    expect(findWireBendInsertion(elbow, 40, 4)!.index).toBe(0);
    expect(findWireBendInsertion(elbow, 104, 60)!.index).toBe(2);
  });

  it('clamps to the corner rather than running off the end of a segment', () => {
    // Beyond the elbow on both axes: the foot is the corner itself.
    const insertion = findWireBendInsertion(elbow, 140, -40);

    expect(insertion!.x).toBeCloseTo(100, 6);
    expect(insertion!.y).toBeCloseTo(0, 6);
  });

  it('refuses a run with a non-finite coordinate instead of guessing', () => {
    // This used to fail every comparison and drop the bend into segment 0,
    // however far away the click was.
    expect(findWireBendInsertion([0, 0, Number.NaN, 0, 100, 100], 90, 90)).toBeNull();
    expect(findWireBendInsertion(elbow, Number.NaN, 10)).toBeNull();
  });

  it('refuses a cable too short to have a segment', () => {
    expect(findWireBendInsertion([5, 5], 0, 0)).toBeNull();
  });
});

describe('withWireBendAt', () => {
  it('splices the new point between the ends of its own segment', () => {
    const next = withWireBendAt([0, 0, 100, 0, 100, 100], 40, 9);

    expect(next).toEqual([0, 0, 40, 0, 100, 0, 100, 100]);
  });

  it('leaves every added point sitting on the original run', () => {
    const original = [0, 0, 100, 0, 100, 100, 200, 100];
    const next = withWireBendAt(original, 150, 112)!;

    // The point that was added, wherever it went in.
    for (let i = 0; i + 1 < next.length; i += 2) {
      expect(distanceToRun(original, next[i], next[i + 1])).toBeLessThan(1e-6);
    }
  });

  it('will not stack a bend on a point the cable already has', () => {
    // A vertex on top of a vertex does nothing but wait to be dragged by
    // accident.
    expect(withWireBendAt([0, 0, 100, 0, 100, 100], 100.2, 0.1)).toBeNull();
  });

  it('keeps the ends where they were plugged in', () => {
    const next = withWireBendAt([0, 0, 100, 0, 100, 100], 60, 6)!;

    expect(next.slice(0, 2)).toEqual([0, 0]);
    expect(next.slice(-2)).toEqual([100, 100]);
  });
});

describe('isSameGesture', () => {
  const at = (x: number, y: number, when: number, wireId = 'w1') => ({ wireId, x, y, at: when });

  it('accepts two clicks in the same place, moments apart', () => {
    expect(isSameGesture(at(100, 100, 1000), at(100, 100, 1180))).toBe(true);
    expect(isSameGesture(at(100, 100, 1000), at(104, 103, 1180))).toBe(true);
  });

  it('refuses two clicks in different places, however quick', () => {
    // The whole bug: the host's double-click window ignores position, so two
    // ordinary clicks anywhere on one cable used to put a bend in.
    expect(isSameGesture(at(100, 100, 1000), at(240, 100, 1010))).toBe(false);
    expect(isSameGesture(at(100, 100, 1000), at(100, 118, 1010))).toBe(false);
  });

  it('refuses two clicks too far apart in time', () => {
    expect(isSameGesture(at(100, 100, 1000), at(100, 100, 1401))).toBe(false);
  });

  it('refuses two clicks on different cables', () => {
    expect(isSameGesture(at(100, 100, 1000, 'w1'), at(100, 100, 1100, 'w2'))).toBe(false);
  });

  it('has nothing to match against on the first click of all', () => {
    expect(isSameGesture(null, at(100, 100, 1000))).toBe(false);
  });

  it('refuses a click that claims to predate the one before it', () => {
    expect(isSameGesture(at(100, 100, 1000), at(100, 100, 900))).toBe(false);
  });
});

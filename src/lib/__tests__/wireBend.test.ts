import { describe, expect, it } from 'vitest';
import {
  WIRE_BEND_MAX_DISTANCE,
  findWireBendInsertion,
  isSameGesture,
  withWireBendAt,
} from '../wireBend';

describe('findWireBendInsertion', () => {
  const elbow = [0, 0, 100, 0, 100, 100];

  it('puts the bend where the pointer is', () => {
    // Nine units to one side of the first leg: inside the click band, well
    // outside the drawn cable. The previous version moved this onto the cable,
    // which put the bend a visible distance from the click.
    const insertion = findWireBendInsertion(elbow, 40, 9);

    expect(insertion).not.toBeNull();
    expect(insertion!.x).toBe(40);
    expect(insertion!.y).toBe(9);
  });

  it('still reports the nearest point on the cable, and how far off it was', () => {
    const insertion = findWireBendInsertion(elbow, 40, 9)!;

    expect(insertion.footX).toBeCloseTo(40, 6);
    expect(insertion.footY).toBeCloseTo(0, 6);
    expect(insertion.distance).toBeCloseTo(9, 6);
  });

  it('picks the segment the pointer is actually nearest', () => {
    expect(findWireBendInsertion(elbow, 40, 4)!.index).toBe(0);
    expect(findWireBendInsertion(elbow, 104, 60)!.index).toBe(2);
  });

  it('refuses a click too far from the cable to have meant it', () => {
    // The distance was being computed and thrown away, so a click anywhere at
    // all found the nearest segment of the whole run and bent that.
    expect(findWireBendInsertion(elbow, 40, WIRE_BEND_MAX_DISTANCE + 1)).toBeNull();
    expect(findWireBendInsertion(elbow, 400, 400)).toBeNull();
  });

  it('accepts a click right at the edge of the band', () => {
    expect(findWireBendInsertion(elbow, 40, WIRE_BEND_MAX_DISTANCE)).not.toBeNull();
  });

  it('measures a click past a corner from the corner, not from the line extended', () => {
    const insertion = findWireBendInsertion(elbow, 104, -3)!;

    expect(insertion.footX).toBeCloseTo(100, 6);
    expect(insertion.footY).toBeCloseTo(0, 6);
    expect(insertion.distance).toBeCloseTo(5, 6);
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
  const elbow = [0, 0, 100, 0, 100, 100];

  it('splices the pointer itself between the ends of its own segment', () => {
    expect(withWireBendAt(elbow, 40, 9)!.points).toEqual([0, 0, 40, 9, 100, 0, 100, 100]);
  });

  it('reports where it put the new point, for a caller about to drag it', () => {
    const bend = withWireBendAt(elbow, 40, 9)!;

    expect(bend.index).toBe(2);
    expect(bend.points[bend.index]).toBe(40);
    expect(bend.points[bend.index + 1]).toBe(9);
  });

  it('bends an elbow that is clicked on its outside corner', () => {
    // Both segments measure this from the corner, so the foot landed exactly on
    // a point the cable already had and the guard below threw the bend away.
    // Double-clicking an elbow did nothing whatsoever.
    const bend = withWireBendAt(elbow, 101.5, -1.2);

    expect(bend).not.toBeNull();
    expect(bend!.points).toContain(101.5);
    expect(bend!.points).toContain(-1.2);
    expect(bend!.points.length).toBe(elbow.length + 2);
  });

  it('refuses a click that is nowhere near the cable', () => {
    expect(withWireBendAt(elbow, 40, 40)).toBeNull();
  });

  it('will not stack a bend on a point the cable already has', () => {
    // A vertex on top of a vertex does nothing but wait to be dragged by
    // accident. Measured from the pointer now, which is the thing being placed.
    expect(withWireBendAt(elbow, 100.2, 0.1)).toBeNull();
  });

  it('keeps the ends where they were plugged in', () => {
    const next = withWireBendAt(elbow, 60, 6)!.points;

    expect(next.slice(0, 2)).toEqual([0, 0]);
    expect(next.slice(-2)).toEqual([100, 100]);
  });

  it('adds one point and leaves the rest of the route alone', () => {
    const original = [0, 0, 100, 0, 100, 100, 200, 100];
    const next = withWireBendAt(original, 150, 104)!.points;

    expect(next).toEqual([0, 0, 100, 0, 100, 100, 150, 104, 200, 100]);
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

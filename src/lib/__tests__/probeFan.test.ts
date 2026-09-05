import { describe, expect, it } from 'vitest';
import {
  PROBE_FAN_ANGLE,
  PROBE_FAN_DISTANCE,
  getProbeFanAngles,
  rotateAround,
} from '../probeFan';

const at = (x: number, y: number) => ({ x, y });

describe('getProbeFanAngles', () => {
  it('leans the two apart when they are on the same point', () => {
    const { black, red } = getProbeFanAngles(at(100, 100), at(100, 100));

    expect(black).toBeCloseTo(-PROBE_FAN_ANGLE, 6);
    expect(red).toBeCloseTo(PROBE_FAN_ANGLE, 6);
    // Opposite ways, or they would still be parallel.
    expect(Math.sign(black)).not.toBe(Math.sign(red));
  });

  it('leaves them alone once they are far enough apart to read', () => {
    expect(getProbeFanAngles(at(0, 0), at(PROBE_FAN_DISTANCE, 0))).toEqual({ black: 0, red: 0 });
    expect(getProbeFanAngles(at(0, 0), at(200, 200))).toEqual({ black: 0, red: 0 });
  });

  it('straightens up gradually as one is dragged away', () => {
    // A probe pulled off its twin should not snap upright at some threshold.
    let previous = PROBE_FAN_ANGLE + 1;
    for (let gap = 0; gap < PROBE_FAN_DISTANCE; gap += 2) {
      const lean = getProbeFanAngles(at(0, 0), at(gap, 0)).red;
      expect(lean).toBeLessThan(previous);
      previous = lean;
    }
  });

  it('reads the same however the two are ordered in space', () => {
    const apart = getProbeFanAngles(at(0, 0), at(10, 0));
    const swapped = getProbeFanAngles(at(10, 0), at(0, 0));

    // The black probe always leans one way and the red the other; which of them
    // happens to be left of the other must not change that.
    expect(apart).toEqual(swapped);
  });

  it('answers with no lean for coordinates that are not numbers', () => {
    expect(getProbeFanAngles(at(Number.NaN, 0), at(0, 0))).toEqual({ black: 0, red: 0 });
  });
});

describe('rotateAround', () => {
  it('leaves the pivot itself where it is', () => {
    expect(rotateAround(at(50, 50), at(50, 50), 40)).toEqual(at(50, 50));
  });

  it('keeps the distance from the pivot', () => {
    const pivot = at(100, 100);
    const point = at(100, 40); // 60 above
    const turned = rotateAround(point, pivot, 37);

    expect(Math.hypot(turned.x - pivot.x, turned.y - pivot.y)).toBeCloseTo(60, 6);
  });

  it('turns a quarter circle the way the screen does', () => {
    // Screen y grows downwards, so a positive angle takes +x onto +y.
    const turned = rotateAround(at(10, 0), at(0, 0), 90);

    expect(turned.x).toBeCloseTo(0, 6);
    expect(turned.y).toBeCloseTo(10, 6);
  });

  it('does nothing at all for no angle', () => {
    const point = at(3, 7);
    expect(rotateAround(point, at(0, 0), 0)).toBe(point);
  });
});

describe('the two together', () => {
  it('moves the body without moving the tip', () => {
    // The whole point: a lead's boot swings round, the needle does not.
    const tip = at(200, 300);
    const boot = at(200, 232); // one probe-length up
    const { red } = getProbeFanAngles(tip, tip);
    const swung = rotateAround(boot, tip, red);

    expect(swung).not.toEqual(boot);
    expect(Math.hypot(swung.x - tip.x, swung.y - tip.y)).toBeCloseTo(68, 6);
  });
});

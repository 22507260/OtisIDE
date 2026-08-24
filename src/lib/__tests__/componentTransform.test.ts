import { describe, expect, it } from 'vitest';
import {
  clampComponentScale,
  getArtworkLeft,
  getComponentTransform,
  getMirroredPins,
  getTransformedPins,
  normalizeRotation,
  transformPoint,
} from '../componentTransform';

const pin = (x: number, y: number) => ({ id: 'p', x, y });

describe('component transform', () => {
  it('leaves a plain component alone', () => {
    expect(transformPoint(10, -4)).toEqual({ x: 10, y: -4 });
    const pins = [pin(3, 4)];
    expect(getTransformedPins(pins, { rotation: 0, scale: 1, flipX: false })).toBe(pins);
  });

  it('turns right angles exactly', () => {
    expect(transformPoint(10, 0, { rotation: 90 })).toEqual({ x: 0, y: 10 });
    expect(transformPoint(10, 0, { rotation: 180 })).toEqual({ x: -10, y: 0 });
    expect(transformPoint(10, 0, { rotation: 270 })).toEqual({ x: 0, y: -10 });
    expect(transformPoint(10, 0, { rotation: 360 })).toEqual({ x: 10, y: 0 });
  });

  it('handles angles in between and counter clockwise ones', () => {
    const turned = transformPoint(10, 0, { rotation: 30 });
    expect(turned.x).toBeCloseTo(8.66, 2);
    expect(turned.y).toBeCloseTo(5, 2);

    const back = transformPoint(10, 0, { rotation: -90 });
    expect(back.x).toBeCloseTo(0, 6);
    expect(back.y).toBeCloseTo(-10, 6);
  });

  it('scales the distance from the anchor', () => {
    expect(transformPoint(10, -6, { scale: 2 })).toEqual({ x: 20, y: -12 });
    expect(transformPoint(10, 0, { scale: 2, rotation: 90 })).toEqual({ x: 0, y: 20 });
  });

  it('mirrors across the anchor without touching the other axis', () => {
    expect(transformPoint(10, -6, { flipX: true })).toEqual({ x: -10, y: -6 });
  });

  it('mirrors first, then scales, then turns', () => {
    // A pin 10 to the right becomes 10 to the left, doubles to 20, and a
    // quarter turn sends it straight down.
    expect(transformPoint(10, 0, { flipX: true, scale: 2, rotation: 90 })).toEqual({
      x: 0,
      y: -20,
    });
  });

  it('keeps every pin field while moving it', () => {
    const moved = getTransformedPins([{ id: 'anode', name: 'A', x: 4, y: 2 }], { scale: 2 });
    expect(moved[0]).toEqual({ id: 'anode', name: 'A', x: 8, y: 4 });
  });

  it('mirrors pins on their own, for what Konva still has to turn', () => {
    expect(getMirroredPins([pin(4, 2)], true)).toEqual([{ id: 'p', x: -4, y: 2 }]);
    const pins = [pin(4, 2)];
    expect(getMirroredPins(pins, false)).toBe(pins);
  });

  it('keeps the size within what can be drawn', () => {
    expect(clampComponentScale(0.1)).toBe(0.4);
    expect(clampComponentScale(9)).toBe(3);
    expect(clampComponentScale(1.5)).toBe(1.5);
    expect(clampComponentScale(Number.NaN)).toBe(1);
  });

  it('normalises an angle onto a single turn', () => {
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
  });

  it('reports where mirrored artwork starts, so a frame can follow it', () => {
    // Centred anchor: mirroring changes nothing.
    const led = { width: 24, offsetX: 12 };
    expect(getArtworkLeft(led, false)).toBe(-12);
    expect(getArtworkLeft(led, true)).toBe(-12);

    // Anchor near the left edge, as on the RC522: the drawing lands on the
    // other side of the anchor, and a frame that ignored this would sit a full
    // width away from the part.
    const rc522 = { width: 272, offsetX: 20 };
    expect(getArtworkLeft(rc522, false)).toBe(-20);
    expect(getArtworkLeft(rc522, true)).toBe(-252);
    expect(getArtworkLeft(rc522, true) + rc522.width).toBe(rc522.offsetX);
  });

  it('fills in what an older component does not carry', () => {
    expect(getComponentTransform({ rotation: 90 })).toEqual({
      rotation: 90,
      scale: 1,
      flipX: false,
    });
  });
});

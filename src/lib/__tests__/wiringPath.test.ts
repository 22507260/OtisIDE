import { describe, expect, it } from 'vitest';
import { appendWiringBend, getWiringAnchor } from '../wiringPath';

const START = { x: 100, y: 100 };

describe('getWiringAnchor', () => {
  it('is the pin the cable came from while there are no bends yet', () => {
    expect(getWiringAnchor([], START)).toEqual({ x: 100, y: 100 });
  });

  it('is the last bend once there is one', () => {
    expect(getWiringAnchor([300, 100], START)).toEqual({ x: 300, y: 100 });
    expect(getWiringAnchor([300, 100, 300, 260], START)).toEqual({ x: 300, y: 260 });
  });

  it('falls back to the pin rather than hand back a non-finite anchor', () => {
    expect(getWiringAnchor([300, Number.NaN], START)).toEqual({ x: 100, y: 100 });
  });
});

describe('appendWiringBend', () => {
  it('puts the point exactly where it was given', () => {
    expect(appendWiringBend([], { x: 340, y: 118 })).toEqual([340, 118]);
  });

  it('keeps every earlier bend where it was', () => {
    const path = appendWiringBend([340, 118], { x: 340, y: 260 })!;

    expect(path).toEqual([340, 118, 340, 260]);
  });

  it('places consecutive bends in different places', () => {
    // The whole bug: the second click committed the position captured at the
    // first, so two clicks in two places produced two vertices in one.
    const first = appendWiringBend([], { x: 340, y: 118 })!;
    const second = appendWiringBend(first, { x: 512, y: 260 })!;

    expect(second).toEqual([340, 118, 512, 260]);
    expect(second.slice(0, 2)).not.toEqual(second.slice(2, 4));
  });

  it('refuses a bend on top of one the cable already has', () => {
    expect(appendWiringBend([340, 118], { x: 340.2, y: 118.1 })).toBeNull();
  });

  it('allows a bend just outside the separation it refuses inside', () => {
    expect(appendWiringBend([340, 118], { x: 341.5, y: 118 })).toEqual([340, 118, 341.5, 118]);
  });

  it('refuses a point that is not a point', () => {
    expect(appendWiringBend([], { x: Number.NaN, y: 10 })).toBeNull();
    expect(appendWiringBend([], { x: 10, y: Number.POSITIVE_INFINITY })).toBeNull();
    expect(appendWiringBend([], null as unknown as { x: number; y: number })).toBeNull();
  });
});

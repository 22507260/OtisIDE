import { describe, expect, it } from 'vitest';
import {
  WIRE_PIN_RADIUS,
  getClosestPinSpacing,
  getWirePinHitRadius,
  getWirePinTargetSize,
} from '../wirePinTargets';
import type { Pin } from '../../models/types';

const pin = (id: string, x: number, y: number): Pin => ({
  id,
  name: id,
  type: 'passive',
  x,
  y,
});

/** The four legs as the app actually measures them off rgb-led.svg. */
const RGB_LED_PINS = [
  pin('red', -11.818, 28),
  pin('common', -3.939, 28),
  pin('green', 3.939, 28),
  pin('blue', 11.818, 28),
];

/** A plain LED's two legs, far apart with room to spare. */
const LED_PINS = [pin('anode', 0, -20), pin('cathode', 0, 20)];

describe('wire pin targets', () => {
  it('measures the gap to the nearest neighbouring pin', () => {
    expect(getClosestPinSpacing(RGB_LED_PINS)).toBeCloseTo(7.879, 2);
    expect(getClosestPinSpacing(LED_PINS)).toBeCloseTo(40, 5);
  });

  it('keeps the full click area of adjacent RGB LED legs from overlapping', () => {
    const spacing = getClosestPinSpacing(RGB_LED_PINS);
    const hitRadius = getWirePinHitRadius(RGB_LED_PINS);

    // Two neighbours each reaching `hitRadius` must not meet in the middle,
    // otherwise a click lands on whichever happens to be drawn last and the
    // part cannot be wired up deliberately.
    expect(hitRadius * 2).toBeLessThanOrEqual(spacing + 1e-9);
  });

  it('draws RGB LED targets small enough not to visually overlap', () => {
    const { radius } = getWirePinTargetSize(RGB_LED_PINS);
    expect(radius * 2).toBeLessThan(getClosestPinSpacing(RGB_LED_PINS));
  });

  it('still gives a widely spaced part the full-size, generous target', () => {
    const { radius, hitStrokeWidth } = getWirePinTargetSize(LED_PINS);
    expect(radius).toBe(WIRE_PIN_RADIUS);
    expect(hitStrokeWidth).toBeGreaterThan(0);
    expect(getWirePinHitRadius(LED_PINS)).toBeGreaterThan(radius);
  });

  it('falls back to the default size for a single-pin part', () => {
    expect(getWirePinTargetSize([pin('only', 0, 0)]).radius).toBe(WIRE_PIN_RADIUS);
    expect(getWirePinTargetSize([]).radius).toBe(WIRE_PIN_RADIUS);
  });

  it('never shrinks a target away to nothing', () => {
    const crowded = [pin('a', 0, 0), pin('b', 0.5, 0)];
    expect(getWirePinTargetSize(crowded).radius).toBeGreaterThan(0);
  });
});

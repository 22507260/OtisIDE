import { describe, expect, it } from 'vitest';
import {
  FLOW_MAX_SPEED,
  FLOW_MIN_SPEED,
  FLOW_SPACING_DENSE,
  FLOW_SPACING_MEDIUM,
  FLOW_SPACING_SPARSE,
  getFlowPace,
} from '../flowPace';

/** The currents this simulator actually produces. */
const TEN_KILOHM_LED = 0.0003;
const ONE_KILOHM_LED = 0.003;
const TYPICAL_LED = 0.0104;
const BUZZER = 0.025;
const MOTOR = 0.4;

describe('speed', () => {
  it('tells apart the currents this simulator actually makes', () => {
    // The old scale was clamp(|I| * 260, 22, 260), whose floor binds under
    // about 85 mA — so every one of these ran at exactly the same speed and
    // nothing about the current was visible.
    const speeds = [TEN_KILOHM_LED, ONE_KILOHM_LED, TYPICAL_LED, BUZZER].map(
      (amps) => getFlowPace(amps).speed
    );

    for (let i = 1; i < speeds.length; i += 1) {
      expect(speeds[i], `${speeds[i]} should beat ${speeds[i - 1]}`).toBeGreaterThan(
        speeds[i - 1] + 10
      );
    }
  });

  it('gives a tenfold current a fixed step, wherever in the range it falls', () => {
    // Logarithmic, so the same ratio reads the same on screen whether it is
    // 0.1 to 1 mA or 1 to 10 mA.
    const lowDecade = getFlowPace(0.001).speed - getFlowPace(0.0001).speed;
    const highDecade = getFlowPace(0.01).speed - getFlowPace(0.001).speed;

    expect(lowDecade).toBeCloseTo(highDecade, 6);
  });

  it('never leaves its bounds', () => {
    for (const amps of [1e-9, 1e-6, TYPICAL_LED, MOTOR, 5, 1e6]) {
      const { speed } = getFlowPace(amps);
      expect(speed).toBeGreaterThanOrEqual(FLOW_MIN_SPEED);
      expect(speed).toBeLessThanOrEqual(FLOW_MAX_SPEED);
    }
  });

  it('rises with the current and never falls', () => {
    let previous = 0;
    for (let amps = 1e-6; amps < 1; amps *= 1.5) {
      const { speed } = getFlowPace(amps);
      expect(speed).toBeGreaterThanOrEqual(previous);
      previous = speed;
    }
  });
});

describe('spacing', () => {
  it('puts the circuit everybody builds in the middle band', () => {
    // An LED behind 220 ohms. If this is at either extreme the other two bands
    // have nothing to say.
    expect(getFlowPace(TYPICAL_LED).spacing).toBe(FLOW_SPACING_MEDIUM);
  });

  it('thins out below a couple of milliamps and closes up above twenty', () => {
    expect(getFlowPace(TEN_KILOHM_LED).spacing).toBe(FLOW_SPACING_SPARSE);
    expect(getFlowPace(0.0019).spacing).toBe(FLOW_SPACING_SPARSE);
    expect(getFlowPace(0.002).spacing).toBe(FLOW_SPACING_MEDIUM);
    expect(getFlowPace(0.0199).spacing).toBe(FLOW_SPACING_MEDIUM);
    expect(getFlowPace(0.02).spacing).toBe(FLOW_SPACING_DENSE);
    expect(getFlowPace(MOTOR).spacing).toBe(FLOW_SPACING_DENSE);
  });

  it('never widens as the current grows', () => {
    let previous = Infinity;
    for (let amps = 1e-6; amps < 1; amps *= 1.2) {
      const { spacing } = getFlowPace(amps);
      expect(spacing).toBeLessThanOrEqual(previous);
      previous = spacing;
    }
  });
});

describe('the awkward inputs', () => {
  it('answers with something finite for a current that is not a number', () => {
    for (const amps of [0, -0, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const { speed, spacing } = getFlowPace(amps);
      expect(Number.isFinite(speed)).toBe(true);
      expect(Number.isFinite(spacing)).toBe(true);
      expect(speed).toBeGreaterThanOrEqual(FLOW_MIN_SPEED);
    }
  });

  it('reads a current the same in either direction', () => {
    expect(getFlowPace(-TYPICAL_LED)).toEqual(getFlowPace(TYPICAL_LED));
  });
});

import { describe, expect, it } from 'vitest';
import {
  STEP_REPEAT_DELAY_MS,
  STEP_REPEAT_FAST_MS,
  STEP_REPEAT_RAMP,
  getRepeatDelay,
} from '../stepRepeat';

describe('getRepeatDelay', () => {
  it('waits long enough after the click that a click is never a hold', () => {
    expect(getRepeatDelay(0)).toBe(STEP_REPEAT_DELAY_MS);
    expect(STEP_REPEAT_DELAY_MS).toBeGreaterThan(250);
  });

  it('speeds up with every repeat', () => {
    const delays = Array.from({ length: STEP_REPEAT_RAMP + 1 }, (_, i) => getRepeatDelay(i));

    for (let i = 1; i < delays.length; i += 1) {
      expect(delays[i]).toBeLessThan(delays[i - 1]);
    }
  });

  it('stops speeding up once it is as fast as it goes', () => {
    expect(getRepeatDelay(STEP_REPEAT_RAMP)).toBe(STEP_REPEAT_FAST_MS);
    expect(getRepeatDelay(STEP_REPEAT_RAMP + 40)).toBe(STEP_REPEAT_FAST_MS);
    expect(getRepeatDelay(10_000)).toBe(STEP_REPEAT_FAST_MS);
  });

  it('never returns a wait that would spin the timer', () => {
    for (let i = 0; i <= 200; i += 1) {
      expect(getRepeatDelay(i)).toBeGreaterThanOrEqual(STEP_REPEAT_FAST_MS);
    }
  });

  it('falls back to the initial pause rather than a nonsense wait', () => {
    expect(getRepeatDelay(Number.NaN)).toBe(STEP_REPEAT_DELAY_MS);
    expect(getRepeatDelay(-3)).toBe(STEP_REPEAT_DELAY_MS);
    expect(getRepeatDelay(Number.POSITIVE_INFINITY)).toBe(STEP_REPEAT_DELAY_MS);
  });
});

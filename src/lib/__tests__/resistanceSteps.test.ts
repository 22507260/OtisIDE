import { describe, expect, it } from 'vitest';
import { stepResistance } from '../resistanceSteps';

describe('stepping a resistance', () => {
  it('walks the series a value at a time', () => {
    expect(stepResistance(220, 1)).toBe(270);
    expect(stepResistance(220, -1)).toBe(180);
  });

  it('crosses a decade without stalling', () => {
    expect(stepResistance(820, 1)).toBe(1000);
    expect(stepResistance(1000, -1)).toBe(820);
  });

  it('gets from a couple of hundred ohms to ten kilohm in a sane number of turns', () => {
    let value = 220;
    let turns = 0;
    while (value < 10_000 && turns < 100) {
      value = stepResistance(value, 1);
      turns += 1;
    }

    expect(value).toBe(10_000);
    // Fixed steps of one ohm would have taken ten thousand of them.
    expect(turns).toBeLessThan(25);
  });

  it('moves an odd value onto the nearest rung in the direction asked for', () => {
    expect(stepResistance(250, 1)).toBe(270);
    expect(stepResistance(250, -1)).toBe(220);
  });

  it('stops at the ends rather than running away', () => {
    expect(stepResistance(10_000_000, 1)).toBe(10_000_000);
    expect(stepResistance(1, -1)).toBe(10);
  });

  it('leaves the value alone when asked for no step', () => {
    expect(stepResistance(4700, 0)).toBe(4700);
  });
});

import { describe, expect, it } from 'vitest';
import { clampPropertyValue, getPropertyRange } from '../propertyRanges';

describe('property ranges', () => {
  it('holds a potentiometer between nought and a hundred percent', () => {
    expect(clampPropertyValue('potentiometer', 'position', 150)).toBe(100);
    expect(clampPropertyValue('potentiometer', 'position', -20)).toBe(0);
    expect(clampPropertyValue('potentiometer', 'position', 37)).toBe(37);
  });

  it('offers the potentiometer a slider rather than a number to type', () => {
    expect(getPropertyRange('potentiometer', 'position')).toMatchObject({
      min: 0,
      max: 100,
      slider: true,
    });
  });

  it('leaves values with no honest bound alone', () => {
    // A resistance can be anything; inventing a ceiling would be worse than
    // having none.
    expect(getPropertyRange('potentiometer', 'resistance')).toBeNull();
    expect(clampPropertyValue('potentiometer', 'resistance', 4_700_000)).toBe(4_700_000);
    expect(getPropertyRange('hc-05', 'baudRate')).toBeNull();
  });

  it('keeps a servo inside the half turn it can reach', () => {
    expect(clampPropertyValue('servo', 'angle', 900)).toBe(180);
    expect(clampPropertyValue('servo', 'angle', -30)).toBe(0);
  });

  it('scopes a range to the part that owns it', () => {
    // A stepper counts turns, so its angle has no ceiling; a servo's does.
    expect(getPropertyRange('servo', 'angle')).not.toBeNull();
    expect(getPropertyRange('stepper-28byj48', 'angle')).toBeNull();
    expect(clampPropertyValue('stepper-28byj48', 'angle', 900)).toBe(900);
  });

  it('applies a shared range wherever the property turns up', () => {
    for (const battery of ['9v-battery', 'aa-battery', 'li-po-battery']) {
      expect(clampPropertyValue(battery, 'chargePercent', 140)).toBe(100);
    }
  });

  it('falls back to the floor when handed something that is not a number', () => {
    expect(clampPropertyValue('potentiometer', 'position', Number.NaN)).toBe(0);
  });
});

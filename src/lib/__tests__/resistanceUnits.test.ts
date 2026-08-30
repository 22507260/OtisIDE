import { describe, expect, it } from 'vitest';
import {
  fromOhms,
  getResistanceUnitMultiplier,
  getResistanceUnitSymbol,
  normalizeResistanceUnit,
  pickResistanceUnit,
  toOhms,
} from '../resistanceUnits';

describe('normalizeResistanceUnit', () => {
  it('reads the units it stores', () => {
    expect(normalizeResistanceUnit('ohm')).toBe('ohm');
    expect(normalizeResistanceUnit('kohm')).toBe('kohm');
    expect(normalizeResistanceUnit('Mohm')).toBe('Mohm');
  });

  it('ignores case and the symbol forms a hand-edited file might carry', () => {
    expect(normalizeResistanceUnit('KOHM')).toBe('kohm');
    expect(normalizeResistanceUnit('mohm')).toBe('Mohm');
    expect(normalizeResistanceUnit(' kΩ ')).toBe('kohm');
    expect(normalizeResistanceUnit('MΩ')).toBe('Mohm');
  });

  it('falls back to ohms, which is what every project without one meant', () => {
    expect(normalizeResistanceUnit(undefined)).toBe('ohm');
    expect(normalizeResistanceUnit('uF')).toBe('ohm');
    expect(normalizeResistanceUnit(220)).toBe('ohm');
  });
});

describe('multipliers and symbols', () => {
  it('scales by a thousand a step', () => {
    expect(getResistanceUnitMultiplier('ohm')).toBe(1);
    expect(getResistanceUnitMultiplier('kohm')).toBe(1_000);
    expect(getResistanceUnitMultiplier('Mohm')).toBe(1_000_000);
  });

  it('labels each unit', () => {
    expect(getResistanceUnitSymbol('ohm')).toBe('Ω');
    expect(getResistanceUnitSymbol('kohm')).toBe('kΩ');
    expect(getResistanceUnitSymbol('Mohm')).toBe('MΩ');
  });
});

describe('pickResistanceUnit', () => {
  it('picks the unit that writes the value with the fewest digits', () => {
    expect(pickResistanceUnit(220)).toBe('ohm');
    expect(pickResistanceUnit(999)).toBe('ohm');
    expect(pickResistanceUnit(1_000)).toBe('kohm');
    expect(pickResistanceUnit(4_700)).toBe('kohm');
    expect(pickResistanceUnit(1_500_000)).toBe('Mohm');
  });

  it('handles nothing sensible being stored', () => {
    expect(pickResistanceUnit(0)).toBe('ohm');
    expect(pickResistanceUnit(Number.NaN)).toBe('ohm');
  });
});

describe('conversion', () => {
  it('converts without leaving binary dust behind', () => {
    // 4.7 * 1000 is 4700.000000000001 in plain arithmetic.
    expect(toOhms(4.7, 'kohm')).toBe(4700);
    expect(toOhms(2.2, 'kohm')).toBe(2200);
    expect(toOhms(1.5, 'Mohm')).toBe(1_500_000);
    expect(toOhms(220, 'ohm')).toBe(220);
  });

  it('round trips', () => {
    expect(fromOhms(toOhms(4.7, 'kohm'), 'kohm')).toBe(4.7);
    expect(fromOhms(4700, 'kohm')).toBe(4.7);
    expect(fromOhms(4700, 'ohm')).toBe(4700);
    expect(fromOhms(1_500_000, 'Mohm')).toBe(1.5);
  });

  it('keeps the resistance itself when only the unit changes', () => {
    const stored = 4700;
    expect(fromOhms(stored, 'ohm')).toBe(4700);
    expect(fromOhms(stored, 'kohm')).toBe(4.7);
    expect(fromOhms(stored, 'Mohm')).toBe(0.0047);
  });
});

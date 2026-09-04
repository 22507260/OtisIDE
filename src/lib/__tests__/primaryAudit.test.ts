import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getDefaultProperties } from '../../models/types';
import type { ComponentType } from '../../models/types';
import { getPrimaryProperty, getPropertyRange, stepPropertyValue } from '../propertyRanges';

/**
 * Every component type there is, read off the union in models/types.ts.
 *
 * There is no runtime list of them, and a hand-written one in here would fall
 * behind the moment a part was added — which is exactly the failure this file
 * exists to catch.
 */
function allComponentTypes(): ComponentType[] {
  const source = readFileSync(new URL('../../models/types.ts', import.meta.url), 'utf8');
  const union = source.slice(source.indexOf('export type ComponentType'));
  return Array.from(union.slice(0, union.indexOf(';')).matchAll(/'([a-z0-9-]+)'/g)).map(
    (match) => match[1] as ComponentType
  );
}

describe('the wheel reaches every value worth turning', () => {
  it('finds a primary property for anything with a range to move along', () => {
    const missed: string[] = [];

    for (const type of allComponentTypes()) {
      const properties = getDefaultProperties(type);
      const ranged = Object.entries(properties).some(
        ([key, value]) => typeof value === 'number' && getPropertyRange(type, key)
      );
      if (ranged && !getPrimaryProperty(type, properties)) missed.push(type);
    }

    expect(missed).toEqual([]);
  });

  it('steps a named primary by its own range, not the resistor ladder', () => {
    // Every named primary needs a range, or stepPropertyValue falls through to
    // the E12 ladder and a thermometer reads 22, 27, 33, 39 degrees.
    const laddered: string[] = [];

    for (const type of allComponentTypes()) {
      const properties = getDefaultProperties(type);
      const key = getPrimaryProperty(type, properties);
      if (!key) continue;
      // Resistance and capacitance are *meant* to walk the ladder.
      if (key === 'resistance' || key === 'capacitance') continue;
      if (!getPropertyRange(type, key)) laddered.push(`${type}.${key}`);
    }

    expect(laddered).toEqual([]);
  });

  it('keeps the wheel off readings and probe positions', () => {
    // Turning a multimeter would drag its probes across the board, and the
    // current a sensor reports is an output, not a setting.
    for (const type of ['multimeter', 'ina219', 'acs712'] as ComponentType[]) {
      expect(getPrimaryProperty(type, getDefaultProperties(type))).toBeNull();
    }
  });

  it('stops a stepped value at both ends of its range', () => {
    expect(stepPropertyValue('potentiometer', 'position', 100, 1)).toBe(100);
    expect(stepPropertyValue('potentiometer', 'position', 0, -1)).toBe(0);
    expect(stepPropertyValue('tm1637', 'brightness', 7, 1)).toBe(7);
    expect(stepPropertyValue('led', 'forwardVoltage', 2, 1)).toBeCloseTo(2.1, 5);
  });
});

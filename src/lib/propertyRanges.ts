/**
 * How far a numeric property is allowed to go.
 *
 * The properties panel wrote every number straight through, so a
 * potentiometer's position could be set to 5000 percent and a servo could be
 * asked for a 900 degree angle. Nothing downstream expected that: the runtime
 * clamps what it reads, so the value simply sat there looking wrong.
 *
 * Only properties with a real physical range are listed. Anything not here —
 * a resistance, a capacity, a baud rate — stays a free number, because there is
 * no honest upper bound to give it.
 */

import { stepResistance } from './resistanceSteps';

export type PropertyRange = {
  min: number;
  max: number;
  step: number;
  /** Worth dragging rather than typing: a knob, a dimmer, a charge level. */
  slider?: boolean;
};

const PERCENT: PropertyRange = { min: 0, max: 100, step: 1, slider: true };
const BYTE: PropertyRange = { min: 0, max: 255, step: 1, slider: true };

/** Ranges that belong to one kind of part. */
const BY_TYPE: Record<string, Record<string, PropertyRange>> = {
  potentiometer: { position: PERCENT },
  ldr: { lightLevel: PERCENT },
  'flame-sensor': { sensitivity: PERCENT },
  servo: {
    angle: { min: 0, max: 180, step: 1, slider: true },
    minAngle: { min: 0, max: 180, step: 1 },
    maxAngle: { min: 0, max: 180, step: 1 },
  },
  'rgb-led': { red: BYTE, green: BYTE, blue: BYTE },
  joystick: {
    xAxis: { min: 0, max: 1023, step: 1, slider: true },
    yAxis: { min: 0, max: 1023, step: 1, slider: true },
  },
  // The range a piezo can actually be driven over.
  buzzer: { frequency: { min: 31, max: 20000, step: 1 } },
  dht11: { humidity: PERCENT },
  bme280: { humidity: PERCENT },
  'l298n-driver': { pwmA: BYTE, pwmB: BYTE },
  'bts7960-driver': { pwmR: BYTE, pwmL: BYTE },
};

/** Ranges that mean the same thing on every part that has them. */
const BY_KEY: Record<string, PropertyRange> = {
  chargePercent: PERCENT,
};

export function getPropertyRange(
  componentType: string,
  key: string
): PropertyRange | null {
  return BY_TYPE[componentType]?.[key] ?? BY_KEY[key] ?? null;
}

/** The value, brought back inside its range. Untouched when it has none. */
export function clampPropertyValue(
  componentType: string,
  key: string,
  value: number
): number {
  const range = getPropertyRange(componentType, key);
  if (!range) return value;
  if (!Number.isFinite(value)) return range.min;
  return Math.min(range.max, Math.max(range.min, value));
}

/**
 * The value a part is most likely to be reached for.
 *
 * The wheel needs one answer per part: a resistor's resistance, a knob's
 * position, a servo's angle. Where a part has several adjustable numbers this
 * says which one the wheel gets; the rest stay in the panel where they can be
 * picked out by name.
 */
const PRIMARY_PROPERTY: Record<string, string> = {
  resistor: 'resistance',
  potentiometer: 'position',
  ldr: 'lightLevel',
  servo: 'angle',
  buzzer: 'frequency',
  'flame-sensor': 'sensitivity',
  joystick: 'xAxis',
  dht11: 'temperature',
  bme280: 'temperature',
  lm35: 'temperature',
  mq2: 'gasLevel',
  vl53l0x: 'distance',
  'rgb-led': 'red',
  'l298n-driver': 'pwmA',
  'bts7960-driver': 'pwmR',
  capacitor: 'capacitance',
};

/** Anything with a charge level is adjusted by that before anything else. */
const CHARGE_KEY = 'chargePercent';

export function getPrimaryProperty(
  componentType: string,
  properties: Record<string, unknown>
): string | null {
  if (typeof properties[CHARGE_KEY] === 'number') return CHARGE_KEY;

  const named = PRIMARY_PROPERTY[componentType];
  if (named && typeof properties[named] === 'number') return named;

  // Nothing named: the first number that has an honest range to move along.
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === 'number' && getPropertyRange(componentType, key)) return key;
  }

  return typeof properties.resistance === 'number' ? 'resistance' : null;
}

/**
 * One wheel notch on a property. A resistance walks the E12 ladder, because
 * nothing else gets from 220 to ten kilohm in a sane number of turns; anything
 * with a range moves by its own step and stops at its ends.
 */
export function stepPropertyValue(
  componentType: string,
  key: string,
  current: number,
  direction: number
): number {
  if (direction === 0) return current;

  const range = getPropertyRange(componentType, key);
  if (!range) {
    // Resistances, capacitances and the like: multiplicative, not additive.
    return stepResistance(current, direction);
  }

  const next = current + range.step * (direction > 0 ? 1 : -1);
  return clampPropertyValue(componentType, key, Number(next.toFixed(4)));
}

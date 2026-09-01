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

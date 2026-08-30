/**
 * The unit a resistance is typed and shown in.
 *
 * Resistance itself is always stored in ohms — the simulation, the on-canvas
 * label and the colour bands all read that one number — so the unit is purely
 * how the value is entered and displayed. Switching it never changes the part:
 * 4700 ohm shown in kilohms is 4.7, and the circuit is the same circuit.
 */

export type ResistanceUnit = 'ohm' | 'kohm' | 'Mohm';

export const RESISTANCE_UNITS: readonly ResistanceUnit[] = ['ohm', 'kohm', 'Mohm'];

const MULTIPLIERS: Record<ResistanceUnit, number> = {
  ohm: 1,
  kohm: 1_000,
  Mohm: 1_000_000,
};

const SYMBOLS: Record<ResistanceUnit, string> = {
  ohm: 'Ω',
  kohm: 'kΩ',
  Mohm: 'MΩ',
};

/**
 * Stored with a capital M so it cannot be read as milliohms, but accepted in
 * any case on the way in: projects saved before this existed carry `'ohm'`, and
 * a hand-edited file may well say `'k'` or `'MΩ'`. Anything unrecognised is
 * plain ohms, which is what every such file meant.
 */
export function normalizeResistanceUnit(unit: unknown): ResistanceUnit {
  if (typeof unit !== 'string') return 'ohm';

  const normalized = unit.trim().toLowerCase();

  if (normalized === 'kohm' || normalized === 'kohms' || normalized === 'k' || normalized === 'kω') {
    return 'kohm';
  }

  if (normalized === 'mohm' || normalized === 'mohms' || normalized === 'm' || normalized === 'mω') {
    return 'Mohm';
  }

  return 'ohm';
}

export function getResistanceUnitMultiplier(unit: unknown): number {
  return MULTIPLIERS[normalizeResistanceUnit(unit)];
}

export function getResistanceUnitSymbol(unit: unknown): string {
  return SYMBOLS[normalizeResistanceUnit(unit)];
}

/** The unit that writes this many ohms with the fewest digits. */
export function pickResistanceUnit(ohms: number): ResistanceUnit {
  const magnitude = Math.abs(Number.isFinite(ohms) ? ohms : 0);

  if (magnitude >= 1_000_000) return 'Mohm';
  if (magnitude >= 1_000) return 'kohm';
  return 'ohm';
}

/**
 * Scaling by a thousand is not exact in binary — 4.7 * 1000 lands on
 * 4700.000000000001 — so both directions are trimmed back to twelve significant
 * digits. That is far more precision than any resistor has, and it keeps the
 * round trip clean: 4.7 kohm is 4700 ohm is 4.7 kohm.
 */
function trim(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toPrecision(12));
}

export function toOhms(value: number, unit: unknown): number {
  return trim(value * getResistanceUnitMultiplier(unit));
}

export function fromOhms(ohms: number, unit: unknown): number {
  return trim(ohms / getResistanceUnitMultiplier(unit));
}

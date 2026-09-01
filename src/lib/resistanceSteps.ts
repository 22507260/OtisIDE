/**
 * The next resistance up or down from where you are.
 *
 * Stepping by a fixed amount is useless across the range these take: one ohm at
 * a time never gets you from 220 to 10k, and a thousand at a time skips
 * everything below it. Real resistors come in a repeating series of values per
 * decade, so this walks that series instead — which is also the set of values
 * anyone actually has in a drawer.
 */

/** The E12 series: what a bag of assorted resistors is made of. */
const DECADE = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];

const MIN_RESISTANCE = 1;
const MAX_RESISTANCE = 10_000_000;

/** Every value in the series across the range, smallest first. */
const LADDER: number[] = (() => {
  const values: number[] = [];
  for (let exponent = 0; exponent <= 6; exponent += 1) {
    for (const base of DECADE) {
      const value = base * 10 ** exponent;
      if (value >= MIN_RESISTANCE && value <= MAX_RESISTANCE) values.push(value);
    }
  }
  values.push(MAX_RESISTANCE);
  return [...new Set(values)].sort((a, b) => a - b);
})();

/**
 * One step along the ladder. `direction` is +1 for the next value up and -1 for
 * the next one down; a value sitting between two rungs moves to the nearer rung
 * in that direction rather than snapping first.
 */
export function stepResistance(current: number, direction: number): number {
  if (!Number.isFinite(current)) return LADDER[0];
  if (direction === 0) return current;

  if (direction > 0) {
    const next = LADDER.find((value) => value > current + 1e-6);
    return next ?? LADDER[LADDER.length - 1];
  }

  const lower = [...LADDER].reverse().find((value) => value < current - 1e-6);
  return lower ?? LADDER[0];
}

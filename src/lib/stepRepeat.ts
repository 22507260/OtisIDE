/**
 * How fast a held-down stepper arrow repeats.
 *
 * A click is one step. Holding is for the times one step is not what you want —
 * a resistor going from 220 Ω to 47 kΩ is seventeen rungs of the E12 ladder,
 * and clicking seventeen times is not a design. So the first repeat waits long
 * enough that a click is never mistaken for a hold, and the rest accelerate to
 * a pace you can still stop on the value you meant.
 */

/** The pause after the initial click before repeating starts at all. */
export const STEP_REPEAT_DELAY_MS = 400;
/** The fastest it ever goes. */
export const STEP_REPEAT_FAST_MS = 60;
/** How many repeats it takes to get there. */
export const STEP_REPEAT_RAMP = 6;

/**
 * The wait before repeat number `repeat`, counting the first repeat as 0.
 *
 * Falls from the initial pause to the floor across `STEP_REPEAT_RAMP` repeats
 * and stays there, so a hold speeds up under the finger and then holds steady
 * rather than running away.
 */
export function getRepeatDelay(repeat: number): number {
  if (!Number.isFinite(repeat) || repeat <= 0) return STEP_REPEAT_DELAY_MS;

  const along = Math.min(1, repeat / STEP_REPEAT_RAMP);
  return Math.round(
    STEP_REPEAT_DELAY_MS + (STEP_REPEAT_FAST_MS - STEP_REPEAT_DELAY_MS) * along
  );
}

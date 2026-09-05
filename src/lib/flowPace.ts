/**
 * How fast the current arrows travel, and how thickly they sit.
 *
 * Both come from the same number so they cannot disagree on the same frame, and
 * both are scaled in milliamps rather than amps — which is the whole point.
 * The speed used to be `clamp(|I| * 260, 22, 260)`, and that lower clamp binds
 * at anything under about 85 mA. Nothing this simulator builds goes near that:
 * a 220 ohm LED draws ten milliamps, a piezo fifteen to thirty, and the damage
 * limits are thirty to a hundred. So every realistic circuit ran at exactly the
 * floor speed and "it moves faster when more current flows" was invisible.
 */

/** The pace a barely-conducting circuit still crawls along at. */
export const FLOW_MIN_SPEED = 22;
/** ...and the fastest the marks are allowed to travel, in units per second. */
export const FLOW_MAX_SPEED = 260;

/**
 * The decade that matters, in amps.
 *
 * A tenth of a milliamp is a ten-kilohm LED, "barely alight"; a hundred
 * milliamps is past what any part here survives. Spreading the speed over the
 * logarithm of that range means a tenfold change in current is a tenfold change
 * on screen, wherever in the range it happens.
 */
const SPEED_FLOOR_CURRENT = 1e-4;
const SPEED_CEILING_CURRENT = 0.1;

/**
 * Three densities, because a smooth ramp is not readable at a glance.
 *
 * The thresholds put the circuit everybody builds — an LED behind 220 ohms,
 * about ten milliamps — in the middle band, so the sparse and dense ones read
 * as "less than usual" and "more than usual" rather than as the extremes.
 */
export const FLOW_SPACING_SPARSE = 200;
export const FLOW_SPACING_MEDIUM = 120;
export const FLOW_SPACING_DENSE = 60;

const MEDIUM_FROM_CURRENT = 0.002;
const DENSE_FROM_CURRENT = 0.02;

export type FlowPace = {
  /** Canvas units per second. */
  speed: number;
  /** Canvas units between one arrow and the next. */
  spacing: number;
};

/** The pace for a branch carrying `current` amps. Sign is ignored. */
export function getFlowPace(current: number): FlowPace {
  const amps = Math.abs(current);

  // A branch carrying nothing is drawn as a still grey dash, not as arrows, so
  // this is only reached for a current that has already been called real. Even
  // so it must answer with something finite.
  if (!Number.isFinite(amps) || amps <= 0) {
    return { speed: FLOW_MIN_SPEED, spacing: FLOW_SPACING_SPARSE };
  }

  const decades = Math.log10(SPEED_CEILING_CURRENT / SPEED_FLOOR_CURRENT);
  const along = Math.log10(amps / SPEED_FLOOR_CURRENT) / decades;
  const t = Math.min(1, Math.max(0, along));

  return {
    speed: FLOW_MIN_SPEED + (FLOW_MAX_SPEED - FLOW_MIN_SPEED) * t,
    spacing:
      amps < MEDIUM_FROM_CURRENT
        ? FLOW_SPACING_SPARSE
        : amps < DENSE_FROM_CURRENT
          ? FLOW_SPACING_MEDIUM
          : FLOW_SPACING_DENSE,
  };
}

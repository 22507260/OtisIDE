/**
 * Where the "press Shift" hint sits when the warnings bar is in the way.
 *
 * The hint is pinned to the top-right of the canvas and the warnings bar to the
 * top-centre, so on a wide canvas they never meet. On a narrow one they do, and
 * the bar wins: it is drawn later and stacked higher.
 *
 * This used to be a fixed 104px drop, guessed from a bar three warnings tall.
 * The bar has no height limit, so a fourth warning grew it past the guess and
 * covered the hint again — invisibly, because the hint was still in the page
 * and still reported its text. Measure the bar instead of guessing at it.
 */

/** The hint's distance from the top of the canvas with nothing in its way. */
export const FLOW_HINT_TOP = 10;
/** Clear air between the bottom of the warnings bar and the hint. */
export const FLOW_HINT_GAP = 10;

export type FlowHintPlacement = {
  /** Canvas width in CSS pixels. */
  canvasWidth: number;
  /** The warnings bar's width, or 0 when there is no bar. */
  warningsWidth: number;
  /** The warnings bar's height, or 0 when there is no bar. */
  warningsHeight: number;
  /** The hint's own width. */
  hintWidth: number;
};

/**
 * The hint's `top`, in CSS pixels.
 *
 * Stays at the top unless the centred warnings bar actually reaches across to
 * where the hint starts; only then does it drop below the bar's real height.
 */
export function getFlowHintTop({
  canvasWidth,
  warningsWidth,
  warningsHeight,
  hintWidth,
}: FlowHintPlacement): number {
  const measurements = [canvasWidth, warningsWidth, warningsHeight, hintWidth];
  if (measurements.some((value) => !Number.isFinite(value))) return FLOW_HINT_TOP;
  if (warningsHeight <= 0 || warningsWidth <= 0) return FLOW_HINT_TOP;

  // The bar is centred; the hint is inset from the right by the same margin it
  // sits down from the top.
  const barRight = canvasWidth / 2 + warningsWidth / 2;
  const hintLeft = canvasWidth - FLOW_HINT_TOP - hintWidth;
  if (barRight <= hintLeft) return FLOW_HINT_TOP;

  return FLOW_HINT_TOP + warningsHeight + FLOW_HINT_GAP;
}

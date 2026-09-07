import { describe, expect, it } from 'vitest';
import { FLOW_HINT_GAP, FLOW_HINT_TOP, getFlowHintTop } from '../hintPlacement';

/** A four-warning bar: the case the old fixed 104px drop was not tall enough for. */
const TALL_BAR = { warningsWidth: 420, warningsHeight: 152 };
/** Three warnings, which is roughly what the fixed drop was guessed from. */
const SHORT_BAR = { warningsWidth: 420, warningsHeight: 98 };

describe('getFlowHintTop', () => {
  it('leaves the hint at the top when there is no warnings bar', () => {
    expect(
      getFlowHintTop({ canvasWidth: 900, warningsWidth: 0, warningsHeight: 0, hintWidth: 220 })
    ).toBe(FLOW_HINT_TOP);
  });

  it('leaves the hint at the top on a canvas wide enough for both', () => {
    // Bar spans 590..1010 of a 1600 canvas; the hint starts at 1370.
    expect(getFlowHintTop({ canvasWidth: 1600, ...TALL_BAR, hintWidth: 220 })).toBe(FLOW_HINT_TOP);
  });

  it('drops the hint below a bar it would otherwise sit behind', () => {
    // Bar spans 190..610 of an 800 canvas; the hint starts at 570.
    expect(getFlowHintTop({ canvasWidth: 800, ...TALL_BAR, hintWidth: 220 })).toBe(
      FLOW_HINT_TOP + TALL_BAR.warningsHeight + FLOW_HINT_GAP
    );
  });

  it('clears a bar taller than the drop it used to be given', () => {
    // The whole point: 104px was not enough for four warnings, and the bar is
    // stacked above the hint, so the hint was covered while still reporting
    // its text to anything that asked.
    const top = getFlowHintTop({ canvasWidth: 800, ...TALL_BAR, hintWidth: 220 });

    expect(top).toBeGreaterThan(104);
    expect(top).toBeGreaterThanOrEqual(FLOW_HINT_TOP + TALL_BAR.warningsHeight);
  });

  it('drops only as far as the bar in front of it actually goes', () => {
    const tall = getFlowHintTop({ canvasWidth: 800, ...TALL_BAR, hintWidth: 220 });
    const short = getFlowHintTop({ canvasWidth: 800, ...SHORT_BAR, hintWidth: 220 });

    expect(short).toBeLessThan(tall);
    expect(short).toBe(FLOW_HINT_TOP + SHORT_BAR.warningsHeight + FLOW_HINT_GAP);
  });

  it('treats a bar that stops exactly where the hint starts as clear', () => {
    // Bar spans 190..610, hint starts at 610: touching, not overlapping.
    expect(
      getFlowHintTop({
        canvasWidth: 800,
        warningsWidth: 420,
        warningsHeight: 152,
        hintWidth: 800 - FLOW_HINT_TOP - 610,
      })
    ).toBe(FLOW_HINT_TOP);
  });

  it('falls back to the top rather than a nonsense offset', () => {
    expect(
      getFlowHintTop({
        canvasWidth: Number.NaN,
        warningsWidth: 420,
        warningsHeight: 152,
        hintWidth: 220,
      })
    ).toBe(FLOW_HINT_TOP);
  });
});

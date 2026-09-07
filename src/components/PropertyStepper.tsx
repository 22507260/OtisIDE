import React, { useCallback, useEffect, useRef } from 'react';
import { getRepeatDelay } from '../lib/stepRepeat';

type PropertyStepperProps = {
  /** Move the value one rung. Called again, faster, while an arrow is held. */
  onStep: (direction: 1 | -1) => void;
  /** Whether there is anywhere left to go in each direction. */
  canStepUp: boolean;
  canStepDown: boolean;
  upTitle: string;
  downTitle: string;
};

const Caret: React.FC<{ up: boolean }> = ({ up }) => (
  <svg viewBox="0 0 10 6" width="9" height="5" aria-hidden="true" focusable="false">
    <path
      d={up ? 'M1 5 5 1 9 5' : 'M1 1 5 5 9 1'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * The two arrows on the right of a value.
 *
 * The wheel already changed these values, but nothing said so: a number field
 * looks exactly like a text field, and Chromium's own spinners only appear once
 * the pointer is already over them, which is no use to someone who does not
 * know there is anything to hover for. These are always there.
 *
 * Every step goes through the same `stepPropertyValue` the wheel uses, so the
 * E12 ladder, the ranges and the clamping are shared rather than reimplemented.
 */
export function PropertyStepper({
  onStep,
  canStepUp,
  canStepDown,
  upTitle,
  downTitle,
}: PropertyStepperProps) {
  const timerRef = useRef<number | null>(null);
  const repeatsRef = useRef(0);

  // Read through a ref, not the closure the timer was built with: the value
  // moves under us with every step, and a stale handler would step from the
  // same starting number for as long as the arrow was held.
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  const stop = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    repeatsRef.current = 0;
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(
    (direction: 1 | -1) => {
      stop();
      onStepRef.current(direction);

      const tick = () => {
        onStepRef.current(direction);
        repeatsRef.current += 1;
        timerRef.current = window.setTimeout(tick, getRepeatDelay(repeatsRef.current));
      };

      timerRef.current = window.setTimeout(tick, getRepeatDelay(0));
    },
    [stop]
  );

  // Let go anywhere and it stops. Watching the button alone left it repeating
  // whenever the pointer slid off it before the release.
  useEffect(() => {
    window.addEventListener('mouseup', stop);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('blur', stop);
    };
  }, [stop]);

  const press = (direction: 1 | -1) => (event: React.MouseEvent) => {
    if (event.button !== 0) return;
    // Keeps the focus where it was. Without this the field blurs, and the
    // resistance row throws away the number half-typed in it.
    event.preventDefault();
    start(direction);
  };

  return (
    <span className="property-stepper">
      <button
        type="button"
        className="property-stepper-btn"
        tabIndex={-1}
        title={upTitle}
        aria-label={upTitle}
        disabled={!canStepUp}
        onMouseDown={press(1)}
        onMouseUp={stop}
        onMouseLeave={stop}
      >
        <Caret up />
      </button>
      <button
        type="button"
        className="property-stepper-btn"
        tabIndex={-1}
        title={downTitle}
        aria-label={downTitle}
        disabled={!canStepDown}
        onMouseDown={press(-1)}
        onMouseUp={stop}
        onMouseLeave={stop}
      >
        <Caret up={false} />
      </button>
    </span>
  );
}

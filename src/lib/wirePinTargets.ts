import type { Pin } from '../models/types';

/** Nothing bigger than this, however much room a lone pair of legs has. */
export const WIRE_PIN_RADIUS = 6;
/**
 * How much of the gap to its nearest neighbour a pin's wiring target may take
 * up. An RGB LED's four legs sit under 8 units apart, so a fixed radius drew
 * (and caught clicks for) four badly overlapping circles — you could not pick
 * the leg you meant, which is why such parts were impossible to wire up.
 */
export const WIRE_PIN_SPACING_FRACTION = 0.42;
export const WIRE_PIN_MIN_RADIUS = 2.2;
/** Slack added around the drawn circle for easier clicking, when there is room. */
export const WIRE_PIN_HIT_PADDING = 9;

/** Distance to the closest other pin, i.e. how much room a target really has. */
export function getClosestPinSpacing(pins: Pin[]): number {
  let closest = Infinity;

  for (let i = 0; i < pins.length; i += 1) {
    for (let j = i + 1; j < pins.length; j += 1) {
      const distance = Math.hypot(pins[i].x - pins[j].x, pins[i].y - pins[j].y);
      if (distance > 0 && distance < closest) {
        closest = distance;
      }
    }
  }

  return closest;
}

/**
 * Wiring targets sized so neighbouring pins never share a spot: generous on a
 * two-legged part, tight on something like an RGB LED whose legs nearly touch.
 * The target stays centred on the pin tip either way — only its size moves.
 */
export function getWirePinTargetSize(pins: Pin[]): { radius: number; hitStrokeWidth: number } {
  const closest = getClosestPinSpacing(pins);

  if (!Number.isFinite(closest)) {
    return { radius: WIRE_PIN_RADIUS, hitStrokeWidth: WIRE_PIN_HIT_PADDING * 2 };
  }

  const radius = Math.max(
    WIRE_PIN_MIN_RADIUS,
    Math.min(WIRE_PIN_RADIUS, closest * WIRE_PIN_SPACING_FRACTION)
  );
  // Konva grows a shape's hit area by half its hit stroke, so keeping the total
  // inside half the gap means two pins can never claim the same click.
  const hitRadius = Math.max(radius, Math.min(radius + WIRE_PIN_HIT_PADDING, closest * 0.5));

  return { radius, hitStrokeWidth: Math.max(0, (hitRadius - radius) * 2) };
}

/** Total reach of a pin's click area, drawn circle plus its hit slack. */
export function getWirePinHitRadius(pins: Pin[]): number {
  const { radius, hitStrokeWidth } = getWirePinTargetSize(pins);
  return radius + hitStrokeWidth / 2;
}

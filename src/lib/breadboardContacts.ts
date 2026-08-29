/**
 * Which component legs are actually sitting in breadboard holes.
 *
 * Placing a part on the breadboard already lands its pins on holes — that is
 * what the canvas's snapping does — but until this existed nothing turned that
 * physical contact into an electrical one, so a resistor plugged neatly into
 * the board counted for nothing and the circuit checks called the LED beside
 * it unpowered. A real breadboard conducts through the hole; so does this.
 */

import {
  DEFAULT_BREADBOARD_POSITION,
  HOLE_SP,
  getNearestBreadboardHole,
} from '../models/breadboard';
import type { CircuitComponent } from '../models/types';
import { getComponentTransform, transformPoint } from './componentTransform';

/**
 * How close a leg must be to count as seated: half the hole pitch, which is
 * the hole's own share of the grid. Anything nearer belongs to this hole and
 * no other; a leg in the gutter between two rows, or off the board entirely,
 * reaches nothing.
 *
 * Deliberately not tighter than that. Parts are placed by snapping, which puts
 * one leg exactly on a hole and leaves the rest wherever the artwork's own leg
 * spacing lands them — a resistor's legs are 7.46 holes apart, so its far leg
 * sits about 5.3px from the nearest hole. Anything stricter would call a part
 * the app itself had just seated on the board unplugged.
 */
export const BREADBOARD_CONTACT_RADIUS = HOLE_SP / 2;
const CONTACT_RADIUS_SQ = BREADBOARD_CONTACT_RADIUS ** 2;

/**
 * Parts that reach the breadboard some other way. The multimeter's probes
 * carry their own target in the component's properties, and letting its body
 * pins conduct as well would wire the meter into the circuit it is measuring.
 */
const NON_SEATING_TYPES = new Set<CircuitComponent['type']>(['multimeter']);

export type BreadboardContact = {
  componentId: string;
  pinId: string;
  holeId: string;
};

/**
 * Every leg-in-hole contact in the circuit. Derived purely from geometry, so
 * it follows parts as they are dragged with nothing to keep in sync.
 */
export function getBreadboardContacts(
  components: CircuitComponent[],
  breadboardPosition: { x: number; y: number } = DEFAULT_BREADBOARD_POSITION
): BreadboardContact[] {
  const contacts: BreadboardContact[] = [];

  for (const component of components) {
    if (NON_SEATING_TYPES.has(component.type)) continue;

    const transform = getComponentTransform(component);
    // One hole holds one leg. Parts whose legs sit closer together than the
    // hole pitch could otherwise claim the same hole twice, shorting
    // themselves out through a hole that in reality only fits one of them.
    const claimed = new Map<string, { pinId: string; distSq: number }>();

    for (const pin of component.pins) {
      const moved = transformPoint(pin.x, pin.y, transform);
      const hole = getNearestBreadboardHole(
        component.x + moved.x,
        component.y + moved.y,
        breadboardPosition
      );

      if (hole.distSq > CONTACT_RADIUS_SQ) continue;

      const current = claimed.get(hole.id);
      if (!current || hole.distSq < current.distSq) {
        claimed.set(hole.id, { pinId: pin.id, distSq: hole.distSq });
      }
    }

    for (const [holeId, seated] of claimed) {
      contacts.push({ componentId: component.id, pinId: seated.pinId, holeId });
    }
  }

  return contacts;
}

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
  HOLE_SP,
  getBreadboardPlacements,
  getNearestHoleAcrossBreadboards,
  isBreadboardType,
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
  /** Which board the hole belongs to; hole ids repeat from board to board. */
  breadboardId: string;
  holeId: string;
  /**
   * Where the leg is and where its hole is, both in world coordinates.
   *
   * Rarely the same point. Seating a part translates it until *one* leg is
   * exactly on a hole and leaves the others wherever the artwork's leg spacing
   * puts them — a resistor's legs are 7.46 holes apart, so its far leg lands
   * about five pixels to the side of the hole it is connected to. The canvas
   * draws the lead across that gap, which is what a real part's bent leg does.
   */
  pinX: number;
  pinY: number;
  holeX: number;
  holeY: number;
};

/**
 * Every leg-in-hole contact in the circuit. Derived purely from geometry, so
 * it follows parts as they are dragged with nothing to keep in sync.
 */
export function getBreadboardContacts(components: CircuitComponent[]): BreadboardContact[] {
  const boards = getBreadboardPlacements(components);
  if (boards.length === 0) return [];

  const contacts: BreadboardContact[] = [];

  for (const component of components) {
    if (NON_SEATING_TYPES.has(component.type)) continue;
    // A board is not plugged into another board.
    if (isBreadboardType(component.type)) continue;

    const transform = getComponentTransform(component);
    // One hole holds one leg. Parts whose legs sit closer together than the
    // hole pitch could otherwise claim the same hole twice, shorting
    // themselves out through a hole that in reality only fits one of them.
    // Keyed by board as well as hole, since hole ids repeat across boards.
    const claimed = new Map<
      string,
      { pinId: string; distSq: number; pinX: number; pinY: number; holeX: number; holeY: number }
    >();

    for (const pin of component.pins) {
      const moved = transformPoint(pin.x, pin.y, transform);
      const pinX = component.x + moved.x;
      const pinY = component.y + moved.y;
      const nearest = getNearestHoleAcrossBreadboards(pinX, pinY, boards);

      if (!nearest || nearest.distSq > CONTACT_RADIUS_SQ) continue;

      const key = `${nearest.breadboardId}::${nearest.hole.id}`;
      const current = claimed.get(key);
      if (!current || nearest.distSq < current.distSq) {
        claimed.set(key, {
          pinId: pin.id,
          distSq: nearest.distSq,
          pinX,
          pinY,
          holeX: nearest.hole.x,
          holeY: nearest.hole.y,
        });
      }
    }

    for (const [key, seated] of claimed) {
      const separator = key.indexOf('::');
      contacts.push({
        componentId: component.id,
        pinId: seated.pinId,
        breadboardId: key.slice(0, separator),
        holeId: key.slice(separator + 2),
        pinX: seated.pinX,
        pinY: seated.pinY,
        holeX: seated.holeX,
        holeY: seated.holeY,
      });
    }
  }

  return contacts;
}

/**
 * Which legs of a part are actually joined to something.
 *
 * A part can look wired up and not be: a leg half a hole off the row, a cable
 * that was dropped a pixel short. Knowing which legs took hold is exactly the
 * thing that is invisible on a flat drawing, so the canvas marks each joined leg
 * of the selected part with a little solder blob.
 *
 * Two things count as joined, and only these two: a cable end lands on the leg,
 * or the leg is seated in a breadboard hole. Both are what the simulation
 * itself conducts through, so a leg with a blob is a leg the program has really
 * connected — the same question that had a resistor sitting neatly on the board
 * counting for nothing before breadboard contacts existed.
 */

import { ARDUINO_COMPONENT_ID } from '../models/arduinoUno';
import type { CircuitComponent, Wire } from '../models/types';
import { getBreadboardContacts } from './breadboardContacts';

export function pinKey(componentId: string, pinId: string): string {
  return `${componentId}::${pinId}`;
}

export function getSolderedPinKeys(
  components: CircuitComponent[],
  wires: Wire[]
): Set<string> {
  const soldered = new Set<string>();

  /**
   * The board and the breadboards are wired to constantly and would be lit up
   * end to end, which says nothing about the part in front of the user. Blobs
   * belong on the legs of parts.
   */
  const boardIds = new Set(
    components.filter((component) => component.type === 'breadboard').map((component) => component.id)
  );

  const add = (componentId: string, pinId: string) => {
    if (!componentId || !pinId) return;
    if (componentId === ARDUINO_COMPONENT_ID || boardIds.has(componentId)) return;
    soldered.add(pinKey(componentId, pinId));
  };

  for (const wire of wires) {
    add(wire.startComponentId, wire.startPinId);
    add(wire.endComponentId, wire.endPinId);
  }

  for (const contact of getBreadboardContacts(components)) {
    add(contact.componentId, contact.pinId);
  }

  return soldered;
}

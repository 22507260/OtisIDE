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

import { BREADBOARD_COMPONENT_ID, DEFAULT_BREADBOARD_POSITION } from '../models/breadboard';
import { ARDUINO_COMPONENT_ID } from '../models/arduinoUno';
import type { CircuitComponent, Wire } from '../models/types';
import { getBreadboardContacts } from './breadboardContacts';

export function pinKey(componentId: string, pinId: string): string {
  return `${componentId}::${pinId}`;
}

/**
 * The fixtures are wired to constantly and would be lit up end to end, which
 * says nothing about the part the user selected. Blobs belong on parts.
 */
const FIXTURE_IDS = new Set<string>([BREADBOARD_COMPONENT_ID, ARDUINO_COMPONENT_ID]);

export function getSolderedPinKeys(
  components: CircuitComponent[],
  wires: Wire[],
  breadboardPosition: { x: number; y: number } = DEFAULT_BREADBOARD_POSITION
): Set<string> {
  const soldered = new Set<string>();

  const add = (componentId: string, pinId: string) => {
    if (!componentId || !pinId || FIXTURE_IDS.has(componentId)) return;
    soldered.add(pinKey(componentId, pinId));
  };

  for (const wire of wires) {
    add(wire.startComponentId, wire.startPinId);
    add(wire.endComponentId, wire.endPinId);
  }

  for (const contact of getBreadboardContacts(components, breadboardPosition)) {
    add(contact.componentId, contact.pinId);
  }

  return soldered;
}

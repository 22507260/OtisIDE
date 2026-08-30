import { describe, expect, it } from 'vitest';
import { getSolderedPinKeys, pinKey } from '../solderedPins';
import { BB_X, BB_Y, BREADBOARD_COMPONENT_ID, HOLE_SP } from '../../models/breadboard';
import { ARDUINO_COMPONENT_ID } from '../../models/arduinoUno';
import type { CircuitComponent, Wire } from '../../models/types';

// The same hole positions breadboardContacts.test.ts works from: column N of
// row A sits at x = 80 + (N - 1) * HOLE_SP, y = 286.
const A1 = { x: 80, y: 286 };

const part = (overrides: Partial<CircuitComponent> = {}): CircuitComponent => ({
  id: 'resistor-1',
  type: 'resistor',
  x: A1.x,
  y: A1.y,
  rotation: 0,
  pins: [
    { id: 'pin1', name: '1', type: 'passive', x: 0, y: 0 },
    { id: 'pin2', name: '2', type: 'passive', x: 4 * HOLE_SP, y: 0 },
  ],
  properties: { resistance: 220 },
  ...overrides,
});

const wire = (overrides: Partial<Wire> = {}): Wire => ({
  id: 'wire-1',
  startComponentId: 'resistor-1',
  startPinId: 'pin1',
  endComponentId: ARDUINO_COMPONENT_ID,
  endPinId: 'd9',
  color: 'red',
  points: [0, 0, 10, 10],
  ...overrides,
});

/** Well clear of the board, so only wiring can connect it. */
const inTheAir = { x: -900, y: -900 };

/** The board itself, an ordinary component now. */
const board = (overrides: Partial<CircuitComponent> = {}): CircuitComponent => ({
  id: BREADBOARD_COMPONENT_ID,
  type: 'breadboard',
  x: BB_X,
  y: BB_Y,
  rotation: 0,
  pins: [],
  properties: {},
  ...overrides,
});

describe('getSolderedPinKeys', () => {
  it('marks a leg a cable reaches', () => {
    const keys = getSolderedPinKeys([board(), part(inTheAir)], [wire()]);
    expect(keys.has(pinKey('resistor-1', 'pin1'))).toBe(true);
    expect(keys.has(pinKey('resistor-1', 'pin2'))).toBe(false);
  });

  it('marks a leg seated in a breadboard hole', () => {
    const keys = getSolderedPinKeys([board(), part()], []);
    expect(keys.has(pinKey('resistor-1', 'pin1'))).toBe(true);
    expect(keys.has(pinKey('resistor-1', 'pin2'))).toBe(true);
  });

  it('marks nothing on a part that is neither wired nor plugged in', () => {
    expect(getSolderedPinKeys([board(), part(inTheAir)], []).size).toBe(0);
  });

  it('leaves the board and the breadboard themselves unmarked', () => {
    // Both ends of both cables land on a fixture, which is wired to constantly
    // and says nothing about the part the user selected.
    const keys = getSolderedPinKeys(
      [board(), part(inTheAir)],
      [
        wire(),
        wire({
          id: 'wire-2',
          startComponentId: BREADBOARD_COMPONENT_ID,
          startPinId: 'bb-a-1',
          endComponentId: ARDUINO_COMPONENT_ID,
          endPinId: 'gnd',
        }),
      ]
    );

    expect(keys.has(pinKey(ARDUINO_COMPONENT_ID, 'd9'))).toBe(false);
    expect(keys.has(pinKey(ARDUINO_COMPONENT_ID, 'gnd'))).toBe(false);
    expect(keys.has(pinKey(BREADBOARD_COMPONENT_ID, 'bb-a-1'))).toBe(false);
    expect([...keys]).toEqual([pinKey('resistor-1', 'pin1')]);
  });

  it('follows the breadboard when it is moved', () => {
    // The position is where the board sits, not how far it travelled, so the
    // part shifts by the difference from its default spot.
    const moved = { x: 160, y: 340 };
    const shifted = part({
      x: A1.x + (moved.x - BB_X),
      y: A1.y + (moved.y - BB_Y),
    });

    const movedBoard = board({ x: moved.x, y: moved.y });

    expect(getSolderedPinKeys([movedBoard, shifted], []).size).toBe(2);
    // …and the part left at its old spot no longer reaches the moved board.
    expect(getSolderedPinKeys([movedBoard, part()], []).size).toBe(0);
  });

  it('never marks a board, only the legs plugged into one', () => {
    const keys = getSolderedPinKeys(
      [board(), part()],
      [wire({ id: 'w-hole', startComponentId: BREADBOARD_COMPONENT_ID, startPinId: 'bb-a-1' })]
    );

    expect(keys.has(pinKey(BREADBOARD_COMPONENT_ID, 'bb-a-1'))).toBe(false);
    expect(keys.has(pinKey('resistor-1', 'pin1'))).toBe(true);
  });
});

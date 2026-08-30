import { describe, expect, it } from 'vitest';
import { getBreadboardContacts } from '../breadboardContacts';
import { BB_X, BB_Y, BREADBOARD_COMPONENT_ID, HOLE_SP } from '../../models/breadboard';
import type { CircuitComponent } from '../../models/types';

// Hole positions the default breadboard actually has, worked out from
// models/breadboard.ts: column N of row A sits at x = 80 + (N - 1) * HOLE_SP,
// y = 286, and row E of the same column is 4 rows below it.
const A1 = { x: 80, y: 286 };
const A5 = { x: 80 + 4 * HOLE_SP, y: 286 };
const E5 = { x: A5.x, y: 286 + 4 * HOLE_SP };

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

/** The board the parts are plugged into; it is a component like any other. */
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

/** What a contact on the default board looks like. */
const on = (pinId: string, holeId: string, componentId = 'resistor-1') => ({
  componentId,
  pinId,
  breadboardId: BREADBOARD_COMPONENT_ID,
  holeId,
});

describe('getBreadboardContacts', () => {
  it('seats legs that land on holes', () => {
    expect(getBreadboardContacts([board(), part()])).toEqual([
      on('pin1', 'bb-a-1', 'resistor-1'),
      on('pin2', 'bb-a-5', 'resistor-1'),
    ]);
  });

  it('leaves a part sunk into the gutter between two rows unseated', () => {
    // Rows E and F are two pitches apart; parked midway, neither leg is in
    // any hole's share of the grid.
    const contacts = getBreadboardContacts([board(), 
      part({ y: 286 + 4 * HOLE_SP + HOLE_SP }),
    ]);
    expect(contacts).toEqual([]);
  });

  it('seats a leg the artwork leaves short of its hole', () => {
    // A resistor's legs are 7.46 pitches apart, so snapping puts one exactly
    // on a hole and leaves the other ~5.3px shy of the next — still its hole.
    const awkward = part({
      pins: [
        { id: 'pin1', name: '1', type: 'passive', x: 0, y: 0 },
        { id: 'pin2', name: '2', type: 'passive', x: 7.46 * HOLE_SP, y: 0 },
      ],
    });

    expect(getBreadboardContacts([board(), awkward])).toEqual([
      on('pin1', 'bb-a-1', 'resistor-1'),
      on('pin2', 'bb-a-8', 'resistor-1'),
    ]);
  });

  it('finds nothing for a part sitting away from the board', () => {
    expect(getBreadboardContacts([board(), part({ x: 900, y: 900 })])).toEqual([]);
  });

  it('follows a part through a rotation', () => {
    // Turned a quarter turn, a leg 4 holes down the part reaches 4 holes to
    // the left of its origin instead.
    const turned = part({
      x: A5.x,
      y: A5.y,
      rotation: 90,
      pins: [
        { id: 'pin1', name: '1', type: 'passive', x: 0, y: 0 },
        { id: 'pin2', name: '2', type: 'passive', x: 0, y: 4 * HOLE_SP },
      ],
    });

    expect(getBreadboardContacts([board(), turned])).toEqual([
      on('pin1', 'bb-a-5', 'resistor-1'),
      on('pin2', 'bb-a-1', 'resistor-1'),
    ]);
  });

  it('reaches rows further down the same column', () => {
    const straddling = part({
      x: E5.x,
      y: A5.y,
      pins: [
        { id: 'pin1', name: '1', type: 'passive', x: 0, y: 0 },
        { id: 'pin2', name: '2', type: 'passive', x: 0, y: 4 * HOLE_SP },
      ],
    });

    expect(getBreadboardContacts([board(), straddling])).toEqual([
      on('pin1', 'bb-a-5', 'resistor-1'),
      on('pin2', 'bb-e-5', 'resistor-1'),
    ]);
  });

  it('gives one hole to one leg', () => {
    // Legs closer together than the hole pitch would otherwise both claim the
    // same hole and short the part out through it.
    const crowded = part({
      pins: [
        { id: 'pin1', name: '1', type: 'passive', x: 0, y: 0 },
        { id: 'pin2', name: '2', type: 'passive', x: 2, y: 0 },
      ],
    });

    expect(getBreadboardContacts([board(), crowded])).toEqual([
      on('pin1', 'bb-a-1', 'resistor-1'),
    ]);
  });

  it('never seats a multimeter, which reaches the board through its probes', () => {
    const meter = part({ id: 'meter-1', type: 'multimeter' });
    expect(getBreadboardContacts([board(), meter])).toEqual([]);
  });

  it('moves with the breadboard', () => {
    const moved = { x: 160, y: 340 };
    const movedBoard = board({ x: moved.x, y: moved.y });
    const shifted = part({
      x: A1.x + (moved.x - BB_X),
      y: A1.y + (moved.y - BB_Y),
    });

    expect(getBreadboardContacts([movedBoard, shifted])).toEqual([
      on('pin1', 'bb-a-1'),
      on('pin2', 'bb-a-5'),
    ]);
    // …and the same part at its old spot no longer reaches the moved board.
    expect(getBreadboardContacts([movedBoard, part()])).toEqual([]);
  });

  it('finds nothing at all when the canvas has no board', () => {
    expect(getBreadboardContacts([part()])).toEqual([]);
  });

  describe('with more than one board', () => {
    const secondBoard = board({ id: 'board-2', x: BB_X, y: BB_Y + 400 });

    /** The same part, seated on whichever board it is sitting over. */
    const partOnSecond = part({ y: A1.y + 400 });

    it('seats each part on the board it is over', () => {
      const contacts = getBreadboardContacts([board(), secondBoard, part(), partOnSecond]);

      expect(contacts).toContainEqual(on('pin1', 'bb-a-1'));
      expect(contacts).toContainEqual({
        componentId: 'resistor-1',
        pinId: 'pin1',
        breadboardId: 'board-2',
        holeId: 'bb-a-1',
      });
    });

    it('keeps the two boards' + String.fromCharCode(39) + ' identical hole ids apart', () => {
      const first = getBreadboardContacts([board(), part()]);
      const second = getBreadboardContacts([secondBoard, partOnSecond]);

      // Same hole id, different board — which is exactly why the contact
      // carries the board it belongs to.
      expect(first[0].holeId).toBe(second[0].holeId);
      expect(first[0].breadboardId).not.toBe(second[0].breadboardId);
    });

    it('never treats a board as a part plugged into another board', () => {
      const contacts = getBreadboardContacts([board(), board({ id: 'board-2' })]);
      expect(contacts).toEqual([]);
    });
  });
});

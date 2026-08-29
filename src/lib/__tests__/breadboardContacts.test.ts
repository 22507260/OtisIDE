import { describe, expect, it } from 'vitest';
import { getBreadboardContacts } from '../breadboardContacts';
import { HOLE_SP } from '../../models/breadboard';
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

describe('getBreadboardContacts', () => {
  it('seats legs that land on holes', () => {
    expect(getBreadboardContacts([part()])).toEqual([
      { componentId: 'resistor-1', pinId: 'pin1', holeId: 'bb-a-1' },
      { componentId: 'resistor-1', pinId: 'pin2', holeId: 'bb-a-5' },
    ]);
  });

  it('leaves a part sunk into the gutter between two rows unseated', () => {
    // Rows E and F are two pitches apart; parked midway, neither leg is in
    // any hole's share of the grid.
    const contacts = getBreadboardContacts([
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

    expect(getBreadboardContacts([awkward])).toEqual([
      { componentId: 'resistor-1', pinId: 'pin1', holeId: 'bb-a-1' },
      { componentId: 'resistor-1', pinId: 'pin2', holeId: 'bb-a-8' },
    ]);
  });

  it('finds nothing for a part sitting away from the board', () => {
    expect(getBreadboardContacts([part({ x: 900, y: 900 })])).toEqual([]);
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

    expect(getBreadboardContacts([turned])).toEqual([
      { componentId: 'resistor-1', pinId: 'pin1', holeId: 'bb-a-5' },
      { componentId: 'resistor-1', pinId: 'pin2', holeId: 'bb-a-1' },
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

    expect(getBreadboardContacts([straddling])).toEqual([
      { componentId: 'resistor-1', pinId: 'pin1', holeId: 'bb-a-5' },
      { componentId: 'resistor-1', pinId: 'pin2', holeId: 'bb-e-5' },
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

    expect(getBreadboardContacts([crowded])).toEqual([
      { componentId: 'resistor-1', pinId: 'pin1', holeId: 'bb-a-1' },
    ]);
  });

  it('never seats a multimeter, which reaches the board through its probes', () => {
    const meter = part({ id: 'meter-1', type: 'multimeter' });
    expect(getBreadboardContacts([meter])).toEqual([]);
  });

  it('moves with the breadboard', () => {
    const moved = { x: 160, y: 340 };
    const shifted = part({
      x: A1.x + (moved.x - 60),
      y: A1.y + (moved.y - 240),
    });

    expect(getBreadboardContacts([shifted], moved)).toEqual([
      { componentId: 'resistor-1', pinId: 'pin1', holeId: 'bb-a-1' },
      { componentId: 'resistor-1', pinId: 'pin2', holeId: 'bb-a-5' },
    ]);
    // …and the same part at its old spot no longer reaches the moved board.
    expect(getBreadboardContacts([part()], moved)).toEqual([]);
  });
});

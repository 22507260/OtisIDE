import { describe, expect, it } from 'vitest';
import { getBreadboardContacts } from '../breadboardContacts';
import {
  BB_X,
  BB_Y,
  BREADBOARD_COMPONENT_ID,
  HOLE_SP,
  getBreadboardHoleOn,
  getBreadboardSpec,
} from '../../models/breadboard';
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

/**
 * What a contact on the default board looks like.
 *
 * Matched on identity alone — which leg, which hole. A contact also carries
 * where the leg and the hole each are, so the canvas can draw the lead between
 * them, and pinning those coordinates here would only make these tests about
 * artwork measurements.
 */
const on = (pinId: string, holeId: string, componentId = 'resistor-1') =>
  expect.objectContaining({
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

  it('says where the leg is and where its hole is, so the lead can be drawn', () => {
    // The same 7.46-pitch resistor: one leg lands dead on its hole, the other
    // is left short by the artwork's own leg spacing. Both are connected; only
    // one of them looks it, which is what the drawn lead is for.
    const awkward = part({
      pins: [
        { id: 'pin1', name: '1', type: 'passive', x: 0, y: 0 },
        { id: 'pin2', name: '2', type: 'passive', x: 7.46 * HOLE_SP, y: 0 },
      ],
    });

    const [near, far] = getBreadboardContacts([board(), awkward]);

    expect(near.pinX).toBeCloseTo(near.holeX, 6);
    expect(near.pinY).toBeCloseTo(near.holeY, 6);

    // Its hole is the eighth column; the leg stops short of it.
    expect(far.holeX).toBeCloseTo(A1.x + 7 * HOLE_SP, 6);
    expect(far.pinX).toBeCloseTo(A1.x + 7.46 * HOLE_SP, 6);
    expect(Math.hypot(far.pinX - far.holeX, far.pinY - far.holeY)).toBeGreaterThan(1);
  });

  it('puts every hole it names where it says it is', () => {
    for (const contact of getBreadboardContacts([board(), part()])) {
      const hole = getBreadboardHoleOn(
        { id: BREADBOARD_COMPONENT_ID, x: BB_X, y: BB_Y, variant: 'full' },
        contact.holeId
      );
      expect(contact.holeX).toBeCloseTo(hole!.x, 6);
      expect(contact.holeY).toBeCloseTo(hole!.y, 6);
    }
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

      expect(contacts).toEqual(expect.arrayContaining([on('pin1', 'bb-a-1')]));
      expect(contacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            componentId: 'resistor-1',
            pinId: 'pin1',
            breadboardId: 'board-2',
            holeId: 'bb-a-1',
          }),
        ])
      );
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

describe('the mini board', () => {
  const miniBoard = (overrides: Partial<CircuitComponent> = {}): CircuitComponent => ({
    ...board(),
    id: 'mini-1',
    type: 'breadboard-mini',
    ...overrides,
  });

  it('has seventeen columns of A-J, with rails like the full board', () => {
    const spec = getBreadboardSpec('mini');

    expect(spec.cols).toBe(17);
    expect(spec.hasRails).toBe(true);
    // Ten main rows plus four rail rows, seventeen columns.
    expect(spec.holes).toHaveLength(14 * 17);
    expect(spec.holes.filter((hole) => hole.rowLabel === 'A')).toHaveLength(17);
    expect(spec.holes.filter((hole) => hole.rowLabel === 'T+')).toHaveLength(17);
    expect(spec.holes.filter((hole) => hole.rowLabel === 'B-')).toHaveLength(17);
  });

  it('runs each rail as one strip across the whole board', () => {
    const spec = getBreadboardSpec('mini');

    for (const stripId of ['rail-top-pos', 'rail-top-neg', 'rail-bottom-pos', 'rail-bottom-neg']) {
      const rail = spec.stripGroups.find((group) => group[0].stripId === stripId);
      expect(rail).toHaveLength(17);
    }
  });

  it('keeps a column on one strip, five holes at a time', () => {
    const spec = getBreadboardSpec('mini');
    const upper = spec.stripGroups.find((group) => group[0].stripId === 'upper-strip-1');
    const lower = spec.stripGroups.find((group) => group[0].stripId === 'lower-strip-1');

    expect(upper).toHaveLength(5);
    expect(lower).toHaveLength(5);
    // A and F share a column but not a strip — the channel runs between them.
    expect(upper?.map((hole) => hole.rowLabel)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(lower?.map((hole) => hole.rowLabel)).toEqual(['F', 'G', 'H', 'I', 'J']);
  });

  it('seats parts on its own holes', () => {
    // Both sizes measure their rows from the board's own corner, so row A lands
    // in the same place on either; only how far the columns run apart differs.
    const spec = getBreadboardSpec('mini');
    const a1 = spec.holes.find((hole) => hole.id === 'bb-a-1');
    expect(a1).toBeDefined();

    const seated = part({ x: a1!.x, y: a1!.y });
    const contacts = getBreadboardContacts([miniBoard(), seated]);

    expect(contacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          componentId: 'resistor-1',
          pinId: 'pin1',
          breadboardId: 'mini-1',
          holeId: 'bb-a-1',
        }),
      ])
    );
  });

  it('has no column 18, however far a leg reaches', () => {
    const spec = getBreadboardSpec('mini');
    expect(spec.holes.some((hole) => hole.id === 'bb-a-18')).toBe(false);
    expect(getBreadboardSpec('full').holes.some((hole) => hole.id === 'bb-a-18')).toBe(true);
  });

  it('looks a hole up on the board it was asked about', () => {
    const mini = { id: 'mini-1', x: 500, y: 40, variant: 'mini' as const };
    const full = { id: 'full-1', x: 900, y: 300, variant: 'full' as const };

    const onMini = getBreadboardHoleOn(mini, 'bb-a-1');
    const onFull = getBreadboardHoleOn(full, 'bb-a-1');

    expect(onMini).not.toBeNull();
    expect(onFull).not.toBeNull();
    // Same hole id, two boards: the answer follows the board it belongs to,
    // which is what makes a wire move when its board moves.
    expect(onMini!.x).not.toBe(onFull!.x);
    expect(Math.round(onMini!.x - mini.x)).toBe(Math.round(onFull!.x - full.x));
  });

  it('will not hand back a hole the board does not have', () => {
    const mini = { id: 'mini-1', x: 500, y: 40, variant: 'mini' as const };
    const full = { id: 'full-1', x: 900, y: 300, variant: 'full' as const };

    // Column 40 exists on a full-size board and nowhere on a mini; asking
    // without saying which board used to answer with the full board's geometry.
    expect(getBreadboardHoleOn(full, 'bb-a-40')).not.toBeNull();
    expect(getBreadboardHoleOn(mini, 'bb-a-40')).toBeNull();
  });

  it('is narrower than the full board, and just as tall', () => {
    const mini = getBreadboardSpec('mini');
    const full = getBreadboardSpec('full');

    expect(mini.width).toBeLessThan(full.width);
    // Same rows, same rails, same height — the mini is a short board, not a
    // squat one.
    expect(mini.height).toBe(full.height);
  });
});

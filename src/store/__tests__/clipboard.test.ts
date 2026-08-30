import { beforeEach, describe, expect, it } from 'vitest';
import { useCircuitStore } from '../circuitStore';
import type { CircuitComponent, Wire } from '../../models/types';

const part = (id: string, x: number, y: number): CircuitComponent => ({
  id,
  type: 'resistor',
  x,
  y,
  rotation: 0,
  pins: [
    { id: 'pin1', name: 'Pin 1', type: 'passive', x: -25, y: 0 },
    { id: 'pin2', name: 'Pin 2', type: 'passive', x: 25, y: 0 },
  ],
  properties: { resistance: 220, unit: 'ohm' },
});

const link = (from: string, to: string): Wire => ({
  id: `${from}-${to}`,
  startComponentId: from,
  startPinId: 'pin2',
  endComponentId: to,
  endPinId: 'pin1',
  color: '#e74c3c',
  points: [100, 100, 300, 100],
});

/** Where the pasted copies ended up, oldest part first. */
const pastedPositions = (before: number) =>
  useCircuitStore
    .getState()
    .components.slice(before)
    .map((component) => ({ x: component.x, y: component.y }));

describe('pasting', () => {
  beforeEach(() => {
    useCircuitStore.setState({
      components: [part('a', 100, 100), part('b', 300, 100)],
      wires: [link('a', 'b')],
      selectedComponentIds: ['a', 'b'],
      selectedComponentId: 'b',
    });
    useCircuitStore.getState().copySelection();
  });

  it('centres the copy on the point it is given', () => {
    // The pair spans x 100..300, so its centre is (200, 100).
    useCircuitStore.getState().pasteClipboard({ x: 500, y: 400 });

    expect(pastedPositions(2)).toEqual([
      { x: 400, y: 400 },
      { x: 600, y: 400 },
    ]);
  });

  it('carries the wires between the copies by the same vector', () => {
    useCircuitStore.getState().pasteClipboard({ x: 500, y: 400 });

    const pasted = useCircuitStore.getState().wires.slice(1);
    expect(pasted).toHaveLength(1);
    // The original ran (100,100) -> (300,100); the copy is shifted by (300,300).
    expect(pasted[0].points).toEqual([400, 400, 600, 400]);
  });

  it('keeps the copy the shape it was copied in', () => {
    useCircuitStore.getState().pasteClipboard({ x: 0, y: 0 });

    const [first, second] = pastedPositions(2);
    expect(second.x - first.x).toBe(200);
    expect(second.y - first.y).toBe(0);
  });

  it('steps away from the original when no point is given', () => {
    useCircuitStore.getState().pasteClipboard();
    const [first] = pastedPositions(2);

    expect(first.x).toBeGreaterThan(100);
    expect(first.y).toBeGreaterThan(100);
    expect(first.x - 100).toBe(first.y - 100);
  });

  it('does not let the staircase drift once a point has been used', () => {
    // Pasting at the pointer already puts each copy somewhere of its own, so
    // the next plain paste starts from the first step again rather than
    // carrying on from wherever the count had got to.
    useCircuitStore.getState().pasteClipboard();
    const firstStep = pastedPositions(2)[0].x - 100;

    useCircuitStore.setState({ components: [part('a', 100, 100), part('b', 300, 100)] });
    useCircuitStore.getState().pasteClipboard({ x: 500, y: 400 });
    useCircuitStore.getState().pasteClipboard();

    const afterPointerPaste = pastedPositions(4)[0].x - 100;
    expect(afterPointerPaste).toBe(firstStep);
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useCircuitStore } from '../circuitStore';
import type { CircuitComponent, Wire } from '../../models/types';

const part = (id: string, x = 100, y = 100): CircuitComponent => ({
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

const link = (): Wire => ({
  id: 'w1',
  startComponentId: 'a',
  startPinId: 'pin2',
  endComponentId: 'b',
  endPinId: 'pin1',
  color: '#e74c3c',
  points: [0, 0, 10, 10],
});

/** Puts the store in the state a running simulation leaves it in. */
const setRunning = (running: boolean) =>
  useCircuitStore.setState((s) => ({ simulation: { ...s.simulation, running } }));

beforeEach(() => {
  useCircuitStore.setState({
    components: [part('a'), part('b', 300)],
    wires: [],
    selectedComponentId: 'a',
    selectedComponentIds: ['a'],
  });
});

afterEach(() => {
  setRunning(false);
});

describe('the circuit is locked while it runs', () => {
  it('refuses the edits that would rebuild the circuit', () => {
    setRunning(true);
    const store = useCircuitStore.getState();

    store.addComponent('led', 400, 400);
    store.removeComponent('a');
    store.updateComponent('a', { x: 999 });
    store.addWire(link());
    store.duplicateComponent('a');

    const state = useCircuitStore.getState();
    expect(state.components.map((component) => component.id)).toEqual(['a', 'b']);
    expect(state.components[0].x).toBe(100);
    expect(state.wires).toEqual([]);
  });

  it('refuses to paste, and says nothing was pasted', () => {
    useCircuitStore.getState().copySelection();
    setRunning(true);

    expect(useCircuitStore.getState().pasteClipboard({ x: 500, y: 500 })).toBe(0);
    expect(useCircuitStore.getState().components).toHaveLength(2);
  });

  it('refuses to undo, so the running circuit cannot be pulled out from under it', () => {
    useCircuitStore.getState().updateComponent('a', { x: 250 });
    setRunning(true);

    useCircuitStore.getState().undo();
    expect(useCircuitStore.getState().components[0].x).toBe(250);
  });

  it('still lets values through, because those are the inputs', () => {
    setRunning(true);

    useCircuitStore.getState().updateComponentProperty('a', 'resistance', 10000);
    expect(useCircuitStore.getState().components[0].properties.resistance).toBe(10000);

    // A multimeter probe being moved goes the same way.
    useCircuitStore.getState().updateComponentProperties('a', { redProbeX: 12, redProbeY: 34 });
    expect(useCircuitStore.getState().components[0].properties.redProbeX).toBe(12);
  });

  it('lets everything through again once it has stopped', () => {
    setRunning(true);
    useCircuitStore.getState().updateComponent('a', { x: 999 });
    expect(useCircuitStore.getState().components[0].x).toBe(100);

    setRunning(false);
    useCircuitStore.getState().updateComponent('a', { x: 999 });
    expect(useCircuitStore.getState().components[0].x).toBe(999);
  });
});

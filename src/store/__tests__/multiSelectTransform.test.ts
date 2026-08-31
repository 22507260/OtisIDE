import { beforeEach, describe, expect, it } from 'vitest';
import { useCircuitStore } from '../circuitStore';
import type { CircuitComponent } from '../../models/types';

const part = (
  id: string,
  x: number,
  y: number,
  overrides: Partial<CircuitComponent> = {}
): CircuitComponent => ({
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
  ...overrides,
});

const byId = (id: string) =>
  useCircuitStore.getState().components.find((component) => component.id === id)!;

const layout = () =>
  useCircuitStore.getState().components.map((component) => ({
    id: component.id,
    x: component.x,
    y: component.y,
    rotation: component.rotation,
    scale: component.scale,
    flipX: component.flipX,
  }));

describe('transforming a multi-selection', () => {
  beforeEach(() => {
    useCircuitStore.setState({
      components: [
        part('a', 100, 100),
        part('b', 300, 140, { rotation: 90, scale: 2 }),
        part('c', 500, 200),
      ],
      wires: [],
      selectedComponentIds: ['a', 'b'],
      selectedComponentId: 'b',
      simulation: { ...useCircuitStore.getState().simulation, running: false },
    });
  });

  it('moves the whole selection by the same amount', () => {
    // 'b' goes from x 300 to x 360, so everything selected shifts sixty right.
    useCircuitStore.getState().updateComponentTransform('b', { x: 360 });

    expect(byId('a')).toMatchObject({ x: 160, y: 100 });
    expect(byId('b')).toMatchObject({ x: 360, y: 140 });
    // Not selected, so it stays put.
    expect(byId('c')).toMatchObject({ x: 500, y: 200 });
  });

  it('keeps the arrangement when both axes move', () => {
    useCircuitStore.getState().updateComponentTransform('b', { x: 340, y: 190 });

    expect(byId('a')).toMatchObject({ x: 140, y: 150 });
    expect(byId('b')).toMatchObject({ x: 340, y: 190 });
  });

  it('gives every selected part the same angle', () => {
    useCircuitStore.getState().updateComponentTransform('b', { rotation: 45 });

    expect(byId('a').rotation).toBe(45);
    expect(byId('b').rotation).toBe(45);
    expect(byId('c').rotation).toBe(0);
  });

  it('gives every selected part the same size', () => {
    useCircuitStore.getState().updateComponentTransform('b', { scale: 1.5 });

    expect(byId('a').scale).toBe(1.5);
    expect(byId('b').scale).toBe(1.5);
    expect(byId('c').scale).toBeUndefined();
  });

  it('mirrors every selected part together', () => {
    useCircuitStore.getState().updateComponentTransform('b', { flipX: true });

    expect(byId('a').flipX).toBe(true);
    expect(byId('b').flipX).toBe(true);
    expect(byId('c').flipX).toBeUndefined();
  });

  it('leaves the angle alone when only the position is being set', () => {
    useCircuitStore.getState().updateComponentTransform('b', { x: 360 });

    // 'b' was turned and 'a' was not; a move must not quietly level them.
    expect(byId('a').rotation).toBe(0);
    expect(byId('b').rotation).toBe(90);
  });

  it('touches one part only when it is the only one selected', () => {
    useCircuitStore.setState({ selectedComponentIds: ['b'], selectedComponentId: 'b' });
    useCircuitStore.getState().updateComponentTransform('b', { x: 360, rotation: 10 });

    expect(byId('a')).toMatchObject({ x: 100, rotation: 0 });
    expect(byId('b')).toMatchObject({ x: 360, rotation: 10 });
  });

  it('touches one part only when it is not in the selection', () => {
    useCircuitStore.getState().updateComponentTransform('c', { rotation: 20 });

    expect(byId('a').rotation).toBe(0);
    expect(byId('b').rotation).toBe(90);
    expect(byId('c').rotation).toBe(20);
  });

  it('takes one undo step for the whole block', () => {
    const before = layout();
    useCircuitStore.getState().updateComponentTransform('b', { x: 360 });
    useCircuitStore.getState().undo();

    expect(layout()).toEqual(before);
  });

  it('changes nothing while the simulation is running', () => {
    const before = layout();
    useCircuitStore.setState({
      simulation: { ...useCircuitStore.getState().simulation, running: true },
    });

    useCircuitStore.getState().updateComponentTransform('b', { x: 360, rotation: 45 });

    expect(layout()).toEqual(before);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { useCircuitStore } from '../circuitStore';
import { BREADBOARD_COMPONENT_ID } from '../../models/breadboard';
import type { CircuitComponent } from '../../models/types';

const board = (id: string, x: number, y: number): CircuitComponent => ({
  id,
  type: 'breadboard',
  x,
  y,
  rotation: 0,
  pins: [],
  properties: {},
});

const led = (): CircuitComponent => ({
  id: 'led-1',
  type: 'led',
  x: 200,
  y: 200,
  rotation: 0,
  pins: [
    { id: 'anode', name: 'Anode (+)', type: 'passive', x: 5, y: 0 },
    { id: 'cathode', name: 'Cathode (-)', type: 'passive', x: -5, y: 0 },
  ],
  properties: { color: 'red', forwardVoltage: 2 },
});

describe('saving and opening a project', () => {
  beforeEach(() => {
    useCircuitStore.setState({ components: [], wires: [] });
  });

  it('round trips every board', () => {
    useCircuitStore.setState({
      components: [board('board-a', 60, 240), board('board-b', 60, 640), led()],
      wires: [],
    });

    const saved = JSON.parse(JSON.stringify(useCircuitStore.getState().getProjectData()));
    useCircuitStore.setState({ components: [], wires: [] });

    expect(useCircuitStore.getState().loadProject(saved)).toBe(true);

    const restored = useCircuitStore.getState().components;
    expect(restored.filter((component) => component.type === 'breadboard')).toHaveLength(2);
    expect(restored.map((component) => component.id)).toEqual(['board-a', 'board-b', 'led-1']);
  });

  it('brings a project saved before boards were components forward', () => {
    // 1.12.0 and earlier kept one board outside the parts list, and addressed
    // its holes through a fixed id. Both have to keep working.
    const legacy = {
      components: [led()],
      wires: [
        {
          id: 'w1',
          startComponentId: 'arduino-uno-fixed',
          startPinId: 'D9',
          endComponentId: BREADBOARD_COMPONENT_ID,
          endPinId: 'bb-a-1',
          color: '#e74c3c',
          points: [0, 0, 10, 10],
        },
      ],
      code: 'void setup() {}\nvoid loop() {}\n',
      boardType: 'arduino-uno',
      boardPosition: { x: 60, y: 10 },
      breadboardPosition: { x: 140, y: 300 },
    };

    expect(useCircuitStore.getState().loadProject(legacy)).toBe(true);

    const restored = useCircuitStore.getState().components;
    const migrated = restored.find((component) => component.type === 'breadboard');

    expect(migrated).toBeDefined();
    expect(migrated).toMatchObject({ id: BREADBOARD_COMPONENT_ID, x: 140, y: 300 });
    // The board comes first, so it is drawn under the parts sitting on it.
    expect(restored[0].type).toBe('breadboard');
    // …and the wire that named the old fixture still points at it.
    expect(useCircuitStore.getState().wires[0].endComponentId).toBe(BREADBOARD_COMPONENT_ID);
  });

  it('leaves a board-less project board-less', () => {
    // Saved after the user deleted the board: nothing must put it back.
    const project = {
      components: [led()],
      wires: [],
      code: 'void setup() {}\nvoid loop() {}\n',
      boardType: 'arduino-uno',
      boardPosition: { x: 60, y: 10 },
    };

    expect(useCircuitStore.getState().loadProject(project)).toBe(true);
    expect(
      useCircuitStore.getState().components.filter((component) => component.type === 'breadboard')
    ).toHaveLength(0);
  });
});

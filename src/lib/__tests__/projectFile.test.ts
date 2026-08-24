import { describe, expect, it } from 'vitest';
import { sanitizeProjectData } from '../projectFile';
import { ARDUINO_COMPONENT_ID } from '../../models/arduinoUno';

const FALLBACK_CODE = '// fallback';

const validProject = () => ({
  components: [
    {
      id: 'led-1',
      type: 'led',
      x: 120,
      y: 240,
      rotation: 90,
      pins: [
        { id: 'anode', name: 'Anode (+)', type: 'passive', x: 5, y: 0 },
        { id: 'cathode', name: 'Cathode (-)', type: 'passive', x: -5, y: 0 },
      ],
      properties: { color: 'red', forwardVoltage: 2 },
    },
  ],
  wires: [
    {
      id: 'wire-1',
      startComponentId: ARDUINO_COMPONENT_ID,
      startPinId: 'D13',
      endComponentId: 'led-1',
      endPinId: 'anode',
      color: '#e74c3c',
      points: [0, 0, 10, 10],
    },
  ],
  code: 'void setup() {}',
  boardType: 'mega',
  boardPosition: { x: 12, y: 34 },
  breadboardPosition: { x: 56, y: 78 },
});

describe('sanitizeProjectData', () => {
  it('accepts a well formed project unchanged', () => {
    const project = sanitizeProjectData(validProject(), FALLBACK_CODE);

    expect(project).not.toBeNull();
    expect(project!.components).toHaveLength(1);
    expect(project!.wires).toHaveLength(1);
    expect(project!.code).toBe('void setup() {}');
    expect(project!.boardType).toBe('mega');
    expect(project!.boardPosition).toEqual({ x: 12, y: 34 });
  });

  it('rejects anything that is not a project', () => {
    expect(sanitizeProjectData(null, FALLBACK_CODE)).toBeNull();
    expect(sanitizeProjectData('merhaba', FALLBACK_CODE)).toBeNull();
    expect(sanitizeProjectData(42, FALLBACK_CODE)).toBeNull();
    expect(sanitizeProjectData({ hello: 'world' }, FALLBACK_CODE)).toBeNull();
  });

  it('drops components whose type is not in the catalog', () => {
    const data = validProject();
    data.components.push({ ...data.components[0], id: 'x', type: 'quantum-flux' } as never);

    const project = sanitizeProjectData(data, FALLBACK_CODE);
    expect(project!.components.map((c) => c.type)).toEqual(['led']);
  });

  it('drops wires that point at a component which is not there', () => {
    const data = validProject();
    data.wires.push({
      ...data.wires[0],
      id: 'wire-2',
      endComponentId: 'missing-component',
    });

    const project = sanitizeProjectData(data, FALLBACK_CODE);
    expect(project!.wires.map((w) => w.id)).toEqual(['wire-1']);
  });

  it('keeps wires anchored to the board or the breadboard', () => {
    const project = sanitizeProjectData(validProject(), FALLBACK_CODE);
    expect(project!.wires[0].startComponentId).toBe(ARDUINO_COMPONENT_ID);
  });

  it('falls back when fields are missing or the wrong type', () => {
    const project = sanitizeProjectData(
      { components: [], wires: [], code: 42, boardType: 'not-a-board' },
      FALLBACK_CODE
    );

    expect(project!.code).toBe(FALLBACK_CODE);
    expect(project!.boardType).toBe('uno');
    expect(project!.boardPosition).toEqual({ x: 60, y: 10 });
  });

  it('repairs a component with unusable pins and coordinates', () => {
    const project = sanitizeProjectData(
      {
        components: [{ type: 'led', x: 'abc', y: null, pins: 'nope', properties: 5 }],
        wires: [],
      },
      FALLBACK_CODE
    );

    const led = project!.components[0];
    expect(led.x).toBe(0);
    expect(led.y).toBe(0);
    expect(led.id).toMatch(/[0-9a-f-]{36}/);
    expect(led.pins.map((pin) => pin.id).sort()).toEqual(['anode', 'cathode']);
    expect(led.properties).toEqual({});
  });

  it('gives duplicated component ids a fresh one', () => {
    const data = validProject();
    data.components.push({ ...data.components[0] });

    const project = sanitizeProjectData(data, FALLBACK_CODE);
    const [first, second] = project!.components;
    expect(first.id).not.toBe(second.id);
  });

  it('reads the size and the mirror back', () => {
    const project = sanitizeProjectData(
      {
        components: [{ type: 'led', x: 10, y: 20, scale: 1.5, flipX: true }],
        wires: [],
      },
      FALLBACK_CODE
    );

    expect(project!.components[0].scale).toBe(1.5);
    expect(project!.components[0].flipX).toBe(true);
  });

  it('keeps the size within what can be drawn', () => {
    const project = sanitizeProjectData(
      {
        components: [
          { type: 'led', x: 0, y: 0, scale: 40 },
          { type: 'resistor', x: 0, y: 0, scale: 'huge' },
        ],
        wires: [],
      },
      FALLBACK_CODE
    );

    expect(project!.components[0].scale).toBe(3);
    expect(project!.components[1].scale).toBe(1);
  });

  it('defaults a project saved before size and mirror existed', () => {
    const project = sanitizeProjectData(
      { components: [{ type: 'led', x: 10, y: 20, rotation: 90 }], wires: [] },
      FALLBACK_CODE
    );

    const led = project!.components[0];
    expect(led.rotation).toBe(90);
    expect(led.scale).toBe(1);
    expect(led.flipX).toBe(false);
  });
});

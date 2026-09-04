import { afterEach, describe, expect, it } from 'vitest';
import { startMockArduinoRuntime, stopMockArduinoRuntime } from '../mockArduinoRuntime';
import {
  getDefaultPins,
  getDefaultProperties,
  type CircuitComponent,
  type ComponentType,
  type Pin,
  type Wire,
} from '../../models/types';

const BOARD_PINS: Pin[] = [
  { id: 'D13', name: 'D13', type: 'digital', x: 0, y: 0 },
  { id: 'GND', name: 'GND', type: 'ground', x: 0, y: 20 },
  { id: '5V', name: '5V', type: 'power', x: 0, y: 30 },
];

const part = (
  id: string,
  type: ComponentType,
  properties: Record<string, string | number | boolean> = {}
): CircuitComponent => ({
  id,
  type,
  x: 200,
  y: 200,
  rotation: 0,
  pins: getDefaultPins(type),
  properties: { ...getDefaultProperties(type), ...properties },
});

const wire = (
  id: string,
  startComponentId: string,
  startPinId: string,
  endComponentId: string,
  endPinId: string
): Wire => ({
  id,
  startComponentId,
  startPinId,
  endComponentId,
  endPinId,
  color: '#e74c3c',
  points: [0, 0, 0, 0],
});

/** The same cable, drawn the other way round. */
const reversed = (w: Wire): Wire => ({
  ...w,
  startComponentId: w.endComponentId,
  startPinId: w.endPinId,
  endComponentId: w.startComponentId,
  endPinId: w.startPinId,
});

const SKETCH = `
  void setup() { }
  void loop() { }
`;

function flowOf(components: CircuitComponent[], wires: Wire[]) {
  return new Promise<Record<string, number>>((resolve) => {
    let latest: Record<string, number> = {};

    startMockArduinoRuntime(SKETCH, components, wires, BOARD_PINS, 5, {
      addSerialOutput: () => {},
      pushOscilloscopeSample: () => {},
      setLedState: () => {},
      clearLedStates: () => {},
      setComponentState: () => {},
      clearComponentStates: () => {},
      setPinStates: () => {},
      setWireFlow: (next) => {
        latest = { ...next };
      },
    });

    setTimeout(() => {
      stopMockArduinoRuntime();
      resolve(latest);
    }, 120);
  });
}

afterEach(() => {
  stopMockArduinoRuntime();
});

describe('wire flow', () => {
  const battery = () => part('bat-1', 'aa-battery', { chargePercent: 100 });
  const resistor = (ohms = 220) => part('res-1', 'resistor', { resistance: ohms });

  it('runs current the way the cable was drawn, and reverses when the cable does', async () => {
    const outward = wire('w1', 'bat-1', 'positive', 'res-1', 'pin1');
    const back = wire('w2', 'res-1', 'pin2', 'bat-1', 'negative');

    const forward = await flowOf([battery(), resistor()], [outward, back]);
    expect(forward.w1).toBeGreaterThan(0);
    expect(forward.w2).toBeGreaterThan(0);

    // Drawn the other way round, the same current has the opposite sign — the
    // arrow has to keep pointing at the same end of the circuit.
    const flipped = await flowOf([battery(), resistor()], [reversed(outward), back]);
    expect(flipped.w1).toBeLessThan(0);
    expect(flipped.w1).toBeCloseTo(-forward.w1, 6);
  });

  it('gives every cable in a series loop the same current', async () => {
    const flow = await flowOf(
      [battery(), resistor()],
      [wire('w1', 'bat-1', 'positive', 'res-1', 'pin1'), wire('w2', 'res-1', 'pin2', 'bat-1', 'negative')]
    );

    expect(Math.abs(flow.w1)).toBeGreaterThan(1e-4);
    expect(Math.abs(flow.w1)).toBeCloseTo(Math.abs(flow.w2), 9);
  });

  it('splits between parallel branches and the parts add back up to the supply', async () => {
    const flow = await flowOf(
      [
        battery(),
        part('res-1', 'resistor', { resistance: 220 }),
        part('res-2', 'resistor', { resistance: 1000 }),
      ],
      [
        wire('feed', 'bat-1', 'positive', 'res-1', 'pin1'),
        wire('feed2', 'res-1', 'pin1', 'res-2', 'pin1'),
        wire('back1', 'res-1', 'pin2', 'bat-1', 'negative'),
        wire('back2', 'res-2', 'pin2', 'bat-1', 'negative'),
      ]
    );

    // The 220 takes the lion's share; both are carrying something.
    expect(Math.abs(flow.back1)).toBeGreaterThan(Math.abs(flow.back2));
    expect(Math.abs(flow.back2)).toBeGreaterThan(1e-5);

    // Everything the supply pushes out comes back — exactly, not nearly.
    // Deducing a cable's current from what meets it at a junction can only
    // produce numbers that balance; reading each one separately off a voltage
    // difference cannot, and the leftover is what points arrows the wrong way.
    expect(Math.abs(flow.feed)).toBe(Math.abs(flow.back1) + Math.abs(flow.back2));
  });

  it('reads exactly zero on a cable that leads nowhere', async () => {
    const flow = await flowOf(
      [battery(), resistor(), part('spare-1', 'resistor', { resistance: 470 })],
      [
        wire('w1', 'bat-1', 'positive', 'res-1', 'pin1'),
        wire('w2', 'res-1', 'pin2', 'bat-1', 'negative'),
        // One end on the live circuit, the other on a resistor connected to
        // nothing else: a stub, and nothing can flow down it.
        wire('stub', 'bat-1', 'positive', 'spare-1', 'pin1'),
      ]
    );

    expect(Math.abs(flow.w1)).toBeGreaterThan(1e-4);
    expect(flow.stub).toBe(0);
  });

  it('reads zero everywhere when nothing completes a circuit', async () => {
    const flow = await flowOf(
      [battery(), resistor()],
      [wire('w1', 'bat-1', 'positive', 'res-1', 'pin1')]
    );

    expect(flow.w1).toBe(0);
  });
});

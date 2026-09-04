import { afterEach, describe, expect, it } from 'vitest';
import {
  startMockArduinoRuntime,
  stopMockArduinoRuntime,
  updateMockArduinoCircuit,
} from '../mockArduinoRuntime';
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

type Recording = {
  serial: string[];
  led: Array<{ id: string; on: boolean }>;
  states: Array<{ id: string; state: Record<string, string | number | boolean> }>;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The newest state published for a part, or null if it was never mentioned. */
const stateOf = (recording: Recording, id: string) => {
  const seen = recording.states.filter((entry) => entry.id === id);
  return seen.length > 0 ? seen[seen.length - 1].state : null;
};

/** Whether the last word on an LED was that it is lit. */
const litLast = (recording: Recording, id: string) => {
  const seen = recording.led.filter((entry) => entry.id === id);
  return seen.length > 0 ? seen[seen.length - 1].on : false;
};

/**
 * A sketch that does nothing, on purpose.
 *
 * The circuit here is a battery, a resistor and an LED — no pin drives any of
 * it, and there is no reason for the sketch to have a loop. That also makes it
 * the honest test: with an empty loop the runtime stops ticking, so the recompute
 * triggered by changing a value is the *only* pass that will ever run. Anything
 * that needs a second pass to come out right never comes out right at all.
 */
const SKETCH = `
  void setup() { }
  void loop() { }
`;

afterEach(() => {
  stopMockArduinoRuntime();
});

describe('a burned part recovers inside the run that burned it', () => {
  it('relights an LED when the resistance goes up, and blows it again when it comes back down', async () => {
    const recording: Recording = { serial: [], led: [], states: [] };
    const battery = part('bat-1', 'li-ion-battery', { cells: 2, chargePercent: 100 });
    const led = part('led-1', 'led');
    const wires = [
      wire('w1', 'bat-1', 'positive', 'res-1', 'pin1'),
      wire('w2', 'res-1', 'pin2', 'led-1', 'anode'),
      wire('w3', 'led-1', 'cathode', 'bat-1', 'negative'),
    ];

    // One ohm in front of it: nothing is limiting anything.
    const cook = (ohms: number) => [battery, part('res-1', 'resistor', { resistance: ohms }), led];

    startMockArduinoRuntime(SKETCH, cook(1), wires, BOARD_PINS, 5, {
      addSerialOutput: (text) => recording.serial.push(text),
      pushOscilloscopeSample: () => {},
      setLedState: (id, on) => recording.led.push({ id, on }),
      clearLedStates: () => {},
      setComponentState: (id, state) => recording.states.push({ id, state: { ...state } }),
      clearComponentStates: () => {},
      setPinStates: () => {},
    });

    await wait(200);
    // Reported the moment it happens: the char mark and the serial line.
    expect(stateOf(recording, 'led-1')?.damaged).toBe(true);

    // A part is only dark once it was already dead when the pass began, so it
    // takes one more pass for the glow to go — a part burns out while it is
    // still lit, and that is the only reason an LED straight off a pin is ever
    // seen at all before it dies.
    updateMockArduinoCircuit(cook(1), wires, BOARD_PINS);
    await wait(200);
    expect(litLast(recording, 'led-1')).toBe(false);

    // Turn the resistor up — the same gesture as a notch of the wheel — without
    // stopping the simulation.
    updateMockArduinoCircuit(cook(470), wires, BOARD_PINS);
    await wait(200);

    expect(stateOf(recording, 'led-1')?.damaged).toBe(false);
    expect(litLast(recording, 'led-1')).toBe(true);
    expect(recording.serial.some((line) => line.startsWith('[ok]'))).toBe(true);

    // ...and back down again: it goes the same way it went the first time. The
    // fault is reported at once — that is the burn mark and the serial line —
    // while the LED itself is still lit for the pass that kills it.
    updateMockArduinoCircuit(cook(1), wires, BOARD_PINS);
    await wait(200);
    expect(stateOf(recording, 'led-1')?.damaged).toBe(true);

    // The next pass — the next notch of the wheel — finds it already dead.
    updateMockArduinoCircuit(cook(1), wires, BOARD_PINS);
    await wait(200);
    expect(stateOf(recording, 'led-1')?.damaged).toBe(true);
    expect(litLast(recording, 'led-1')).toBe(false);
  });
});

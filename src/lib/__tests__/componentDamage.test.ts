import { afterEach, describe, expect, it } from 'vitest';
import { startMockArduinoRuntime, stopMockArduinoRuntime } from '../mockArduinoRuntime';
import { ARDUINO_COMPONENT_ID } from '../../models/arduinoUno';
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

function run(components: CircuitComponent[], wires: Wire[], ms = 600, code = SKETCH) {
  return new Promise<Recording>((resolve) => {
    const recording: Recording = { serial: [], led: [], states: [] };

    startMockArduinoRuntime(code, components, wires, BOARD_PINS, 5, {
      addSerialOutput: (text) => recording.serial.push(text),
      pushOscilloscopeSample: () => {},
      setLedState: (id, on) => recording.led.push({ id, on }),
      clearLedStates: () => {},
      setComponentState: (id, state) => recording.states.push({ id, state: { ...state } }),
      clearComponentStates: () => {},
      setPinStates: () => {},
    });

    setTimeout(() => {
      stopMockArduinoRuntime();
      resolve(recording);
    }, ms);
  });
}

const SKETCH = `
  void setup() { pinMode(13, OUTPUT); }
  void loop() { digitalWrite(13, HIGH); delay(100); }
`;

/** The last state published for a component. */
const stateOf = (recording: Recording, id: string) => {
  const seen = recording.states.filter((entry) => entry.id === id);
  return seen.length > 0 ? seen[seen.length - 1].state : null;
};

afterEach(() => {
  stopMockArduinoRuntime();
});

describe('over current and over voltage damage', () => {
  it('burns an LED wired straight across a 3S pack', async () => {
    const battery = part('bat-1', 'li-po-battery', { cells: 3, chargePercent: 100 });
    const led = part('led-1', 'led');

    const recording = await run(
      [battery, led],
      [
        wire('w1', 'bat-1', 'positive', 'led-1', 'anode'),
        wire('w2', 'led-1', 'cathode', 'bat-1', 'negative'),
      ]
    );

    const state = stateOf(recording, 'led-1');
    expect(state?.damaged).toBe(true);
    expect(state?.damageReason).toBe('overcurrent');
    expect(recording.serial.some((line) => line.startsWith('[!] led'))).toBe(true);
  });

  it('leaves the same LED alone behind a resistor on 5V', async () => {
    const led = part('led-1', 'led');
    const resistor = part('res-1', 'resistor', { resistance: 220 });

    const recording = await run(
      [led, resistor],
      [
        wire('w1', ARDUINO_COMPONENT_ID, '5V', 'res-1', 'pin1'),
        wire('w2', 'res-1', 'pin2', 'led-1', 'anode'),
        wire('w3', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
      ]
    );

    expect(stateOf(recording, 'led-1')?.damaged).toBeUndefined();
    expect(recording.serial.filter((line) => line.startsWith('[!]'))).toEqual([]);
  });

  it('burns a quarter watt resistor asked to dissipate more', async () => {
    const battery = part('bat-1', 'li-po-battery', { cells: 4, chargePercent: 100 });
    const resistor = part('res-1', 'resistor', { resistance: 10 });

    const recording = await run(
      [battery, resistor],
      [
        wire('w1', 'bat-1', 'positive', 'res-1', 'pin1'),
        wire('w2', 'res-1', 'pin2', 'bat-1', 'negative'),
      ]
    );

    const state = stateOf(recording, 'res-1');
    expect(state?.damaged).toBe(true);
    expect(['overpower', 'overcurrent']).toContain(state?.damageReason);
  });

  it('burns a 5V module fed from a 3S pack', async () => {
    const battery = part('bat-1', 'li-po-battery', { cells: 3, chargePercent: 100 });
    const sensor = part('dht-1', 'dht11');

    const recording = await run(
      [battery, sensor],
      [
        wire('w1', 'bat-1', 'positive', 'dht-1', 'vcc'),
        wire('w2', 'dht-1', 'gnd', 'bat-1', 'negative'),
      ]
    );

    const state = stateOf(recording, 'dht-1');
    expect(state?.damaged).toBe(true);
    expect(state?.damageReason).toBe('overvoltage');
  });

  it('keeps a burned LED dark, and repairs it on a fresh run', async () => {
    const battery = part('bat-1', 'li-ion-battery', { cells: 4, chargePercent: 100 });
    const led = part('led-1', 'led');
    const wires = [
      wire('w1', 'bat-1', 'positive', 'led-1', 'anode'),
      wire('w2', 'led-1', 'cathode', 'bat-1', 'negative'),
    ];

    const burned = await run([battery, led], wires);
    expect(stateOf(burned, 'led-1')?.damaged).toBe(true);
    const ledStates = burned.led.filter((entry) => entry.id === 'led-1');
    expect(ledStates[ledStates.length - 1]?.on).toBe(false);

    // A new run builds a new circuit, so nothing carries over.
    const rebuilt = await run(
      [part('bat-1', 'li-ion-battery', { cells: 1 }), part('led-1', 'led')],
      wires
    );
    expect(stateOf(rebuilt, 'led-1')?.damaged).toBeUndefined();
  });

  it('scales the pack voltage with its cells', async () => {
    const wires = [
      wire('w1', 'bat-1', 'positive', 'res-1', 'pin1'),
      wire('w2', 'res-1', 'pin2', 'bat-1', 'negative'),
    ];

    // 4.2 V across 220 ohms is 80 mW, well inside a quarter watt part.
    const single = await run(
      [part('bat-1', 'li-ion-battery', { cells: 1 }), part('res-1', 'resistor', { resistance: 220 })],
      wires
    );
    expect(stateOf(single, 'res-1')?.damaged).toBeUndefined();

    // Four cells put 16.8 V across the same resistor, which is 1.28 W.
    const pack = await run(
      [part('bat-1', 'li-po-battery', { cells: 4 }), part('res-1', 'resistor', { resistance: 220 })],
      wires
    );
    expect(stateOf(pack, 'res-1')?.damaged).toBe(true);
    expect(stateOf(pack, 'res-1')?.damageReason).toBe('overpower');
  });

  it('drains less voltage as the pack empties', async () => {
    const wires = [
      wire('w1', 'bat-1', 'positive', 'led-1', 'anode'),
      wire('w2', 'led-1', 'cathode', 'bat-1', 'negative'),
    ];

    // 2S full is 8.4 V, so 47 mA through the LED: too much.
    const full = await run(
      [part('bat-1', 'li-po-battery', { cells: 2, chargePercent: 100 }), part('led-1', 'led')],
      wires
    );
    expect(stateOf(full, 'led-1')?.damaged).toBe(true);

    // The same pack at 10% sits near 6.8 V, which is 38 mA — still too much,
    // while a single flat cell at 3.4 V is only 19 mA and survives.
    const flat = await run(
      [part('bat-1', 'li-ion-battery', { cells: 1, chargePercent: 10 }), part('led-1', 'led')],
      wires
    );
    expect(stateOf(flat, 'led-1')?.damaged).toBeUndefined();
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { startMockArduinoRuntime, stopMockArduinoRuntime } from '../mockArduinoRuntime';
import { ARDUINO_COMPONENT_ID } from '../../models/arduinoUno';
import type { CircuitComponent, Pin, Wire } from '../../models/types';

const BOARD_PINS: Pin[] = [
  { id: 'D13', name: 'D13', type: 'digital', x: 0, y: 0 },
  { id: 'D9', name: 'D9', type: 'pwm', x: 0, y: 10 },
  { id: 'GND', name: 'GND', type: 'ground', x: 0, y: 20 },
  { id: '5V', name: '5V', type: 'power', x: 0, y: 30 },
];

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
  pinStates: Array<Record<string, number>>;
  serial: string[];
  led: Array<{ on: boolean; brightness: number }>;
};

/** Runs a sketch for `ms` and reports everything the runtime published. */
function run(code: string, components: CircuitComponent[], wires: Wire[], ms = 2500) {
  return new Promise<Recording>((resolve) => {
    const recording: Recording = { pinStates: [], serial: [], led: [] };

    startMockArduinoRuntime(code, components, wires, BOARD_PINS, 5, {
      addSerialOutput: (text) => recording.serial.push(text),
      pushOscilloscopeSample: () => {},
      setLedState: (_id, on, brightness) => recording.led.push({ on, brightness }),
      clearLedStates: () => {},
      setComponentState: () => {},
      clearComponentStates: () => {},
      setPinStates: (states) => recording.pinStates.push({ ...states }),
    });

    setTimeout(() => {
      stopMockArduinoRuntime();
      resolve(recording);
    }, ms);
  });
}

const BLINK = `
void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(400);
  digitalWrite(13, LOW);
  delay(400);
  Serial.println("LED Blink!");
}
`;

afterEach(() => {
  stopMockArduinoRuntime();
});

describe('mock Arduino runtime', () => {
  it('drives pin 13 high and low for the demo blink sketch', async () => {
    const recording = await run(BLINK, [], []);
    const values = recording.pinStates.map((state) => state.D13);

    expect(values).toContain(255);
    expect(values).toContain(0);
    expect(recording.serial).toContain('LED Blink!');
  });

  it('lights an LED wired anode to the pin and cathode to ground', async () => {
    const recording = await run(BLINK, [led()], [
      wire('w1', ARDUINO_COMPONENT_ID, 'D13', 'led-1', 'anode'),
      wire('w2', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
    ]);

    expect(recording.led.some((state) => state.on)).toBe(true);
    expect(recording.led.some((state) => !state.on)).toBe(true);
    expect(Math.max(...recording.led.map((state) => state.brightness))).toBeCloseTo(1, 1);
  });

  it('leaves a reversed LED dark', async () => {
    const recording = await run(BLINK, [led()], [
      wire('w1', ARDUINO_COMPONENT_ID, 'D13', 'led-1', 'cathode'),
      wire('w2', 'led-1', 'anode', ARDUINO_COMPONENT_ID, 'GND'),
    ]);

    expect(recording.led.some((state) => state.on)).toBe(false);
  });

  it('dims an LED driven by analogWrite', async () => {
    const dim = `
      void setup() { pinMode(9, OUTPUT); }
      void loop() { analogWrite(9, 64); delay(400); }
    `;

    const recording = await run(dim, [led()], [
      wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'led-1', 'anode'),
      wire('w2', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
    ]);

    const lit = recording.led.filter((state) => state.on);
    expect(lit.length).toBeGreaterThan(0);
    expect(Math.max(...lit.map((state) => state.brightness))).toBeLessThan(0.5);
  });

  it('stops publishing once the runtime is stopped', async () => {
    const recording = await run(BLINK, [], [], 900);
    const seen = recording.pinStates.length;

    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(recording.pinStates.length).toBe(seen);
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import {
  startMockArduinoRuntime,
  stopMockArduinoRuntime,
  updateMockArduinoCircuit,
  findSketchCompileError,
  getCircuitWiringIssues,
} from '../mockArduinoRuntime';
import { ARDUINO_COMPONENT_ID } from '../../models/arduinoUno';
import { BB_X, BB_Y, BREADBOARD_COMPONENT_ID, HOLE_SP } from '../../models/breadboard';
import { getDefaultPins, type CircuitComponent, type Pin, type Wire } from '../../models/types';

const BOARD_PINS: Pin[] = [
  { id: 'D13', name: 'D13', type: 'digital', x: 0, y: 0 },
  { id: 'D9', name: 'D9', type: 'pwm', x: 0, y: 10 },
  { id: 'GND', name: 'GND', type: 'ground', x: 0, y: 20 },
  { id: '5V', name: '5V', type: 'power', x: 0, y: 30 },
  { id: 'D5', name: 'D5', type: 'pwm', x: 0, y: 40 },
  { id: 'D6', name: 'D6', type: 'pwm', x: 0, y: 50 },
  { id: 'D7', name: 'D7', type: 'digital', x: 0, y: 60 },
  { id: 'D8', name: 'D8', type: 'digital', x: 0, y: 70 },
  { id: 'A0', name: 'A0', type: 'analog', x: 0, y: 80 },
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

const rgbLed = (commonType: 'cathode' | 'anode' = 'cathode'): CircuitComponent => ({
  id: 'rgb-1',
  type: 'rgb-led',
  x: 200,
  y: 200,
  rotation: 0,
  pins: [
    { id: 'red', name: 'Red', type: 'passive', x: -15, y: -15 },
    { id: 'common', name: 'Common', type: 'passive', x: -5, y: -15 },
    { id: 'green', name: 'Green', type: 'passive', x: 5, y: -15 },
    { id: 'blue', name: 'Blue', type: 'passive', x: 15, y: -15 },
  ],
  properties: { red: 0, green: 0, blue: 0, commonType },
});

const battery = (): CircuitComponent => ({
  id: 'battery-1',
  type: '9v-battery',
  x: 100,
  y: 100,
  rotation: 0,
  pins: [
    { id: 'positive', name: '+', type: 'power', x: 40, y: -15 },
    { id: 'negative', name: '-', type: 'ground', x: 40, y: 15 },
  ],
  properties: { cells: 1 },
});

const resistor = (): CircuitComponent => ({
  id: 'resistor-1',
  type: 'resistor',
  x: 150,
  y: 200,
  rotation: 0,
  pins: [
    { id: 'pin1', name: 'Pin 1', type: 'passive', x: -25, y: 0 },
    { id: 'pin2', name: 'Pin 2', type: 'passive', x: 25, y: 0 },
  ],
  properties: { resistance: 220, unit: 'ohm' },
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

type ComponentStateEntry = {
  id: string;
  state: Record<string, string | number | boolean>;
};

type Recording = {
  pinStates: Array<Record<string, number>>;
  serial: string[];
  led: Array<{ on: boolean; brightness: number }>;
  ledById: Array<{ id: string; on: boolean; brightness: number }>;
  componentStates: ComponentStateEntry[];
  wireFlow: Array<Record<string, number>>;
};

/** The brightest this LED ever reported, so a blinking sketch still counts. */
const peakBrightness = (recording: Recording, id: string): number =>
  recording.ledById
    .filter((entry) => entry.id === id)
    .reduce((peak, entry) => Math.max(peak, entry.brightness), 0);

/** Every value the runtime published for one component, oldest first. */
const statesOf = (recording: Recording, id: string) =>
  recording.componentStates.filter((entry) => entry.id === id).map((entry) => entry.state);

/** Runs a sketch for `ms` and reports everything the runtime published. */
function run(code: string, components: CircuitComponent[], wires: Wire[], ms = 2500) {
  return new Promise<Recording>((resolve) => {
    const recording: Recording = {
      pinStates: [],
      serial: [],
      led: [],
      ledById: [],
      componentStates: [],
      wireFlow: [],
    };

    startMockArduinoRuntime(code, components, wires, BOARD_PINS, 5, {
      addSerialOutput: (text) => recording.serial.push(text),
      pushOscilloscopeSample: () => {},
      setLedState: (id, on, brightness) => {
        recording.led.push({ on, brightness });
        recording.ledById.push({ id, on, brightness });
      },
      clearLedStates: () => {},
      setComponentState: (id, state) => recording.componentStates.push({ id, state: { ...state } }),
      clearComponentStates: () => {},
      setPinStates: (states) => recording.pinStates.push({ ...states }),
      setWireFlow: (flow) => recording.wireFlow.push({ ...flow }),
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
    // Through a resistor, so the comparison is not both ends pinned at full.
    const at = async (value: number) => {
      const recording = await run(
        `void setup() { pinMode(9, OUTPUT); }
         void loop() { analogWrite(9, ${value}); delay(400); }`,
        [resistor(), led()],
        [
          wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'resistor-1', 'pin1'),
          wire('w2', 'resistor-1', 'pin2', 'led-1', 'anode'),
          wire('w3', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
        ]
      );
      return peakBrightness(recording, 'led-1');
    };

    const full = await at(255);
    const quarter = await at(64);

    expect(quarter).toBeGreaterThan(0);
    expect(quarter).toBeLessThan(full);
  });

  it('stops publishing once the runtime is stopped', async () => {
    const recording = await run(BLINK, [], [], 900);
    const seen = recording.pinStates.length;

    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(recording.pinStates.length).toBe(seen);
  });

  it('prints what a call returns, not the call itself', async () => {
    const code = `
      void setup() { Serial.begin(9600); }

      void loop() {
        Serial.println(millis());
        Serial.println("ms=" + String(map(128, 0, 255, 0, 100)));
        delay(200);
      }
    `;

    const recording = await run(code, [], [], 900);

    expect(recording.serial.some((line) => /^\d+$/.test(line))).toBe(true);
    expect(recording.serial).toContain('ms=50');
    expect(recording.serial.some((line) => line.includes('millis('))).toBe(false);
  });
});

const bts7960 = (motorCurrentA = 0): CircuitComponent => ({
  id: 'bts-1',
  type: 'bts7960-driver',
  x: 300,
  y: 200,
  rotation: 0,
  pins: getDefaultPins('bts7960-driver'),
  properties: { pwmR: 0, pwmL: 0, enabledR: false, enabledL: false, motorCurrentA },
});

const dcMotor = (): CircuitComponent => ({
  id: 'motor-1',
  type: 'dc-motor',
  x: 400,
  y: 300,
  rotation: 0,
  pins: [
    { id: 'pin1', name: 'Pin 1', type: 'passive', x: -10, y: 0 },
    { id: 'pin2', name: 'Pin 2', type: 'passive', x: 10, y: 0 },
  ],
  properties: { rpm: 0 },
});

/** The wiring every BTS7960 test starts from: logic, supply and motor all hooked up. */
const bts7960Wiring = (): Wire[] => [
  wire('w-rpwm', ARDUINO_COMPONENT_ID, 'D5', 'bts-1', 'rpwm'),
  wire('w-lpwm', ARDUINO_COMPONENT_ID, 'D6', 'bts-1', 'lpwm'),
  wire('w-ren', ARDUINO_COMPONENT_ID, 'D7', 'bts-1', 'r_en'),
  wire('w-len', ARDUINO_COMPONENT_ID, 'D8', 'bts-1', 'l_en'),
  wire('w-vcc', ARDUINO_COMPONENT_ID, '5V', 'bts-1', 'vcc'),
  wire('w-gnd', ARDUINO_COMPONENT_ID, 'GND', 'bts-1', 'gnd'),
  wire('w-bplus', ARDUINO_COMPONENT_ID, '5V', 'bts-1', 'b_plus'),
  wire('w-bminus', ARDUINO_COMPONENT_ID, 'GND', 'bts-1', 'b_minus'),
  wire('w-mplus', 'bts-1', 'm_plus', 'motor-1', 'pin1'),
  wire('w-mminus', 'bts-1', 'm_minus', 'motor-1', 'pin2'),
];

/** Enables both half bridges, then drives the two PWM inputs. */
const btsSketch = (rpwm: string, lpwm: string, enable = 'HIGH') => `
  void setup() {
    pinMode(5, OUTPUT);
    pinMode(6, OUTPUT);
    pinMode(7, OUTPUT);
    pinMode(8, OUTPUT);
    digitalWrite(7, ${enable});
    digitalWrite(8, ${enable});
  }

  void loop() {
    analogWrite(5, ${rpwm});
    analogWrite(6, ${lpwm});
    delay(200);
  }
`;

const motorSpeeds = (recording: Recording) =>
  statesOf(recording, 'motor-1').map((state) => Number(state.rpm));

describe('the series resistor decides whether the LED survives', () => {
  const DRIVE = `
void setup() {
  pinMode(9, OUTPUT);
}

void loop() {
  digitalWrite(9, HIGH);
  delay(50);
}
`;

  const ledOnPin = (ohms: number | null) => {
    const led: CircuitComponent = {
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
    };

    if (ohms === null) {
      return {
        components: [led],
        wires: [
          wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'led-1', 'anode'),
          wire('w2', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
        ],
      };
    }

    const res: CircuitComponent = {
      id: 'res-1',
      type: 'resistor',
      x: 150,
      y: 200,
      rotation: 0,
      pins: [
        { id: 'pin1', name: 'Pin 1', type: 'passive', x: -25, y: 0 },
        { id: 'pin2', name: 'Pin 2', type: 'passive', x: 25, y: 0 },
      ],
      properties: { resistance: ohms, unit: 'ohm' },
    };

    return {
      components: [res, led],
      wires: [
        wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'res-1', 'pin1'),
        wire('w2', 'res-1', 'pin2', 'led-1', 'anode'),
        wire('w3', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
      ],
    };
  };

  const burned = async (ohms: number | null) => {
    const { components, wires } = ledOnPin(ohms);
    const recording = await run(DRIVE, components, wires, 900);
    const states = recording.componentStates.filter((entry) => entry.id === 'led-1');
    return states.some((entry) => entry.state.damaged === true);
  };

  it('burns the LED wired to a pin with nothing to limit it', async () => {
    expect(await burned(null)).toBe(true);
  });

  it('burns it through a resistor far too small to help', async () => {
    expect(await burned(10)).toBe(true);
  });

  it('saves it with the resistor everyone actually uses', async () => {
    expect(await burned(220)).toBe(false);
  });

  it('saves it with a large one too', async () => {
    expect(await burned(10000)).toBe(false);
  });
});

describe('LEDs in series', () => {
  const secondLed = (): CircuitComponent => ({
    ...led(),
    id: 'led-2',
    x: 260,
  });

  const DRIVE_D9 = `
void setup() {
  pinMode(9, OUTPUT);
}

void loop() {
  digitalWrite(9, HIGH);
  delay(50);
}
`;

  it('lights both of two LEDs chained through one resistor', async () => {
    // D9 -> 220R -> LED1 -> LED2 -> GND. The node between the two LEDs is
    // driven by nothing, which is exactly the case that used to leave the pair
    // dark: with no level on that net there was nothing to take a difference
    // from, so both ends read as unknown.
    const recording = await run(
      DRIVE_D9,
      [resistor(), led(), secondLed()],
      [
        wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'resistor-1', 'pin1'),
        wire('w2', 'resistor-1', 'pin2', 'led-1', 'anode'),
        wire('w3', 'led-1', 'cathode', 'led-2', 'anode'),
        wire('w4', 'led-2', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
      ],
      900
    );

    expect(peakBrightness(recording, 'led-1')).toBeGreaterThan(0.05);
    expect(peakBrightness(recording, 'led-2')).toBeGreaterThan(0.05);
  });

  it('still drives a single LED at full brightness', async () => {
    const recording = await run(
      DRIVE_D9,
      [resistor(), led()],
      [
        wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'resistor-1', 'pin1'),
        wire('w2', 'resistor-1', 'pin2', 'led-1', 'anode'),
        wire('w3', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
      ],
      900
    );

    expect(peakBrightness(recording, 'led-1')).toBe(1);
  });

  it('leaves a chain with no path to ground dark', async () => {
    const recording = await run(
      DRIVE_D9,
      [resistor(), led(), secondLed()],
      [
        wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'resistor-1', 'pin1'),
        wire('w2', 'resistor-1', 'pin2', 'led-1', 'anode'),
        wire('w3', 'led-1', 'cathode', 'led-2', 'anode'),
      ],
      900
    );

    // Solved as a linear branch a diode leaves a whisper of arithmetic dust
    // behind, so the claim is that neither LED lights, not that the number is
    // exactly zero.
    expect(peakBrightness(recording, 'led-1')).toBeLessThan(0.05);
    expect(peakBrightness(recording, 'led-2')).toBeLessThan(0.05);
  });
});

describe('BTS7960 half bridge driver', () => {
  it('drives the motor forward when only RPWM is fed', async () => {
    const recording = await run(btsSketch('200', '0'), [bts7960(), dcMotor()], bts7960Wiring(), 900);

    expect(Math.max(...motorSpeeds(recording))).toBeGreaterThan(0);
    expect(Math.min(...motorSpeeds(recording))).toBeGreaterThanOrEqual(0);

    const driver = statesOf(recording, 'bts-1');
    expect(driver.some((state) => state.enabledR === true && state.pwmR === 200)).toBe(true);
    expect(driver.every((state) => state.pwmL === 0)).toBe(true);
  });

  it('runs the motor backwards when only LPWM is fed', async () => {
    const recording = await run(btsSketch('0', '200'), [bts7960(), dcMotor()], bts7960Wiring(), 900);

    expect(Math.min(...motorSpeeds(recording))).toBeLessThan(0);
    expect(Math.max(...motorSpeeds(recording))).toBeLessThanOrEqual(0);
  });

  it('follows the PWM value, so a lower duty turns slower', async () => {
    const fast = await run(btsSketch('255', '0'), [bts7960(), dcMotor()], bts7960Wiring(), 900);
    const slow = await run(btsSketch('80', '0'), [bts7960(), dcMotor()], bts7960Wiring(), 900);

    expect(Math.max(...motorSpeeds(slow))).toBeGreaterThan(0);
    expect(Math.max(...motorSpeeds(slow))).toBeLessThan(Math.max(...motorSpeeds(fast)));
  });

  it('coasts while the enable pins are low, whatever the PWM says', async () => {
    const recording = await run(
      btsSketch('255', '0', 'LOW'),
      [bts7960(), dcMotor()],
      bts7960Wiring(),
      900
    );

    expect(motorSpeeds(recording).every((rpm) => rpm === 0)).toBe(true);
    expect(statesOf(recording, 'bts-1').every((state) => state.enabledR === false)).toBe(true);
  });

  it('brakes when both sides are enabled and neither is driven', async () => {
    const recording = await run(btsSketch('0', '0'), [bts7960(), dcMotor()], bts7960Wiring(), 900);

    expect(motorSpeeds(recording).every((rpm) => rpm === 0)).toBe(true);
    expect(
      statesOf(recording, 'bts-1').some(
        (state) => state.enabledR === true && state.enabledL === true
      )
    ).toBe(true);
  });

  it('reports the load current on R_IS while that side conducts', async () => {
    const senseSketch = `
      void setup() {
        pinMode(5, OUTPUT);
        pinMode(7, OUTPUT);
        pinMode(8, OUTPUT);
        digitalWrite(7, HIGH);
        digitalWrite(8, HIGH);
        Serial.begin(9600);
      }

      void loop() {
        analogWrite(5, 255);
        delay(150);
        Serial.println(analogRead(A0));
        delay(150);
      }
    `;
    const senseWire = wire('w-sense', ARDUINO_COMPONENT_ID, 'A0', 'bts-1', 'r_is');

    const driving = await run(
      senseSketch,
      [bts7960(10), dcMotor()],
      [...bts7960Wiring(), senseWire],
      1200
    );
    const idle = await run(
      senseSketch,
      [bts7960(0), dcMotor()],
      [...bts7960Wiring(), senseWire],
      1200
    );

    const readings = driving.serial.map(Number).filter((value) => Number.isFinite(value));
    expect(readings.length).toBeGreaterThan(0);
    expect(Math.max(...readings)).toBeGreaterThan(0);

    const idleReadings = idle.serial.map(Number).filter((value) => Number.isFinite(value));
    expect(idleReadings.length).toBeGreaterThan(0);
    expect(Math.max(...idleReadings)).toBe(0);
  });
});

describe('a button in the circuit', () => {
  const button = (pressed: boolean): CircuitComponent => ({
    id: 'btn-1',
    type: 'button',
    x: 300,
    y: 200,
    rotation: 0,
    pins: [
      { id: 'pin1', name: 'Pin 1', type: 'passive', x: 15, y: -10 },
      { id: 'pin2', name: 'Pin 2', type: 'passive', x: 15, y: 10 },
      { id: 'pin3', name: 'Pin 3', type: 'passive', x: -15, y: -10 },
      { id: 'pin4', name: 'Pin 4', type: 'passive', x: -15, y: 10 },
    ],
    properties: { pressed, type: 'momentary' },
  });

  const HOLD_D9 = `
void setup() {
  pinMode(9, OUTPUT);
}

void loop() {
  digitalWrite(9, HIGH);
  delay(50);
}
`;

  /** D9 -> resistor -> button -> LED -> GND, wired to the named button legs. */
  const circuit = (pressed: boolean, inLeg: string, outLeg: string) => ({
    components: [resistor(), button(pressed), led()],
    wires: [
      wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'resistor-1', 'pin1'),
      wire('w2', 'resistor-1', 'pin2', 'btn-1', inLeg),
      wire('w3', 'btn-1', outLeg, 'led-1', 'anode'),
      wire('w4', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
    ],
  });

  const brightness = async (pressed: boolean, inLeg = 'pin1', outLeg = 'pin3') => {
    const { components, wires } = circuit(pressed, inLeg, outLeg);
    const recording = await run(HOLD_D9, components, wires, 900);
    return peakBrightness(recording, 'led-1');
  };

  it('leaves the circuit open until it is pressed', async () => {
    expect(await brightness(false)).toBeLessThan(0.05);
  });

  it('closes the circuit and lights the LED when pressed', async () => {
    expect(await brightness(true)).toBeGreaterThan(0.05);
  });

  it('works off either pair of legs, because each pair is one terminal', async () => {
    // pin2 is the other leg of pin1's terminal, pin4 the other leg of pin3's.
    expect(await brightness(true, 'pin2', 'pin4')).toBeGreaterThan(0.05);
    expect(await brightness(false, 'pin2', 'pin4')).toBeLessThan(0.05);
  });

  it('does nothing when both wires land on the same terminal', async () => {
    // Legs on one side are joined inside the part, so this shorts the button
    // out rather than switching anything — pressed or not, the LED is lit.
    expect(await brightness(false, 'pin1', 'pin2')).toBeGreaterThan(0.05);
  });
});

describe('editing the circuit while it runs', () => {
  const buttonPart = (pressed: boolean): CircuitComponent => ({
    id: 'btn-1',
    type: 'button',
    x: 300,
    y: 200,
    rotation: 0,
    pins: [
      { id: 'pin1', name: 'Pin 1', type: 'passive', x: 15, y: -10 },
      { id: 'pin2', name: 'Pin 2', type: 'passive', x: 15, y: 10 },
      { id: 'pin3', name: 'Pin 3', type: 'passive', x: -15, y: -10 },
      { id: 'pin4', name: 'Pin 4', type: 'passive', x: -15, y: 10 },
    ],
    properties: { pressed, type: 'momentary' },
  });

  const BUTTON_WIRES = [
    wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'resistor-1', 'pin1'),
    wire('w2', 'resistor-1', 'pin2', 'btn-1', 'pin1'),
    wire('w3', 'btn-1', 'pin3', 'led-1', 'anode'),
    wire('w4', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
  ];

  const COUNTING_SKETCH = `
int runs = 0;

void setup() {
  pinMode(9, OUTPUT);
  digitalWrite(9, HIGH);
  runs = runs + 1;
  Serial.begin(9600);
  Serial.println("setup");
}

void loop() {
  delay(50);
}
`;

  it('does not send the sketch back to setup when a value changes', async () => {
    const recording = await new Promise<Recording>((resolve) => {
      const captured: Recording = {
        pinStates: [],
        serial: [],
        led: [],
        ledById: [],
        componentStates: [],
        wireFlow: [],
      };

      startMockArduinoRuntime(
        COUNTING_SKETCH,
        [resistor(), led()],
        [
          wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'resistor-1', 'pin1'),
          wire('w2', 'resistor-1', 'pin2', 'led-1', 'anode'),
          wire('w3', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
        ],
        BOARD_PINS,
        5,
        {
          addSerialOutput: (text) => captured.serial.push(text),
          pushOscilloscopeSample: () => {},
          setLedState: (id, on, brightness) => {
            captured.led.push({ on, brightness });
            captured.ledById.push({ id, on, brightness });
          },
          clearLedStates: () => {},
          setComponentState: (id, state) =>
            captured.componentStates.push({ id, state: { ...state } }),
          clearComponentStates: () => {},
          setPinStates: (states) => captured.pinStates.push({ ...states }),
        }
      );

      setTimeout(() => {
        // The kind of edit the properties panel makes: same circuit, new value.
        updateMockArduinoCircuit(
          [{ ...resistor(), properties: { resistance: 10000, unit: 'ohm' } }, led()],
          [
            wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'resistor-1', 'pin1'),
            wire('w2', 'resistor-1', 'pin2', 'led-1', 'anode'),
            wire('w3', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
          ],
          BOARD_PINS
        );
      }, 400);

      setTimeout(() => {
        stopMockArduinoRuntime();
        resolve(captured);
      }, 900);
    });

    // setup() ran once and only once: the change did not restart anything.
    expect(recording.serial.filter((line) => line.includes('setup'))).toHaveLength(1);
  });

  it('shows the change, not just carries on running', async () => {
    // The claim the earlier test missed: the sketch keeping its place is only
    // half of it, the edit has to reach the circuit too. Pressing a button is
    // exactly this path, and it did nothing because the running sketch went on
    // reading the graph it started with.
    const pressed = await new Promise<boolean>((resolve) => {
      const seen: boolean[] = [];

      startMockArduinoRuntime(
        `void setup() { pinMode(9, OUTPUT); }
         void loop() { digitalWrite(9, HIGH); delay(30); }`,
        [resistor(), buttonPart(false), led()],
        BUTTON_WIRES,
        BOARD_PINS,
        5,
        {
          addSerialOutput: () => {},
          pushOscilloscopeSample: () => {},
          setLedState: (id, on) => {
            if (id === 'led-1') seen.push(on);
          },
          clearLedStates: () => {},
          setComponentState: () => {},
          clearComponentStates: () => {},
          setPinStates: () => {},
        }
      );

      setTimeout(() => {
        // The button goes down, the way the canvas reports a press.
        updateMockArduinoCircuit(
          [resistor(), buttonPart(true), led()],
          BUTTON_WIRES,
          BOARD_PINS
        );
      }, 300);

      setTimeout(() => {
        stopMockArduinoRuntime();
        // Dark to begin with, lit once the button closed the circuit.
        resolve(seen.slice(0, 3).every((on) => !on) && seen.slice(-3).every((on) => on));
      }, 800);
    });

    expect(pressed).toBe(true);
  });

  it('recomputes there and then, without waiting for the sketch to run a line', async () => {
    // A meter probing a resistor, or a potentiometer being swept, has to move as
    // the value moves. Swapping the graph alone only showed up on the sketch's
    // next statement, so a loop sitting in a long delay held the old reading.
    const meter = (): CircuitComponent => ({
      id: 'meter-1',
      type: 'multimeter',
      x: 300,
      y: 300,
      rotation: 0,
      pins: [],
      properties: {
        mode: 'resistance',
        autoRange: true,
        redProbeTargetComponentId: 'resistor-1',
        redProbeTargetPinId: 'pin1',
        blackProbeTargetComponentId: 'resistor-1',
        blackProbeTargetPinId: 'pin2',
      },
    });

    const LIVE_WIRES = [
      wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'resistor-1', 'pin1'),
      wire('w2', 'resistor-1', 'pin2', 'led-1', 'anode'),
      wire('w3', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
    ];

    const readingsAfterEdit = await new Promise<string[]>((resolve) => {
      const readings: string[] = [];
      let countAtEdit = 0;

      startMockArduinoRuntime(
        `void setup() { pinMode(9, OUTPUT); digitalWrite(9, HIGH); }
         void loop() { delay(5000); }`,
        [resistor(), led(), meter()],
        LIVE_WIRES,
        BOARD_PINS,
        5,
        {
          addSerialOutput: () => {},
          pushOscilloscopeSample: () => {},
          setLedState: () => {},
          clearLedStates: () => {},
          setComponentState: (id, state) => {
            if (id === 'meter-1' && typeof state.reading === 'number') {
              readings.push(`${state.reading} ${state.unit}`);
            }
          },
          clearComponentStates: () => {},
          setPinStates: () => {},
        }
      );

      setTimeout(() => {
        countAtEdit = readings.length;
        updateMockArduinoCircuit(
          [
            { ...resistor(), properties: { resistance: 10000, unit: 'ohm' } },
            led(),
            meter(),
          ],
          LIVE_WIRES,
          BOARD_PINS
        );
      }, 300);

      setTimeout(() => {
        stopMockArduinoRuntime();
        resolve(readings.slice(countAtEdit));
      }, 550);
    });

    // The sketch never ran another line in that window, so a fresh reading in
    // it came from the edit itself — and it is the new value, not the old one.
    expect(readingsAfterEdit.length).toBeGreaterThan(0);
    // 220 ohm before the edit, ten kilohm after it — auto-range and all.
    expect(readingsAfterEdit[readingsAfterEdit.length - 1]).toBe('10 kΩ');
  });

  it('reports nothing to update once the run has stopped', () => {
    stopMockArduinoRuntime();
    expect(updateMockArduinoCircuit([], [], BOARD_PINS)).toBe(false);
  });
});

describe('buzzer', () => {
  const buzzerPart = (
    properties: Record<string, string | number | boolean> = {}
  ): CircuitComponent => ({
    id: 'buzzer-1',
    type: 'buzzer',
    x: 200,
    y: 300,
    rotation: 0,
    pins: [
      { id: 'positive', name: '+', type: 'passive', x: -10, y: 0 },
      { id: 'negative', name: '-', type: 'passive', x: 10, y: 0 },
    ],
    properties: { frequency: 1000, active: true, ...properties },
  });

  const BUZZER_WIRES = [
    wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'buzzer-1', 'positive'),
    wire('w2', 'buzzer-1', 'negative', ARDUINO_COMPONENT_ID, 'GND'),
  ];

  /** Only the entries that carry a sounding verdict — damage reports do not. */
  const buzzerStates = (recording: Recording) =>
    statesOf(recording, 'buzzer-1').filter((state) => 'sounding' in state);

  /** Did it ever report itself sounding, and at what pitch? */
  const sounded = (recording: Recording) =>
    buzzerStates(recording).filter((state) => state.sounding === true);

  const HIGH_SKETCH = `
void setup() {
  pinMode(9, OUTPUT);
  digitalWrite(9, HIGH);
}

void loop() {
  delay(50);
}
`;

  it('sounds when an active buzzer is driven high', async () => {
    const recording = await run(HIGH_SKETCH, [buzzerPart()], BUZZER_WIRES, 700);
    const sounding = sounded(recording);

    expect(sounding.length).toBeGreaterThan(0);
    // An active buzzer runs at its own frequency; no tone() needed.
    expect(sounding[sounding.length - 1].frequency).toBe(1000);
  });

  it('stays quiet when the pin is low', async () => {
    const recording = await run(
      `void setup() { pinMode(9, OUTPUT); digitalWrite(9, LOW); }
       void loop() { delay(50); }`,
      [buzzerPart()],
      BUZZER_WIRES,
      700
    );

    expect(sounded(recording)).toHaveLength(0);
  });

  it('stays quiet with a leg in mid-air, however hard the pin is driven', async () => {
    const recording = await run(
      HIGH_SKETCH,
      [buzzerPart()],
      [wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'buzzer-1', 'positive')],
      700
    );

    expect(sounded(recording)).toHaveLength(0);
  });

  it('needs tone() for a passive buzzer — a bare HIGH does nothing', async () => {
    const recording = await run(HIGH_SKETCH, [buzzerPart({ active: false })], BUZZER_WIRES, 700);

    expect(sounded(recording)).toHaveLength(0);
  });

  it('plays the pitch tone() asks for', async () => {
    const recording = await run(
      `void setup() { pinMode(9, OUTPUT); tone(9, 440); }
       void loop() { delay(50); }`,
      [buzzerPart({ active: false })],
      BUZZER_WIRES,
      700
    );
    const sounding = sounded(recording);

    expect(sounding.length).toBeGreaterThan(0);
    expect(sounding[sounding.length - 1].frequency).toBe(440);
  });

  it('lets tone() override an active buzzer own pitch', async () => {
    const recording = await run(
      `void setup() { pinMode(9, OUTPUT); tone(9, 262); }
       void loop() { delay(50); }`,
      [buzzerPart()],
      BUZZER_WIRES,
      700
    );
    const sounding = sounded(recording);

    expect(sounding.length).toBeGreaterThan(0);
    expect(sounding[sounding.length - 1].frequency).toBe(262);
  });

  it('goes quiet on noTone()', async () => {
    const recording = await run(
      `void setup() {
         pinMode(9, OUTPUT);
         tone(9, 440);
         delay(100);
         noTone(9);
       }
       void loop() { delay(50); }`,
      [buzzerPart({ active: false })],
      BUZZER_WIRES,
      900
    );
    const states = buzzerStates(recording);

    // It sang, then stopped, and the last word is silence.
    expect(states.some((state) => state.sounding === true)).toBe(true);
    expect(states[states.length - 1].sounding).toBe(false);
  });

  it('stops on its own once a timed tone runs out', async () => {
    const recording = await run(
      `void setup() {
         pinMode(9, OUTPUT);
         tone(9, 440, 80);
       }
       void loop() { delay(40); }`,
      [buzzerPart({ active: false })],
      BUZZER_WIRES,
      900
    );
    const states = buzzerStates(recording);

    expect(states.some((state) => state.sounding === true)).toBe(true);
    expect(states[states.length - 1].sounding).toBe(false);
  });

  it('survives being wired straight to a pin, the way every kit does it', async () => {
    const recording = await run(HIGH_SKETCH, [buzzerPart()], BUZZER_WIRES, 900);
    const damage = statesOf(recording, 'buzzer-1').filter((state) => state.damaged === true);

    // Modelled at 32 ohm it drew 156 mA and burned out on the first tick, so it
    // beeped once and went dead however the sketch was written.
    expect(damage).toHaveLength(0);
    const states = buzzerStates(recording);
    expect(states[states.length - 1].sounding).toBe(true);
  });
});

describe('potentiometer', () => {
  const pot = (position: number): CircuitComponent => ({
    id: 'pot-1',
    type: 'potentiometer',
    x: 200,
    y: 200,
    rotation: 0,
    pins: [
      { id: 'pin1', name: 'Pin 1', type: 'passive', x: -12, y: 8 },
      { id: 'wiper', name: 'Wiper', type: 'passive', x: 0, y: 8 },
      { id: 'pin2', name: 'Pin 2', type: 'passive', x: 12, y: 8 },
    ],
    properties: { resistance: 10000, position, unit: 'ohm' },
  });

  // The textbook wiring: track across the supply, wiper into an analog pin.
  const POT_WIRES = [
    wire('w1', ARDUINO_COMPONENT_ID, '5V', 'pot-1', 'pin1'),
    wire('w2', 'pot-1', 'pin2', ARDUINO_COMPONENT_ID, 'GND'),
    wire('w3', 'pot-1', 'wiper', ARDUINO_COMPONENT_ID, 'A0'),
  ];

  const READ_SKETCH = `
void setup() {
  Serial.begin(9600);
}

void loop() {
  Serial.println(analogRead(A0));
  delay(60);
}
`;

  /** The last reading the sketch printed — println flushes one line per entry. */
  const lastReading = (recording: Recording): number => {
    const numbers = recording.serial
      .map((line) => Number(line.trim()))
      .filter((value) => Number.isFinite(value));
    return numbers[numbers.length - 1] ?? -1;
  };

  it('reads full scale with the wiper at the supply end', async () => {
    const recording = await run(READ_SKETCH, [pot(0)], POT_WIRES, 800);
    expect(lastReading(recording)).toBeGreaterThan(1000);
  });

  it('reads about half way with the wiper in the middle', async () => {
    const recording = await run(READ_SKETCH, [pot(50)], POT_WIRES, 800);
    const reading = lastReading(recording);

    expect(reading).toBeGreaterThan(480);
    expect(reading).toBeLessThan(545);
  });

  it('reads nothing with the wiper at the ground end', async () => {
    const recording = await run(READ_SKETCH, [pot(100)], POT_WIRES, 800);
    expect(lastReading(recording)).toBeLessThan(20);
  });

  it('gives a different reading for every position, not one flat value', async () => {
    // Read through the bridged graph the track was a dead short, so pin1, the
    // wiper and pin2 all sat on one net and turning the knob did nothing.
    const readings = await Promise.all(
      [0, 25, 50, 75, 100].map(async (position) =>
        lastReading(await run(READ_SKETCH, [pot(position)], POT_WIRES, 700))
      )
    );

    expect(new Set(readings).size).toBe(readings.length);
    // And they fall as the wiper travels away from the supply.
    for (let i = 1; i < readings.length; i += 1) {
      expect(readings[i]).toBeLessThan(readings[i - 1]);
    }
  });
});

describe('transistor', () => {
  const transistor = (
    type: 'transistor-npn' | 'transistor-pnp',
    properties: Record<string, string | number | boolean> = {}
  ): CircuitComponent => ({
    id: 'q-1',
    type,
    x: 260,
    y: 200,
    rotation: 0,
    pins: [
      { id: 'base', name: 'Base', type: 'passive', x: 0, y: 8 },
      { id: 'collector', name: 'Collector', type: 'passive', x: -9.5, y: 8 },
      { id: 'emitter', name: 'Emitter', type: 'passive', x: 9.5, y: 8 },
    ],
    properties: { hfe: 100, on: false, ...properties },
  });

  const baseResistor = (): CircuitComponent => ({ ...resistor(), id: 'rb-1' });
  const loadResistor = (): CircuitComponent => ({ ...resistor(), id: 'rl-1' });

  /**
   * The textbook low-side switch: a pin drives the base through a resistor, and
   * the LED sits between the supply and the collector.
   */
  const NPN_WIRES = [
    wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'rb-1', 'pin1'),
    wire('w2', 'rb-1', 'pin2', 'q-1', 'base'),
    wire('w3', ARDUINO_COMPONENT_ID, '5V', 'rl-1', 'pin1'),
    wire('w4', 'rl-1', 'pin2', 'led-1', 'anode'),
    wire('w5', 'led-1', 'cathode', 'q-1', 'collector'),
    wire('w6', 'q-1', 'emitter', ARDUINO_COMPONENT_ID, 'GND'),
  ];

  const DRIVE = (level: 'HIGH' | 'LOW') => `
void setup() {
  pinMode(9, OUTPUT);
  digitalWrite(9, ${level});
}

void loop() {
  delay(50);
}
`;

  it('leaves the load off while the base is not driven', async () => {
    const recording = await run(
      DRIVE('LOW'),
      [baseResistor(), loadResistor(), transistor('transistor-npn'), led()],
      NPN_WIRES,
      800
    );

    expect(peakBrightness(recording, 'led-1')).toBeLessThan(0.05);
  });

  it('turns the load on when the sketch drives the base', async () => {
    const recording = await run(
      DRIVE('HIGH'),
      [baseResistor(), loadResistor(), transistor('transistor-npn'), led()],
      NPN_WIRES,
      800
    );

    expect(peakBrightness(recording, 'led-1')).toBeGreaterThan(0.2);
  });

  it('reports whether it is conducting', async () => {
    const recording = await run(
      DRIVE('HIGH'),
      [baseResistor(), loadResistor(), transistor('transistor-npn'), led()],
      NPN_WIRES,
      800
    );
    const states = statesOf(recording, 'q-1').filter((state) => 'conducting' in state);

    expect(states.length).toBeGreaterThan(0);
    expect(states[states.length - 1].conducting).toBe(true);
  });

  it('can be switched on by hand from the properties panel', async () => {
    // The pin is low, so only the panel switch can be closing this.
    const recording = await run(
      DRIVE('LOW'),
      [
        baseResistor(),
        loadResistor(),
        transistor('transistor-npn', { on: true }),
        led(),
      ],
      NPN_WIRES,
      800
    );

    expect(peakBrightness(recording, 'led-1')).toBeGreaterThan(0.2);
  });

  it('answers to the base the other way round when it is a PNP', async () => {
    // A PNP conducts when its base is pulled below the emitter, so the same
    // circuit that switches an NPN on with a high pin leaves a PNP off.
    const lit = await run(
      DRIVE('HIGH'),
      [baseResistor(), loadResistor(), transistor('transistor-pnp'), led()],
      NPN_WIRES,
      800
    );

    expect(peakBrightness(lit, 'led-1')).toBeLessThan(0.05);
  });
});

describe('current flow', () => {
  const LIT_WIRES = [
    wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'resistor-1', 'pin1'),
    wire('w2', 'resistor-1', 'pin2', 'led-1', 'anode'),
    wire('w3', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
  ];

  const DRIVE = (level: 'HIGH' | 'LOW') => `
void setup() {
  pinMode(9, OUTPUT);
  digitalWrite(9, ${level});
}

void loop() {
  delay(50);
}
`;

  /** The last set of cable currents the runtime published. */
  const lastFlow = (recording: Recording): Record<string, number> =>
    recording.wireFlow[recording.wireFlow.length - 1] ?? {};

  it('runs current through every cable of a lit circuit', async () => {
    const recording = await run(DRIVE('HIGH'), [resistor(), led()], LIT_WIRES, 800);
    const flow = lastFlow(recording);

    for (const id of ['w1', 'w2', 'w3']) {
      expect(Math.abs(flow[id] ?? 0)).toBeGreaterThan(0);
    }
  });

  it('points every cable the same way round the loop', async () => {
    // Each cable is written pin-first along the path out of the board and back
    // to ground, so a circuit traced from the supply runs positive throughout.
    const recording = await run(DRIVE('HIGH'), [resistor(), led()], LIT_WIRES, 800);
    const flow = lastFlow(recording);

    expect(flow.w1).toBeGreaterThan(0);
    expect(flow.w2).toBeGreaterThan(0);
    expect(flow.w3).toBeGreaterThan(0);
  });

  it('turns the other way when the cable is written the other way', async () => {
    const reversed = [
      wire('w1', 'resistor-1', 'pin1', ARDUINO_COMPONENT_ID, 'D9'),
      wire('w2', 'resistor-1', 'pin2', 'led-1', 'anode'),
      wire('w3', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
    ];
    const recording = await run(DRIVE('HIGH'), [resistor(), led()], reversed, 800);
    const flow = lastFlow(recording);

    // Same circuit, same direction on the bench — the sign follows the points
    // the wire is drawn with, which is what the canvas animates along.
    expect(flow.w1).toBeLessThan(0);
    expect(flow.w2).toBeGreaterThan(0);
  });

  it('reports nothing while the pin is low', async () => {
    const recording = await run(DRIVE('LOW'), [resistor(), led()], LIT_WIRES, 800);
    const flow = lastFlow(recording);

    for (const id of ['w1', 'w2', 'w3']) {
      expect(Math.abs(flow[id] ?? 0)).toBeLessThan(1e-6);
    }
  });

  it('reports nothing when the circuit is not closed', async () => {
    const open = [
      wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'resistor-1', 'pin1'),
      wire('w2', 'resistor-1', 'pin2', 'led-1', 'anode'),
    ];
    const recording = await run(DRIVE('HIGH'), [resistor(), led()], open, 800);
    const flow = lastFlow(recording);

    expect(Math.abs(flow.w1 ?? 0)).toBeLessThan(1e-6);
    expect(Math.abs(flow.w2 ?? 0)).toBeLessThan(1e-6);
  });

  it('carries more current through a smaller resistor', async () => {
    const small = await run(DRIVE('HIGH'), [resistor(), led()], LIT_WIRES, 800);
    const large = await run(
      DRIVE('HIGH'),
      [{ ...resistor(), properties: { resistance: 10000, unit: 'ohm' } }, led()],
      LIT_WIRES,
      800
    );

    expect(Math.abs(lastFlow(small).w1)).toBeGreaterThan(Math.abs(lastFlow(large).w1));
  });
});

describe('brightness follows the series resistance', () => {
  const LED_WIRES = [
    wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'resistor-1', 'pin1'),
    wire('w2', 'resistor-1', 'pin2', 'led-1', 'anode'),
    wire('w3', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
  ];

  const ON = `
void setup() {
  pinMode(9, OUTPUT);
  digitalWrite(9, HIGH);
}

void loop() {
  delay(50);
}
`;

  const litWith = async (ohms: number) => {
    const recording = await run(
      ON,
      [{ ...resistor(), properties: { resistance: ohms, unit: 'ohm' } }, led()],
      LED_WIRES,
      800
    );
    return peakBrightness(recording, 'led-1');
  };

  it('runs a 220 ohm circuit at full brightness', async () => {
    // The resistor everybody reaches for should look properly lit.
    expect(await litWith(220)).toBeGreaterThan(0.9);
  });

  it('dims noticeably at a kilohm', async () => {
    const bright = await litWith(220);
    const dim = await litWith(1000);

    expect(dim).toBeLessThan(bright * 0.6);
    expect(dim).toBeGreaterThan(0.05);
  });

  it('barely lights at ten kilohm', async () => {
    const faint = await litWith(10000);

    expect(faint).toBeLessThan(0.15);
    expect(faint).toBeGreaterThan(0);
  });

  it('falls off as the resistance climbs, every step of the way', async () => {
    const readings = [];
    for (const ohms of [220, 470, 1000, 4700, 10000]) {
      readings.push(await litWith(ohms));
    }

    for (let i = 1; i < readings.length; i += 1) {
      expect(readings[i]).toBeLessThan(readings[i - 1]);
    }
  });

  it('dims as a potentiometer in series is turned up', async () => {
    // The knob wired as a rheostat: pin1 in, wiper out, and the track between
    // them is the resistance the LED sees.
    const pot = (position: number): CircuitComponent => ({
      id: 'pot-1',
      type: 'potentiometer',
      x: 200,
      y: 300,
      rotation: 0,
      pins: [
        { id: 'pin1', name: 'Pin 1', type: 'passive', x: -12, y: 8 },
        { id: 'wiper', name: 'Wiper', type: 'passive', x: 0, y: 8 },
        { id: 'pin2', name: 'Pin 2', type: 'passive', x: 12, y: 8 },
      ],
      properties: { resistance: 10000, position, unit: 'ohm' },
    });

    const POT_WIRES = [
      wire('p1', ARDUINO_COMPONENT_ID, 'D9', 'pot-1', 'pin1'),
      wire('p2', 'pot-1', 'wiper', 'led-1', 'anode'),
      wire('p3', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
    ];

    const litAt = async (position: number) => {
      const recording = await run(ON, [pot(position), led()], POT_WIRES, 800);
      return peakBrightness(recording, 'led-1');
    };

    const nearlyZero = await litAt(2);
    const halfWay = await litAt(50);

    expect(nearlyZero).toBeGreaterThan(halfWay);
  });
});

describe('INPUT_PULLUP', () => {
  const button = (pressed: boolean): CircuitComponent => ({
    id: 'btn-1',
    type: 'button',
    x: 300,
    y: 200,
    rotation: 0,
    pins: [
      { id: 'pin1', name: 'Pin 1', type: 'passive', x: 15, y: -10 },
      { id: 'pin2', name: 'Pin 2', type: 'passive', x: 15, y: 10 },
      { id: 'pin3', name: 'Pin 3', type: 'passive', x: -15, y: -10 },
      { id: 'pin4', name: 'Pin 4', type: 'passive', x: -15, y: 10 },
    ],
    properties: { pressed, type: 'momentary' },
  });

  // The wiring the pull-up exists for: no resistor, just the switch to ground.
  const WIRES = [
    wire('w1', ARDUINO_COMPONENT_ID, 'D7', 'btn-1', 'pin1'),
    wire('w2', 'btn-1', 'pin3', ARDUINO_COMPONENT_ID, 'GND'),
  ];

  const SKETCH = (mode: string) => `
void setup() {
  pinMode(7, ${mode});
  Serial.begin(9600);
}

void loop() {
  Serial.println(digitalRead(7));
  delay(60);
}
`;

  const lastRead = (recording: Recording): number => {
    const values = recording.serial
      .map((line) => Number(line.trim()))
      .filter((value) => Number.isFinite(value));
    return values[values.length - 1] ?? -1;
  };

  it('reads high with the button open', async () => {
    const recording = await run(SKETCH('INPUT_PULLUP'), [button(false)], WIRES, 800);
    expect(lastRead(recording)).toBe(1);
  });

  it('reads low with the button pressed', async () => {
    const recording = await run(SKETCH('INPUT_PULLUP'), [button(true)], WIRES, 800);
    expect(lastRead(recording)).toBe(0);
  });

  it('follows the button as it is pressed and let go', async () => {
    const open = await run(SKETCH('INPUT_PULLUP'), [button(false)], WIRES, 700);
    const closed = await run(SKETCH('INPUT_PULLUP'), [button(true)], WIRES, 700);

    expect(lastRead(open)).toBe(1);
    expect(lastRead(closed)).toBe(0);
  });

  it('leaves a plain INPUT floating, as it really is', async () => {
    // Without the pull-up there is nothing holding the pin up, so an open
    // switch reads low — which is exactly why the pull-up is wanted.
    const recording = await run(SKETCH('INPUT'), [button(false)], WIRES, 700);
    expect(lastRead(recording)).toBe(0);
  });
});

describe('transistor, wired every way round', () => {
  const npn = (properties: Record<string, string | number | boolean> = {}): CircuitComponent => ({
    id: 'q-1',
    type: 'transistor-npn',
    x: 260,
    y: 200,
    rotation: 0,
    pins: [
      { id: 'base', name: 'Base', type: 'passive', x: 0, y: 8 },
      { id: 'collector', name: 'Collector', type: 'passive', x: -9.5, y: 8 },
      { id: 'emitter', name: 'Emitter', type: 'passive', x: 9.5, y: 8 },
    ],
    properties: { hfe: 100, on: false, ...properties },
  });

  const baseR = (): CircuitComponent => ({ ...resistor(), id: 'rb-1' });
  const loadR = (): CircuitComponent => ({ ...resistor(), id: 'rl-1' });

  const DRIVE = (level: 'HIGH' | 'LOW') => `
void setup() {
  pinMode(9, OUTPUT);
  digitalWrite(9, ${level});
}

void loop() {
  delay(50);
}
`;

  // Load above the transistor: 5V -> resistor -> LED -> collector, emitter to GND.
  const LOW_SIDE = [
    wire('a1', ARDUINO_COMPONENT_ID, 'D9', 'rb-1', 'pin1'),
    wire('a2', 'rb-1', 'pin2', 'q-1', 'base'),
    wire('a3', ARDUINO_COMPONENT_ID, '5V', 'rl-1', 'pin1'),
    wire('a4', 'rl-1', 'pin2', 'led-1', 'anode'),
    wire('a5', 'led-1', 'cathode', 'q-1', 'collector'),
    wire('a6', 'q-1', 'emitter', ARDUINO_COMPONENT_ID, 'GND'),
  ];

  // Load below it: collector to 5V, emitter -> resistor -> LED -> GND.
  const EMITTER_FOLLOWER = [
    wire('b1', ARDUINO_COMPONENT_ID, 'D9', 'rb-1', 'pin1'),
    wire('b2', 'rb-1', 'pin2', 'q-1', 'base'),
    wire('b3', ARDUINO_COMPONENT_ID, '5V', 'q-1', 'collector'),
    wire('b4', 'q-1', 'emitter', 'rl-1', 'pin1'),
    wire('b5', 'rl-1', 'pin2', 'led-1', 'anode'),
    wire('b6', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
  ];

  const lit = async (
    wires: Wire[],
    level: 'HIGH' | 'LOW',
    properties: Record<string, string | number | boolean> = {}
  ) => {
    const recording = await run(
      DRIVE(level),
      [baseR(), loadR(), npn(properties), led()],
      wires,
      800
    );
    return peakBrightness(recording, 'led-1');
  };

  it('switches a load on the collector', async () => {
    expect(await lit(LOW_SIDE, 'LOW')).toBeLessThan(0.05);
    expect(await lit(LOW_SIDE, 'HIGH')).toBeGreaterThan(0.2);
  });

  it('switches a load on the emitter', async () => {
    expect(await lit(EMITTER_FOLLOWER, 'LOW')).toBeLessThan(0.05);
    expect(await lit(EMITTER_FOLLOWER, 'HIGH')).toBeGreaterThan(0.2);
  });

  it('switches by hand whichever way the load is wired', async () => {
    // The pin is low, so only the panel switch can be closing these.
    expect(await lit(LOW_SIDE, 'LOW', { on: true })).toBeGreaterThan(0.2);
    expect(await lit(EMITTER_FOLLOWER, 'LOW', { on: true })).toBeGreaterThan(0.2);
  });

  it('carries a current of its own once it is conducting', async () => {
    const recording = await new Promise<Recording>((resolve) => {
      const captured: Recording = {
        pinStates: [], serial: [], led: [], ledById: [],
        componentStates: [], wireFlow: [],
      };

      startMockArduinoRuntime(
        DRIVE('HIGH'),
        [baseR(), loadR(), npn(), led()],
        LOW_SIDE,
        BOARD_PINS,
        5,
        {
          addSerialOutput: () => {},
          pushOscilloscopeSample: () => {},
          setLedState: () => {},
          clearLedStates: () => {},
          setComponentState: () => {},
          clearComponentStates: () => {},
          setPinStates: () => {},
          setWireFlow: (flow) => captured.wireFlow.push({ ...flow }),
        }
      );

      setTimeout(() => {
        stopMockArduinoRuntime();
        resolve(captured);
      }, 800);
    });

    const last = recording.wireFlow[recording.wireFlow.length - 1] ?? {};
    // The cables feeding the collector and leaving the emitter both run.
    expect(Math.abs(last.a5 ?? 0)).toBeGreaterThan(0);
    expect(Math.abs(last.a6 ?? 0)).toBeGreaterThan(0);
  });
});

describe('current flow, every branch of it', () => {
  const secondResistor = (): CircuitComponent => ({ ...resistor(), id: 'resistor-2' });
  const secondLed = (): CircuitComponent => ({ ...led(), id: 'led-2' });

  // One pin feeding two branches that rejoin at ground: the shape where a walk
  // that only ever finds one route back leaves half the circuit dark.
  const PARALLEL = [
    wire('p1', ARDUINO_COMPONENT_ID, 'D9', 'resistor-1', 'pin1'),
    wire('p2', 'resistor-1', 'pin2', 'led-1', 'anode'),
    wire('p3', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
    wire('p4', ARDUINO_COMPONENT_ID, 'D9', 'resistor-2', 'pin1'),
    wire('p5', 'resistor-2', 'pin2', 'led-2', 'anode'),
    wire('p6', 'led-2', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
  ];

  const flowOf = async (components: CircuitComponent[], wires: Wire[]) => {
    const seen: Array<Record<string, number>> = [];

    await new Promise<void>((resolve) => {
      startMockArduinoRuntime(
        `void setup() { pinMode(9, OUTPUT); digitalWrite(9, HIGH); }
         void loop() { delay(50); }`,
        components,
        wires,
        BOARD_PINS,
        5,
        {
          addSerialOutput: () => {},
          pushOscilloscopeSample: () => {},
          setLedState: () => {},
          clearLedStates: () => {},
          setComponentState: () => {},
          clearComponentStates: () => {},
          setPinStates: () => {},
          setWireFlow: (flow) => seen.push({ ...flow }),
        }
      );

      setTimeout(() => {
        stopMockArduinoRuntime();
        resolve();
      }, 800);
    });

    return seen[seen.length - 1] ?? {};
  };

  it('runs current in both branches, not just the one it found first', async () => {
    const flow = await flowOf(
      [resistor(), secondResistor(), led(), secondLed()],
      PARALLEL
    );

    for (const id of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) {
      expect(Math.abs(flow[id] ?? 0)).toBeGreaterThan(0);
    }
  });

  it('still leaves a branch that is switched off alone', async () => {
    // Only the first branch is fed; the second shares the ground net but has
    // nothing driving it, so its ground lead carries nothing.
    const oneFed = [
      wire('p1', ARDUINO_COMPONENT_ID, 'D9', 'resistor-1', 'pin1'),
      wire('p2', 'resistor-1', 'pin2', 'led-1', 'anode'),
      wire('p3', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
      wire('p5', 'resistor-2', 'pin2', 'led-2', 'anode'),
      wire('p6', 'led-2', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
    ];

    const flow = await flowOf(
      [resistor(), secondResistor(), led(), secondLed()],
      oneFed
    );

    expect(Math.abs(flow.p3 ?? 0)).toBeGreaterThan(0);
    expect(Math.abs(flow.p6 ?? 0)).toBeLessThan(1e-6);
  });
});

describe('the meter as an ammeter', () => {
  const meter = (
    mode: string,
    red: [string, string] | null,
    black: [string, string] | null
  ): CircuitComponent => ({
    id: 'meter-1',
    type: 'multimeter',
    x: 400,
    y: 300,
    rotation: 0,
    pins: [],
    properties: {
      mode,
      autoRange: true,
      ...(red
        ? { redProbeTargetComponentId: red[0], redProbeTargetPinId: red[1] }
        : {}),
      ...(black
        ? { blackProbeTargetComponentId: black[0], blackProbeTargetPinId: black[1] }
        : {}),
    },
  });

  const ON = `
void setup() {
  pinMode(9, OUTPUT);
  digitalWrite(9, HIGH);
}

void loop() {
  delay(50);
}
`;

  /** The gap in the circuit the meter is meant to fill: pin to resistor. */
  const BROKEN = [
    wire('m2', 'resistor-1', 'pin2', 'led-1', 'anode'),
    wire('m3', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
  ];

  const readingOf = (recording: Recording) => {
    const states = statesOf(recording, 'meter-1').filter((state) => 'displayText' in state);
    return states[states.length - 1] ?? null;
  };

  it('reads the current when it bridges the gap in the circuit', async () => {
    // Red on the pin, black on the resistor: the meter completes the loop.
    const recording = await run(
      ON,
      [resistor(), led(), meter('current', [ARDUINO_COMPONENT_ID, 'D9'], ['resistor-1', 'pin1'])],
      BROKEN,
      800
    );
    const state = readingOf(recording);

    expect(state).not.toBeNull();
    expect(state!.status).toBe('ready');
    // Roughly (5 - 2) / (220 + 68) in milliamps.
    expect(Number(state!.reading)).toBeGreaterThan(8);
    expect(Number(state!.reading)).toBeLessThan(13);
  });

  it('lights the LED it is standing in for', async () => {
    const recording = await run(
      ON,
      [resistor(), led(), meter('current', [ARDUINO_COMPONENT_ID, 'D9'], ['resistor-1', 'pin1'])],
      BROKEN,
      800
    );

    expect(peakBrightness(recording, 'led-1')).toBeGreaterThan(0.5);
  });

  it('reads OPEN with only one probe clipped on', async () => {
    const recording = await run(
      ON,
      [resistor(), led(), meter('current', [ARDUINO_COMPONENT_ID, 'D9'], null)],
      BROKEN,
      800
    );
    const state = readingOf(recording);

    expect(state!.displayText).toBe('OPEN');
  });

  it('reads nothing while the circuit around it is dead', async () => {
    const recording = await run(
      `void setup() { pinMode(9, OUTPUT); digitalWrite(9, LOW); }
       void loop() { delay(50); }`,
      [resistor(), led(), meter('current', [ARDUINO_COMPONENT_ID, 'D9'], ['resistor-1', 'pin1'])],
      BROKEN,
      800
    );
    const state = readingOf(recording);

    expect(Math.abs(Number(state!.reading))).toBeLessThan(0.5);
  });

  it('leaves the other modes alone', async () => {
    // Voltage mode still measures across two points without joining them.
    const WHOLE = [
      wire('v1', ARDUINO_COMPONENT_ID, 'D9', 'resistor-1', 'pin1'),
      ...BROKEN,
    ];
    const recording = await run(
      ON,
      [resistor(), led(), meter('voltage', ['led-1', 'anode'], ['led-1', 'cathode'])],
      WHOLE,
      800
    );
    const state = readingOf(recording);

    expect(state!.status).toBe('ready');
    expect(Number(state!.reading)).toBeGreaterThan(1.5);
  });
});

describe('RGB LED', () => {
  /**
   * Each channel gets its own series resistor, the way the datasheet asks for
   * one. Driven straight off a pin an LED now draws far more than it survives,
   * so a resistor is the difference between a lit channel and a dead part.
   */
  const channelResistor = (id: string): CircuitComponent => ({
    ...resistor(),
    id,
  });

  const REDONLY_SKETCH = `
    void setup() {
      pinMode(9, OUTPUT);
      digitalWrite(9, HIGH);
    }
    void loop() { delay(50); }
  `;

  it('lights only the red channel when only its pin is driven, common cathode', async () => {
    const recording = await run(
      REDONLY_SKETCH,
      [rgbLed('cathode'), channelResistor('res-red')],
      [
        wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'res-red', 'pin1'),
        wire('w2', 'res-red', 'pin2', 'rgb-1', 'red'),
        wire('w3', 'rgb-1', 'common', ARDUINO_COMPONENT_ID, 'GND'),
      ],
      600
    );

    const states = statesOf(recording, 'rgb-1');
    expect(states.length).toBeGreaterThan(0);
    const last = states[states.length - 1];
    expect(Number(last.red)).toBeGreaterThan(200);
    expect(Number(last.green)).toBe(0);
    expect(Number(last.blue)).toBe(0);
  });

  it('lights the red channel when it is pulled low against a high common, common anode', async () => {
    const recording = await run(
      `void setup() { pinMode(9, OUTPUT); digitalWrite(9, LOW); } void loop() { delay(50); }`,
      [rgbLed('anode'), channelResistor('res-red')],
      [
        wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'res-red', 'pin1'),
        wire('w2', 'res-red', 'pin2', 'rgb-1', 'red'),
        wire('w3', 'rgb-1', 'common', ARDUINO_COMPONENT_ID, '5V'),
      ],
      600
    );

    const states = statesOf(recording, 'rgb-1');
    expect(states.length).toBeGreaterThan(0);
    const last = states[states.length - 1];
    expect(Number(last.red)).toBeGreaterThan(200);
    expect(Number(last.green)).toBe(0);
    expect(Number(last.blue)).toBe(0);
  });

  it('stays dark when nothing drives it', async () => {
    const recording = await run(
      `void setup() {} void loop() { delay(50); }`,
      [rgbLed('cathode')],
      [wire('w2', 'rgb-1', 'common', ARDUINO_COMPONENT_ID, 'GND')],
      400
    );

    const states = statesOf(recording, 'rgb-1');
    if (states.length > 0) {
      const last = states[states.length - 1];
      expect(Number(last.red)).toBe(0);
      expect(Number(last.green)).toBe(0);
      expect(Number(last.blue)).toBe(0);
    }
  });

  it('mixes two channels at once, the way a real one makes yellow', async () => {
    const recording = await run(
      `void setup() {
         pinMode(9, OUTPUT); pinMode(5, OUTPUT);
         digitalWrite(9, HIGH); digitalWrite(5, HIGH);
       }
       void loop() { delay(50); }`,
      [rgbLed('cathode'), channelResistor('res-red'), channelResistor('res-green')],
      [
        wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'res-red', 'pin1'),
        wire('w2', 'res-red', 'pin2', 'rgb-1', 'red'),
        wire('w3', ARDUINO_COMPONENT_ID, 'D5', 'res-green', 'pin1'),
        wire('w4', 'res-green', 'pin2', 'rgb-1', 'green'),
        wire('w5', 'rgb-1', 'common', ARDUINO_COMPONENT_ID, 'GND'),
      ],
      600
    );

    const states = statesOf(recording, 'rgb-1');
    const last = states[states.length - 1];
    expect(Number(last.red)).toBeGreaterThan(200);
    expect(Number(last.green)).toBeGreaterThan(200);
    expect(Number(last.blue)).toBe(0);
  });

  it('dims a channel driven by analogWrite instead of only on or off', async () => {
    const recording = await run(
      `void setup() { pinMode(9, OUTPUT); analogWrite(9, 64); }
       void loop() { delay(50); }`,
      [rgbLed('cathode')],
      [
        wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'rgb-1', 'red'),
        wire('w2', 'rgb-1', 'common', ARDUINO_COMPONENT_ID, 'GND'),
      ],
      600
    );

    const states = statesOf(recording, 'rgb-1');
    const last = states[states.length - 1];
    const red = Number(last.red);
    expect(red).toBeGreaterThan(0);
    expect(red).toBeLessThan(160);
  });

  it('stays dark when the common leg is wired backwards', async () => {
    const recording = await run(
      `void setup() { pinMode(9, OUTPUT); digitalWrite(9, LOW); }
       void loop() { delay(50); }`,
      // Common cathode, but the common leg is on 5V and the channel on a low
      // pin — a real one cannot conduct that way round.
      [rgbLed('cathode')],
      [
        wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'rgb-1', 'red'),
        wire('w2', 'rgb-1', 'common', ARDUINO_COMPONENT_ID, '5V'),
      ],
      600
    );

    const states = statesOf(recording, 'rgb-1');
    const last = states[states.length - 1];
    expect(Number(last.red)).toBe(0);
    expect(Number(last.green)).toBe(0);
    expect(Number(last.blue)).toBe(0);
  });

  it('burns out when a channel is wired across a battery with no resistor', async () => {
    const recording = await run(
      `void setup() {} void loop() { delay(50); }`,
      [rgbLed('cathode'), battery()],
      [
        wire('w1', 'battery-1', 'positive', 'rgb-1', 'red'),
        wire('w2', 'rgb-1', 'common', 'battery-1', 'negative'),
      ],
      600
    );

    const damaged = statesOf(recording, 'rgb-1').some((state) => state.damaged === true);
    expect(damaged).toBe(true);
  });
});

describe('runtime error resilience', () => {
  it('reports a statement that throws instead of letting it escape the runtime', async () => {
    let addSerialOutputCalls = 0;
    let reportedError: string | null = null;
    let escaped = false;

    const code = `
      void setup() {
        Serial.begin(9600);
        Serial.println("hi");
      }
      void loop() { delay(50); }
    `;

    try {
      await new Promise<void>((resolve) => {
        startMockArduinoRuntime(code, [], [], BOARD_PINS, 5, {
          // Fails once, on the statement that first touches the serial
          // output — exactly the kind of mid-statement blow-up the runtime's
          // own try/catch exists to contain. Failing only once (not on every
          // call) also lets the runtime's own error-reporting line, a couple
          // of frames down, succeed normally.
          addSerialOutput: () => {
            addSerialOutputCalls += 1;
            if (addSerialOutputCalls === 1) {
              throw new Error('boom');
            }
          },
          pushOscilloscopeSample: () => {},
          setLedState: () => {},
          clearLedStates: () => {},
          setComponentState: () => {},
          clearComponentStates: () => {},
          setPinStates: () => {},
          reportRuntimeError: (message) => {
            reportedError = message;
          },
        });
        setTimeout(resolve, 300);
      });
    } catch {
      escaped = true;
    }

    expect(escaped).toBe(false);
    expect(reportedError).toBe('boom');
  });
});

describe('findSketchCompileError', () => {
  it('accepts a normal sketch', () => {
    expect(findSketchCompileError(BLINK)).toBeNull();
  });

  it('flags an unclosed brace', () => {
    const error = findSketchCompileError(`
      void setup() {
        Serial.begin(9600);
    `);
    expect(error?.reason).toBe('unbalanced-brace');
  });

  it('flags an unclosed paren', () => {
    const error = findSketchCompileError(`
      void setup() {}
      void loop() {
        if (true
      }
    `);
    expect(error?.reason).toBe('unbalanced-paren');
  });

  it('rejects while loops', () => {
    const error = findSketchCompileError(`
      void setup() {}
      void loop() { while (true) { delay(1); } }
    `);
    expect(error?.reason).toBe('unsupported-while');
  });

  it('rejects do...while loops', () => {
    const error = findSketchCompileError(`
      void setup() {}
      void loop() { do { delay(1); } while (true); }
    `);
    expect(error?.reason).toBe('unsupported-do-while');
  });

  it('rejects switch statements', () => {
    const error = findSketchCompileError(`
      void setup() {}
      void loop() { switch (1) { } }
    `);
    expect(error?.reason).toBe('unsupported-switch');
  });

  it('flags an empty if condition', () => {
    const error = findSketchCompileError(`
      void setup() {}
      void loop() { if () { delay(1); } }
    `);
    expect(error?.reason).toBe('empty-if-condition');
  });

  it('flags an expression left hanging on an operator', () => {
    const error = findSketchCompileError(`
      void setup() { int x = 5 +; }
      void loop() { delay(1); }
    `);
    expect(error?.reason).toBe('dangling-operator');
  });

  it('reports the file-accurate line number for an error nested two levels deep', () => {
    const code = [
      'void setup() {',
      '}',
      '',
      'void loop() {',
      '  for (int i = 0; i < 3; i++) {',
      '    while (true) {',
      '      delay(1);',
      '    }',
      '  }',
      '}',
    ].join('\n');

    const error = findSketchCompileError(code);
    expect(error?.reason).toBe('unsupported-while');
    expect(error?.line).toBe(6);
  });

  // The tokenizer has no compound `++`/`--` token — `i++` is two adjacent `+`
  // operator tokens — so the dangling-operator check must special-case this,
  // or every ordinary for-loop would be flagged. This is the single highest-
  // risk regression for this feature; if it ever fails, nothing should ship.
  it('does not flag a for-loop postfix increment as a dangling operator', () => {
    const error = findSketchCompileError(`
      void setup() {}
      void loop() {
        for (int i = 0; i < 5; i++) {
          Serial.println(i);
        }
      }
    `);
    expect(error).toBeNull();
  });

  it('does not flag compound assignment (+=) as a dangling operator', () => {
    const error = findSketchCompileError(`
      void setup() {}
      void loop() {
        int x = 0;
        x += 5;
        delay(1);
      }
    `);
    expect(error).toBeNull();
  });
});

describe('getCircuitWiringIssues', () => {
  it('flags a battery wired straight from + to -', () => {
    const issues = getCircuitWiringIssues(
      [battery()],
      [wire('w1', 'battery-1', 'positive', 'battery-1', 'negative')],
      BOARD_PINS
    );
    expect(issues).toContainEqual(expect.objectContaining({ type: 'dead-short' }));
  });

  it('flags an LED with no wires at all as floating', () => {
    const issues = getCircuitWiringIssues([led()], [], BOARD_PINS);
    expect(issues).toContainEqual({ type: 'floating-part', componentId: 'led-1' });
  });

  it('flags an LED wired straight to a battery with no resistor', () => {
    const issues = getCircuitWiringIssues(
      [battery(), led()],
      [
        wire('w1', 'battery-1', 'positive', 'led-1', 'anode'),
        wire('w2', 'led-1', 'cathode', 'battery-1', 'negative'),
      ],
      BOARD_PINS
    );
    expect(issues).toContainEqual({ type: 'part-no-resistor', componentId: 'led-1' });
  });

  it('flags an LED wired straight to a digital pin with no resistor, polarity-agnostic', () => {
    const issues = getCircuitWiringIssues(
      [led()],
      [
        wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'led-1', 'anode'),
        wire('w2', 'led-1', 'cathode', ARDUINO_COMPONENT_ID, 'GND'),
      ],
      BOARD_PINS
    );
    expect(issues).toContainEqual({ type: 'part-no-resistor', componentId: 'led-1' });
  });

  it('does not flag an LED wired through a resistor', () => {
    const issues = getCircuitWiringIssues(
      [battery(), resistor(), led()],
      [
        wire('w1', 'battery-1', 'positive', 'resistor-1', 'pin1'),
        wire('w2', 'resistor-1', 'pin2', 'led-1', 'anode'),
        wire('w3', 'led-1', 'cathode', 'battery-1', 'negative'),
      ],
      BOARD_PINS
    );
    expect(issues).toEqual([]);
  });

  it('raises no issues for an unwired battery sitting alone on the canvas', () => {
    const issues = getCircuitWiringIssues([battery()], [], BOARD_PINS);
    expect(issues).toEqual([]);
  });

  // Parts pushed into breadboard holes conduct through them, so a circuit
  // built on the board rather than with drawn wires is a real circuit.
  describe('parts seated in the breadboard', () => {
    // Column N of row A sits at x = 80 + (N - 1) * HOLE_SP, y = 286.
    const holeX = (column: number) => 80 + (column - 1) * HOLE_SP;
    const ROW_A_Y = 286;

    /** The board itself; it is an ordinary component in the parts list now. */
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

    const seatedResistor = (fromColumn: number, toColumn: number): CircuitComponent => ({
      ...resistor(),
      x: holeX(fromColumn),
      y: ROW_A_Y,
      pins: [
        { id: 'pin1', name: 'Pin 1', type: 'passive', x: 0, y: 0 },
        { id: 'pin2', name: 'Pin 2', type: 'passive', x: holeX(toColumn) - holeX(fromColumn), y: 0 },
      ],
    });

    const seatedLed = (fromColumn: number, toColumn: number): CircuitComponent => ({
      ...led(),
      x: holeX(fromColumn),
      y: ROW_A_Y,
      pins: [
        { id: 'anode', name: 'Anode (+)', type: 'passive', x: 0, y: 0 },
        { id: 'cathode', name: 'Cathode (-)', type: 'passive', x: holeX(toColumn) - holeX(fromColumn), y: 0 },
      ],
    });

    it('lets a resistor plugged into the board limit the current', () => {
      const issues = getCircuitWiringIssues(
        [board(), seatedResistor(1, 5), seatedLed(5, 10)],
        [
          wire('w1', ARDUINO_COMPONENT_ID, 'D9', BREADBOARD_COMPONENT_ID, 'bb-b-1'),
          wire('w2', BREADBOARD_COMPONENT_ID, 'bb-b-10', ARDUINO_COMPONENT_ID, 'GND'),
        ],
        BOARD_PINS
      );
      expect(issues).toEqual([]);
    });

    it('flags the LED again once it is lifted off the board', () => {
      const issues = getCircuitWiringIssues(
        [board(), seatedResistor(1, 5), { ...seatedLed(5, 10), x: 900, y: 900 }],
        [
          wire('w1', ARDUINO_COMPONENT_ID, 'D9', BREADBOARD_COMPONENT_ID, 'bb-b-1'),
          wire('w2', BREADBOARD_COMPONENT_ID, 'bb-b-10', ARDUINO_COMPONENT_ID, 'GND'),
        ],
        BOARD_PINS
      );
      expect(issues).toContainEqual({ type: 'floating-part', componentId: 'led-1' });
    });

    it('flags an LED seated straight across the supply with no resistor', () => {
      const issues = getCircuitWiringIssues(
        [board(), seatedLed(1, 10)],
        [
          wire('w1', ARDUINO_COMPONENT_ID, 'D9', BREADBOARD_COMPONENT_ID, 'bb-b-1'),
          wire('w2', BREADBOARD_COMPONENT_ID, 'bb-b-10', ARDUINO_COMPONENT_ID, 'GND'),
        ],
        BOARD_PINS
      );
      expect(issues).toContainEqual({ type: 'part-no-resistor', componentId: 'led-1' });
    });

    /**
     * The way this actually gets built: the resistor bridges from a cable into
     * the board, so one leg is in a hole and the other is in the air with a
     * wire on it. Only the seated leg has a breadboard contact.
     */
    const halfSeatedResistor = (): CircuitComponent => ({
      ...resistor(),
      x: holeX(1),
      y: ROW_A_Y,
      pins: [
        { id: 'pin1', name: 'Pin 1', type: 'passive', x: 0, y: 0 },
        { id: 'pin2', name: 'Pin 2', type: 'passive', x: -400, y: -120 },
      ],
    });

    /** Seated in row B so it shares column 1's strip without fighting for the hole. */
    const ledFromRowB = (): CircuitComponent => ({
      ...led(),
      x: holeX(1),
      y: ROW_A_Y + HOLE_SP,
      pins: [
        { id: 'anode', name: 'Anode (+)', type: 'passive', x: 0, y: 0 },
        { id: 'cathode', name: 'Cathode (-)', type: 'passive', x: holeX(10) - holeX(1), y: 0 },
      ],
    });

    const HALF_SEATED_WIRES = [
      wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'resistor-1', 'pin2'),
      wire('w2', BREADBOARD_COMPONENT_ID, 'bb-c-10', ARDUINO_COMPONENT_ID, 'GND'),
    ];

    it('conducts through a resistor with one leg in a hole and one leg wired', () => {
      const issues = getCircuitWiringIssues(
        [board(), halfSeatedResistor(), ledFromRowB()],
        HALF_SEATED_WIRES,
        BOARD_PINS
      );
      expect(issues).toEqual([]);
    });

    it('lights the LED fed through a half-seated resistor', async () => {
      const recording = await run(
        `
void setup() {
  pinMode(9, OUTPUT);
}

void loop() {
  digitalWrite(9, HIGH);
  delay(50);
}
`,
        [board(), halfSeatedResistor(), ledFromRowB()],
        HALF_SEATED_WIRES,
        900
      );

      expect(peakBrightness(recording, 'led-1')).toBeGreaterThan(0.05);
    });

    it('follows the breadboard when it is moved', () => {
      const moved = { x: 160, y: 340 };
      const shift = (component: CircuitComponent): CircuitComponent => ({
        ...component,
        x: component.x + (moved.x - BB_X),
        y: component.y + (moved.y - BB_Y),
      });

      const issues = getCircuitWiringIssues(
        [board({ x: moved.x, y: moved.y }), shift(seatedResistor(1, 5)), shift(seatedLed(5, 10))],
        [
          wire('w1', ARDUINO_COMPONENT_ID, 'D9', BREADBOARD_COMPONENT_ID, 'bb-b-1'),
          wire('w2', BREADBOARD_COMPONENT_ID, 'bb-b-10', ARDUINO_COMPONENT_ID, 'GND'),
        ],
        BOARD_PINS
      );
      expect(issues).toEqual([]);
    });

    it('keeps two boards apart, hole ids and all', () => {
      // Both boards have a `bb-a-1`; only the parts on the same board should
      // end up in one circuit.
      const secondBoard = board({ id: 'board-2', x: BB_X, y: BB_Y + 400 });
      const drop = (component: CircuitComponent): CircuitComponent => ({
        ...component,
        id: `${component.id}-2`,
        y: component.y + 400,
      });

      const issues = getCircuitWiringIssues(
        [
          board(),
          secondBoard,
          seatedResistor(1, 5),
          seatedLed(5, 10),
          drop(seatedLed(20, 25)),
        ],
        [
          wire('w1', ARDUINO_COMPONENT_ID, 'D9', BREADBOARD_COMPONENT_ID, 'bb-b-1'),
          wire('w2', BREADBOARD_COMPONENT_ID, 'bb-b-10', ARDUINO_COMPONENT_ID, 'GND'),
        ],
        BOARD_PINS
      );

      // The LED on the first board is powered through the resistor; the one on
      // the second board is on its own, however identical its hole ids look.
      expect(issues).toEqual([{ type: 'floating-part', componentId: 'led-1-2' }]);
    });
  });
});

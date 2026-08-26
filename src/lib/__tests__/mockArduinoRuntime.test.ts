import { afterEach, describe, expect, it } from 'vitest';
import { startMockArduinoRuntime, stopMockArduinoRuntime } from '../mockArduinoRuntime';
import { ARDUINO_COMPONENT_ID } from '../../models/arduinoUno';
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
  componentStates: ComponentStateEntry[];
};

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
      componentStates: [],
    };

    startMockArduinoRuntime(code, components, wires, BOARD_PINS, 5, {
      addSerialOutput: (text) => recording.serial.push(text),
      pushOscilloscopeSample: () => {},
      setLedState: (_id, on, brightness) => recording.led.push({ on, brightness }),
      clearLedStates: () => {},
      setComponentState: (id, state) => recording.componentStates.push({ id, state: { ...state } }),
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

describe('RGB LED', () => {
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
      [rgbLed('cathode')],
      [
        wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'rgb-1', 'red'),
        wire('w2', 'rgb-1', 'common', ARDUINO_COMPONENT_ID, 'GND'),
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
      [rgbLed('anode')],
      [
        wire('w1', ARDUINO_COMPONENT_ID, 'D9', 'rgb-1', 'red'),
        wire('w2', 'rgb-1', 'common', ARDUINO_COMPONENT_ID, '5V'),
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

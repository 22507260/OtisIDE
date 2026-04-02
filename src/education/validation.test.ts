import { test, expect } from 'vitest';
import { ledBlinkLesson } from './lessonLedBlink';
import { buttonInputLesson } from './lessonButtonInput';
import { evaluateLessonStep } from './validation';
import { LESSON_REF_PROPERTY } from './types';
import type {
  CircuitComponent,
  Pin,
  SimulationState,
  ComponentType,
} from '../models/types';

const createComponent = (
  id: string,
  type: ComponentType,
  lessonRef: string,
  pins: Pin[]
): CircuitComponent => ({
  id,
  type,
  x: 200,
  y: 200,
  rotation: 0,
  pins,
  properties: {
    [LESSON_REF_PROPERTY]: lessonRef,
  },
});

const led1 = createComponent('led-a', 'led', 'led1', [
  { id: 'anode', name: 'Anode', type: 'passive', x: 0, y: -20 },
  { id: 'cathode', name: 'Cathode', type: 'passive', x: 0, y: 20 },
]);

const res1 = createComponent('res-a', 'resistor', 'res1', [
  { id: 'pin1', name: 'Pin 1', type: 'passive', x: -25, y: 0 },
  { id: 'pin2', name: 'Pin 2', type: 'passive', x: 25, y: 0 },
]);

const button1 = createComponent('btn-a', 'button', 'button1', [
  { id: 'pin1', name: 'Pin 1', type: 'passive', x: -15, y: -10 },
  { id: 'pin2', name: 'Pin 2', type: 'passive', x: 15, y: -10 },
]);

const emptySimulation: SimulationState = {
  running: false,
  pinStates: {},
  ledStates: {},
  componentStates: {},
  serialOutput: [],
  oscilloscopeTraces: {},
};

test('lesson validation catches a missing resistor in the LED lesson', () => {
  const step = ledBlinkLesson.steps[0];

  const results = evaluateLessonStep(
    ledBlinkLesson,
    step,
    {
      components: [led1],
      wires: [],
      code: 'void setup() {}\nvoid loop() {}\n',
      boardType: 'uno',
      simulation: emptySimulation,
    },
    'en'
  );

  const resistorCheck = results.find((result) => result.checkId === 'resistor-present');
  expect(resistorCheck).toBeTruthy();
  expect(resistorCheck?.status).toBe('fail');
});

test('lesson validation marks wrong LED wiring as a hint', () => {
  const step = ledBlinkLesson.steps[1];

  const results = evaluateLessonStep(
    ledBlinkLesson,
    step,
    {
      components: [led1, res1],
      wires: [
        {
          id: 'wire-1',
          startComponentId: 'arduino-uno-fixed',
          startPinId: 'D12',
          endComponentId: 'res-a',
          endPinId: 'pin1',
          color: '#e74c3c',
          points: [0, 0, 1, 1],
        },
        {
          id: 'wire-2',
          startComponentId: 'res-a',
          startPinId: 'pin2',
          endComponentId: 'led-a',
          endPinId: 'anode',
          color: '#f1c40f',
          points: [0, 0, 1, 1],
        },
        {
          id: 'wire-3',
          startComponentId: 'led-a',
          startPinId: 'cathode',
          endComponentId: 'arduino-uno-fixed',
          endPinId: 'GND',
          color: '#2c3e50',
          points: [0, 0, 1, 1],
        },
      ],
      code: 'void setup() {}\nvoid loop() {}\n',
      boardType: 'uno',
      simulation: emptySimulation,
    },
    'en'
  );

  const pinCheck = results.find((result) => result.checkId === 'd13-to-resistor');
  expect(pinCheck).toBeTruthy();
  expect(pinCheck?.status).toBe('hint');
});

test('lesson validation catches missing Serial.begin in the button lesson', () => {
  const step = buttonInputLesson.steps[2];
  const results = evaluateLessonStep(
    buttonInputLesson,
    step,
    {
      components: [button1, res1],
      wires: [
        {
          id: 'wire-4',
          startComponentId: 'arduino-uno-fixed',
          startPinId: '5V',
          endComponentId: 'btn-a',
          endPinId: 'pin1',
          color: '#e67e22',
          points: [0, 0, 1, 1],
        },
        {
          id: 'wire-5',
          startComponentId: 'btn-a',
          startPinId: 'pin2',
          endComponentId: 'arduino-uno-fixed',
          endPinId: 'D2',
          color: '#3498db',
          points: [0, 0, 1, 1],
        },
        {
          id: 'wire-6',
          startComponentId: 'btn-a',
          startPinId: 'pin2',
          endComponentId: 'res-a',
          endPinId: 'pin1',
          color: '#f1c40f',
          points: [0, 0, 1, 1],
        },
        {
          id: 'wire-7',
          startComponentId: 'res-a',
          startPinId: 'pin2',
          endComponentId: 'arduino-uno-fixed',
          endPinId: 'GND',
          color: '#2c3e50',
          points: [0, 0, 1, 1],
        },
      ],
      code: `void setup() {
  pinMode(2, INPUT);
}

void loop() {
  int buttonState = digitalRead(2);
  Serial.println(buttonState);
}
`,
      boardType: 'uno',
      simulation: emptySimulation,
    },
    'en'
  );

  const serialCheck = results.find(
    (result) => result.checkId === 'button-serial-begin'
  );
  expect(serialCheck).toBeTruthy();
  expect(serialCheck?.status).toBe('fail');
});

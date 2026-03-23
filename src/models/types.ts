import { v4 as uuidv4 } from 'uuid';
import { applySvgPinLayout } from './componentGeometry';

// ===== Component Types =====
export type ComponentType =
  | 'led'
  | 'resistor'
  | 'capacitor'
  | 'diode'
  | 'button'
  | 'switch'
  | 'potentiometer'
  | 'joystick'
  | 'buzzer'
  | 'servo'
  | 'dc-motor'
  | 'rgb-led'
  | 'ldr'
  | 'lm35'
  | 'dht11'
  | 'pir-sensor'
  | 'flame-sensor'
  | 'mq2'
  | 'hc-05'
  | 'oled-i2c'
  | 'rc522'
  | 'keypad-4x4'
  | 'stepper-28byj48'
  | 'l298n-driver'
  | 'vl53l0x'
  | 'reed-switch-module'
  | 'breadboard-power-supply'
  | 'acs712'
  | 'logic-level-converter'
  | 'rf-433-receiver'
  | 'sound-sensor'
  | 'tm1637'
  | 'uln2003-driver'
  | 'rf-433-transmitter'
  | 'ds18b20-probe'
  | 'deneyap-gps-glonass'
  | 'deneyap-9-axis-imu'
  | 'deneyap-touch-keypad'
  | 'deneyap-rain-sensor-center'
  | 'deneyap-rain-sensor-surface'
  | 'esp8266-module'
  | 'hx711'
  | 'microsd-module'
  | 'ds3231-rtc'
  | 'max7219-matrix'
  | 'ov7670-camera'
  | 'tcrt5000'
  | 'tp4056-charger'
  | 'rfm69hcw'
  | 'shaft-encoder'
  | 'tcs230'
  | 'uv-sensor'
  | 'hc-sr04'
  | 'ir-sensor'
  | 'seven-segment'
  | 'lcd-16x2'
  | 'relay'
  | 'transistor-npn'
  | 'transistor-pnp'
  | 'bme280'
  | 'ina219'
  | 'sx1276-lora'
  | 'a4988-driver'
  | 'multimeter'
  | 'oscilloscope'
  | 'motor-driver';

export type PinType = 'digital' | 'analog' | 'power' | 'ground' | 'pwm' | 'passive';

export interface Pin {
  id: string;
  name: string;
  type: PinType;
  x: number;
  y: number;
}

export interface CircuitComponent {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  rotation: number;
  pins: Pin[];
  properties: Record<string, string | number | boolean>;
}

export interface Wire {
  id: string;
  startComponentId: string;
  startPinId: string;
  endComponentId: string;
  endPinId: string;
  color: string;
  points: number[];
}

export interface OscilloscopeSample {
  timeMs: number;
  voltage: number;
}

export type ToolMode = 'select' | 'wire' | 'pan' | 'delete';

export type RightTab = 'properties' | 'ai';

export interface SimulationState {
  running: boolean;
  pinStates: Record<string, number>;
  ledStates: Record<string, { on: boolean; brightness: number }>;
  componentStates: Record<string, Record<string, string | number | boolean>>;
  serialOutput: string[];
  oscilloscopeTraces: Record<string, OscilloscopeSample[]>;
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIConversation {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: string;
  updatedAt: string;
}

export type AIProvider = 'groq' | 'openai' | 'gemini' | 'compatible';

export const AI_PROVIDER_CONFIGS: Record<
  AIProvider,
  {
    label: string;
    baseUrl: string;
    model: string;
    models: string[];
    apiKeyPlaceholder: string;
    requiresApiKey: boolean;
  }
> = {
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'gpt-oss-120b',
    models: ['gpt-oss-120b'],
    apiKeyPlaceholder: 'gsk_...',
    requiresApiKey: true,
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    models: ['gpt-4.1-mini'],
    apiKeyPlaceholder: 'sk-...',
    requiresApiKey: true,
  },
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
    apiKeyPlaceholder: 'AIza...',
    requiresApiKey: true,
  },
  compatible: {
    label: 'OpenAI Compatible',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2:3b',
    models: ['llama3.2:3b'],
    apiKeyPlaceholder: 'Optional',
    requiresApiKey: false,
  },
};

export const DEFAULT_AI_PROVIDER: AIProvider = 'groq';
export const DEFAULT_AI_BASE_URL = AI_PROVIDER_CONFIGS[DEFAULT_AI_PROVIDER].baseUrl;
export const DEFAULT_AI_MODEL = AI_PROVIDER_CONFIGS[DEFAULT_AI_PROVIDER].model;

// ===== Default pin definitions for each component type =====
export function getDefaultPins(type: ComponentType): Pin[] {
  const withSvgLayout = (pins: Pin[]) => applySvgPinLayout(type, pins);

  switch (type) {
    case 'led':
      return withSvgLayout([
        { id: 'anode', name: 'Anode (+)', type: 'passive', x: 0, y: -20 },
        { id: 'cathode', name: 'Cathode (-)', type: 'passive', x: 0, y: 20 },
      ]);
    case 'resistor':
      return withSvgLayout([
        { id: 'pin1', name: 'Pin 1', type: 'passive', x: -25, y: 0 },
        { id: 'pin2', name: 'Pin 2', type: 'passive', x: 25, y: 0 },
      ]);
    case 'capacitor':
      return withSvgLayout([
        { id: 'pin1', name: 'Pin 1 (+)', type: 'passive', x: -15, y: 0 },
        { id: 'pin2', name: 'Pin 2 (-)', type: 'passive', x: 15, y: 0 },
      ]);
    case 'diode':
      return withSvgLayout([
        { id: 'anode', name: 'Anode', type: 'passive', x: -20, y: 0 },
        { id: 'cathode', name: 'Cathode', type: 'passive', x: 20, y: 0 },
      ]);
    case 'button':
      return withSvgLayout([
        { id: 'pin1', name: 'Pin 1', type: 'passive', x: -15, y: -10 },
        { id: 'pin2', name: 'Pin 2', type: 'passive', x: 15, y: -10 },
        { id: 'pin3', name: 'Pin 3', type: 'passive', x: -15, y: 10 },
        { id: 'pin4', name: 'Pin 4', type: 'passive', x: 15, y: 10 },
      ]);
    case 'switch':
      return withSvgLayout([
        { id: 'common', name: 'Common', type: 'passive', x: -20, y: 0 },
        { id: 'no', name: 'NO', type: 'passive', x: 20, y: -8 },
        { id: 'nc', name: 'NC', type: 'passive', x: 20, y: 8 },
      ]);
    case 'potentiometer':
      return withSvgLayout([
        { id: 'pin1', name: 'Pin 1', type: 'passive', x: -20, y: 0 },
        { id: 'wiper', name: 'Wiper', type: 'passive', x: 0, y: -15 },
        { id: 'pin2', name: 'Pin 2', type: 'passive', x: 20, y: 0 },
      ]);
    case 'joystick':
      return withSvgLayout([
        { id: 'gnd', name: 'GND', type: 'ground', x: -24, y: 18 },
        { id: 'vcc', name: 'VCC', type: 'power', x: -12, y: 18 },
        { id: 'vrx', name: 'VRx', type: 'analog', x: 0, y: 18 },
        { id: 'vry', name: 'VRy', type: 'analog', x: 12, y: 18 },
        { id: 'sw', name: 'SW', type: 'digital', x: 24, y: 18 },
      ]);
    case 'buzzer':
      return withSvgLayout([
        { id: 'positive', name: '+', type: 'passive', x: -10, y: 0 },
        { id: 'negative', name: '-', type: 'passive', x: 10, y: 0 },
      ]);
    case 'servo':
      return withSvgLayout([
        { id: 'signal', name: 'Signal (Orange)', type: 'pwm', x: -15, y: -10 },
        { id: 'vcc', name: 'VCC (Red)', type: 'power', x: 0, y: -10 },
        { id: 'gnd', name: 'GND (Brown)', type: 'ground', x: 15, y: -10 },
      ]);
    case 'dc-motor':
      return withSvgLayout([
        { id: 'pin1', name: 'Terminal 1', type: 'passive', x: -15, y: 0 },
        { id: 'pin2', name: 'Terminal 2', type: 'passive', x: 15, y: 0 },
      ]);
    case 'rgb-led':
      return withSvgLayout([
        { id: 'red', name: 'Red', type: 'passive', x: -15, y: -15 },
        { id: 'common', name: 'Common', type: 'passive', x: -5, y: -15 },
        { id: 'green', name: 'Green', type: 'passive', x: 5, y: -15 },
        { id: 'blue', name: 'Blue', type: 'passive', x: 15, y: -15 },
      ]);
    case 'ldr':
      return withSvgLayout([
        { id: 'pin1', name: 'Pin 1', type: 'passive', x: -12, y: 0 },
        { id: 'pin2', name: 'Pin 2', type: 'passive', x: 12, y: 0 },
      ]);
    case 'lm35':
      return withSvgLayout([
        { id: 'vcc', name: 'VCC', type: 'power', x: -12, y: 15 },
        { id: 'vout', name: 'Vout', type: 'analog', x: 0, y: 15 },
        { id: 'gnd', name: 'GND', type: 'ground', x: 12, y: 15 },
      ]);
    case 'dht11':
      return withSvgLayout([
        { id: 'vcc', name: 'VCC', type: 'power', x: -12, y: 18 },
        { id: 'data', name: 'DATA', type: 'digital', x: 0, y: 18 },
        { id: 'gnd', name: 'GND', type: 'ground', x: 12, y: 18 },
      ]);
    case 'pir-sensor':
      return withSvgLayout([
        { id: 'vcc', name: 'VCC', type: 'power', x: -12, y: 18 },
        { id: 'out', name: 'OUT', type: 'digital', x: 0, y: 18 },
        { id: 'gnd', name: 'GND', type: 'ground', x: 12, y: 18 },
      ]);
    case 'flame-sensor':
      return withSvgLayout([
        { id: 'vcc', name: 'VCC', type: 'power', x: -18, y: 18 },
        { id: 'gnd', name: 'GND', type: 'ground', x: -6, y: 18 },
        { id: 'do', name: 'DO', type: 'digital', x: 6, y: 18 },
        { id: 'ao', name: 'AO', type: 'analog', x: 18, y: 18 },
      ]);
    case 'mq2':
      return withSvgLayout([
        { id: 'vcc', name: 'VCC', type: 'power', x: -18, y: 18 },
        { id: 'gnd', name: 'GND', type: 'ground', x: -6, y: 18 },
        { id: 'do', name: 'DO', type: 'digital', x: 6, y: 18 },
        { id: 'ao', name: 'AO', type: 'analog', x: 18, y: 18 },
      ]);
    case 'hc-05':
      return withSvgLayout([
        { id: 'rxd', name: 'RXD', type: 'digital', x: -30, y: 18 },
        { id: 'txd', name: 'TXD', type: 'digital', x: -18, y: 18 },
        { id: 'gnd', name: 'GND', type: 'ground', x: -6, y: 18 },
        { id: 'vcc', name: 'VCC', type: 'power', x: 6, y: 18 },
        { id: 'wakeup', name: 'WAKEUP', type: 'digital', x: 18, y: 18 },
        { id: 'state', name: 'STATE', type: 'digital', x: 30, y: 18 },
      ]);
    case 'oled-i2c':
      return withSvgLayout([
        { id: 'vdd', name: 'VDD', type: 'power', x: -18, y: 16 },
        { id: 'gnd', name: 'GND', type: 'ground', x: -6, y: 16 },
        { id: 'sck', name: 'SCK', type: 'digital', x: 6, y: 16 },
        { id: 'sda', name: 'SDA', type: 'digital', x: 18, y: 16 },
      ]);
    case 'rc522':
      return withSvgLayout([
        { id: 'sda', name: 'SDA', type: 'digital', x: -24, y: 0 },
        { id: 'sck', name: 'SCK', type: 'digital', x: -24, y: 10 },
        { id: 'mosi', name: 'MOSI', type: 'digital', x: -24, y: 20 },
        { id: 'miso', name: 'MISO', type: 'digital', x: -24, y: 30 },
        { id: 'irq', name: 'IRQ', type: 'digital', x: -24, y: 40 },
        { id: 'gnd', name: 'GND', type: 'ground', x: -24, y: 50 },
        { id: 'rst', name: 'RST', type: 'digital', x: -24, y: 60 },
        { id: 'vcc', name: '3V3', type: 'power', x: -24, y: 70 },
      ]);
    case 'keypad-4x4':
      return withSvgLayout([
        { id: 'c4', name: 'C4', type: 'digital', x: -24, y: 16 },
        { id: 'c3', name: 'C3', type: 'digital', x: -16, y: 16 },
        { id: 'c2', name: 'C2', type: 'digital', x: -8, y: 16 },
        { id: 'c1', name: 'C1', type: 'digital', x: 0, y: 16 },
        { id: 'r1', name: 'R1', type: 'digital', x: 8, y: 16 },
        { id: 'r2', name: 'R2', type: 'digital', x: 16, y: 16 },
        { id: 'r3', name: 'R3', type: 'digital', x: 24, y: 16 },
        { id: 'r4', name: 'R4', type: 'digital', x: 32, y: 16 },
      ]);
    case 'stepper-28byj48':
      return withSvgLayout([
        { id: 'blue', name: 'Blue', type: 'passive', x: -20, y: 18 },
        { id: 'pink', name: 'Pink', type: 'passive', x: -10, y: 18 },
        { id: 'yellow', name: 'Yellow', type: 'passive', x: 0, y: 18 },
        { id: 'orange', name: 'Orange', type: 'passive', x: 10, y: 18 },
        { id: 'red', name: 'Red', type: 'power', x: 20, y: 18 },
      ]);
    case 'l298n-driver':
      return withSvgLayout([
        { id: 'out1', name: 'OUT1', type: 'passive', x: -36, y: 20 },
        { id: 'out2', name: 'OUT2', type: 'passive', x: -28, y: 20 },
        { id: 'out3', name: 'OUT3', type: 'passive', x: -20, y: 20 },
        { id: 'out4', name: 'OUT4', type: 'passive', x: -12, y: 20 },
        { id: 'vin12', name: '12V', type: 'power', x: -4, y: 20 },
        { id: 'gnd', name: 'GND', type: 'ground', x: 4, y: 20 },
        { id: 'logic5v', name: '5V', type: 'power', x: 12, y: 20 },
        { id: 'jumper5ven_a', name: '5VEN', type: 'passive', x: 20, y: 20 },
        { id: 'logic5v_a', name: '5V A', type: 'power', x: 28, y: 20 },
        { id: 'logic5v_b', name: '5V B', type: 'power', x: 36, y: 20 },
        { id: 'ena', name: 'ENA', type: 'pwm', x: -32, y: -20 },
        { id: 'enb', name: 'ENB', type: 'pwm', x: -24, y: -20 },
        { id: 'in1', name: 'IN1', type: 'digital', x: -16, y: -20 },
        { id: 'in2', name: 'IN2', type: 'digital', x: -8, y: -20 },
        { id: 'in3', name: 'IN3', type: 'digital', x: 0, y: -20 },
        { id: 'in4', name: 'IN4', type: 'digital', x: 8, y: -20 },
        { id: 'jumper5ven_b', name: '5VEN B', type: 'passive', x: 16, y: -20 },
      ]);
    case 'vl53l0x':
      return withSvgLayout([
        { id: 'vin', name: 'VIN', type: 'power', x: -30, y: 18 },
        { id: 'v2_8', name: '2.8V', type: 'power', x: -20, y: 18 },
        { id: 'gnd', name: 'GND', type: 'ground', x: -10, y: 18 },
        { id: 'gpio', name: 'GPIO', type: 'digital', x: 0, y: 18 },
        { id: 'xshut', name: 'XSHUT', type: 'digital', x: 10, y: 18 },
        { id: 'scl', name: 'SCL', type: 'digital', x: 20, y: 18 },
        { id: 'sda', name: 'SDA', type: 'digital', x: 30, y: 18 },
      ]);
    case 'reed-switch-module':
      return withSvgLayout([
        { id: 'ao', name: 'A0', type: 'analog', x: -18, y: 18 },
        { id: 'gnd', name: 'G', type: 'ground', x: -6, y: 18 },
        { id: 'vcc', name: '+', type: 'power', x: 6, y: 18 },
        { id: 'do', name: 'D0', type: 'digital', x: 18, y: 18 },
      ]);
    case 'breadboard-power-supply':
      return withSvgLayout([
        { id: 'vcc_1', name: 'VCC 1', type: 'power', x: -28, y: 14 },
        { id: 'vcc_2', name: 'VCC 2', type: 'power', x: -20, y: 14 },
        { id: 'vcc_3', name: 'VCC 3', type: 'power', x: -12, y: 14 },
        { id: 'vcc_4', name: 'VCC 4', type: 'power', x: -4, y: 14 },
        { id: 'gnd_1', name: 'GND 1', type: 'ground', x: 4, y: 14 },
        { id: 'gnd_2', name: 'GND 2', type: 'ground', x: 12, y: 14 },
        { id: 'gnd_3', name: 'GND 3', type: 'ground', x: 20, y: 14 },
        { id: 'gnd_4', name: 'GND 4', type: 'ground', x: 28, y: 14 },
      ]);
    case 'acs712':
      return withSvgLayout([
        { id: 'vcc', name: 'VCC', type: 'power', x: -12, y: 18 },
        { id: 'out', name: 'OUT', type: 'analog', x: 0, y: 18 },
        { id: 'gnd', name: 'GND', type: 'ground', x: 12, y: 18 },
      ]);
    case 'logic-level-converter':
      return withSvgLayout([
        { id: 'lv1', name: 'LV1', type: 'digital', x: -28, y: 18 },
        { id: 'lv2', name: 'LV2', type: 'digital', x: -20, y: 18 },
        { id: 'lv', name: 'LV', type: 'power', x: -12, y: 18 },
        { id: 'l_gnd', name: 'L-GND', type: 'ground', x: -4, y: 18 },
        { id: 'lv3', name: 'LV3', type: 'digital', x: 4, y: 18 },
        { id: 'lv4', name: 'LV4', type: 'digital', x: 12, y: 18 },
        { id: 'hv4', name: 'HV4', type: 'digital', x: 20, y: 18 },
        { id: 'hv3', name: 'HV3', type: 'digital', x: 28, y: 18 },
        { id: 'h_gnd', name: 'H-GND', type: 'ground', x: 36, y: 18 },
        { id: 'hv', name: 'HV', type: 'power', x: 44, y: 18 },
        { id: 'hv2', name: 'HV2', type: 'digital', x: 52, y: 18 },
        { id: 'hv1', name: 'HV1', type: 'digital', x: 60, y: 18 },
      ]);
    case 'rf-433-receiver':
      return withSvgLayout([
        { id: 'vcc', name: 'VCC', type: 'power', x: -18, y: 18 },
        { id: 'data1', name: 'DATA 1', type: 'digital', x: -6, y: 18 },
        { id: 'data2', name: 'DATA 2', type: 'digital', x: 6, y: 18 },
        { id: 'gnd', name: 'GND', type: 'ground', x: 18, y: 18 },
        { id: 'antenna', name: 'Antenna', type: 'passive', x: 30, y: 18 },
      ]);
    case 'sound-sensor':
      return withSvgLayout([
        { id: 'vcc', name: 'VCC', type: 'power', x: -12, y: 18 },
        { id: 'gnd', name: 'GND', type: 'ground', x: 0, y: 18 },
        { id: 'out', name: 'OUT', type: 'digital', x: 12, y: 18 },
      ]);
    case 'tm1637':
      return withSvgLayout([
        { id: 'gnd', name: 'GND', type: 'ground', x: -18, y: 18 },
        { id: 'vcc', name: 'VCC', type: 'power', x: -6, y: 18 },
        { id: 'dio', name: 'DIO', type: 'digital', x: 6, y: 18 },
        { id: 'clk', name: 'CLK', type: 'digital', x: 18, y: 18 },
      ]);
    case 'uln2003-driver':
      return withSvgLayout([
        { id: 'in1', name: 'IN1', type: 'digital', x: -20, y: 18 },
        { id: 'in2', name: 'IN2', type: 'digital', x: -10, y: 18 },
        { id: 'in3', name: 'IN3', type: 'digital', x: 0, y: 18 },
        { id: 'in4', name: 'IN4', type: 'digital', x: 10, y: 18 },
        { id: 'gnd', name: 'GND', type: 'ground', x: 20, y: 18 },
        { id: 'vcc', name: 'VCC', type: 'power', x: 30, y: 18 },
        { id: 'blue', name: 'BLUE', type: 'passive', x: -24, y: -18 },
        { id: 'pink', name: 'PINK', type: 'passive', x: -12, y: -18 },
        { id: 'yellow', name: 'YELLOW', type: 'passive', x: 0, y: -18 },
        { id: 'orange', name: 'ORANGE', type: 'passive', x: 12, y: -18 },
        { id: 'red', name: 'RED', type: 'power', x: 24, y: -18 },
      ]);
    case 'rf-433-transmitter':
      return withSvgLayout([
        { id: 'data', name: 'DATA', type: 'digital', x: -18, y: 18 },
        { id: 'vcc', name: 'VCC', type: 'power', x: -6, y: 18 },
        { id: 'gnd', name: 'GND', type: 'ground', x: 6, y: 18 },
        { id: 'antenna', name: 'Antenna', type: 'passive', x: 18, y: 18 },
      ]);
    case 'ds18b20-probe':
      return withSvgLayout([
        { id: 'gnd', name: 'GND', type: 'ground', x: -18, y: 18 },
        { id: 'dq', name: 'DQ', type: 'digital', x: -6, y: 18 },
        { id: 'vdd', name: 'VDD', type: 'power', x: 6, y: 18 },
        { id: 'shield', name: 'Shield', type: 'passive', x: 18, y: 18 },
      ]);
    case 'deneyap-gps-glonass':
      return withSvgLayout([
        { id: 'gnd', name: 'GND', type: 'ground', x: -24, y: 18 },
        { id: 'sda', name: 'SDA', type: 'digital', x: -18, y: 18 },
        { id: 'scl', name: 'SCL', type: 'digital', x: -12, y: 18 },
        { id: 'swim', name: 'SWIM', type: 'digital', x: -6, y: 18 },
        { id: 'rx', name: 'RX', type: 'digital', x: 0, y: 18 },
        { id: 'tx', name: 'TX', type: 'digital', x: 6, y: 18 },
        { id: 'pps1', name: '1PPS', type: 'digital', x: 12, y: 18 },
        { id: 'force', name: 'FORCE', type: 'digital', x: 18, y: 18 },
        { id: 'res_n', name: 'RES_N', type: 'digital', x: 24, y: 18 },
        { id: 'addet_n', name: 'ADDET_N', type: 'digital', x: 30, y: 18 },
        { id: 'reset', name: 'RESET', type: 'digital', x: 36, y: 18 },
        { id: 'vcc', name: '3V3', type: 'power', x: 42, y: 18 },
      ]);
    case 'deneyap-9-axis-imu':
      return withSvgLayout([
        { id: 'vcc', name: '3V3', type: 'power', x: -15, y: 18 },
        { id: 'int1', name: 'INT1', type: 'digital', x: -9, y: 18 },
        { id: 'int2', name: 'INT2', type: 'digital', x: -3, y: 18 },
        { id: 'scl', name: 'SCL', type: 'digital', x: 3, y: 18 },
        { id: 'sda', name: 'SDA', type: 'digital', x: 9, y: 18 },
        { id: 'gnd', name: 'GND', type: 'ground', x: 15, y: 18 },
      ]);
    case 'deneyap-touch-keypad':
      return withSvgLayout([
        { id: 'vcc', name: '3V3', type: 'power', x: -36, y: 18 },
        { id: 'but0', name: 'BUT0', type: 'digital', x: -30, y: 18 },
        { id: 'but2', name: 'BUT2', type: 'digital', x: -24, y: 18 },
        { id: 'but4', name: 'BUT4', type: 'digital', x: -18, y: 18 },
        { id: 'but6', name: 'BUT6', type: 'digital', x: -12, y: 18 },
        { id: 'but7', name: 'BUT7', type: 'digital', x: -6, y: 18 },
        { id: 'but8', name: 'BUT8', type: 'digital', x: 0, y: 18 },
        { id: 'but9', name: 'BUT9', type: 'digital', x: 6, y: 18 },
        { id: 'sbwtdio', name: 'SBWTDIO', type: 'digital', x: 12, y: 18 },
        { id: 'sbwtck', name: 'SBWTCK', type: 'digital', x: 18, y: 18 },
        { id: 'but5', name: 'BUT5', type: 'digital', x: 24, y: 18 },
        { id: 'but3', name: 'BUT3', type: 'digital', x: 30, y: 18 },
        { id: 'but1', name: 'BUT1', type: 'digital', x: 36, y: 18 },
        { id: 'scl', name: 'SCL', type: 'digital', x: 42, y: 18 },
        { id: 'sda', name: 'SDA', type: 'digital', x: 48, y: 18 },
        { id: 'gnd', name: 'GND', type: 'ground', x: 54, y: 18 },
      ]);
    case 'deneyap-rain-sensor-center':
      return withSvgLayout([
        { id: 'vcc', name: '3V3', type: 'power', x: -21, y: 18 },
        { id: 'reset', name: 'RESET', type: 'digital', x: -15, y: 18 },
        { id: 'd0', name: 'D0', type: 'digital', x: -9, y: 18 },
        { id: 'a0', name: 'A0', type: 'analog', x: -3, y: 18 },
        { id: 'gnd', name: 'GND', type: 'ground', x: 3, y: 18 },
        { id: 'sda', name: 'SDA', type: 'digital', x: 9, y: 18 },
        { id: 'scl', name: 'SCL', type: 'digital', x: 15, y: 18 },
        { id: 'swim', name: 'SWIM', type: 'digital', x: 21, y: 18 },
      ]);
    case 'deneyap-rain-sensor-surface':
      return withSvgLayout([
        { id: 'gnd', name: 'GND', type: 'ground', x: -6, y: 18 },
        { id: 'a0', name: 'A0', type: 'analog', x: 6, y: 18 },
      ]);
    case 'esp8266-module':
      return withSvgLayout([
        { id: 'rxd', name: 'RXD', type: 'digital', x: -30, y: 18 },
        { id: 'vcc', name: 'VCC', type: 'power', x: -20, y: 18 },
        { id: 'gpio0', name: 'GPIO0', type: 'digital', x: -10, y: 18 },
        { id: 'gpio16', name: 'GPIO16', type: 'digital', x: 0, y: 18 },
        { id: 'gpio2', name: 'GPIO2', type: 'digital', x: 10, y: 18 },
        { id: 'ch_pd', name: 'CH_PD', type: 'digital', x: 20, y: 18 },
        { id: 'gnd', name: 'GND', type: 'ground', x: 30, y: 18 },
        { id: 'txd', name: 'TXD', type: 'digital', x: 40, y: 18 },
      ]);
    case 'hx711':
      return withSvgLayout([
        { id: 'vcc', name: 'VCC', type: 'power', x: -36, y: 16 },
        { id: 'gnd', name: 'GND', type: 'ground', x: -28, y: 16 },
        { id: 'data', name: 'DO/RX', type: 'digital', x: -20, y: 16 },
        { id: 'clock', name: 'CK/TX', type: 'digital', x: -12, y: 16 },
        { id: 'e_plus', name: 'E+', type: 'passive', x: -4, y: 16 },
        { id: 'e_minus', name: 'E-', type: 'passive', x: 4, y: 16 },
        { id: 'a_plus', name: 'A+', type: 'passive', x: 12, y: 16 },
        { id: 'a_minus', name: 'A-', type: 'passive', x: 20, y: 16 },
        { id: 'b_plus', name: 'B+', type: 'passive', x: 28, y: 16 },
        { id: 'b_minus', name: 'B-', type: 'passive', x: 36, y: 16 },
      ]);
    case 'microsd-module':
      return withSvgLayout([
        { id: 'gnd', name: 'GND', type: 'ground', x: -20, y: 18 },
        { id: 'vcc', name: 'VCC', type: 'power', x: -12, y: 18 },
        { id: 'miso', name: 'MISO', type: 'digital', x: -4, y: 18 },
        { id: 'mosi', name: 'MOSI', type: 'digital', x: 4, y: 18 },
        { id: 'sck', name: 'SCK', type: 'digital', x: 12, y: 18 },
        { id: 'cs', name: 'CS', type: 'digital', x: 20, y: 18 },
      ]);
    case 'ds3231-rtc':
      return withSvgLayout([
        { id: 'gnd', name: 'GND', type: 'ground', x: -36, y: 16 },
        { id: 'vcc', name: 'VCC', type: 'power', x: -28, y: 16 },
        { id: 'sda', name: 'SDA', type: 'digital', x: -20, y: 16 },
        { id: 'scl', name: 'SCL', type: 'digital', x: -12, y: 16 },
        { id: 'sqw', name: 'SQW', type: 'digital', x: -4, y: 16 },
        { id: 'k32', name: '32K', type: 'digital', x: 4, y: 16 },
        { id: 'gnd_2', name: 'GND 2', type: 'ground', x: 12, y: 16 },
        { id: 'vcc_2', name: 'VCC 2', type: 'power', x: 20, y: 16 },
        { id: 'sda_2', name: 'SDA 2', type: 'digital', x: 28, y: 16 },
        { id: 'scl_2', name: 'SCL 2', type: 'digital', x: 36, y: 16 },
      ]);
    case 'max7219-matrix':
      return withSvgLayout([
        { id: 'vcc_in', name: 'VCC In', type: 'power', x: -36, y: 18 },
        { id: 'gnd_in', name: 'GND In', type: 'ground', x: -28, y: 18 },
        { id: 'din', name: 'DIN', type: 'digital', x: -20, y: 18 },
        { id: 'cs_in', name: 'CS In', type: 'digital', x: -12, y: 18 },
        { id: 'clk_in', name: 'CLK In', type: 'digital', x: -4, y: 18 },
        { id: 'vcc_out', name: 'VCC Out', type: 'power', x: 4, y: 18 },
        { id: 'gnd_out', name: 'GND Out', type: 'ground', x: 12, y: 18 },
        { id: 'dout', name: 'DOUT', type: 'digital', x: 20, y: 18 },
        { id: 'cs_out', name: 'CS Out', type: 'digital', x: 28, y: 18 },
        { id: 'clk_out', name: 'CLK Out', type: 'digital', x: 36, y: 18 },
      ]);
    case 'ov7670-camera':
      return withSvgLayout([
        { id: 'vcc', name: '3V3', type: 'power', x: -34, y: 16 },
        { id: 'sioc', name: 'SIOC', type: 'digital', x: -30, y: 16 },
        { id: 'vsync', name: 'VSYNC', type: 'digital', x: -26, y: 16 },
        { id: 'pclk', name: 'PCLK', type: 'digital', x: -22, y: 16 },
        { id: 'd7', name: 'D7', type: 'digital', x: -18, y: 16 },
        { id: 'd5', name: 'D5', type: 'digital', x: -14, y: 16 },
        { id: 'd3', name: 'D3', type: 'digital', x: -10, y: 16 },
        { id: 'd1', name: 'D1', type: 'digital', x: -6, y: 16 },
        { id: 'reset', name: 'RESET', type: 'digital', x: -2, y: 16 },
        { id: 'gnd', name: 'GND', type: 'ground', x: 2, y: 16 },
        { id: 'siod', name: 'SIOD', type: 'digital', x: 6, y: 16 },
        { id: 'href', name: 'HREF', type: 'digital', x: 10, y: 16 },
        { id: 'xclk', name: 'XCLK', type: 'digital', x: 14, y: 16 },
        { id: 'd6', name: 'D6', type: 'digital', x: 18, y: 16 },
        { id: 'd4', name: 'D4', type: 'digital', x: 22, y: 16 },
        { id: 'd2', name: 'D2', type: 'digital', x: 26, y: 16 },
        { id: 'd0', name: 'D0', type: 'digital', x: 30, y: 16 },
        { id: 'pwdn', name: 'PWDN', type: 'digital', x: 34, y: 16 },
      ]);
    case 'tcrt5000':
      return withSvgLayout([
        { id: 'pin1', name: 'Pin 1', type: 'passive', x: -12, y: 10 },
        { id: 'pin2', name: 'Pin 2', type: 'passive', x: -4, y: 10 },
        { id: 'pin3', name: 'Pin 3', type: 'passive', x: 4, y: 10 },
        { id: 'pin4', name: 'Pin 4', type: 'passive', x: 12, y: 10 },
      ]);
    case 'tp4056-charger':
      return withSvgLayout([
        { id: 'in_plus', name: 'IN+', type: 'power', x: -18, y: 18 },
        { id: 'in_minus', name: 'IN-', type: 'ground', x: -6, y: 18 },
        { id: 'bat_plus', name: 'BAT+', type: 'power', x: 6, y: 18 },
        { id: 'bat_minus', name: 'BAT-', type: 'ground', x: 18, y: 18 },
      ]);
    case 'rfm69hcw':
      return withSvgLayout([
        { id: 'gnd_1', name: 'GND 1', type: 'ground', x: -30, y: 18 },
        { id: 'miso', name: 'MISO', type: 'digital', x: -26, y: 18 },
        { id: 'mosi', name: 'MOSI', type: 'digital', x: -22, y: 18 },
        { id: 'sck', name: 'SCK', type: 'digital', x: -18, y: 18 },
        { id: 'cs', name: 'NSS / CS', type: 'digital', x: -14, y: 18 },
        { id: 'reset', name: 'RESET', type: 'digital', x: -10, y: 18 },
        { id: 'dio5', name: 'DIO5', type: 'digital', x: -6, y: 18 },
        { id: 'gnd_2', name: 'GND 2', type: 'ground', x: -2, y: 18 },
        { id: 'ant', name: 'ANT', type: 'passive', x: 2, y: 18 },
        { id: 'gnd_3', name: 'GND 3', type: 'ground', x: 6, y: 18 },
        { id: 'dio3', name: 'DIO3', type: 'digital', x: 10, y: 18 },
        { id: 'dio4', name: 'DIO4', type: 'digital', x: 14, y: 18 },
        { id: 'vcc', name: '3.3V', type: 'power', x: 18, y: 18 },
        { id: 'dio0', name: 'DIO0', type: 'digital', x: 22, y: 18 },
        { id: 'dio1', name: 'DIO1', type: 'digital', x: 26, y: 18 },
        { id: 'dio2', name: 'DIO2', type: 'digital', x: 30, y: 18 },
      ]);
    case 'shaft-encoder':
      return withSvgLayout([
        { id: 'vcc', name: 'VCC', type: 'power', x: -12, y: 18 },
        { id: 'gnd', name: 'GND', type: 'ground', x: 0, y: 18 },
        { id: 'out', name: 'OUT', type: 'digital', x: 12, y: 18 },
      ]);
    case 'tcs230':
      return withSvgLayout([
        { id: 'gnd', name: 'GND', type: 'ground', x: -28, y: 18 },
        { id: 'oe', name: 'OE', type: 'digital', x: -20, y: 18 },
        { id: 's1', name: 'S1', type: 'digital', x: -12, y: 18 },
        { id: 's0', name: 'S0', type: 'digital', x: -4, y: 18 },
        { id: 's3', name: 'S3', type: 'digital', x: 4, y: 18 },
        { id: 's2', name: 'S2', type: 'digital', x: 12, y: 18 },
        { id: 'out', name: 'OUT', type: 'digital', x: 20, y: 18 },
        { id: 'vcc', name: 'VCC', type: 'power', x: 28, y: 18 },
      ]);
    case 'uv-sensor':
      return withSvgLayout([
        { id: 'vcc', name: '5V', type: 'power', x: -12, y: 18 },
        { id: 'out', name: 'OUT', type: 'analog', x: 0, y: 18 },
        { id: 'gnd', name: 'GND', type: 'ground', x: 12, y: 18 },
      ]);
    case 'hc-sr04':
      return withSvgLayout([
        { id: 'vcc', name: 'VCC', type: 'power', x: -22, y: 20 },
        { id: 'trig', name: 'Trig', type: 'digital', x: -8, y: 20 },
        { id: 'echo', name: 'Echo', type: 'digital', x: 8, y: 20 },
        { id: 'gnd', name: 'GND', type: 'ground', x: 22, y: 20 },
      ]);
    case 'ir-sensor':
      return withSvgLayout([
        { id: 'vcc', name: 'VCC', type: 'power', x: -12, y: 15 },
        { id: 'out', name: 'OUT', type: 'digital', x: 0, y: 15 },
        { id: 'gnd', name: 'GND', type: 'ground', x: 12, y: 15 },
      ]);
    case 'seven-segment':
      return withSvgLayout([
        { id: 'a', name: 'a', type: 'passive', x: -21, y: -20 },
        { id: 'b', name: 'b', type: 'passive', x: -14, y: -20 },
        { id: 'c', name: 'c', type: 'passive', x: -7, y: -20 },
        { id: 'd', name: 'd', type: 'passive', x: 0, y: -20 },
        { id: 'e', name: 'e', type: 'passive', x: 7, y: -20 },
        { id: 'f', name: 'f', type: 'passive', x: -14, y: 20 },
        { id: 'g', name: 'g', type: 'passive', x: -7, y: 20 },
        { id: 'dp', name: 'DP', type: 'passive', x: 0, y: 20 },
        { id: 'common', name: 'Common', type: 'passive', x: 14, y: 20 },
      ]);
    case 'lcd-16x2':
      return withSvgLayout(
        Array.from({ length: 16 }, (_, i) => ({
          id: `pin${i + 1}`,
          name: [
            'VSS',
            'VDD',
            'V0',
            'RS',
            'RW',
            'E',
            'D0',
            'D1',
            'D2',
            'D3',
            'D4',
            'D5',
            'D6',
            'D7',
            'A',
            'K',
          ][i],
          type: 'passive' as PinType,
          x: -52 + i * 7,
          y: 25,
        }))
      );
    case 'relay':
      return withSvgLayout([
        { id: 'coil1', name: 'Coil +', type: 'passive', x: -15, y: -15 },
        { id: 'coil2', name: 'Coil -', type: 'passive', x: 15, y: -15 },
        { id: 'com', name: 'COM', type: 'passive', x: -15, y: 15 },
        { id: 'no', name: 'NO', type: 'passive', x: 0, y: 15 },
        { id: 'nc', name: 'NC', type: 'passive', x: 15, y: 15 },
      ]);
    case 'transistor-npn':
    case 'transistor-pnp':
      return withSvgLayout([
        { id: 'base', name: 'Base', type: 'passive', x: -18, y: 0 },
        { id: 'collector', name: 'Collector', type: 'passive', x: 10, y: -15 },
        { id: 'emitter', name: 'Emitter', type: 'passive', x: 10, y: 15 },
      ]);
    case 'motor-driver':
      return withSvgLayout([
        { id: 'in1', name: 'IN1', type: 'digital', x: -30, y: -20 },
        { id: 'in2', name: 'IN2', type: 'digital', x: -30, y: -10 },
        { id: 'in3', name: 'IN3', type: 'digital', x: -30, y: 0 },
        { id: 'in4', name: 'IN4', type: 'digital', x: -30, y: 10 },
        { id: 'en1', name: 'ENA', type: 'pwm', x: -30, y: 20 },
        { id: 'en2', name: 'ENB', type: 'pwm', x: -30, y: 30 },
        { id: 'out1', name: 'OUT1', type: 'passive', x: 30, y: -20 },
        { id: 'out2', name: 'OUT2', type: 'passive', x: 30, y: -10 },
        { id: 'out3', name: 'OUT3', type: 'passive', x: 30, y: 0 },
        { id: 'out4', name: 'OUT4', type: 'passive', x: 30, y: 10 },
        { id: 'vcc', name: 'VCC', type: 'power', x: 0, y: -25 },
        { id: 'gnd', name: 'GND', type: 'ground', x: 0, y: 35 },
      ]);
    case 'multimeter':
      return withSvgLayout([]);
    case 'bme280':
      return [
        { id: 'vin', name: 'VIN', type: 'power', x: -24, y: 16 },
        { id: 'gnd', name: 'GND', type: 'ground', x: -16, y: 16 },
        { id: 'sck', name: 'SCK', type: 'digital', x: -8, y: 16 },
        { id: 'sdo', name: 'SDO', type: 'digital', x: 0, y: 16 },
        { id: 'sdi', name: 'SDI', type: 'digital', x: 8, y: 16 },
        { id: 'cs', name: 'CS', type: 'digital', x: 16, y: 16 },
        { id: '3vo', name: '3Vo', type: 'power', x: 24, y: 16 },
      ];
    case 'ina219':
      return [
        { id: 'vin_plus', name: 'VIN+', type: 'passive', x: -14, y: -18 },
        { id: 'vin_minus', name: 'VIN-', type: 'passive', x: 14, y: -18 },
        { id: 'vin', name: 'VIN', type: 'power', x: -18, y: 18 },
        { id: 'gnd', name: 'GND', type: 'ground', x: -6, y: 18 },
        { id: 'scl', name: 'SCL', type: 'digital', x: 6, y: 18 },
        { id: 'sda', name: 'SDA', type: 'digital', x: 18, y: 18 },
      ];
    case 'sx1276-lora':
      return [
        { id: 'gnd', name: 'GND', type: 'ground', x: -36, y: 18 },
        { id: 'vcc', name: 'VCC', type: 'power', x: -28, y: 18 },
        { id: 'miso', name: 'MISO', type: 'digital', x: -20, y: 18 },
        { id: 'mosi', name: 'MOSI', type: 'digital', x: -12, y: 18 },
        { id: 'sck', name: 'SCK', type: 'digital', x: -4, y: 18 },
        { id: 'nss', name: 'NSS', type: 'digital', x: 4, y: 18 },
        { id: 'reset', name: 'RST', type: 'digital', x: 12, y: 18 },
        { id: 'dio0', name: 'DIO0', type: 'digital', x: 20, y: 18 },
        { id: 'dio1', name: 'DIO1', type: 'digital', x: 28, y: 18 },
        { id: 'ant', name: 'ANT', type: 'passive', x: 36, y: 18 },
      ];
    case 'a4988-driver':
      return [
        { id: 'enable', name: 'EN', type: 'digital', x: -24, y: -28 },
        { id: 'ms1', name: 'MS1', type: 'digital', x: -24, y: -18 },
        { id: 'ms2', name: 'MS2', type: 'digital', x: -24, y: -8 },
        { id: 'ms3', name: 'MS3', type: 'digital', x: -24, y: 2 },
        { id: 'reset', name: 'RST', type: 'digital', x: -24, y: 12 },
        { id: 'sleep', name: 'SLP', type: 'digital', x: -24, y: 22 },
        { id: 'step', name: 'STEP', type: 'digital', x: 24, y: -28 },
        { id: 'dir', name: 'DIR', type: 'digital', x: 24, y: -18 },
        { id: 'vdd', name: 'VDD', type: 'power', x: 24, y: -8 },
        { id: 'gnd_logic', name: 'GND', type: 'ground', x: 24, y: 2 },
        { id: '1a', name: '1A', type: 'passive', x: 24, y: 12 },
        { id: '1b', name: '1B', type: 'passive', x: 24, y: 22 },
        { id: '2a', name: '2A', type: 'passive', x: 24, y: 32 },
        { id: '2b', name: '2B', type: 'passive', x: 24, y: 42 },
        { id: 'vmot', name: 'VMOT', type: 'power', x: -24, y: 32 },
        { id: 'gnd_motor', name: 'GND', type: 'ground', x: -24, y: 42 },
      ];
    case 'oscilloscope':
      return [
        { id: 'ch1', name: 'CH1', type: 'analog', x: -28, y: 44 },
        { id: 'gnd', name: 'GND', type: 'ground', x: 28, y: 44 },
      ];
    default:
      return [];
  }
}

export function getDefaultProperties(type: ComponentType): Record<string, string | number | boolean> {
  switch (type) {
    case 'led':
      return { color: 'red', forwardVoltage: 2.0 };
    case 'resistor':
      return { resistance: 220, unit: 'ohm' };
    case 'capacitor':
      return { capacitance: 100, unit: 'uF' };
    case 'diode':
      return { forwardVoltage: 0.7 };
    case 'button':
      return { pressed: false, type: 'momentary' };
    case 'switch':
      return { closed: false };
    case 'potentiometer':
      return { resistance: 10000, position: 50, unit: 'ohm' };
    case 'joystick':
      return { xAxis: 512, yAxis: 512, pressed: false };
    case 'buzzer':
      return { frequency: 1000, active: true };
    case 'servo':
      return { angle: 90, minAngle: 0, maxAngle: 180 };
    case 'dc-motor':
      return { rpm: 0 };
    case 'rgb-led':
      return { red: 0, green: 0, blue: 0, commonType: 'cathode' };
    case 'ldr':
      return { resistance: 10000, lightLevel: 50 };
    case 'lm35':
      return { temperature: 25 };
    case 'dht11':
      return { temperature: 24, humidity: 55 };
    case 'pir-sensor':
      return { detected: false, range: 6 };
    case 'flame-sensor':
      return { flameDetected: false, sensitivity: 50 };
    case 'mq2':
      return { gasLevel: 120, threshold: 300 };
    case 'hc-05':
      return { connected: false, baudRate: 9600 };
    case 'oled-i2c':
      return { text1: 'AI Circuit', text2: '', inverted: false };
    case 'rc522':
      return { cardPresent: false, uid: 'DE AD BE EF' };
    case 'keypad-4x4':
      return { lastKey: '', debounceMs: 50 };
    case 'stepper-28byj48':
      return { angle: 0, stepsPerRevolution: 2048 };
    case 'l298n-driver':
      return { pwmA: 0, pwmB: 0, enabledA: false, enabledB: false };
    case 'vl53l0x':
      return { distance: 120, timingBudget: 33 };
    case 'reed-switch-module':
      return { triggered: false, analogLevel: 0 };
    case 'breadboard-power-supply':
      return { leftRail: '5V', rightRail: '3.3V', enabled: true };
    case 'acs712':
      return { current: 0, sensitivityMvPerA: 185 };
    case 'logic-level-converter':
      return { lowVoltage: 3.3, highVoltage: 5 };
    case 'rf-433-receiver':
      return { signal: false, frequencyMHz: 433.92 };
    case 'sound-sensor':
      return { detected: false, level: 0 };
    case 'tm1637':
      return { value: '1234', brightness: 4 };
    case 'uln2003-driver':
      return { enabled: false, stepIndex: 0 };
    case 'rf-433-transmitter':
      return { transmitting: false, frequencyMHz: 433.92 };
    case 'ds18b20-probe':
      return { temperature: 24 };
    case 'deneyap-gps-glonass':
      return { fix: false, satellites: 6, latitude: 41.0082, longitude: 28.9784 };
    case 'deneyap-9-axis-imu':
      return { pitch: 0, roll: 0, heading: 0 };
    case 'deneyap-touch-keypad':
      return { lastTouch: '', touchCount: 0 };
    case 'deneyap-rain-sensor-center':
      return { detected: false, analogLevel: 0 };
    case 'deneyap-rain-sensor-surface':
      return { wet: false, moisture: 0 };
    case 'esp8266-module':
      return { connected: false, ssid: '', mode: 'station' };
    case 'hx711':
      return { reading: 0, gain: 128 };
    case 'microsd-module':
      return { mounted: false, filename: 'data.txt' };
    case 'ds3231-rtc':
      return { date: '2026-03-17', time: '12:00:00' };
    case 'max7219-matrix':
      return { pattern: '8x8', brightness: 8 };
    case 'ov7670-camera':
      return { active: false, resolution: 'QQVGA' };
    case 'tcrt5000':
      return { detected: false };
    case 'tp4056-charger':
      return { charging: false, batteryPercent: 75 };
    case 'rfm69hcw':
      return { signal: false, frequencyMHz: 433.0 };
    case 'shaft-encoder':
      return { pulses: 0 };
    case 'tcs230':
      return { red: 0, green: 0, blue: 0, clear: 0 };
    case 'uv-sensor':
      return { uvIndex: 3.2 };
    case 'hc-sr04':
      return { distance: 100 };
    case 'ir-sensor':
      return { detected: false };
    case 'seven-segment':
      return { commonType: 'cathode', segments: 0 };
    case 'lcd-16x2':
      return { text1: '', text2: '', backlight: true };
    case 'relay':
      return { coilVoltage: 5, activated: false };
    case 'transistor-npn':
      return { hfe: 100 };
    case 'transistor-pnp':
      return { hfe: 100 };
    case 'bme280':
      return {
        temperature: 24,
        humidity: 46,
        pressure: 1013.2,
        address: '0x77',
      };
    case 'ina219':
      return {
        busVoltage: 5.0,
        current: 0.12,
        power: 0.6,
        address: '0x40',
      };
    case 'sx1276-lora':
      return {
        frequencyMHz: 868,
        spreadingFactor: 7,
        bandwidthKhz: 125,
        signal: false,
      };
    case 'a4988-driver':
      return {
        enabled: false,
        currentLimit: 1.0,
        stepMode: '1/16',
      };
    case 'multimeter':
      return {
        mode: 'voltage',
        autoRange: true,
        reading: 0,
        unit: 'V',
        displayText: '0.00 V',
        continuity: false,
        status: 'ready',
        blackProbeX: 0,
        blackProbeY: 0,
        redProbeX: 0,
        redProbeY: 0,
        blackProbeDocked: true,
        redProbeDocked: true,
        blackProbeTargetComponentId: '',
        blackProbeTargetPinId: '',
        redProbeTargetComponentId: '',
        redProbeTargetPinId: '',
      };
    case 'oscilloscope':
      return {
        reading: 0,
        displayText: '0.00 V',
        status: 'idle',
        timeWindowMs: 4000,
      };
    case 'motor-driver':
      return { type: 'L293D' };
    default:
      return {};
  }
}

export function createComponent(type: ComponentType, x: number, y: number): CircuitComponent {
  const properties = getDefaultProperties(type);

  if (type === 'multimeter') {
    properties.blackProbeX = x + 6;
    properties.blackProbeY = y + 170;
    properties.redProbeX = x + 72;
    properties.redProbeY = y + 170;
  }

  return {
    id: uuidv4(),
    type,
    x,
    y,
    rotation: 0,
    pins: getDefaultPins(type),
    properties,
  };
}

// Component display info
export interface ComponentInfo {
  type: ComponentType;
  name: string;
  category: string;
  icon: string;
}

export const COMPONENT_CATALOG: ComponentInfo[] = [
  // Passive
  { type: 'led', name: 'LED', category: 'Passive', icon: 'LED' },
  { type: 'resistor', name: 'Resistor', category: 'Passive', icon: 'R' },
  { type: 'capacitor', name: 'Capacitor', category: 'Passive', icon: 'C' },
  { type: 'diode', name: 'Diode', category: 'Passive', icon: 'D' },
  // Active
  { type: 'button', name: 'Button', category: 'Active', icon: 'BTN' },
  { type: 'switch', name: 'Switch', category: 'Active', icon: 'SW' },
  { type: 'potentiometer', name: 'Potentiometer', category: 'Active', icon: 'POT' },
  { type: 'joystick', name: 'Joystick', category: 'Active', icon: 'JOY' },
  // Output
  { type: 'buzzer', name: 'Buzzer', category: 'Output', icon: 'BZR' },
  { type: 'servo', name: 'Servo Motor', category: 'Output', icon: 'SRV' },
  { type: 'dc-motor', name: 'DC Motor', category: 'Output', icon: 'MTR' },
  { type: 'rgb-led', name: 'RGB LED', category: 'Output', icon: 'RGB' },
  // Sensor
  { type: 'ldr', name: 'LDR', category: 'Sensor', icon: 'LDR' },
  { type: 'lm35', name: 'LM35 Temperature', category: 'Sensor', icon: 'TMP' },
  { type: 'dht11', name: 'DHT11', category: 'Sensor', icon: 'DHT' },
  { type: 'pir-sensor', name: 'PIR Sensor', category: 'Sensor', icon: 'PIR' },
  { type: 'flame-sensor', name: 'Flame Sensor', category: 'Sensor', icon: 'FLM' },
  { type: 'mq2', name: 'MQ-2 Gas Sensor', category: 'Sensor', icon: 'MQ2' },
  { type: 'vl53l0x', name: 'VL53L0X ToF', category: 'Sensor', icon: 'TOF' },
  { type: 'reed-switch-module', name: 'Reed Switch', category: 'Sensor', icon: 'REED' },
  { type: 'acs712', name: 'ACS712 Current Sensor', category: 'Sensor', icon: 'AMP' },
  { type: 'rf-433-receiver', name: '433MHz Receiver', category: 'Sensor', icon: '433' },
  { type: 'sound-sensor', name: 'Sound Sensor', category: 'Sensor', icon: 'SND' },
  { type: 'ds18b20-probe', name: 'DS18B20 Probe', category: 'Sensor', icon: 'DS18' },
  { type: 'hx711', name: 'HX711 Load Cell Amp', category: 'Sensor', icon: 'HX' },
  { type: 'ov7670-camera', name: 'OV7670 Camera', category: 'Sensor', icon: 'CAM' },
  { type: 'tcrt5000', name: 'TCRT5000 Sensor', category: 'Sensor', icon: 'IRL' },
  { type: 'shaft-encoder', name: 'Shaft Encoder', category: 'Sensor', icon: 'ENC' },
  { type: 'tcs230', name: 'TCS230 Color Sensor', category: 'Sensor', icon: 'RGB' },
  { type: 'uv-sensor', name: 'UV Sensor', category: 'Sensor', icon: 'UV' },
  { type: 'rc522', name: 'RC522 RFID', category: 'Sensor', icon: 'RFID' },
  { type: 'hc-sr04', name: 'HC-SR04 Ultrasonic', category: 'Sensor', icon: 'US' },
  { type: 'ir-sensor', name: 'IR Sensor', category: 'Sensor', icon: 'IR' },
  { type: 'bme280', name: 'BME280 Env Sensor', category: 'Sensor', icon: 'BME' },
  { type: 'ina219', name: 'INA219 Current Sensor', category: 'Sensor', icon: 'INA' },
  // Display
  { type: 'seven-segment', name: '7 Segment', category: 'Display', icon: '7SEG' },
  { type: 'lcd-16x2', name: 'LCD 16x2', category: 'Display', icon: 'LCD' },
  { type: 'oled-i2c', name: 'OLED I2C', category: 'Display', icon: 'OLED' },
  { type: 'tm1637', name: 'TM1637 Display', category: 'Display', icon: 'TM' },
  { type: 'max7219-matrix', name: 'MAX7219 8x8 Matrix', category: 'Display', icon: 'M8X8' },
  // Other
  { type: 'hc-05', name: 'Bluetooth HC-05', category: 'Other', icon: 'BT' },
  { type: 'keypad-4x4', name: 'Keypad 4x4', category: 'Other', icon: 'KEY' },
  { type: 'stepper-28byj48', name: '28BYJ-48 Stepper', category: 'Other', icon: 'STP' },
  { type: 'l298n-driver', name: 'L298N Driver', category: 'Other', icon: 'L298' },
  { type: 'breadboard-power-supply', name: 'Breadboard PSU', category: 'Other', icon: 'PSU' },
  { type: 'logic-level-converter', name: 'Level Converter', category: 'Other', icon: 'LLC' },
  { type: 'uln2003-driver', name: 'ULN2003 Driver', category: 'Other', icon: 'ULN' },
  { type: 'rf-433-transmitter', name: '433MHz Transmitter', category: 'Other', icon: 'TX433' },
  { type: 'esp8266-module', name: 'ESP8266 Module', category: 'Other', icon: 'ESP' },
  { type: 'microsd-module', name: 'microSD Module', category: 'Other', icon: 'SD' },
  { type: 'ds3231-rtc', name: 'DS3231 RTC', category: 'Other', icon: 'RTC' },
  { type: 'tp4056-charger', name: 'TP4056 Charger', category: 'Other', icon: 'BAT' },
  { type: 'rfm69hcw', name: 'RFM69HCW Radio', category: 'Other', icon: 'RF' },
  { type: 'deneyap-gps-glonass', name: 'Deneyap GPS/GLONASS', category: 'Sensor', icon: 'GPS' },
  { type: 'deneyap-9-axis-imu', name: 'Deneyap 9-Axis IMU', category: 'Sensor', icon: 'IMU' },
  { type: 'deneyap-touch-keypad', name: 'Deneyap Touch Keypad', category: 'Active', icon: 'TOUCH' },
  { type: 'deneyap-rain-sensor-center', name: 'Deneyap Rain Hub', category: 'Sensor', icon: 'RAIN' },
  { type: 'deneyap-rain-sensor-surface', name: 'Deneyap Rain Plate', category: 'Sensor', icon: 'RAIN' },
  { type: 'relay', name: 'Relay', category: 'Other', icon: 'RLY' },
  { type: 'transistor-npn', name: 'NPN Transistor', category: 'Other', icon: 'NPN' },
  { type: 'transistor-pnp', name: 'PNP Transistor', category: 'Other', icon: 'PNP' },
  { type: 'sx1276-lora', name: 'SX1276 LoRa Module', category: 'Other', icon: 'LORA' },
  { type: 'a4988-driver', name: 'A4988 Stepper Driver', category: 'Other', icon: 'A4988' },
  { type: 'multimeter', name: 'Digital Multimeter', category: 'Other', icon: 'DMM' },
  { type: 'oscilloscope', name: 'Oscilloscope', category: 'Other', icon: 'OSC' },
  { type: 'motor-driver', name: 'Motor Driver', category: 'Other', icon: 'DRV' },
];

export const WIRE_COLORS = [
  { name: 'Red', value: '#e74c3c' },
  { name: 'Black', value: '#2c3e50' },
  { name: 'Green', value: '#27ae60' },
  { name: 'Blue', value: '#3498db' },
  { name: 'Yellow', value: '#f1c40f' },
  { name: 'Orange', value: '#e67e22' },
  { name: 'White', value: '#ecf0f1' },
];

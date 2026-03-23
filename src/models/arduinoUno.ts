import type { Pin, PinType } from './types';
import arduinoUnoImage from '../assets/arduino-uno-fritzing.svg';
import arduinoUnoR4WifiImage from '../assets/boards/arduino-uno-r4-wifi-fritzing.svg';
import arduinoNanoImage from '../assets/boards/arduino-nano-fritzing.svg';
import arduinoMegaImage from '../assets/boards/arduino-mega-fritzing.svg';
import arduinoLeonardoImage from '../assets/boards/arduino-leonardo-fritzing.svg';
import deneyapKart1AImage from '../assets/boards/deneyap-kart-1a-fritzing.svg';
import deneyapKart1AV2Image from '../assets/boards/deneyap-kart-1a-v2-fritzing.svg';
import deneyapKartGImage from '../assets/boards/deneyap-kart-g-fritzing.svg';
import deneyapMiniImage from '../assets/boards/deneyap-mini-fritzing.svg';
import deneyapMiniV2Image from '../assets/boards/deneyap-mini-v2-fritzing.svg';
import nodemcuImage from '../assets/boards/nodemcu-amica-fritzing.svg';
import nodemcuV3Image from '../assets/boards/nodemcu-v3-fritzing.svg';
import wemosD1MiniImage from '../assets/boards/wemos-d1-mini-fritzing.svg';
import arduinoFioImage from '../assets/boards/arduino-fio-fritzing.svg';
import proMicroImage from '../assets/boards/pro-micro-fritzing.svg';
import picoImage from '../assets/boards/pico-fritzing.svg';
import featherHuzzah32Image from '../assets/boards/feather-huzzah32-fritzing.svg';
import esp32S3DevKitC1Image from '../assets/boards/esp32-s3-devkitc-1-fritzing.svg';

export type ControllerBoardType =
  | 'uno'
  | 'uno-r4-wifi'
  | 'nano'
  | 'mega'
  | 'leonardo'
  | 'deneyap-kart-1a'
  | 'deneyap-kart-1a-v2'
  | 'deneyap-kart-g'
  | 'deneyap-mini'
  | 'deneyap-mini-v2'
  | 'nodemcu'
  | 'nodemcu-v3'
  | 'wemos-d1-mini'
  | 'arduino-fio'
  | 'pro-micro'
  | 'pico'
  | 'feather-huzzah32'
  | 'esp32-s3-devkitc-1';

type ArduinoPinDef = {
  id: string;
  x: number;
  y: number;
  type: PinType;
  aliases?: string[];
};

type GeneratedBoardPinSeed = {
  name: string;
  x: number;
  y: number;
};

export type ControllerBoardDefinition = {
  type: ControllerBoardType;
  name: string;
  shortName: string;
  width: number;
  height: number;
  imageUrl: string;
  pinDefs: ArduinoPinDef[];
  aliases: string[];
  pinSummary: string;
  theme: {
    body: string;
    accent: string;
    outline: string;
    text: string;
    chip: string;
    pin: string;
    usb: string;
  };
};

export const ARDUINO_COMPONENT_ID = 'arduino-uno-fixed';
export const ARDUINO_X = 60;
export const ARDUINO_Y = 10;
export const DEFAULT_CONTROLLER_BOARD_TYPE: ControllerBoardType = 'uno';
export const DEFAULT_CONTROLLER_BOARD_POSITION = { x: ARDUINO_X, y: ARDUINO_Y };

const UNO_W = 300;
const UNO_H = 214;
const UNO_RAW_W = 212.372;
const UNO_RAW_H = 151.2;
const UNO_SCALE_X = UNO_W / UNO_RAW_W;
const UNO_SCALE_Y = UNO_H / UNO_RAW_H;

export const ARDUINO_W = UNO_W;
export const ARDUINO_H = UNO_H;

function scaleUnoX(rawX: number): number {
  return rawX * UNO_SCALE_X;
}

function scaleUnoY(rawY: number): number {
  return rawY * UNO_SCALE_Y;
}

const UNO_R4_W = 300;
const UNO_R4_H = 227;
const UNO_R4_RAW_W = 2772.3795;
const UNO_R4_RAW_H = 2099.9442;
const UNO_R4_SCALE_X = UNO_R4_W / UNO_R4_RAW_W;
const UNO_R4_SCALE_Y = UNO_R4_H / UNO_R4_RAW_H;

function scaleUnoR4X(rawX: number): number {
  return rawX * UNO_R4_SCALE_X;
}

function scaleUnoR4Y(rawY: number): number {
  return rawY * UNO_R4_SCALE_Y;
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function makePin(
  id: string,
  x: number,
  y: number,
  type: PinType,
  aliases?: string[]
): ArduinoPinDef {
  return { id, x, y, type, aliases };
}

function gpioAliases(pinNumber: number, ...extraAliases: string[]): string[] {
  return [
    `${pinNumber}`,
    `GPIO${pinNumber}`,
    `IO${pinNumber}`,
    `D${pinNumber}`,
    ...extraAliases,
  ];
}

function createVerticalPins(
  x: number,
  startY: number,
  spacing: number,
  pins: Array<{ id: string; type: PinType; aliases?: string[] }>
): ArduinoPinDef[] {
  return pins.map((pin, index) =>
    makePin(pin.id, x, startY + index * spacing, pin.type, pin.aliases)
  );
}

function createHorizontalPins(
  startX: number,
  y: number,
  spacing: number,
  pins: Array<{ id: string; type: PinType; aliases?: string[] }>
): ArduinoPinDef[] {
  return pins.map((pin, index) =>
    makePin(pin.id, startX + index * spacing, y, pin.type, pin.aliases)
  );
}

function inferGeneratedBoardPinType(name: string): PinType {
  const token = normalizeToken(name);

  if (!token) return 'passive';
  if (token.includes('gnd') || token === 'ground') return 'ground';
  if (
    token === '3v3' ||
    token === '3v' ||
    token === '5v' ||
    token === 'vin' ||
    token === 'vbat' ||
    token === 'bat' ||
    token === 'vcc'
  ) {
    return 'power';
  }
  if (/^(a\d+|da\d+|dac\d+)$/.test(token)) {
    return 'analog';
  }

  return 'digital';
}

function inferGeneratedBoardPinAliases(name: string): string[] {
  const token = normalizeToken(name);
  const aliases = new Set<string>();

  const add = (...values: string[]) => {
    values
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => aliases.add(value));
  };

  const digitalMatch = token.match(/^d(\d+)$/);
  if (digitalMatch) {
    const pinNumber = digitalMatch[1];
    add(pinNumber, `GPIO${pinNumber}`, `IO${pinNumber}`);
  }

  const analogMatch = token.match(/^a(\d+)$/);
  if (analogMatch) {
    add(`ADC${analogMatch[1]}`);
  }

  const dacMatch = token.match(/^(?:da|dac)(\d+)$/);
  if (dacMatch) {
    add(`DAC${dacMatch[1]}`, `DA${dacMatch[1]}`);
  }

  switch (token) {
    case 'vbat':
      add('BAT');
      break;
    case 'bat':
      add('VBAT');
      break;
    case 'reset':
      add('RST');
      break;
    case 'en':
      add('ENABLE');
      break;
    case 'scl':
      add('I2C_SCL');
      break;
    case 'sda':
      add('I2C_SDA');
      break;
    case 'tx':
      add('TXD');
      break;
    case 'rx':
      add('RXD');
      break;
    case 'mo':
      add('MOSI');
      break;
    case 'mi':
      add('MISO');
      break;
    case 'mc':
      add('SCK', 'CLK');
      break;
    case 'sc':
      add('SCL');
      break;
    case 'sd':
      add('SDA');
      break;
    case 'bt':
      add('BOOT');
      break;
    case '1pps':
      add('PPS');
      break;
  }

  return [...aliases].filter(
    (value) => normalizeToken(value) !== token
  );
}

function createGeneratedBoardPinDefs(
  seeds: GeneratedBoardPinSeed[]
): ArduinoPinDef[] {
  const counts = new Map<string, number>();

  return seeds.map((seed) => {
    const count = (counts.get(seed.name) ?? 0) + 1;
    counts.set(seed.name, count);

    const aliases = inferGeneratedBoardPinAliases(seed.name);
    if (count > 1) {
      aliases.unshift(seed.name);
    }

    return makePin(
      count === 1 ? seed.name : `${seed.name}_${count}`,
      seed.x,
      seed.y,
      inferGeneratedBoardPinType(seed.name),
      aliases.length > 0 ? aliases : undefined
    );
  });
}

const DENEYAP_KART_1A_PIN_SEEDS: GeneratedBoardPinSeed[] = [
  { name: 'A0', x: 3.409, y: 37.982 },
  { name: 'A1', x: 3.581, y: 47.462 },
  { name: 'A2', x: 3.842, y: 57.02 },
  { name: 'A3', x: 3.842, y: 67.694 },
  { name: 'A4', x: 3.842, y: 77.718 },
  { name: 'A5', x: 3.842, y: 88.392 },
  { name: 'DAC1', x: 3.581, y: 98.267 },
  { name: 'DAC2', x: 3.842, y: 107.824 },
  { name: 'D15', x: 3.842, y: 118.499 },
  { name: 'D14', x: 4.103, y: 128.425 },
  { name: 'D13', x: 4.131, y: 139.078 },
  { name: 'D12', x: 3.87, y: 148.952 },
  { name: 'VBAT', x: 4.131, y: 158.51 },
  { name: '5V', x: 4.131, y: 169.184 },
  { name: 'GND', x: 4.392, y: 179.11 },
  { name: 'GND', x: 98.216, y: 179.11 },
  { name: '3V3', x: 97.955, y: 169.184 },
  { name: '3V3', x: 97.955, y: 158.51 },
  { name: 'SCL', x: 97.694, y: 148.952 },
  { name: 'SDA', x: 97.955, y: 139.078 },
  { name: 'D9', x: 97.806, y: 128.425 },
  { name: 'D8', x: 97.545, y: 118.499 },
  { name: 'MOSI', x: 97.545, y: 107.824 },
  { name: 'MISO', x: 97.283, y: 98.267 },
  { name: 'SCK', x: 97.545, y: 88.392 },
  { name: 'D4', x: 97.545, y: 77.718 },
  { name: 'RX', x: 97.545, y: 67.694 },
  { name: 'TX', x: 97.545, y: 57.02 },
  { name: 'D1', x: 97.283, y: 47.462 },
  { name: 'D0', x: 97.111, y: 37.982 },
];

const DENEYAP_KART_G_PIN_SEEDS: GeneratedBoardPinSeed[] = [
  { name: 'A0', x: 74.379, y: 24.59 },
  { name: 'A1', x: 74.379, y: 34.659 },
  { name: 'SCL', x: 74.379, y: 44.728 },
  { name: 'A2', x: 74.379, y: 54.798 },
  { name: 'A3', x: 74.379, y: 64.867 },
  { name: 'A4', x: 74.379, y: 74.937 },
  { name: 'A5', x: 74.752, y: 85.352 },
  { name: 'D5', x: 74.752, y: 95.421 },
  { name: 'SDA', x: 74.752, y: 105.491 },
  { name: '3V3', x: 129.334, y: 104.478 },
  { name: '3V3', x: 129.334, y: 94.409 },
  { name: 'GND', x: 129.334, y: 84.34 },
  { name: 'GND', x: 128.961, y: 73.924 },
  { name: 'BAT', x: 128.961, y: 63.855 },
  { name: 'D3', x: 128.961, y: 53.785 },
  { name: 'D2', x: 128.961, y: 43.716 },
  { name: 'TX', x: 128.961, y: 33.647 },
  { name: 'RX', x: 128.961, y: 23.577 },
];

const DENEYAP_MINI_PIN_SEEDS: GeneratedBoardPinSeed[] = [
  { name: 'BT', x: 4.505, y: 37.092 },
  { name: 'A0', x: 4.505, y: 47.176 },
  { name: 'A1', x: 4.505, y: 57.264 },
  { name: 'A2', x: 4.505, y: 67.348 },
  { name: 'A3', x: 4.505, y: 77.432 },
  { name: 'A4', x: 4.505, y: 87.515 },
  { name: 'A5', x: 4.505, y: 97.599 },
  { name: 'A6', x: 4.505, y: 107.683 },
  { name: 'DA0', x: 4.505, y: 117.767 },
  { name: 'DA1', x: 4.505, y: 127.851 },
  { name: 'D10', x: 4.505, y: 137.935 },
  { name: 'D9', x: 4.505, y: 148.018 },
  { name: 'GND', x: 4.52, y: 158.102 },
  { name: '3V3', x: 4.473, y: 168.777 },
  { name: '5V', x: 4.473, y: 178.766 },
  { name: 'EN', x: 73.515, y: 37.022 },
  { name: 'RX', x: 73.515, y: 47.105 },
  { name: 'TX', x: 73.515, y: 57.189 },
  { name: 'D2', x: 73.515, y: 67.273 },
  { name: 'D3', x: 73.515, y: 77.357 },
  { name: 'MO', x: 73.515, y: 87.441 },
  { name: 'MI', x: 73.515, y: 97.525 },
  { name: 'MC', x: 73.515, y: 107.608 },
  { name: 'SC', x: 73.515, y: 117.692 },
  { name: 'SD', x: 73.515, y: 127.776 },
  { name: '3V3', x: 73.515, y: 137.86 },
  { name: 'GND', x: 73.515, y: 147.944 },
];

const DENEYAP_MINI_V2_PIN_SEEDS: GeneratedBoardPinSeed[] = [
  { name: 'A0', x: 4.505, y: 37.092 },
  { name: 'A1', x: 4.505, y: 47.176 },
  { name: 'A2', x: 4.505, y: 57.264 },
  { name: 'A3', x: 4.505, y: 67.348 },
  { name: 'A4', x: 4.505, y: 77.432 },
  { name: 'A5', x: 4.505, y: 87.515 },
  { name: 'A6', x: 4.505, y: 97.599 },
  { name: 'A7', x: 4.505, y: 107.683 },
  { name: 'DA0', x: 4.505, y: 117.767 },
  { name: 'DA1', x: 4.505, y: 127.851 },
  { name: 'D10', x: 4.505, y: 137.935 },
  { name: 'D9', x: 4.505, y: 148.018 },
  { name: 'GND', x: 4.52, y: 158.102 },
  { name: '3V3', x: 4.473, y: 168.777 },
  { name: '5V', x: 4.473, y: 178.766 },
  { name: 'EN', x: 73.515, y: 37.022 },
  { name: 'RX', x: 73.515, y: 47.105 },
  { name: 'TX', x: 73.515, y: 57.189 },
  { name: 'D2', x: 73.515, y: 67.273 },
  { name: 'D3', x: 73.515, y: 77.357 },
  { name: 'MO', x: 73.515, y: 87.441 },
  { name: 'MI', x: 73.515, y: 97.525 },
  { name: 'MC', x: 73.515, y: 107.608 },
  { name: 'SC', x: 73.515, y: 117.692 },
  { name: 'SD', x: 73.515, y: 127.776 },
  { name: '3V3', x: 73.515, y: 137.86 },
  { name: 'GND', x: 73.515, y: 147.944 },
];

const DENEYAP_KART_1A_PIN_DEFS = createGeneratedBoardPinDefs(
  DENEYAP_KART_1A_PIN_SEEDS
);
const DENEYAP_KART_G_PIN_DEFS = createGeneratedBoardPinDefs(
  DENEYAP_KART_G_PIN_SEEDS
);
const DENEYAP_MINI_PIN_DEFS = createGeneratedBoardPinDefs(
  DENEYAP_MINI_PIN_SEEDS
);
const DENEYAP_MINI_V2_PIN_DEFS = createGeneratedBoardPinDefs(
  DENEYAP_MINI_V2_PIN_SEEDS
);

const UNO_PIN_DEFS: ArduinoPinDef[] = [
  makePin('SCL', scaleUnoX(71.251), scaleUnoY(7.2), 'digital'),
  makePin('SDA', scaleUnoX(78.452), scaleUnoY(7.2), 'digital'),
  makePin('AREF', scaleUnoX(85.652), scaleUnoY(7.2), 'power'),
  makePin('GND_TOP', scaleUnoX(92.852), scaleUnoY(7.2), 'ground', ['GND']),
  makePin('D13', scaleUnoX(100.052), scaleUnoY(7.2), 'digital', ['13']),
  makePin('D12', scaleUnoX(107.252), scaleUnoY(7.2), 'digital', ['12']),
  makePin('D11', scaleUnoX(114.452), scaleUnoY(7.2), 'digital', ['11']),
  makePin('D10', scaleUnoX(121.652), scaleUnoY(7.2), 'digital', ['10']),
  makePin('D9', scaleUnoX(128.852), scaleUnoY(7.2), 'digital', ['9']),
  makePin('D8', scaleUnoX(136.051), scaleUnoY(7.2), 'digital', ['8']),
  makePin('D7', scaleUnoX(147.573), scaleUnoY(7.2), 'digital', ['7']),
  makePin('D6', scaleUnoX(154.772), scaleUnoY(7.2), 'digital', ['6']),
  makePin('D5', scaleUnoX(161.972), scaleUnoY(7.2), 'digital', ['5']),
  makePin('D4', scaleUnoX(169.172), scaleUnoY(7.2), 'digital', ['4']),
  makePin('D3', scaleUnoX(176.372), scaleUnoY(7.2), 'digital', ['3']),
  makePin('D2', scaleUnoX(183.573), scaleUnoY(7.2), 'digital', ['2']),
  makePin('D1', scaleUnoX(190.772), scaleUnoY(7.2), 'digital', ['1', 'TX']),
  makePin('D0', scaleUnoX(197.972), scaleUnoY(7.2), 'digital', ['0', 'RX']),
  makePin('IOREF', scaleUnoX(104.372), scaleUnoY(144), 'power'),
  makePin('RESET', scaleUnoX(111.573), scaleUnoY(144), 'digital', ['RST']),
  makePin('3V3', scaleUnoX(118.772), scaleUnoY(144), 'power', ['3.3V', '3V']),
  makePin('5V', scaleUnoX(125.972), scaleUnoY(144), 'power'),
  makePin('GND', scaleUnoX(133.172), scaleUnoY(144), 'ground'),
  makePin('GND_2', scaleUnoX(140.372), scaleUnoY(144), 'ground', ['GROUND']),
  makePin('VIN', scaleUnoX(147.573), scaleUnoY(144), 'power'),
  makePin('A0', scaleUnoX(161.972), scaleUnoY(144), 'analog'),
  makePin('A1', scaleUnoX(169.172), scaleUnoY(144), 'analog'),
  makePin('A2', scaleUnoX(176.372), scaleUnoY(144), 'analog'),
  makePin('A3', scaleUnoX(183.573), scaleUnoY(144), 'analog'),
  makePin('A4', scaleUnoX(190.772), scaleUnoY(144), 'analog'),
  makePin('A5', scaleUnoX(197.972), scaleUnoY(144), 'analog'),
];

const NANO_LEFT_PINS = createVerticalPins(12, 24, 16, [
  { id: 'D1', type: 'digital', aliases: ['1', 'TX'] },
  { id: 'D0', type: 'digital', aliases: ['0', 'RX'] },
  { id: 'RESET', type: 'digital', aliases: ['RST'] },
  { id: 'GND', type: 'ground' },
  { id: 'D2', type: 'digital', aliases: ['2'] },
  { id: 'D3', type: 'digital', aliases: ['3'] },
  { id: 'D4', type: 'digital', aliases: ['4'] },
  { id: 'D5', type: 'digital', aliases: ['5'] },
  { id: 'D6', type: 'digital', aliases: ['6'] },
  { id: 'D7', type: 'digital', aliases: ['7'] },
  { id: 'D8', type: 'digital', aliases: ['8'] },
  { id: 'D9', type: 'digital', aliases: ['9'] },
  { id: 'D10', type: 'digital', aliases: ['10'] },
  { id: 'D11', type: 'digital', aliases: ['11'] },
  { id: 'D12', type: 'digital', aliases: ['12'] },
]);

const NANO_RIGHT_PINS = createVerticalPins(128, 24, 16, [
  { id: 'D13', type: 'digital', aliases: ['13', 'LED_BUILTIN'] },
  { id: '3V3', type: 'power', aliases: ['3.3V', '3V'] },
  { id: 'AREF', type: 'power' },
  { id: 'A0', type: 'analog' },
  { id: 'A1', type: 'analog' },
  { id: 'A2', type: 'analog' },
  { id: 'A3', type: 'analog' },
  { id: 'A4', type: 'analog', aliases: ['SDA'] },
  { id: 'A5', type: 'analog', aliases: ['SCL'] },
  { id: 'A6', type: 'analog' },
  { id: 'A7', type: 'analog' },
  { id: '5V', type: 'power' },
  { id: 'RESET_2', type: 'digital', aliases: ['RESET', 'RST2'] },
  { id: 'VIN', type: 'power' },
  { id: 'GND_2', type: 'ground', aliases: ['GROUND'] },
]);

const NANO_PIN_DEFS = [...NANO_LEFT_PINS, ...NANO_RIGHT_PINS];

const MEGA_TOP_PINS = createHorizontalPins(26, 14, 12.5, [
  { id: 'SCL', type: 'digital' },
  { id: 'SDA', type: 'digital' },
  { id: 'D21', type: 'digital', aliases: ['21'] },
  { id: 'D20', type: 'digital', aliases: ['20'] },
  { id: 'D19', type: 'digital', aliases: ['19'] },
  { id: 'D18', type: 'digital', aliases: ['18'] },
  { id: 'D17', type: 'digital', aliases: ['17'] },
  { id: 'D16', type: 'digital', aliases: ['16'] },
  { id: 'D15', type: 'digital', aliases: ['15'] },
  { id: 'D14', type: 'digital', aliases: ['14'] },
  { id: 'D13', type: 'digital', aliases: ['13', 'LED_BUILTIN'] },
  { id: 'D12', type: 'digital', aliases: ['12'] },
  { id: 'D11', type: 'digital', aliases: ['11'] },
  { id: 'D10', type: 'digital', aliases: ['10'] },
  { id: 'D9', type: 'digital', aliases: ['9'] },
  { id: 'D8', type: 'digital', aliases: ['8'] },
  { id: 'D7', type: 'digital', aliases: ['7'] },
  { id: 'D6', type: 'digital', aliases: ['6'] },
  { id: 'D5', type: 'digital', aliases: ['5'] },
  { id: 'D4', type: 'digital', aliases: ['4'] },
  { id: 'D3', type: 'digital', aliases: ['3'] },
  { id: 'D2', type: 'digital', aliases: ['2'] },
  { id: 'D1', type: 'digital', aliases: ['1', 'TX'] },
  { id: 'D0', type: 'digital', aliases: ['0', 'RX'] },
]);

const MEGA_BOTTOM_PINS = createHorizontalPins(26, 216, 12.5, [
  { id: 'IOREF', type: 'power' },
  { id: 'RESET', type: 'digital', aliases: ['RST'] },
  { id: '3V3', type: 'power', aliases: ['3.3V', '3V'] },
  { id: '5V', type: 'power' },
  { id: 'GND', type: 'ground' },
  { id: 'GND_2', type: 'ground', aliases: ['GROUND'] },
  { id: 'VIN', type: 'power' },
  { id: 'AREF', type: 'power' },
  { id: 'A15', type: 'analog' },
  { id: 'A14', type: 'analog' },
  { id: 'A13', type: 'analog' },
  { id: 'A12', type: 'analog' },
  { id: 'A11', type: 'analog' },
  { id: 'A10', type: 'analog' },
  { id: 'A9', type: 'analog' },
  { id: 'A8', type: 'analog' },
  { id: 'A7', type: 'analog' },
  { id: 'A6', type: 'analog' },
  { id: 'A5', type: 'analog' },
  { id: 'A4', type: 'analog' },
  { id: 'A3', type: 'analog' },
  { id: 'A2', type: 'analog' },
  { id: 'A1', type: 'analog' },
  { id: 'A0', type: 'analog' },
]);

const MEGA_PIN_DEFS = [...MEGA_TOP_PINS, ...MEGA_BOTTOM_PINS];

const LEONARDO_PIN_DEFS: ArduinoPinDef[] = [
  makePin('SCL', 74, 12, 'digital'),
  makePin('SDA', 84, 12, 'digital'),
  makePin('AREF', 94, 12, 'power'),
  makePin('GND_TOP', 104, 12, 'ground', ['GND']),
  makePin('D13', 114, 12, 'digital', ['13', 'LED_BUILTIN']),
  makePin('D12', 124, 12, 'digital', ['12']),
  makePin('D11', 134, 12, 'digital', ['11']),
  makePin('D10', 144, 12, 'digital', ['10']),
  makePin('D9', 154, 12, 'digital', ['9']),
  makePin('D8', 164, 12, 'digital', ['8']),
  makePin('D7', 176, 12, 'digital', ['7']),
  makePin('D6', 186, 12, 'digital', ['6']),
  makePin('D5', 196, 12, 'digital', ['5']),
  makePin('D4', 206, 12, 'digital', ['4']),
  makePin('D3', 216, 12, 'digital', ['3']),
  makePin('D2', 226, 12, 'digital', ['2']),
  makePin('D1', 236, 12, 'digital', ['1', 'TX']),
  makePin('D0', 246, 12, 'digital', ['0', 'RX']),
  makePin('IOREF', 122, 198, 'power'),
  makePin('RESET', 132, 198, 'digital', ['RST']),
  makePin('3V3', 142, 198, 'power', ['3.3V', '3V']),
  makePin('5V', 152, 198, 'power'),
  makePin('GND', 162, 198, 'ground'),
  makePin('GND_2', 172, 198, 'ground', ['GROUND']),
  makePin('VIN', 182, 198, 'power'),
  makePin('A0', 198, 198, 'analog'),
  makePin('A1', 208, 198, 'analog'),
  makePin('A2', 218, 198, 'analog'),
  makePin('A3', 228, 198, 'analog'),
  makePin('A4', 238, 198, 'analog'),
  makePin('A5', 248, 198, 'analog'),
];

const DENEYAP_W = 96;
const DENEYAP_H = 239;
const DENEYAP_RAW_W = 25.3;
const DENEYAP_RAW_H = 63;
const DENEYAP_SCALE_X = DENEYAP_W / DENEYAP_RAW_W;
const DENEYAP_SCALE_Y = DENEYAP_H / DENEYAP_RAW_H;

function scaleDeneyapX(rawX: number): number {
  return rawX * DENEYAP_SCALE_X;
}

function scaleDeneyapY(rawY: number): number {
  return rawY * DENEYAP_SCALE_Y;
}

const DENEYAP_KART_1A_V2_PIN_DEFS: ArduinoPinDef[] = [
  makePin('EN', scaleDeneyapX(1.341), scaleDeneyapY(7.427), 'digital', [
    'CHIP_EN',
  ]),
  makePin('A0', scaleDeneyapX(1.384), scaleDeneyapY(9.797), 'analog'),
  makePin('A1', scaleDeneyapX(1.449), scaleDeneyapY(12.187), 'analog'),
  makePin('A2', scaleDeneyapX(1.449), scaleDeneyapY(14.855), 'analog'),
  makePin('A3', scaleDeneyapX(1.449), scaleDeneyapY(17.361), 'analog'),
  makePin('A4', scaleDeneyapX(1.449), scaleDeneyapY(20.03), 'analog'),
  makePin('A5', scaleDeneyapX(1.384), scaleDeneyapY(22.498), 'analog'),
  makePin('A6', scaleDeneyapX(1.449), scaleDeneyapY(24.888), 'analog'),
  makePin('A7', scaleDeneyapX(1.449), scaleDeneyapY(27.556), 'analog'),
  makePin('D14', scaleDeneyapX(1.514), scaleDeneyapY(30.038), 'digital', [
    '14',
  ]),
  makePin('D13', scaleDeneyapX(1.589), scaleDeneyapY(32.435), 'digital', [
    '13',
    'LED_BUILTIN',
  ]),
  makePin('D12', scaleDeneyapX(1.654), scaleDeneyapY(34.825), 'digital', [
    '12',
  ]),
  makePin(
    '3V3_LEFT',
    scaleDeneyapX(1.654),
    scaleDeneyapY(37.493),
    'power',
    ['3V3', '3.3V', '3V', 'VCC']
  ),
  makePin('BAT', scaleDeneyapX(1.654), scaleDeneyapY(40), 'power', [
    'VBAT',
    'BATTERY',
  ]),
  makePin('5V', scaleDeneyapX(1.638), scaleDeneyapY(42.53), 'power', [
    'USB',
    'VUSB',
  ]),
  makePin(
    'GND_LEFT',
    scaleDeneyapX(1.638),
    scaleDeneyapY(45.068),
    'ground',
    ['GND', 'GROUND']
  ),
  makePin(
    'GND_RIGHT_TOP',
    scaleDeneyapX(23.896),
    scaleDeneyapY(45.068),
    'ground',
    ['GND', 'GROUND']
  ),
  makePin(
    '3V3_RIGHT_TOP',
    scaleDeneyapX(23.896),
    scaleDeneyapY(42.53),
    'power',
    ['3V3', '3.3V', '3V', 'VCC']
  ),
  makePin(
    '3V3_RIGHT_MID',
    scaleDeneyapX(23.912),
    scaleDeneyapY(40),
    'power',
    ['3V3', '3.3V', '3V', 'VCC']
  ),
  makePin('SCL', scaleDeneyapX(23.912), scaleDeneyapY(37.493), 'digital', [
    'I2C_SCL',
  ]),
  makePin('SDA', scaleDeneyapX(23.912), scaleDeneyapY(34.825), 'digital', [
    'I2C_SDA',
  ]),
  makePin('D9', scaleDeneyapX(23.847), scaleDeneyapY(32.435), 'digital', [
    '9',
  ]),
  makePin('D8', scaleDeneyapX(23.772), scaleDeneyapY(30.038), 'digital', [
    '8',
  ]),
  makePin('MOSI', scaleDeneyapX(23.707), scaleDeneyapY(27.556), 'digital', [
    'SPI_MOSI',
  ]),
  makePin('MISO', scaleDeneyapX(23.707), scaleDeneyapY(24.888), 'digital', [
    'SPI_MISO',
  ]),
  makePin('SCK', scaleDeneyapX(23.642), scaleDeneyapY(22.498), 'digital', [
    'SPI_SCK',
    'CLK',
  ]),
  makePin('D4', scaleDeneyapX(23.707), scaleDeneyapY(20.03), 'digital', [
    '4',
  ]),
  makePin('RX', scaleDeneyapX(23.707), scaleDeneyapY(17.361), 'digital', [
    'RX0',
  ]),
  makePin('TX', scaleDeneyapX(23.707), scaleDeneyapY(14.855), 'digital', [
    'TX0',
  ]),
  makePin('D1', scaleDeneyapX(23.707), scaleDeneyapY(12.187), 'digital', [
    '1',
  ]),
  makePin('D0', scaleDeneyapX(23.642), scaleDeneyapY(9.797), 'digital', [
    '0',
  ]),
  makePin(
    'GND_RIGHT_BOTTOM',
    scaleDeneyapX(23.599),
    scaleDeneyapY(7.427),
    'ground',
    ['GND', 'GROUND']
  ),
];

const NODEMCU_PIN_DEFS = [
  ...createVerticalPins(12, 30, 28, [
    { id: 'A0', type: 'analog' },
    { id: 'VIN', type: 'power', aliases: ['VU', '5V'] },
    { id: 'GND', type: 'ground' },
    { id: '3V3', type: 'power', aliases: ['3.3V', '3V', 'VCC'] },
    { id: 'EN', type: 'digital' },
    { id: 'RST', type: 'digital', aliases: ['RESET'] },
  ]),
  ...createVerticalPins(98, 18, 18, [
    { id: 'D0', type: 'digital', aliases: gpioAliases(16) },
    { id: 'D1', type: 'digital', aliases: gpioAliases(5, 'SCL') },
    { id: 'D2', type: 'digital', aliases: gpioAliases(4, 'SDA') },
    { id: 'D3', type: 'digital', aliases: gpioAliases(0) },
    { id: 'D4', type: 'digital', aliases: gpioAliases(2, 'LED_BUILTIN') },
    { id: 'D5', type: 'digital', aliases: gpioAliases(14) },
    { id: 'D6', type: 'digital', aliases: gpioAliases(12) },
    { id: 'D7', type: 'digital', aliases: gpioAliases(13) },
    { id: 'D8', type: 'digital', aliases: gpioAliases(15) },
    { id: 'RX', type: 'digital', aliases: gpioAliases(3, 'D9') },
    { id: 'TX', type: 'digital', aliases: gpioAliases(1, 'D10') },
  ]),
];

const NODEMCU_V3_TOP_PINS = createHorizontalPins(29.554, 3.96, 6.698, [
  { id: 'A0', type: 'analog' },
  { id: 'GND_TOP_1', type: 'ground', aliases: ['GND', 'GROUND'] },
  { id: 'VU', type: 'power', aliases: ['5V', 'USB'] },
  { id: 'SD3', type: 'digital', aliases: ['S3'] },
  { id: 'SD2', type: 'digital', aliases: ['S2'] },
  { id: 'SD1', type: 'digital', aliases: ['S1'] },
  { id: 'CMD', type: 'digital', aliases: ['SC'] },
  { id: 'SD0', type: 'digital', aliases: ['S0'] },
  { id: 'CLK', type: 'digital', aliases: ['SK', 'SCLK'] },
  { id: 'GND_TOP_2', type: 'ground', aliases: ['GND', 'GROUND'] },
  { id: '3V3_TOP', type: 'power', aliases: ['3V3', '3.3V', '3V', 'VCC'] },
  { id: 'EN', type: 'digital', aliases: ['CHIP_EN'] },
  { id: 'RST', type: 'digital', aliases: ['RESET'] },
  { id: 'GND_TOP_3', type: 'ground', aliases: ['GND', 'GROUND'] },
  { id: 'VIN', type: 'power', aliases: ['VIN_RAW'] },
]);

const NODEMCU_V3_BOTTOM_PINS = createHorizontalPins(29.554, 78.69, 6.698, [
  { id: 'D0', type: 'digital', aliases: gpioAliases(16) },
  { id: 'D1', type: 'digital', aliases: gpioAliases(5, 'SCL') },
  { id: 'D2', type: 'digital', aliases: gpioAliases(4, 'SDA') },
  { id: 'D3', type: 'digital', aliases: gpioAliases(0) },
  { id: 'D4', type: 'digital', aliases: gpioAliases(2, 'LED_BUILTIN') },
  { id: '3V3_BOTTOM_1', type: 'power', aliases: ['3V3', '3.3V', '3V', 'VCC'] },
  { id: 'GND_BOTTOM_1', type: 'ground', aliases: ['GND', 'GROUND'] },
  { id: 'D5', type: 'digital', aliases: gpioAliases(14) },
  { id: 'D6', type: 'digital', aliases: gpioAliases(12) },
  { id: 'D7', type: 'digital', aliases: gpioAliases(13) },
  { id: 'D8', type: 'digital', aliases: gpioAliases(15) },
  { id: 'RX', type: 'digital', aliases: gpioAliases(3, 'D9') },
  { id: 'TX', type: 'digital', aliases: gpioAliases(1, 'D10') },
  { id: 'GND_BOTTOM_2', type: 'ground', aliases: ['GND', 'GROUND'] },
  { id: '3V3_BOTTOM_2', type: 'power', aliases: ['3V3', '3.3V', '3V', 'VCC'] },
]);

const NODEMCU_V3_PIN_DEFS = [
  ...NODEMCU_V3_TOP_PINS,
  ...NODEMCU_V3_BOTTOM_PINS,
];

const WEMOS_D1_MINI_LEFT_PINS = createVerticalPins(3.884, 20.6, 7.2, [
  { id: 'RST', type: 'digital', aliases: ['RESET'] },
  { id: 'A0', type: 'analog' },
  { id: 'D0', type: 'digital', aliases: gpioAliases(16) },
  { id: 'D5', type: 'digital', aliases: gpioAliases(14, 'SCK') },
  { id: 'D6', type: 'digital', aliases: gpioAliases(12, 'MISO') },
  { id: 'D7', type: 'digital', aliases: gpioAliases(13, 'MOSI') },
  { id: 'D8', type: 'digital', aliases: gpioAliases(15) },
  { id: '3V3', type: 'power', aliases: ['3.3V', '3V', 'VCC'] },
]);

const WEMOS_D1_MINI_RIGHT_PINS = createVerticalPins(68.684, 20.6, 7.2, [
  { id: 'TX', type: 'digital', aliases: gpioAliases(1, 'D10') },
  { id: 'RX', type: 'digital', aliases: gpioAliases(3, 'D9') },
  { id: 'D1', type: 'digital', aliases: gpioAliases(5, 'SCL') },
  { id: 'D2', type: 'digital', aliases: gpioAliases(4, 'SDA') },
  { id: 'D3', type: 'digital', aliases: gpioAliases(0) },
  { id: 'D4', type: 'digital', aliases: gpioAliases(2, 'LED_BUILTIN') },
  { id: 'GND', type: 'ground', aliases: ['G', 'GROUND'] },
  { id: '5V', type: 'power', aliases: ['VIN', 'USB'] },
]);

const WEMOS_D1_MINI_PIN_DEFS = [
  ...WEMOS_D1_MINI_LEFT_PINS,
  ...WEMOS_D1_MINI_RIGHT_PINS,
];

const FIO_TOP_PINS = createHorizontalPins(3.6, 7.298, 7.2, [
  { id: 'D13', type: 'digital', aliases: ['13', 'SCK', 'LED_BUILTIN'] },
  { id: 'D12', type: 'digital', aliases: ['12', 'MISO'] },
  { id: 'D11', type: 'digital', aliases: ['11', 'MOSI'] },
  { id: 'D10', type: 'digital', aliases: ['10', 'SS'] },
  { id: 'D9', type: 'digital', aliases: ['9'] },
  { id: 'D8', type: 'digital', aliases: ['8'] },
  { id: 'D7', type: 'digital', aliases: ['7'] },
  { id: 'D6', type: 'digital', aliases: ['6'] },
  { id: 'D5', type: 'digital', aliases: ['5'] },
  { id: 'D4', type: 'digital', aliases: ['4'] },
  { id: 'D3', type: 'digital', aliases: ['3'] },
  { id: 'D2', type: 'digital', aliases: ['2'] },
  { id: 'GND_TOP', type: 'ground', aliases: ['GND', 'GROUND'] },
  { id: 'VCC_TOP', type: 'power', aliases: ['VCC', '3V3', '3.3V'] },
]);

const FIO_BOTTOM_PINS = createHorizontalPins(3.6, 72.098, 7.2, [
  { id: 'A7', type: 'analog' },
  { id: 'A6', type: 'analog' },
  { id: 'A5', type: 'analog', aliases: ['SCL'] },
  { id: 'A4', type: 'analog', aliases: ['SDA'] },
  { id: 'A3', type: 'analog' },
  { id: 'A2', type: 'analog' },
  { id: 'A1', type: 'analog' },
  { id: 'A0', type: 'analog' },
  { id: 'DTR_RESET', type: 'digital', aliases: ['DTR', 'RESET'] },
  { id: 'D1', type: 'digital', aliases: ['1', 'TX', 'TXO'] },
  { id: 'D0', type: 'digital', aliases: ['0', 'RX', 'RXI'] },
  { id: 'VCC_BOTTOM', type: 'power', aliases: ['VCC', '3V3', '3.3V'] },
  { id: 'AREF', type: 'power' },
  { id: 'GND_BOTTOM', type: 'ground', aliases: ['GND', 'GROUND'] },
]);

const FIO_SIDE_PINS: ArduinoPinDef[] = [
  makePin('GND_SIDE', 151.2, 25.298, 'ground', ['GND', 'GROUND']),
  makePin('USB_VIN', 151.2, 32.498, 'power', ['USB', 'VIN', '5V']),
  makePin('GND_BAT', 151.2, 50.497, 'ground', ['GND', 'GROUND']),
  makePin('VBATT', 151.2, 57.698, 'power', ['BAT', 'VBAT']),
];

const FIO_PIN_DEFS = [...FIO_TOP_PINS, ...FIO_BOTTOM_PINS, ...FIO_SIDE_PINS];

const PRO_MICRO_W = 166;
const PRO_MICRO_H = 81;
const PRO_MICRO_RAW_W = 103.465;
const PRO_MICRO_RAW_H = 50.598;
const PRO_MICRO_SCALE_X = PRO_MICRO_W / PRO_MICRO_RAW_W;
const PRO_MICRO_SCALE_Y = PRO_MICRO_H / PRO_MICRO_RAW_H;

function scaleProMicroX(rawX: number): number {
  return rawX * PRO_MICRO_SCALE_X;
}

function scaleProMicroY(rawY: number): number {
  return rawY * PRO_MICRO_SCALE_Y;
}

const PRO_MICRO_PIN_DEFS: ArduinoPinDef[] = [
  makePin('RAW', scaleProMicroX(13.542), scaleProMicroY(3.723), 'power'),
  makePin('GND', scaleProMicroX(20.742), scaleProMicroY(3.723), 'ground'),
  makePin('RST', scaleProMicroX(27.942), scaleProMicroY(3.723), 'digital', ['RESET']),
  makePin('VCC', scaleProMicroX(35.143), scaleProMicroY(3.723), 'power', ['5V']),
  makePin('A3', scaleProMicroX(42.342), scaleProMicroY(3.723), 'analog', ['D21', '21']),
  makePin('A2', scaleProMicroX(49.542), scaleProMicroY(3.723), 'analog', ['D20', '20']),
  makePin('A1', scaleProMicroX(56.743), scaleProMicroY(3.723), 'analog', ['D19', '19']),
  makePin('A0', scaleProMicroX(63.941), scaleProMicroY(3.723), 'analog', ['D18', '18']),
  makePin('SCK', scaleProMicroX(71.143), scaleProMicroY(3.723), 'digital', ['D15', '15', 'SCLK']),
  makePin('MISO', scaleProMicroX(78.342), scaleProMicroY(3.723), 'digital', ['D14', '14']),
  makePin('MOSI', scaleProMicroX(85.542), scaleProMicroY(3.723), 'digital', ['D16', '16']),
  makePin('D10', scaleProMicroX(92.742), scaleProMicroY(3.723), 'digital', ['10']),
  makePin('TX', scaleProMicroX(13.542), scaleProMicroY(46.922), 'digital', ['TX1', '1']),
  makePin('RX', scaleProMicroX(20.742), scaleProMicroY(46.922), 'digital', ['RX0', '0']),
  makePin('GND_2', scaleProMicroX(27.942), scaleProMicroY(46.922), 'ground', ['GROUND']),
  makePin('GND_3', scaleProMicroX(35.143), scaleProMicroY(46.922), 'ground'),
  makePin('D2', scaleProMicroX(42.342), scaleProMicroY(46.922), 'digital', ['2']),
  makePin('D3', scaleProMicroX(49.542), scaleProMicroY(46.922), 'digital', ['3']),
  makePin('D4', scaleProMicroX(56.743), scaleProMicroY(46.922), 'digital', ['4']),
  makePin('D5', scaleProMicroX(63.941), scaleProMicroY(46.922), 'digital', ['5']),
  makePin('D6', scaleProMicroX(71.143), scaleProMicroY(46.922), 'digital', ['6']),
  makePin('D7', scaleProMicroX(78.342), scaleProMicroY(46.922), 'digital', ['7']),
  makePin('D8', scaleProMicroX(85.542), scaleProMicroY(46.922), 'digital', ['8']),
  makePin('D9', scaleProMicroX(92.742), scaleProMicroY(46.922), 'digital', ['9']),
];

const PICO_W = 80;
const PICO_H = 188;
const PICO_RAW_W = 50.4;
const PICO_RAW_H = 118.8;
const PICO_SCALE_X = PICO_W / PICO_RAW_W;
const PICO_SCALE_Y = PICO_H / PICO_RAW_H;

function scalePicoX(rawX: number): number {
  return rawX * PICO_SCALE_X;
}

function scalePicoY(rawY: number): number {
  return rawY * PICO_SCALE_Y;
}

const PICO_PIN_DEFS: ArduinoPinDef[] = [
  makePin('D1', scalePicoX(3.64), scalePicoY(82.859), 'digital', ['1', 'TX']),
  makePin('D0', scalePicoX(3.619), scalePicoY(75.665), 'digital', ['0', 'RX']),
  makePin('5V', scalePicoX(3.619), scalePicoY(68.419), 'power', ['VBUS', '+5V']),
  makePin('GND', scalePicoX(3.611), scalePicoY(61.224), 'ground'),
  makePin('RST', scalePicoX(3.625), scalePicoY(54.017), 'digital', ['RESET']),
  makePin('AREF', scalePicoX(3.63), scalePicoY(46.813), 'power'),
  makePin('A5', scalePicoX(3.627), scalePicoY(39.593), 'analog'),
  makePin('A4', scalePicoX(3.628), scalePicoY(32.379), 'analog'),
  makePin('A3', scalePicoX(3.631), scalePicoY(25.178), 'analog'),
  makePin('A2', scalePicoX(3.618), scalePicoY(17.972), 'analog'),
  makePin('A1', scalePicoX(3.627), scalePicoY(10.777), 'analog'),
  makePin('A0', scalePicoX(3.631), scalePicoY(3.594), 'analog'),
  makePin('D2', scalePicoX(46.514), scalePicoY(82.858), 'digital', ['2']),
  makePin('D3', scalePicoX(46.524), scalePicoY(75.648), 'digital', ['3']),
  makePin('D4', scalePicoX(46.514), scalePicoY(68.428), 'digital', ['4']),
  makePin('D5', scalePicoX(46.522), scalePicoY(61.224), 'digital', ['5']),
  makePin('D6', scalePicoX(46.524), scalePicoY(54.007), 'digital', ['6']),
  makePin('D7', scalePicoX(46.513), scalePicoY(46.817), 'digital', ['7']),
  makePin('D8', scalePicoX(46.519), scalePicoY(39.608), 'digital', ['8']),
  makePin('D9', scalePicoX(46.529), scalePicoY(32.386), 'digital', ['9']),
  makePin('D10', scalePicoX(46.511), scalePicoY(25.19), 'digital', ['10']),
  makePin('D11', scalePicoX(46.513), scalePicoY(17.975), 'digital', ['11']),
  makePin('D12', scalePicoX(46.508), scalePicoY(10.767), 'digital', ['12']),
  makePin('D13', scalePicoX(46.525), scalePicoY(3.569), 'digital', ['13', 'LED_BUILTIN']),
];

const FEATHER_W = 236;
const FEATHER_H = 112;
const FEATHER_SCALE_X = 2.1;
const FEATHER_SCALE_Y = 1.8;
const FEATHER_OFFSET_X = 4;
const FEATHER_OFFSET_Y = 4;

function scaleFeatherX(rawX: number): number {
  return (rawX + 53.85) * FEATHER_SCALE_X + FEATHER_OFFSET_X;
}

function scaleFeatherY(rawY: number): number {
  return (rawY + 3.298) * FEATHER_SCALE_Y + FEATHER_OFFSET_Y;
}

const FEATHER_HUZZAH32_PIN_DEFS: ArduinoPinDef[] = [
  makePin('VBAT', scaleFeatherX(-25.05), scaleFeatherY(-3.298), 'power', ['BAT']),
  makePin('EN', scaleFeatherX(-17.85), scaleFeatherY(-3.298), 'digital', ['CHIP_EN']),
  makePin('VBUS', scaleFeatherX(-10.65), scaleFeatherY(-3.298), 'power', ['5V', 'USB']),
  makePin('IO13', scaleFeatherX(-3.45), scaleFeatherY(-3.298), 'digital', gpioAliases(13, 'A12')),
  makePin('IO12', scaleFeatherX(3.75), scaleFeatherY(-3.298), 'digital', gpioAliases(12, 'A11')),
  makePin('IO27', scaleFeatherX(10.95), scaleFeatherY(-3.298), 'digital', gpioAliases(27, 'A10')),
  makePin('IO33', scaleFeatherX(18.15), scaleFeatherY(-3.298), 'digital', gpioAliases(33, 'A9')),
  makePin('IO15', scaleFeatherX(25.35), scaleFeatherY(-3.298), 'digital', gpioAliases(15, 'A8')),
  makePin('IO32', scaleFeatherX(32.55), scaleFeatherY(-3.298), 'digital', gpioAliases(32, 'A7')),
  makePin('IO14', scaleFeatherX(39.75), scaleFeatherY(-3.298), 'digital', gpioAliases(14, 'A6')),
  makePin('SCL', scaleFeatherX(46.95), scaleFeatherY(-3.298), 'digital', gpioAliases(22)),
  makePin('SDA', scaleFeatherX(54.15), scaleFeatherY(-3.298), 'digital', gpioAliases(23)),
  makePin('IO21', scaleFeatherX(54.15), scaleFeatherY(54.302), 'digital', gpioAliases(21)),
  makePin('IO17', scaleFeatherX(46.95), scaleFeatherY(54.302), 'digital', gpioAliases(17)),
  makePin('IO16', scaleFeatherX(39.75), scaleFeatherY(54.302), 'digital', gpioAliases(16)),
  makePin('MISO', scaleFeatherX(32.55), scaleFeatherY(54.302), 'digital', gpioAliases(19)),
  makePin('MOSI', scaleFeatherX(25.35), scaleFeatherY(54.302), 'digital', gpioAliases(18)),
  makePin('SCK', scaleFeatherX(18.15), scaleFeatherY(54.302), 'digital', gpioAliases(5)),
  makePin('A5', scaleFeatherX(10.95), scaleFeatherY(54.302), 'analog', gpioAliases(4)),
  makePin('A4', scaleFeatherX(3.75), scaleFeatherY(54.302), 'analog', gpioAliases(36)),
  makePin('A3', scaleFeatherX(-3.45), scaleFeatherY(54.302), 'analog', gpioAliases(39)),
  makePin('A2', scaleFeatherX(-10.65), scaleFeatherY(54.302), 'analog', gpioAliases(34)),
  makePin('A1', scaleFeatherX(-17.85), scaleFeatherY(54.302), 'analog', gpioAliases(25, 'DAC1')),
  makePin('A0', scaleFeatherX(-25.05), scaleFeatherY(54.302), 'analog', gpioAliases(26, 'DAC2')),
  makePin('GND', scaleFeatherX(-32.25), scaleFeatherY(54.302), 'ground'),
  makePin('3V3', scaleFeatherX(-46.65), scaleFeatherY(54.302), 'power', ['3.3V', '3V', 'VCC']),
  makePin('RESET', scaleFeatherX(-53.85), scaleFeatherY(54.302), 'digital', ['RST']),
];

const UNO_R4_WIFI_PIN_DEFS: ArduinoPinDef[] = [
  makePin('SCL', scaleUnoR4X(806.809), scaleUnoR4Y(100), 'digital'),
  makePin('SDA', scaleUnoR4X(906.823), scaleUnoR4Y(100), 'digital'),
  makePin('AREF', scaleUnoR4X(1006.823), scaleUnoR4Y(100), 'power'),
  makePin('GND_TOP', scaleUnoR4X(1106.823), scaleUnoR4Y(100), 'ground', ['GND']),
  makePin('D13', scaleUnoR4X(1206.823), scaleUnoR4Y(100), 'digital', ['13', 'LED_BUILTIN']),
  makePin('D12', scaleUnoR4X(1306.823), scaleUnoR4Y(100), 'digital', ['12']),
  makePin('D11', scaleUnoR4X(1406.823), scaleUnoR4Y(100), 'digital', ['11']),
  makePin('D10', scaleUnoR4X(1506.823), scaleUnoR4Y(100), 'digital', ['10']),
  makePin('D9', scaleUnoR4X(1606.823), scaleUnoR4Y(100), 'digital', ['9']),
  makePin('D8', scaleUnoR4X(1706.809), scaleUnoR4Y(100), 'digital', ['8']),
  makePin('D7', scaleUnoR4X(1866.837), scaleUnoR4Y(100), 'digital', ['7']),
  makePin('D6', scaleUnoR4X(1966.823), scaleUnoR4Y(100), 'digital', ['6']),
  makePin('D5', scaleUnoR4X(2066.823), scaleUnoR4Y(100), 'digital', ['5']),
  makePin('D4', scaleUnoR4X(2166.823), scaleUnoR4Y(100), 'digital', ['4']),
  makePin('D3', scaleUnoR4X(2266.823), scaleUnoR4Y(100), 'digital', ['3']),
  makePin('D2', scaleUnoR4X(2366.837), scaleUnoR4Y(100), 'digital', ['2']),
  makePin('D1', scaleUnoR4X(2466.823), scaleUnoR4Y(100), 'digital', ['1', 'TX']),
  makePin('D0', scaleUnoR4X(2566.823), scaleUnoR4Y(100), 'digital', ['0', 'RX']),
  makePin('IOREF', scaleUnoR4X(1266.823), scaleUnoR4Y(2000), 'power'),
  makePin('RESET', scaleUnoR4X(1366.837), scaleUnoR4Y(2000), 'digital', ['RST']),
  makePin('3V3', scaleUnoR4X(1466.823), scaleUnoR4Y(2000), 'power', ['3.3V', '3V']),
  makePin('5V', scaleUnoR4X(1566.823), scaleUnoR4Y(2000), 'power'),
  makePin('GND', scaleUnoR4X(1666.823), scaleUnoR4Y(2000), 'ground'),
  makePin('GND_2', scaleUnoR4X(1766.823), scaleUnoR4Y(2000), 'ground', ['GROUND']),
  makePin('VIN', scaleUnoR4X(1866.837), scaleUnoR4Y(2000), 'power'),
  makePin('A0', scaleUnoR4X(2066.823), scaleUnoR4Y(2000), 'analog'),
  makePin('A1', scaleUnoR4X(2166.823), scaleUnoR4Y(2000), 'analog'),
  makePin('A2', scaleUnoR4X(2266.823), scaleUnoR4Y(2000), 'analog'),
  makePin('A3', scaleUnoR4X(2366.837), scaleUnoR4Y(2000), 'analog'),
  makePin('A4', scaleUnoR4X(2466.823), scaleUnoR4Y(2000), 'analog'),
  makePin('A5', scaleUnoR4X(2566.823), scaleUnoR4Y(2000), 'analog'),
];

const ESP32_S3_DEVKITC1_W = 84;
const ESP32_S3_DEVKITC1_H = 236;
const ESP32_S3_DEVKITC1_RAW_W = 989.00021;
const ESP32_S3_DEVKITC1_RAW_H = 2773.7591;
const ESP32_S3_DEVKITC1_SCALE_X = ESP32_S3_DEVKITC1_W / ESP32_S3_DEVKITC1_RAW_W;
const ESP32_S3_DEVKITC1_SCALE_Y = ESP32_S3_DEVKITC1_H / ESP32_S3_DEVKITC1_RAW_H;

function scaleEsp32S3X(rawX: number): number {
  return rawX * ESP32_S3_DEVKITC1_SCALE_X;
}

function scaleEsp32S3Y(rawY: number): number {
  return rawY * ESP32_S3_DEVKITC1_SCALE_Y;
}

const ESP32_S3_DEVKITC1_PIN_DEFS: ArduinoPinDef[] = [
  makePin('3V3', scaleEsp32S3X(44.467), scaleEsp32S3Y(300.598), 'power', ['3.3V', '3V', 'VCC']),
  makePin('3V3_2', scaleEsp32S3X(45.983), scaleEsp32S3Y(400.596), 'power', ['3V3', '3.3V']),
  makePin('RST', scaleEsp32S3X(44.65), scaleEsp32S3Y(500.598), 'digital', ['RESET', 'EN', 'CHIP_EN']),
  makePin('IO4', scaleEsp32S3X(44.65), scaleEsp32S3Y(600.598), 'digital', gpioAliases(4)),
  makePin('IO5', scaleEsp32S3X(44.65), scaleEsp32S3Y(700.598), 'digital', gpioAliases(5)),
  makePin('IO6', scaleEsp32S3X(44.65), scaleEsp32S3Y(800.598), 'digital', gpioAliases(6)),
  makePin('IO7', scaleEsp32S3X(44.65), scaleEsp32S3Y(900.598), 'digital', gpioAliases(7)),
  makePin('IO15', scaleEsp32S3X(44.65), scaleEsp32S3Y(1000.598), 'digital', gpioAliases(15)),
  makePin('IO16', scaleEsp32S3X(44.65), scaleEsp32S3Y(1100.598), 'digital', gpioAliases(16)),
  makePin('IO17', scaleEsp32S3X(44.65), scaleEsp32S3Y(1200.598), 'digital', gpioAliases(17)),
  makePin('IO18', scaleEsp32S3X(44.65), scaleEsp32S3Y(1300.598), 'digital', gpioAliases(18)),
  makePin('IO8', scaleEsp32S3X(44.65), scaleEsp32S3Y(1400.598), 'digital', gpioAliases(8)),
  makePin('IO3', scaleEsp32S3X(44.65), scaleEsp32S3Y(1500.598), 'digital', gpioAliases(3)),
  makePin('IO46', scaleEsp32S3X(44.65), scaleEsp32S3Y(1600.598), 'digital', gpioAliases(46)),
  makePin('IO9', scaleEsp32S3X(44.467), scaleEsp32S3Y(1700.598), 'digital', gpioAliases(9)),
  makePin('IO10', scaleEsp32S3X(44.65), scaleEsp32S3Y(1800.545), 'digital', gpioAliases(10, 'CS', 'SS', 'NSS')),
  makePin('IO11', scaleEsp32S3X(44.65), scaleEsp32S3Y(1900.545), 'digital', gpioAliases(11, 'MOSI')),
  makePin('IO12', scaleEsp32S3X(44.65), scaleEsp32S3Y(2000.545), 'digital', gpioAliases(12, 'SCK', 'CLK')),
  makePin('IO13', scaleEsp32S3X(44.65), scaleEsp32S3Y(2100.545), 'digital', gpioAliases(13, 'MISO')),
  makePin('IO14', scaleEsp32S3X(44.65), scaleEsp32S3Y(2200.545), 'digital', gpioAliases(14)),
  makePin('5V', scaleEsp32S3X(44.467), scaleEsp32S3Y(2300.545), 'power', ['VIN', 'VBUS', 'USB']),
  makePin('GND', scaleEsp32S3X(44.467), scaleEsp32S3Y(2400.807), 'ground'),
  makePin('GND_2', scaleEsp32S3X(944.319), scaleEsp32S3Y(2400.807), 'ground', ['GND', 'GROUND']),
  makePin('GND_3', scaleEsp32S3X(944.319), scaleEsp32S3Y(2300.545), 'ground', ['GND']),
  makePin('IO19', scaleEsp32S3X(944.502), scaleEsp32S3Y(2200.545), 'digital', gpioAliases(19)),
  makePin('IO20', scaleEsp32S3X(944.194), scaleEsp32S3Y(2100.545), 'digital', gpioAliases(20)),
  makePin('IO21', scaleEsp32S3X(944.319), scaleEsp32S3Y(2000.545), 'digital', gpioAliases(21)),
  makePin('IO47', scaleEsp32S3X(944.277), scaleEsp32S3Y(1900.545), 'digital', gpioAliases(47)),
  makePin('IO48', scaleEsp32S3X(944.319), scaleEsp32S3Y(1800.545), 'digital', gpioAliases(48)),
  makePin('IO45', scaleEsp32S3X(944.319), scaleEsp32S3Y(1700.598), 'digital', gpioAliases(45)),
  makePin('IO0', scaleEsp32S3X(944.502), scaleEsp32S3Y(1600.598), 'digital', gpioAliases(0)),
  makePin('IO35', scaleEsp32S3X(944.194), scaleEsp32S3Y(1500.598), 'digital', gpioAliases(35)),
  makePin('IO36', scaleEsp32S3X(944.319), scaleEsp32S3Y(1400.598), 'digital', gpioAliases(36)),
  makePin('IO37', scaleEsp32S3X(944.277), scaleEsp32S3Y(1300.598), 'digital', gpioAliases(37)),
  makePin('IO38', scaleEsp32S3X(944.319), scaleEsp32S3Y(1200.598), 'digital', gpioAliases(38)),
  makePin('IO39', scaleEsp32S3X(944.319), scaleEsp32S3Y(1100.598), 'digital', gpioAliases(39)),
  makePin('IO40', scaleEsp32S3X(945.402), scaleEsp32S3Y(1000.598), 'digital', gpioAliases(40)),
  makePin('IO41', scaleEsp32S3X(944.319), scaleEsp32S3Y(900.598), 'digital', gpioAliases(41)),
  makePin('IO42', scaleEsp32S3X(944.277), scaleEsp32S3Y(800.598), 'digital', gpioAliases(42)),
  makePin('IO2', scaleEsp32S3X(944.319), scaleEsp32S3Y(700.598), 'digital', gpioAliases(2)),
  makePin('IO1', scaleEsp32S3X(944.319), scaleEsp32S3Y(600.067), 'digital', gpioAliases(1)),
  makePin('RX', scaleEsp32S3X(944.319), scaleEsp32S3Y(500.157), 'digital', gpioAliases(44, 'RXD', 'U0RXD', 'IO44')),
  makePin('TX', scaleEsp32S3X(944.194), scaleEsp32S3Y(400.246), 'digital', gpioAliases(43, 'TXD', 'U0TXD', 'IO43')),
  makePin('GND_TOP', scaleEsp32S3X(944.319), scaleEsp32S3Y(300.335), 'ground', ['GND']),
];

export const CONTROLLER_BOARD_OPTIONS: Array<{
  value: ControllerBoardType;
  label: string;
}> = [
  { value: 'uno', label: 'Arduino Uno' },
  { value: 'uno-r4-wifi', label: 'Arduino UNO R4 WiFi' },
  { value: 'nano', label: 'Arduino Nano' },
  { value: 'mega', label: 'Arduino Mega' },
  { value: 'leonardo', label: 'Arduino Leonardo' },
  { value: 'deneyap-kart-1a', label: 'Deneyap Kart 1A' },
  { value: 'deneyap-kart-1a-v2', label: 'Deneyap Kart 1A v2' },
  { value: 'deneyap-kart-g', label: 'Deneyap Kart G' },
  { value: 'deneyap-mini', label: 'Deneyap Mini' },
  { value: 'deneyap-mini-v2', label: 'Deneyap Mini v2' },
  { value: 'nodemcu', label: 'NodeMCU ESP8266' },
  { value: 'nodemcu-v3', label: 'NodeMCU V3 (LoLin)' },
  { value: 'wemos-d1-mini', label: 'WeMos D1 Mini' },
  { value: 'arduino-fio', label: 'Arduino Fio' },
  { value: 'pro-micro', label: 'SparkFun Pro Micro' },
  { value: 'pico', label: 'Raspberry Pi Pico' },
  { value: 'feather-huzzah32', label: 'Adafruit HUZZAH32 Feather' },
  { value: 'esp32-s3-devkitc-1', label: 'ESP32-S3 DevKitC-1' },
];

const BOARD_DEFINITIONS: Record<ControllerBoardType, ControllerBoardDefinition> = {
  uno: {
    type: 'uno',
    name: 'Arduino Uno',
    shortName: 'UNO',
    width: UNO_W,
    height: UNO_H,
    imageUrl: arduinoUnoImage,
    pinDefs: UNO_PIN_DEFS,
    aliases: ['arduino', 'uno', 'arduinouno'],
    pinSummary: 'D0-D13, A0-A5, 5V, GND, 3V3, VIN, RESET, SDA, SCL',
    theme: {
      body: '#0d6a9f',
      accent: '#0b5782',
      outline: '#74b6d7',
      text: '#d9f3ff',
      chip: '#1d2534',
      pin: '#1b1f29',
      usb: '#d6dee7',
    },
  },
  'uno-r4-wifi': {
    type: 'uno-r4-wifi',
    name: 'Arduino UNO R4 WiFi',
    shortName: 'UNO R4',
    width: UNO_R4_W,
    height: UNO_R4_H,
    imageUrl: arduinoUnoR4WifiImage,
    pinDefs: UNO_R4_WIFI_PIN_DEFS,
    aliases: [
      'uno r4',
      'uno r4 wifi',
      'unor4',
      'unor4wifi',
      'arduino uno r4',
      'arduino uno r4 wifi',
    ],
    pinSummary: 'D0-D13, A0-A5, 5V, GND, 3V3, VIN, RESET, SDA, SCL',
    theme: {
      body: '#177aa0',
      accent: '#115f7f',
      outline: '#80d2e6',
      text: '#e3f8ff',
      chip: '#1d2534',
      pin: '#1b1f29',
      usb: '#d9e1e8',
    },
  },
  nano: {
    type: 'nano',
    name: 'Arduino Nano',
    shortName: 'NANO',
    width: 140,
    height: 288,
    imageUrl: arduinoNanoImage,
    pinDefs: NANO_PIN_DEFS,
    aliases: ['nano', 'arduinonano'],
    pinSummary: 'D0-D13, A0-A7, 5V, GND, 3V3, VIN, RESET',
    theme: {
      body: '#0c6378',
      accent: '#0a4f61',
      outline: '#78c5cf',
      text: '#d9f8fb',
      chip: '#1b202b',
      pin: '#171b23',
      usb: '#dfe6ec',
    },
  },
  mega: {
    type: 'mega',
    name: 'Arduino Mega',
    shortName: 'MEGA',
    width: 360,
    height: 230,
    imageUrl: arduinoMegaImage,
    pinDefs: MEGA_PIN_DEFS,
    aliases: ['mega', 'arduinomega', 'mega2560'],
    pinSummary: 'D0-D21, A0-A15, 5V, GND, 3V3, VIN, RESET, SDA, SCL',
    theme: {
      body: '#0f6c8f',
      accent: '#0d5671',
      outline: '#7ac9e2',
      text: '#dbf7ff',
      chip: '#20293a',
      pin: '#171b23',
      usb: '#d5e0e8',
    },
  },
  leonardo: {
    type: 'leonardo',
    name: 'Arduino Leonardo',
    shortName: 'LEONARDO',
    width: 300,
    height: 214,
    imageUrl: arduinoLeonardoImage,
    pinDefs: LEONARDO_PIN_DEFS,
    aliases: ['leonardo', 'arduinoleonardo'],
    pinSummary: 'D0-D13, A0-A5, 5V, GND, 3V3, VIN, RESET, SDA, SCL',
    theme: {
      body: '#126f66',
      accent: '#0d594f',
      outline: '#86d6c7',
      text: '#e2fff8',
      chip: '#1f2837',
      pin: '#171b23',
      usb: '#dce4ea',
    },
  },
  'deneyap-kart-1a': {
    type: 'deneyap-kart-1a',
    name: 'Deneyap Kart 1A',
    shortName: 'DENEYAP 1A',
    width: 101.2,
    height: 252,
    imageUrl: deneyapKart1AImage,
    pinDefs: DENEYAP_KART_1A_PIN_DEFS,
    aliases: [
      'deneyap kart 1a',
      'deneyapkart1a',
      'deneyap 1a',
      'deneyap kart legacy',
    ],
    pinSummary:
      'A0-A5, DAC1-DAC2, D0-D15, 3V3, 5V, VBAT, GND, SCL, SDA, MOSI, MISO, SCK, RX, TX',
    theme: {
      body: '#b20f16',
      accent: '#840d12',
      outline: '#ffc2c6',
      text: '#fff3f4',
      chip: '#172432',
      pin: '#171b23',
      usb: '#dfe6ec',
    },
  },
  'deneyap-kart-1a-v2': {
    type: 'deneyap-kart-1a-v2',
    name: 'Deneyap Kart 1A v2',
    shortName: 'DENEYAP',
    width: DENEYAP_W,
    height: DENEYAP_H,
    imageUrl: deneyapKart1AV2Image,
    pinDefs: DENEYAP_KART_1A_V2_PIN_DEFS,
    aliases: [
      'deneyap',
      'deneyap kart',
      'deneyapkart',
      'deneyap kart 1a',
      'deneyapkart1a',
      'deneyap kart 1a v2',
      'deneyapkart1av2',
      'deneyap 1a v2',
    ],
    pinSummary:
      'EN, A0-A7, D14, D13, D12, D9, D8, D4, D1, D0, TX, RX, SCL, SDA, MISO, MOSI, SCK, 3V3, 5V, BAT, GND',
    theme: {
      body: '#b90d14',
      accent: '#870c11',
      outline: '#ffc2c6',
      text: '#fff2f3',
      chip: '#172432',
      pin: '#171b23',
      usb: '#dfe6ec',
    },
  },
  'deneyap-kart-g': {
    type: 'deneyap-kart-g',
    name: 'Deneyap Kart G',
    shortName: 'DENEYAP G',
    width: 200,
    height: 174,
    imageUrl: deneyapKartGImage,
    pinDefs: DENEYAP_KART_G_PIN_DEFS,
    aliases: [
      'deneyap kart g',
      'deneyapkartg',
      'deneyap g',
      'kart g',
    ],
    pinSummary: 'A0-A5, D2-D5, RX, TX, SCL, SDA, BAT, 3V3, GND',
    theme: {
      body: '#d61a23',
      accent: '#8f1117',
      outline: '#ffc5c8',
      text: '#fff5f6',
      chip: '#172432',
      pin: '#171b23',
      usb: '#dfe6ec',
    },
  },
  'deneyap-mini': {
    type: 'deneyap-mini',
    name: 'Deneyap Mini',
    shortName: 'DENEYAP MINI',
    width: 77.28,
    height: 212,
    imageUrl: deneyapMiniImage,
    pinDefs: DENEYAP_MINI_PIN_DEFS,
    aliases: ['deneyap mini', 'deneyapmini'],
    pinSummary:
      'BT, A0-A6, DA0-DA1, D2-D3, D9-D10, EN, RX, TX, MO, MI, MC, SC, SD, 3V3, 5V, GND',
    theme: {
      body: '#0b4b72',
      accent: '#083b5a',
      outline: '#91d8ff',
      text: '#ecfaff',
      chip: '#172432',
      pin: '#171b23',
      usb: '#dfe6ec',
    },
  },
  'deneyap-mini-v2': {
    type: 'deneyap-mini-v2',
    name: 'Deneyap Mini v2',
    shortName: 'DENEYAP MINI v2',
    width: 77.28,
    height: 212,
    imageUrl: deneyapMiniV2Image,
    pinDefs: DENEYAP_MINI_V2_PIN_DEFS,
    aliases: ['deneyap mini v2', 'deneyapminiv2', 'deneyap mini 2'],
    pinSummary:
      'A0-A7, DA0-DA1, D2-D3, D9-D10, EN, RX, TX, MO, MI, MC, SC, SD, 3V3, 5V, GND',
    theme: {
      body: '#0e5783',
      accent: '#0b4667',
      outline: '#9cdcff',
      text: '#eefbff',
      chip: '#172432',
      pin: '#171b23',
      usb: '#dfe6ec',
    },
  },
  nodemcu: {
    type: 'nodemcu',
    name: 'NodeMCU ESP8266',
    shortName: 'NODEMCU',
    width: 110,
    height: 216,
    imageUrl: nodemcuImage,
    pinDefs: NODEMCU_PIN_DEFS,
    aliases: ['nodemcu', 'esp8266', 'nodemcuesp8266'],
    pinSummary: 'A0, D0-D8, RX, TX, 3V3, GND, VIN, EN, RST',
    theme: {
      body: '#2f3e67',
      accent: '#24314f',
      outline: '#8db0ff',
      text: '#eef3ff',
      chip: '#161c2c',
      pin: '#121620',
      usb: '#d9e1ea',
    },
  },
  'nodemcu-v3': {
    type: 'nodemcu-v3',
    name: 'NodeMCU V3 (LoLin)',
    shortName: 'NODEMCU V3',
    width: 208.612,
    height: 109.8528,
    imageUrl: nodemcuV3Image,
    pinDefs: NODEMCU_V3_PIN_DEFS,
    aliases: [
      'nodemcu v3',
      'nodemcuv3',
      'lolin nodemcu',
      'lolin v3',
      'nodemcu v3 lolin',
    ],
    pinSummary:
      'D0-D8, RX, TX, A0, EN, RST, 3V3, GND, VU, VIN, CLK, CMD, SD0-SD3',
    theme: {
      body: '#314463',
      accent: '#25344d',
      outline: '#9ab6ff',
      text: '#eef4ff',
      chip: '#171e2c',
      pin: '#121620',
      usb: '#dbe4ed',
    },
  },
  'wemos-d1-mini': {
    type: 'wemos-d1-mini',
    name: 'WeMos D1 Mini',
    shortName: 'D1 MINI',
    width: 72.567,
    height: 96.945,
    imageUrl: wemosD1MiniImage,
    pinDefs: WEMOS_D1_MINI_PIN_DEFS,
    aliases: ['wemos', 'wemos d1 mini', 'wemosd1mini', 'd1 mini', 'd1mini'],
    pinSummary: 'D0-D8, RX, TX, A0, 3V3, 5V, GND, RST',
    theme: {
      body: '#0d4c75',
      accent: '#0a3b5b',
      outline: '#91d8ff',
      text: '#edfaff',
      chip: '#1a2530',
      pin: '#171b23',
      usb: '#dfe6ec',
    },
  },
  'arduino-fio': {
    type: 'arduino-fio',
    name: 'Arduino Fio',
    shortName: 'FIO',
    width: 186.504,
    height: 79.297,
    imageUrl: arduinoFioImage,
    pinDefs: FIO_PIN_DEFS,
    aliases: ['fio', 'arduino fio', 'arduinofio', 'funnel io'],
    pinSummary:
      'D0-D13, A0-A7, VCC, GND, AREF, USB_VIN, VBATT, SDA, SCL, MOSI, MISO, SCK',
    theme: {
      body: '#7a9744',
      accent: '#5f7635',
      outline: '#dbf2ad',
      text: '#f7ffe8',
      chip: '#2a2f24',
      pin: '#171b23',
      usb: '#e1e7de',
    },
  },
  'pro-micro': {
    type: 'pro-micro',
    name: 'SparkFun Pro Micro',
    shortName: 'PROMICRO',
    width: PRO_MICRO_W,
    height: PRO_MICRO_H,
    imageUrl: proMicroImage,
    pinDefs: PRO_MICRO_PIN_DEFS,
    aliases: ['promicro', 'sparkfunpromicro', 'micropro'],
    pinSummary: 'TX, RX, D2-D10, A0-A3, MISO, MOSI, SCK, VCC, GND, RAW, RST',
    theme: {
      body: '#18815b',
      accent: '#126547',
      outline: '#92e3b8',
      text: '#eafff4',
      chip: '#1a2430',
      pin: '#171b23',
      usb: '#dfe6ec',
    },
  },
  pico: {
    type: 'pico',
    name: 'Raspberry Pi Pico',
    shortName: 'PICO',
    width: PICO_W,
    height: PICO_H,
    imageUrl: picoImage,
    pinDefs: PICO_PIN_DEFS,
    aliases: ['pico', 'raspberrypipico', 'rppico'],
    pinSummary: 'D0-D13, A0-A5, 5V, GND, RST, AREF',
    theme: {
      body: '#1d6f48',
      accent: '#17593a',
      outline: '#98e6b8',
      text: '#effff5',
      chip: '#1b232d',
      pin: '#171b23',
      usb: '#dfe6ec',
    },
  },
  'feather-huzzah32': {
    type: 'feather-huzzah32',
    name: 'Adafruit HUZZAH32 Feather',
    shortName: 'ESP32',
    width: FEATHER_W,
    height: FEATHER_H,
    imageUrl: featherHuzzah32Image,
    pinDefs: FEATHER_HUZZAH32_PIN_DEFS,
    aliases: ['feather', 'esp32', 'huzzah32', 'featherhuzzah32'],
    pinSummary: 'IO21, IO17, IO16, MISO, MOSI, SCK, A0-A5, SCL, SDA, 3V3, GND, VBAT, VBUS',
    theme: {
      body: '#35445f',
      accent: '#29364c',
      outline: '#95baf8',
      text: '#eef4ff',
      chip: '#1a2230',
      pin: '#171b23',
      usb: '#dfe5ec',
    },
  },
  'esp32-s3-devkitc-1': {
    type: 'esp32-s3-devkitc-1',
    name: 'ESP32-S3 DevKitC-1',
    shortName: 'ESP32-S3',
    width: ESP32_S3_DEVKITC1_W,
    height: ESP32_S3_DEVKITC1_H,
    imageUrl: esp32S3DevKitC1Image,
    pinDefs: ESP32_S3_DEVKITC1_PIN_DEFS,
    aliases: [
      'esp32 s3',
      'esp32-s3',
      'esp32s3',
      'esp32 s3 devkitc-1',
      'esp32-s3-devkitc-1',
      'esp32s3devkitc1',
      'esp32s3devmodule',
      'devkitc1',
    ],
    pinSummary: '3V3, 5V, GND, RST, TX, RX, IO0-IO21, IO35-IO48',
    theme: {
      body: '#2d3138',
      accent: '#20262d',
      outline: '#9aa8b7',
      text: '#eef3f8',
      chip: '#161b21',
      pin: '#12161a',
      usb: '#dce4eb',
    },
  },
};

function pinDefToPin(pin: ArduinoPinDef): Pin {
  return {
    id: pin.id,
    name: pin.id,
    type: pin.type,
    x: pin.x,
    y: pin.y,
  };
}

export function getControllerBoardDefinition(
  boardType: ControllerBoardType = DEFAULT_CONTROLLER_BOARD_TYPE
): ControllerBoardDefinition {
  return BOARD_DEFINITIONS[boardType] ?? BOARD_DEFINITIONS[DEFAULT_CONTROLLER_BOARD_TYPE];
}

export function getControllerBoardPins(
  boardType: ControllerBoardType = DEFAULT_CONTROLLER_BOARD_TYPE
): Pin[] {
  return getControllerBoardDefinition(boardType).pinDefs.map(pinDefToPin);
}

export const ARDUINO_PINS: Pin[] = getControllerBoardPins(DEFAULT_CONTROLLER_BOARD_TYPE);

export function findArduinoPin(
  pinId: string,
  boardType: ControllerBoardType = DEFAULT_CONTROLLER_BOARD_TYPE
): Pin | null {
  const normalized = normalizeToken(pinId);
  const match = getControllerBoardDefinition(boardType).pinDefs.find((pin) => {
    if (normalizeToken(pin.id) === normalized) return true;
    return (pin.aliases ?? []).some((alias) => normalizeToken(alias) === normalized);
  });

  return match ? pinDefToPin(match) : null;
}

export function getArduinoPinGlobal(
  pinId: string,
  boardType: ControllerBoardType = DEFAULT_CONTROLLER_BOARD_TYPE,
  position: { x: number; y: number } = DEFAULT_CONTROLLER_BOARD_POSITION
): { x: number; y: number; pin: Pin } | null {
  const pin = findArduinoPin(pinId, boardType);
  if (!pin) return null;

  return {
    x: position.x + pin.x,
    y: position.y + pin.y,
    pin,
  };
}

export function getControllerBoardPinSummary(
  boardType: ControllerBoardType = DEFAULT_CONTROLLER_BOARD_TYPE
): string {
  return getControllerBoardDefinition(boardType).pinSummary;
}

const normalizeSearchText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

export function inferControllerBoardTypeFromText(
  text: string
): ControllerBoardType | null {
  const normalizedText = normalizeSearchText(text);
  const compactText = normalizeToken(text);
  if (!normalizedText && !compactText) return null;

  const paddedText = normalizedText ? ` ${normalizedText} ` : '';
  let bestMatch: { boardType: ControllerBoardType; score: number } | null = null;

  for (const board of Object.values(BOARD_DEFINITIONS)) {
    const candidates = [board.name, board.shortName, ...board.aliases];

    for (const candidate of candidates) {
      const normalizedCandidate = normalizeSearchText(candidate);
      const compactCandidate = normalizeToken(candidate);
      if (!compactCandidate || compactCandidate === 'arduino') continue;

      const matchesPhrase =
        normalizedCandidate &&
        paddedText.includes(` ${normalizedCandidate} `);
      const matchesCompact =
        compactCandidate.length >= 5 && compactText.includes(compactCandidate);

      if (!matchesPhrase && !matchesCompact) continue;

      const score = compactCandidate.length;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { boardType: board.type, score };
      }
    }
  }

  if (bestMatch) {
    return bestMatch.boardType;
  }

  return null;
}

export function isArduinoReference(ref: string): boolean {
  const normalized = normalizeToken(ref);
  if (!normalized) return false;
  if (normalized === normalizeToken(ARDUINO_COMPONENT_ID)) return true;

  return Object.values(BOARD_DEFINITIONS).some((board) => {
    if (normalizeToken(board.name) === normalized) return true;
    if (normalizeToken(board.shortName) === normalized) return true;
    return board.aliases.some((alias) => normalizeToken(alias) === normalized);
  });
}

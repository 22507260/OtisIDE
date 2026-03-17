import type { Pin, PinType } from './types';
import arduinoUnoImage from '../assets/arduino-uno-fritzing.svg';
import arduinoNanoImage from '../assets/boards/arduino-nano-fritzing.svg';
import arduinoMegaImage from '../assets/boards/arduino-mega-fritzing.svg';
import arduinoLeonardoImage from '../assets/boards/arduino-leonardo-fritzing.svg';
import nodemcuImage from '../assets/boards/nodemcu-amica-fritzing.svg';
import proMicroImage from '../assets/boards/pro-micro-fritzing.svg';
import picoImage from '../assets/boards/pico-fritzing.svg';
import featherHuzzah32Image from '../assets/boards/feather-huzzah32-fritzing.svg';

export type ControllerBoardType =
  | 'uno'
  | 'nano'
  | 'mega'
  | 'leonardo'
  | 'nodemcu'
  | 'pro-micro'
  | 'pico'
  | 'feather-huzzah32';

type ArduinoPinDef = {
  id: string;
  x: number;
  y: number;
  type: PinType;
  aliases?: string[];
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

export const CONTROLLER_BOARD_OPTIONS: Array<{
  value: ControllerBoardType;
  label: string;
}> = [
  { value: 'uno', label: 'Arduino Uno' },
  { value: 'nano', label: 'Arduino Nano' },
  { value: 'mega', label: 'Arduino Mega' },
  { value: 'leonardo', label: 'Arduino Leonardo' },
  { value: 'nodemcu', label: 'NodeMCU ESP8266' },
  { value: 'pro-micro', label: 'SparkFun Pro Micro' },
  { value: 'pico', label: 'Raspberry Pi Pico' },
  { value: 'feather-huzzah32', label: 'Adafruit HUZZAH32 Feather' },
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
  boardType: ControllerBoardType = DEFAULT_CONTROLLER_BOARD_TYPE
): { x: number; y: number; pin: Pin } | null {
  const pin = findArduinoPin(pinId, boardType);
  if (!pin) return null;

  return {
    x: ARDUINO_X + pin.x,
    y: ARDUINO_Y + pin.y,
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

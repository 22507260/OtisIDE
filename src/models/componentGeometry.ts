import type { ComponentType, Pin } from './types';

import ledSvg from '../assets/components/led.svg';
import ledSvgRaw from '../assets/components/led.svg?raw';
import resistorSvg from '../assets/components/resistor.svg';
import resistorSvgRaw from '../assets/components/resistor.svg?raw';
import capacitorSvg from '../assets/components/capacitor.svg';
import capacitorSvgRaw from '../assets/components/capacitor.svg?raw';
import diodeSvg from '../assets/components/diode.svg';
import diodeSvgRaw from '../assets/components/diode.svg?raw';
import buttonSvg from '../assets/components/button.svg';
import buttonSvgRaw from '../assets/components/button.svg?raw';
import switchSvg from '../assets/components/switch.svg';
import switchSvgRaw from '../assets/components/switch.svg?raw';
import potentiometerSvg from '../assets/components/potentiometer.svg';
import potentiometerSvgRaw from '../assets/components/potentiometer.svg?raw';
import joystickSvg from '../assets/components/joystick.svg';
import joystickSvgRaw from '../assets/components/joystick.svg?raw';
import hc05Svg from '../assets/components/hc-05.svg';
import hc05SvgRaw from '../assets/components/hc-05.svg?raw';
import buzzerSvg from '../assets/components/buzzer.svg';
import buzzerSvgRaw from '../assets/components/buzzer.svg?raw';
import servoSvg from '../assets/components/servo.svg';
import servoSvgRaw from '../assets/components/servo.svg?raw';
import dcMotorSvg from '../assets/components/dc-motor.svg';
import dcMotorSvgRaw from '../assets/components/dc-motor.svg?raw';
import rgbLedSvg from '../assets/components/rgb-led.svg';
import rgbLedSvgRaw from '../assets/components/rgb-led.svg?raw';
import ldrSvg from '../assets/components/ldr.svg';
import ldrSvgRaw from '../assets/components/ldr.svg?raw';
import lm35Svg from '../assets/components/lm35.svg';
import lm35SvgRaw from '../assets/components/lm35.svg?raw';
import dht11Svg from '../assets/components/dht11.svg';
import dht11SvgRaw from '../assets/components/dht11.svg?raw';
import pirSensorSvg from '../assets/components/pir-sensor.svg';
import pirSensorSvgRaw from '../assets/components/pir-sensor.svg?raw';
import flameSensorSvg from '../assets/components/flame-sensor.svg';
import flameSensorSvgRaw from '../assets/components/flame-sensor.svg?raw';
import mq2Svg from '../assets/components/mq2.svg';
import mq2SvgRaw from '../assets/components/mq2.svg?raw';
import oledI2cSvg from '../assets/components/oled-i2c.svg';
import oledI2cSvgRaw from '../assets/components/oled-i2c.svg?raw';
import rc522Svg from '../assets/components/rc522.svg';
import rc522SvgRaw from '../assets/components/rc522.svg?raw';
import keypadSvg from '../assets/components/keypad-4x4.svg';
import keypadSvgRaw from '../assets/components/keypad-4x4.svg?raw';
import stepperSvg from '../assets/components/stepper-28byj48.svg';
import stepperSvgRaw from '../assets/components/stepper-28byj48.svg?raw';
import l298nSvg from '../assets/components/l298n-driver.svg';
import l298nSvgRaw from '../assets/components/l298n-driver.svg?raw';
import vl53l0xSvg from '../assets/components/vl53l0x.svg';
import vl53l0xSvgRaw from '../assets/components/vl53l0x.svg?raw';
import reedSwitchSvg from '../assets/components/reed-switch-module.svg';
import reedSwitchSvgRaw from '../assets/components/reed-switch-module.svg?raw';
import breadboardPowerSvg from '../assets/components/breadboard-power-supply.svg';
import breadboardPowerSvgRaw from '../assets/components/breadboard-power-supply.svg?raw';
import acs712Svg from '../assets/components/acs712.svg';
import acs712SvgRaw from '../assets/components/acs712.svg?raw';
import levelConverterSvg from '../assets/components/logic-level-converter.svg';
import levelConverterSvgRaw from '../assets/components/logic-level-converter.svg?raw';
import rf433Svg from '../assets/components/rf-433-receiver.svg';
import rf433SvgRaw from '../assets/components/rf-433-receiver.svg?raw';
import soundSensorSvg from '../assets/components/sound-sensor.svg';
import soundSensorSvgRaw from '../assets/components/sound-sensor.svg?raw';
import tm1637Svg from '../assets/components/tm1637.svg';
import tm1637SvgRaw from '../assets/components/tm1637.svg?raw';
import uln2003Svg from '../assets/components/uln2003-driver.svg';
import uln2003SvgRaw from '../assets/components/uln2003-driver.svg?raw';
import rf433TxSvg from '../assets/components/rf-433-transmitter.svg';
import rf433TxSvgRaw from '../assets/components/rf-433-transmitter.svg?raw';
import ds18b20Svg from '../assets/components/ds18b20-probe.svg';
import ds18b20SvgRaw from '../assets/components/ds18b20-probe.svg?raw';
import deneyapGpsSvg from '../assets/components/deneyap-gps-glonass.svg';
import deneyapGpsSvgRaw from '../assets/components/deneyap-gps-glonass.svg?raw';
import deneyapImuSvg from '../assets/components/deneyap-9-axis-imu.svg';
import deneyapImuSvgRaw from '../assets/components/deneyap-9-axis-imu.svg?raw';
import deneyapTouchKeypadSvg from '../assets/components/deneyap-touch-keypad.svg';
import deneyapTouchKeypadSvgRaw from '../assets/components/deneyap-touch-keypad.svg?raw';
import deneyapRainCenterSvg from '../assets/components/deneyap-rain-sensor-center.svg';
import deneyapRainCenterSvgRaw from '../assets/components/deneyap-rain-sensor-center.svg?raw';
import deneyapRainSurfaceSvg from '../assets/components/deneyap-rain-sensor-surface.svg';
import deneyapRainSurfaceSvgRaw from '../assets/components/deneyap-rain-sensor-surface.svg?raw';
import esp8266Svg from '../assets/components/esp8266-module.svg';
import esp8266SvgRaw from '../assets/components/esp8266-module.svg?raw';
import hx711Svg from '../assets/components/hx711.svg';
import hx711SvgRaw from '../assets/components/hx711.svg?raw';
import microsdSvg from '../assets/components/microsd-module.svg';
import microsdSvgRaw from '../assets/components/microsd-module.svg?raw';
import ds3231Svg from '../assets/components/ds3231-rtc.svg';
import ds3231SvgRaw from '../assets/components/ds3231-rtc.svg?raw';
import max7219Svg from '../assets/components/max7219-matrix.svg';
import max7219SvgRaw from '../assets/components/max7219-matrix.svg?raw';
import ov7670Svg from '../assets/components/ov7670-camera.svg';
import ov7670SvgRaw from '../assets/components/ov7670-camera.svg?raw';
import tcrt5000Svg from '../assets/components/tcrt5000.svg';
import tcrt5000SvgRaw from '../assets/components/tcrt5000.svg?raw';
import tp4056Svg from '../assets/components/tp4056-charger.svg';
import tp4056SvgRaw from '../assets/components/tp4056-charger.svg?raw';
import rfm69Svg from '../assets/components/rfm69hcw.svg';
import rfm69SvgRaw from '../assets/components/rfm69hcw.svg?raw';
import shaftEncoderSvg from '../assets/components/shaft-encoder.svg';
import shaftEncoderSvgRaw from '../assets/components/shaft-encoder.svg?raw';
import tcs230Svg from '../assets/components/tcs230.svg';
import tcs230SvgRaw from '../assets/components/tcs230.svg?raw';
import uvSensorSvg from '../assets/components/uv-sensor.svg';
import uvSensorSvgRaw from '../assets/components/uv-sensor.svg?raw';
import hcsr04Svg from '../assets/components/hc-sr04.svg';
import hcsr04SvgRaw from '../assets/components/hc-sr04.svg?raw';
import irSensorSvg from '../assets/components/ir-sensor.svg';
import irSensorSvgRaw from '../assets/components/ir-sensor.svg?raw';
import sevenSegmentSvg from '../assets/components/seven-segment.svg';
import sevenSegmentSvgRaw from '../assets/components/seven-segment.svg?raw';
import lcdSvg from '../assets/components/lcd.svg';
import lcdSvgRaw from '../assets/components/lcd.svg?raw';
import transistorNpnSvg from '../assets/components/transistor-npn.svg';
import transistorNpnSvgRaw from '../assets/components/transistor-npn.svg?raw';
import transistorPnpSvg from '../assets/components/transistor-pnp.svg';
import transistorPnpSvgRaw from '../assets/components/transistor-pnp.svg?raw';
import relaySvg from '../assets/components/relay.svg';
import relaySvgRaw from '../assets/components/relay.svg?raw';
import multimeterSvg from '../assets/components/multimeter.svg';
import multimeterSvgRaw from '../assets/components/multimeter.svg?raw';
import motorDriverSvg from '../assets/components/motor-driver.svg';
import motorDriverSvgRaw from '../assets/components/motor-driver.svg?raw';

export interface SvgConfig {
  url: string;
  raw: string;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

type Point = { x: number; y: number };
type Matrix = [number, number, number, number, number, number];

const CONNECTOR_ID = /^connector(\d+)pin$/i;
const pinLayoutCache = new Map<ComponentType, Point[] | null>();

// Fritzing SVG dimensions based on viewBox aspect ratios
// Scaled to match breadboard hole spacing (11.5px ~= 2.54mm = 0.1in)
export const SVG_CONFIGS: Record<ComponentType, SvgConfig> = {
  led:            { url: ledSvg,           raw: ledSvgRaw,           width: 24,  height: 46, offsetX: 12,  offsetY: 10 },
  resistor:       { url: resistorSvg,      raw: resistorSvgRaw,      width: 90,  height: 20, offsetX: 45,  offsetY: 10 },
  capacitor:      { url: capacitorSvg,     raw: capacitorSvgRaw,     width: 24,  height: 28, offsetX: 12,  offsetY: 6  },
  diode:          { url: diodeSvg,         raw: diodeSvgRaw,         width: 80,  height: 19, offsetX: 40,  offsetY: 10 },
  button:         { url: buttonSvg,        raw: buttonSvgRaw,        width: 28,  height: 38, offsetX: 14,  offsetY: 16 },
  switch:         { url: switchSvg,        raw: switchSvgRaw,        width: 36,  height: 37, offsetX: 18,  offsetY: 18 },
  potentiometer:  { url: potentiometerSvg, raw: potentiometerSvgRaw, width: 28,  height: 56, offsetX: 14,  offsetY: 20 },
  joystick:       { url: joystickSvg,      raw: joystickSvgRaw,      width: 58,  height: 58, offsetX: 29,  offsetY: 22 },
  'hc-05':        { url: hc05Svg,          raw: hc05SvgRaw,          width: 170, height: 74, offsetX: 85,  offsetY: 24 },
  buzzer:         { url: buzzerSvg,        raw: buzzerSvgRaw,        width: 38,  height: 38, offsetX: 19,  offsetY: 14 },
  servo:          { url: servoSvg,         raw: servoSvgRaw,         width: 62,  height: 50, offsetX: 31,  offsetY: 20 },
  'dc-motor':     { url: dcMotorSvg,       raw: dcMotorSvgRaw,       width: 56,  height: 26, offsetX: 28,  offsetY: 13 },
  'rgb-led':      { url: rgbLedSvg,        raw: rgbLedSvgRaw,        width: 26,  height: 36, offsetX: 13,  offsetY: 8  },
  ldr:            { url: ldrSvg,           raw: ldrSvgRaw,           width: 46,  height: 21, offsetX: 23,  offsetY: 10 },
  lm35:           { url: lm35Svg,          raw: lm35SvgRaw,          width: 22,  height: 32, offsetX: 11,  offsetY: 8  },
  dht11:          { url: dht11Svg,         raw: dht11SvgRaw,         width: 34,  height: 44, offsetX: 17,  offsetY: 14 },
  'pir-sensor':   { url: pirSensorSvg,     raw: pirSensorSvgRaw,     width: 56,  height: 44, offsetX: 28,  offsetY: 14 },
  'flame-sensor': { url: flameSensorSvg,   raw: flameSensorSvgRaw,   width: 58,  height: 38, offsetX: 29,  offsetY: 12 },
  mq2:            { url: mq2Svg,           raw: mq2SvgRaw,           width: 58,  height: 42, offsetX: 29,  offsetY: 13 },
  'oled-i2c':     { url: oledI2cSvg,       raw: oledI2cSvgRaw,       width: 122, height: 123, offsetX: 61,  offsetY: 28 },
  rc522:          { url: rc522Svg,         raw: rc522SvgRaw,         width: 272, height: 182, offsetX: 20,  offsetY: 91 },
  'keypad-4x4':   { url: keypadSvg,        raw: keypadSvgRaw,        width: 195, height: 181, offsetX: 30,  offsetY: 26 },
  'stepper-28byj48': { url: stepperSvg,    raw: stepperSvgRaw,       width: 250, height: 190, offsetX: 125, offsetY: 52 },
  'l298n-driver': { url: l298nSvg,         raw: l298nSvgRaw,         width: 194, height: 192, offsetX: 97,  offsetY: 44 },
  vl53l0x:        { url: vl53l0xSvg,       raw: vl53l0xSvgRaw,       width: 80,  height: 70, offsetX: 40,  offsetY: 20 },
  'reed-switch-module': {
    url: reedSwitchSvg,
    raw: reedSwitchSvgRaw,
    width: 46,
    height: 111,
    offsetX: 23,
    offsetY: 28,
  },
  'breadboard-power-supply': {
    url: breadboardPowerSvg,
    raw: breadboardPowerSvgRaw,
    width: 92,
    height: 153,
    offsetX: 46,
    offsetY: 28,
  },
  acs712:         { url: acs712Svg,        raw: acs712SvgRaw,        width: 46,  height: 110, offsetX: 23,  offsetY: 28 },
  'logic-level-converter': {
    url: levelConverterSvg,
    raw: levelConverterSvgRaw,
    width: 64,
    height: 70,
    offsetX: 32,
    offsetY: 18,
  },
  'rf-433-receiver': {
    url: rf433Svg,
    raw: rf433SvgRaw,
    width: 72,
    height: 34,
    offsetX: 36,
    offsetY: 12,
  },
  'sound-sensor': { url: soundSensorSvg,   raw: soundSensorSvgRaw,   width: 74,  height: 26, offsetX: 37,  offsetY: 8  },
  tm1637:         { url: tm1637Svg,        raw: tm1637SvgRaw,        width: 96,  height: 53, offsetX: 48,  offsetY: 16 },
  'uln2003-driver': { url: uln2003Svg,     raw: uln2003SvgRaw,       width: 72,  height: 142, offsetX: 36,  offsetY: 30 },
  'rf-433-transmitter': {
    url: rf433TxSvg,
    raw: rf433TxSvgRaw,
    width: 56,
    height: 56,
    offsetX: 28,
    offsetY: 16,
  },
  'ds18b20-probe': { url: ds18b20Svg,      raw: ds18b20SvgRaw,       width: 30,  height: 138, offsetX: 15,  offsetY: 22 },
  'deneyap-gps-glonass': {
    url: deneyapGpsSvg,
    raw: deneyapGpsSvgRaw,
    width: 64,
    height: 96,
    offsetX: 32,
    offsetY: 20,
  },
  'deneyap-9-axis-imu': {
    url: deneyapImuSvg,
    raw: deneyapImuSvgRaw,
    width: 58,
    height: 58,
    offsetX: 29,
    offsetY: 18,
  },
  'deneyap-touch-keypad': {
    url: deneyapTouchKeypadSvg,
    raw: deneyapTouchKeypadSvgRaw,
    width: 64,
    height: 128,
    offsetX: 32,
    offsetY: 22,
  },
  'deneyap-rain-sensor-center': {
    url: deneyapRainCenterSvg,
    raw: deneyapRainCenterSvgRaw,
    width: 58,
    height: 58,
    offsetX: 29,
    offsetY: 18,
  },
  'deneyap-rain-sensor-surface': {
    url: deneyapRainSurfaceSvg,
    raw: deneyapRainSurfaceSvgRaw,
    width: 58,
    height: 58,
    offsetX: 29,
    offsetY: 18,
  },
  'esp8266-module': { url: esp8266Svg,     raw: esp8266SvgRaw,       width: 72,  height: 42, offsetX: 36,  offsetY: 12 },
  hx711:          { url: hx711Svg,         raw: hx711SvgRaw,         width: 82,  height: 48, offsetX: 41,  offsetY: 16 },
  'microsd-module': {
    url: microsdSvg,
    raw: microsdSvgRaw,
    width: 68,
    height: 119,
    offsetX: 34,
    offsetY: 18,
  },
  'ds3231-rtc':   { url: ds3231Svg,        raw: ds3231SvgRaw,        width: 108, height: 62, offsetX: 54,  offsetY: 18 },
  'max7219-matrix': {
    url: max7219Svg,
    raw: max7219SvgRaw,
    width: 100,
    height: 180,
    offsetX: 50,
    offsetY: 24,
  },
  'ov7670-camera': {
    url: ov7670Svg,
    raw: ov7670SvgRaw,
    width: 125,
    height: 125,
    offsetX: 62.5,
    offsetY: 20,
  },
  tcrt5000:       { url: tcrt5000Svg,      raw: tcrt5000SvgRaw,      width: 36,  height: 20, offsetX: 18,  offsetY: 8  },
  'tp4056-charger': {
    url: tp4056Svg,
    raw: tp4056SvgRaw,
    width: 48,
    height: 74,
    offsetX: 24,
    offsetY: 18,
  },
  rfm69hcw:       { url: rfm69Svg,         raw: rfm69SvgRaw,         width: 56,  height: 56, offsetX: 28,  offsetY: 16 },
  'shaft-encoder': {
    url: shaftEncoderSvg,
    raw: shaftEncoderSvgRaw,
    width: 42,
    height: 72,
    offsetX: 21,
    offsetY: 22,
  },
  tcs230:         { url: tcs230Svg,        raw: tcs230SvgRaw,        width: 78,  height: 56, offsetX: 39,  offsetY: 16 },
  'uv-sensor':    { url: uvSensorSvg,      raw: uvSensorSvgRaw,      width: 38,  height: 72, offsetX: 19,  offsetY: 22 },
  'hc-sr04':      { url: hcsr04Svg,        raw: hcsr04SvgRaw,        width: 62,  height: 32, offsetX: 31,  offsetY: 10 },
  'ir-sensor':    { url: irSensorSvg,      raw: irSensorSvgRaw,      width: 20,  height: 64, offsetX: 10,  offsetY: 22 },
  'seven-segment':{ url: sevenSegmentSvg,  raw: sevenSegmentSvgRaw,  width: 32,  height: 49, offsetX: 16,  offsetY: 22 },
  'lcd-16x2':     { url: lcdSvg,           raw: lcdSvgRaw,           width: 130, height: 58, offsetX: 65,  offsetY: 24 },
  'transistor-npn': { url: transistorNpnSvg, raw: transistorNpnSvgRaw, width: 22, height: 32, offsetX: 11, offsetY: 8 },
  'transistor-pnp': { url: transistorPnpSvg, raw: transistorPnpSvgRaw, width: 22, height: 32, offsetX: 11, offsetY: 8 },
  relay:          { url: relaySvg,         raw: relaySvgRaw,         width: 52,  height: 42, offsetX: 26,  offsetY: 14 },
  multimeter:     { url: multimeterSvg,    raw: multimeterSvgRaw,    width: 160, height: 248, offsetX: 80,  offsetY: 124 },
  'motor-driver': { url: motorDriverSvg,   raw: motorDriverSvgRaw,   width: 72,  height: 30, offsetX: 36,  offsetY: 8  },
};

function identityMatrix(): Matrix {
  return [1, 0, 0, 1, 0, 0];
}

function multiplyMatrices(left: Matrix, right: Matrix): Matrix {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

function applyMatrix(point: Point, matrix: Matrix): Point {
  return {
    x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
    y: matrix[1] * point.x + matrix[3] * point.y + matrix[5],
  };
}

function parseTransform(transform: string | null): Matrix {
  if (!transform) return identityMatrix();

  const trimmed = transform.trim();
  const openIdx = trimmed.indexOf('(');
  const closeIdx = trimmed.lastIndexOf(')');
  if (openIdx === -1 || closeIdx === -1) return identityMatrix();

  const kind = trimmed.slice(0, openIdx).trim();
  const values = trimmed
    .slice(openIdx + 1, closeIdx)
    .split(/[\s,]+/)
    .map((value) => Number(value))
    .filter((value) => !Number.isNaN(value));

  switch (kind) {
    case 'translate': {
      const [tx = 0, ty = 0] = values;
      return [1, 0, 0, 1, tx, ty];
    }
    case 'scale': {
      const [sx = 1, sy = sx] = values;
      return [sx, 0, 0, sy, 0, 0];
    }
    case 'rotate': {
      const [angle = 0, cx = 0, cy = 0] = values;
      const rad = (angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const moveToOrigin: Matrix = [1, 0, 0, 1, -cx, -cy];
      const rotateMatrix: Matrix = [cos, sin, -sin, cos, 0, 0];
      const moveBack: Matrix = [1, 0, 0, 1, cx, cy];
      return multiplyMatrices(moveBack, multiplyMatrices(rotateMatrix, moveToOrigin));
    }
    case 'matrix': {
      const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = values;
      return [a, b, c, d, e, f];
    }
    default:
      return identityMatrix();
  }
}

function getRectCenter(element: Element): Point {
  const x = Number(element.getAttribute('x') ?? 0);
  const y = Number(element.getAttribute('y') ?? 0);
  const width = Number(element.getAttribute('width') ?? 0);
  const height = Number(element.getAttribute('height') ?? 0);
  return { x: x + width / 2, y: y + height / 2 };
}

function getCircleCenter(element: Element): Point {
  return {
    x: Number(element.getAttribute('cx') ?? 0),
    y: Number(element.getAttribute('cy') ?? 0),
  };
}

function getPathCenter(element: Element): Point {
  const d = element.getAttribute('d') ?? '';
  const numbers = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) ?? [];
  if (numbers.length < 2) return { x: 0, y: 0 };

  const xs: number[] = [];
  const ys: number[] = [];
  for (let idx = 0; idx + 1 < numbers.length; idx += 2) {
    xs.push(numbers[idx]);
    ys.push(numbers[idx + 1]);
  }

  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

function getConnectorCenter(element: Element): Point {
  const tag = element.tagName.toLowerCase();
  if (tag === 'rect') return getRectCenter(element);
  if (tag === 'circle') return getCircleCenter(element);
  if (tag === 'path') return getPathCenter(element);
  return { x: 0, y: 0 };
}

function getViewBox(raw: string): { minX: number; minY: number; width: number; height: number } | null {
  const viewBox = raw.match(/viewBox\s*=\s*"([^"]+)"/i)?.[1] ?? raw.match(/viewBox\s*=\s*'([^']+)'/i)?.[1];
  if (viewBox) {
    const values = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((value) => !Number.isNaN(value));

    if (values.length === 4) {
      return {
        minX: values[0],
        minY: values[1],
        width: values[2],
        height: values[3],
      };
    }
  }

  const width = Number((raw.match(/width\s*=\s*"([^"]+)"/i)?.[1] ?? '').replace(/[^\d.+-]/g, ''));
  const height = Number((raw.match(/height\s*=\s*"([^"]+)"/i)?.[1] ?? '').replace(/[^\d.+-]/g, ''));

  if (Number.isNaN(width) || Number.isNaN(height) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    minX: 0,
    minY: 0,
    width,
    height,
  };
}

function toGroupCoordinates(type: ComponentType, point: Point): Point | null {
  const config = SVG_CONFIGS[type];
  const viewBox = getViewBox(config.raw);
  if (!viewBox) return null;

  const scaleX = config.width / viewBox.width;
  const scaleY = config.height / viewBox.height;

  return {
    x: (point.x - viewBox.minX) * scaleX - config.offsetX,
    y: (point.y - viewBox.minY) * scaleY - config.offsetY,
  };
}

function getPinLayout(type: ComponentType): Point[] | null {
  if (pinLayoutCache.has(type)) {
    return pinLayoutCache.get(type) ?? null;
  }

  if (typeof DOMParser === 'undefined') {
    pinLayoutCache.set(type, null);
    return null;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(SVG_CONFIGS[type].raw, 'image/svg+xml');
    const connectorMap = new Map<number, Element>();
    Array.from(doc.querySelectorAll('[id^="connector"][id$="pin"]')).forEach((element) => {
        const id = element.getAttribute('id') ?? '';
        const match = id.match(CONNECTOR_ID);
        if (!match) return;
        const index = Number(match[1]);
        if (!connectorMap.has(index)) {
          connectorMap.set(index, element);
        }
      });

    const connectors = Array.from(connectorMap.entries())
      .map(([index, element]) => ({ index, element }))
      .sort((left, right) => left.index - right.index);

    const layout = connectors
      .map(({ element }) => {
        let point = getConnectorCenter(element);
        let current: Element | null = element;

        while (current && current.tagName.toLowerCase() !== 'svg') {
          point = applyMatrix(point, parseTransform(current.getAttribute('transform')));
          current = current.parentElement;
        }

        return toGroupCoordinates(type, point);
      })
      .filter((point): point is Point => point !== null);

    pinLayoutCache.set(type, layout.length > 0 ? layout : null);
    return pinLayoutCache.get(type) ?? null;
  } catch {
    pinLayoutCache.set(type, null);
    return null;
  }
}

export function applySvgPinLayout(type: ComponentType, pins: Pin[]): Pin[] {
  const layout = getPinLayout(type);
  if (!layout || layout.length < pins.length) return pins;

  return pins.map((pin, index) => ({
    ...pin,
    x: layout[index]?.x ?? pin.x,
    y: layout[index]?.y ?? pin.y,
  }));
}

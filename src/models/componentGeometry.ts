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
import bme280Svg from '../assets/components/bme280.svg';
import bme280SvgRaw from '../assets/components/bme280.svg?raw';
import ina219Svg from '../assets/components/ina219.svg';
import ina219SvgRaw from '../assets/components/ina219.svg?raw';
import sx1276LoraSvg from '../assets/components/sx1276-lora.svg';
import sx1276LoraSvgRaw from '../assets/components/sx1276-lora.svg?raw';
import a4988DriverSvg from '../assets/components/a4988-driver.svg';
import a4988DriverSvgRaw from '../assets/components/a4988-driver.svg?raw';
import bts7960DriverSvg from '../assets/components/bts7960-driver.svg';
import bts7960DriverSvgRaw from '../assets/components/bts7960-driver.svg?raw';
import liIonBatterySvg from '../assets/components/li-ion-battery.svg';
import liIonBatterySvgRaw from '../assets/components/li-ion-battery.svg?raw';
import liPoBatterySvg from '../assets/components/li-po-battery.svg';
import liPoBatterySvgRaw from '../assets/components/li-po-battery.svg?raw';
import battery9vSvg from '../assets/components/9v-battery.svg';
import battery9vSvgRaw from '../assets/components/9v-battery.svg?raw';
import batteryAaSvg from '../assets/components/aa-battery.svg';
import batteryAaSvgRaw from '../assets/components/aa-battery.svg?raw';
import coinCell3vSvg from '../assets/components/coin-cell-3v.svg';
import coinCell3vSvgRaw from '../assets/components/coin-cell-3v.svg?raw';
import transistorNpnSvg from '../assets/components/transistor-npn.svg';
import transistorNpnSvgRaw from '../assets/components/transistor-npn.svg?raw';
import transistorPnpSvg from '../assets/components/transistor-pnp.svg';
import transistorPnpSvgRaw from '../assets/components/transistor-pnp.svg?raw';
import relaySvg from '../assets/components/relay.svg';
import relaySvgRaw from '../assets/components/relay.svg?raw';
import multimeterSvg from '../assets/components/multimeter.svg';
import multimeterSvgRaw from '../assets/components/multimeter.svg?raw';
import oscilloscopeSvg from '../assets/components/oscilloscope.svg';
import oscilloscopeSvgRaw from '../assets/components/oscilloscope.svg?raw';
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
  bme280:         { url: bme280Svg,        raw: bme280SvgRaw,        width: 84,  height: 58, offsetX: 40,  offsetY: 33 },
  ina219:         { url: ina219Svg,        raw: ina219SvgRaw,        width: 78,  height: 68, offsetX: 39,  offsetY: 32 },
  'sx1276-lora':  { url: sx1276LoraSvg,    raw: sx1276LoraSvgRaw,    width: 104, height: 62, offsetX: 48,  offsetY: 29 },
  'a4988-driver': { url: a4988DriverSvg,   raw: a4988DriverSvgRaw,   width: 78,  height: 102, offsetX: 39,  offsetY: 30 },
  'bts7960-driver': { url: bts7960DriverSvg, raw: bts7960DriverSvgRaw, width: 140, height: 116, offsetX: 70, offsetY: 58 },
  'li-ion-battery': { url: liIonBatterySvg, raw: liIonBatterySvgRaw, width: 128, height: 58, offsetX: 64, offsetY: 29 },
  'li-po-battery': { url: liPoBatterySvg,  raw: liPoBatterySvgRaw,  width: 120, height: 76, offsetX: 60, offsetY: 38 },
  '9v-battery':   { url: battery9vSvg,     raw: battery9vSvgRaw,     width: 100, height: 70, offsetX: 50,  offsetY: 35 },
  'aa-battery':   { url: batteryAaSvg,     raw: batteryAaSvgRaw,     width: 130, height: 40, offsetX: 65,  offsetY: 20 },
  'coin-cell-3v': { url: coinCell3vSvg,    raw: coinCell3vSvgRaw,    width: 90,  height: 84, offsetX: 45,  offsetY: 42 },
  'transistor-npn': { url: transistorNpnSvg, raw: transistorNpnSvgRaw, width: 22, height: 32, offsetX: 11, offsetY: 8 },
  'transistor-pnp': { url: transistorPnpSvg, raw: transistorPnpSvgRaw, width: 22, height: 32, offsetX: 11, offsetY: 8 },
  relay:          { url: relaySvg,         raw: relaySvgRaw,         width: 52,  height: 42, offsetX: 26,  offsetY: 14 },
  multimeter:     { url: multimeterSvg,    raw: multimeterSvgRaw,    width: 160, height: 248, offsetX: 80,  offsetY: 124 },
  oscilloscope:   { url: oscilloscopeSvg,  raw: oscilloscopeSvgRaw,  width: 164, height: 104, offsetX: 82,  offsetY: 52 },
  'motor-driver': { url: motorDriverSvg,   raw: motorDriverSvgRaw,   width: 72,  height: 30, offsetX: 36,  offsetY: 8  },
  // The breadboard has no artwork file: the canvas draws its holes, rails and
  // gutter itself. It is listed here for its size alone, so selection boxes and
  // bounds treat it like any other part. Unlike the rest it is drawn from its
  // top-left corner, hence the zero offsets. Size mirrors BB_BOARD_W and
  // BB_TOTAL_H in models/breadboard.ts — imported by value would make a cycle.
  breadboard:     { url: '',               raw: '',                  width: 764.5, height: 242.5, offsetX: 0, offsetY: 0 },
};

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

/**
 * Reads where a part's connectors actually sit by laying the SVG out offscreen
 * and asking the browser. Resolving nested transforms by hand used to place
 * pins hundreds of units away from their pads on some artwork.
 */
/**
 * A few Fritzing exports carry no viewBox and are sized in millimetres, so their
 * user space is whatever the browser lays the element out at. Reading "16mm" off
 * the width attribute would scale every connector by the DPI ratio and scatter
 * the pins far outside the artwork, so measure the rendered viewport instead.
 */
function measureViewport(
  svg: SVGSVGElement,
  screenToUser: DOMMatrix
): { minX: number; minY: number; width: number; height: number } | null {
  const rect = svg.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const topLeft = svg.createSVGPoint();
  topLeft.x = rect.left;
  topLeft.y = rect.top;
  const bottomRight = svg.createSVGPoint();
  bottomRight.x = rect.right;
  bottomRight.y = rect.bottom;

  const start = topLeft.matrixTransform(screenToUser);
  const end = bottomRight.matrixTransform(screenToUser);
  if (end.x <= start.x || end.y <= start.y) return null;

  return { minX: start.x, minY: start.y, width: end.x - start.x, height: end.y - start.y };
}

function measurePinLayout(type: ComponentType): Point[] | null {
  const config = SVG_CONFIGS[type];
  if (typeof document === 'undefined' || !document.body) return null;

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden;';
  host.innerHTML = config.raw;
  document.body.appendChild(host);

  try {
    const svg = host.querySelector('svg');
    if (!svg) return null;

    const screenToUser = svg.getScreenCTM()?.inverse();
    if (!screenToUser) return null;

    const box = svg.viewBox?.baseVal;
    const viewBox =
      box && box.width > 0 && box.height > 0
        ? { minX: box.x, minY: box.y, width: box.width, height: box.height }
        : measureViewport(svg, screenToUser) ?? getViewBox(config.raw);
    if (!viewBox) return null;

    const scaleX = config.width / viewBox.width;
    const scaleY = config.height / viewBox.height;

    const connectors = new Map<number, Element>();
    svg.querySelectorAll('[id^="connector"][id$="pin"]').forEach((element) => {
      const match = (element.getAttribute('id') ?? '').match(CONNECTOR_ID);
      if (!match) return;
      const index = Number(match[1]);
      if (!connectors.has(index)) connectors.set(index, element);
    });

    const layout = [...connectors.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([, element]) => {
        const rect = element.getBoundingClientRect();
        const point = svg.createSVGPoint();
        point.x = rect.left + rect.width / 2;
        point.y = rect.top + rect.height / 2;
        const user = point.matrixTransform(screenToUser);

        return {
          x: (user.x - viewBox.minX) * scaleX - config.offsetX,
          y: (user.y - viewBox.minY) * scaleY - config.offsetY,
        };
      });

    return layout.length > 0 ? layout : null;
  } catch {
    return null;
  } finally {
    host.remove();
  }
}

function getPinLayout(type: ComponentType): Point[] | null {
  if (pinLayoutCache.has(type)) {
    return pinLayoutCache.get(type) ?? null;
  }

  const layout = measurePinLayout(type);
  pinLayoutCache.set(type, layout);
  return layout;
}

/**
 * Places pins on the connectors found in the part's artwork.
 *
 * Pins are matched to connectors by position, which is wrong for parts whose
 * artwork numbers them the other way round — the LED carries its cathode on
 * connector0. Those parts pass `connectorOrder`.
 *
 * Its values are positions in the connector list sorted by number, which equals
 * the connector number only when the artwork numbers from zero without gaps. A
 * negative value leaves that pin where it was declared, for the odd pad the
 * artwork never marked.
 */
export function applySvgPinLayout(
  type: ComponentType,
  pins: Pin[],
  connectorOrder?: number[]
): Pin[] {
  const layout = getPinLayout(type);
  if (!layout) return pins;

  const required = connectorOrder ? Math.max(...connectorOrder) + 1 : pins.length;
  if (layout.length < required) return pins;

  return pins.map((pin, index) => {
    const connectorIndex = connectorOrder?.[index] ?? index;
    if (connectorIndex < 0) return pin;

    const point = layout[connectorIndex] ?? layout[index];

    return {
      ...pin,
      x: point?.x ?? pin.x,
      y: point?.y ?? pin.y,
    };
  });
}

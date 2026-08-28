import type {
  CircuitComponent,
  OscilloscopeSample,
  Pin,
  Wire,
} from '../models/types';
import { ARDUINO_COMPONENT_ID } from '../models/arduinoUno';
import {
  BREADBOARD_COMPONENT_ID,
  BREADBOARD_HOLES,
  BREADBOARD_STRIP_GROUPS,
} from '../models/breadboard';

type SimulationPropertyValue = string | number | boolean;

type RuntimeCallbacks = {
  addSerialOutput: (text: string) => void;
  pushOscilloscopeSample: (componentId: string, sample: OscilloscopeSample) => void;
  setLedState: (componentId: string, on: boolean, brightness: number) => void;
  clearLedStates: () => void;
  setComponentState: (
    componentId: string,
    properties: Record<string, SimulationPropertyValue>
  ) => void;
  clearComponentStates: () => void;
  /** Current digital/PWM value per pin id, 0-255. Drives the onboard LED. */
  setPinStates: (states: Record<string, number>) => void;
  /**
   * A statement blew up while running — the interpreter caught it instead of
   * letting it crash the app. Optional so existing callback objects (tests,
   * mainly) don't all need updating for a failure mode they don't exercise.
   */
  reportRuntimeError?: (message: string) => void;
};

type Command =
  | { type: 'delay'; ms: number }
  | { type: 'serialPrint'; value: string; newline: boolean }
  | { type: 'pinWrite'; pin: string; value: number }
  | { type: 'servoAttach'; instance: string; pin: string }
  | { type: 'servoDetach'; instance: string }
  | { type: 'servoWrite'; instance: string; angle: number; pulseWidthUs: number | null };

type RuntimeValue = number | boolean | string;
type RuntimeScope = Map<string, RuntimeValue>;

type RuntimeStatement =
  | { type: 'expr'; code: string }
  | { type: 'block'; body: RuntimeStatement[] }
  | {
      type: 'if';
      condition: string;
      consequent: RuntimeStatement;
      alternate: RuntimeStatement | null;
    }
  | {
      type: 'for';
      init: string;
      condition: string;
      update: string;
      body: RuntimeStatement;
    };

type RuntimeExecutionContext = {
  baseVariables: VariableTables;
  scope: RuntimeScope;
  clockMs: { value: number };
  pinValues: Map<string, number>;
  servoRuntime: Map<string, ServoRuntimeState>;
  lcdRuntime: Map<string, LcdRuntimeState>;
  connectivity: Connectivity;
  measurementConnectivity: Connectivity;
  boardPins: Pin[];
  logicHighVoltage: number;
  callbacks: RuntimeCallbacks;
  trackTimeout: (fn: () => void, ms: number) => void;
  flushSerialBuffer: () => void;
  appendSerialOutput: (text: string, newline: boolean) => void;
  /** Parts destroyed during this run, kept so they stay dead until it ends. */
  damagedComponents: Map<string, DamageRecord>;
  isCancelled: () => boolean;
};

type VariableTables = {
  numeric: Map<string, number>;
  logic: Map<string, boolean>;
  pin: Map<string, string>;
  text: Map<string, string>;
};

type Connectivity = {
  endpointToNet: Map<string, number>;
  netEndpoints: Map<number, string[]>;
  components: CircuitComponent[];
};

type NetState = {
  levels: Map<number, number>;
  voltages: Map<number, number>;
  powerNets: Set<number>;
  groundNets: Set<number>;
};

export type CompileErrorReason =
  | 'unbalanced-brace'
  | 'unbalanced-paren'
  | 'unsupported-while'
  | 'unsupported-do-while'
  | 'unsupported-switch'
  | 'empty-if-condition'
  | 'dangling-operator'
  | 'unknown';

export type CompileError = {
  reason: CompileErrorReason;
  line: number;
  /** Raw diagnostic text — only meaningful for 'unknown', where no translated copy exists. */
  detail: string;
};

/** Thrown by the parser on sketch text it cannot make sense of structurally. */
class SketchSyntaxError extends Error {
  constructor(
    public readonly reason: CompileErrorReason,
    public readonly line: number,
    message: string
  ) {
    super(message);
    this.name = 'SketchSyntaxError';
  }
}

function lineNumberAt(code: string, offset: number): number {
  return code.slice(0, Math.max(0, offset)).split('\n').length;
}

/**
 * Parsing recurses into substrings (a loop() body, a nested { } block), each
 * restarting its own line count from 1 — this composes that back with the
 * line the substring actually started on in the original sketch, so a
 * reported error line always points at the right place in the code editor.
 */
function resolveLine(baseLine: number, code: string, offset: number): number {
  return baseLine + lineNumberAt(code, offset) - 1;
}

type ResistiveEdge = {
  fromNet: number;
  toNet: number;
  resistance: number;
  componentId: string;
  componentType: CircuitComponent['type'];
  pinIds: [string, string];
};

type ServoRuntimeState = {
  pin: string | null;
  angle: number;
  pulseWidthUs: number | null;
  hasWritten: boolean;
};

type LcdRuntimeState = {
  rsPin: string | null;
  rwPin: string | null;
  enablePin: string | null;
  dataPins: string[];
  cols: number;
  rows: number;
  cursorCol: number;
  cursorRow: number;
  displayOn: boolean;
  backlight: boolean;
  lines: string[];
};

type DriverChannelDefinition = {
  enablePin: string;
  input1Pin: string;
  input2Pin: string;
  output1Pin: string;
  output2Pin: string;
  enabledProperty?: string;
  pwmProperty?: string;
};

/**
 * A half bridge drives one output on its own: its enable pin decides whether the
 * leg conducts at all and its PWM pin sets how hard the high side is switched on.
 * Two of them facing each other is how the BTS7960 makes an H bridge, which is a
 * different shape from the enable + IN1/IN2 channel the L293D and L298N use.
 */
type DriverHalfBridgeDefinition = {
  enablePin: string;
  pwmPin: string;
  outputPin: string;
  sensePin?: string;
  enabledProperty?: string;
  pwmProperty?: string;
};

type DriverDefinition = {
  supplyPins: string[];
  groundPins: string[];
  channels: DriverChannelDefinition[];
  halfBridges?: DriverHalfBridgeDefinition[];
  /** Property holding the load current, used to drive the current sense pins. */
  senseCurrentProperty?: string;
  senseVoltsPerAmp?: number;
};

const DRIVER_DEFINITIONS: Partial<Record<CircuitComponent['type'], DriverDefinition>> = {
  'l298n-driver': {
    supplyPins: ['vin12', 'logic5v', 'logic5v_a', 'logic5v_b'],
    groundPins: ['gnd'],
    channels: [
      {
        enablePin: 'ena',
        input1Pin: 'in1',
        input2Pin: 'in2',
        output1Pin: 'out1',
        output2Pin: 'out2',
        enabledProperty: 'enabledA',
        pwmProperty: 'pwmA',
      },
      {
        enablePin: 'enb',
        input1Pin: 'in3',
        input2Pin: 'in4',
        output1Pin: 'out3',
        output2Pin: 'out4',
        enabledProperty: 'enabledB',
        pwmProperty: 'pwmB',
      },
    ],
  },
  'bts7960-driver': {
    supplyPins: ['vcc', 'b_plus'],
    groundPins: ['gnd', 'b_minus'],
    channels: [],
    // The chip mirrors about 1/8500 of the load current out of IS, and the
    // 1 kOhm resistor on the IBT-2 board turns that into roughly 0.118 V per amp
    // while that side's high side is conducting.
    senseCurrentProperty: 'motorCurrentA',
    senseVoltsPerAmp: 0.118,
    halfBridges: [
      {
        enablePin: 'r_en',
        pwmPin: 'rpwm',
        outputPin: 'm_plus',
        sensePin: 'r_is',
        enabledProperty: 'enabledR',
        pwmProperty: 'pwmR',
      },
      {
        enablePin: 'l_en',
        pwmPin: 'lpwm',
        outputPin: 'm_minus',
        sensePin: 'l_is',
        enabledProperty: 'enabledL',
        pwmProperty: 'pwmL',
      },
    ],
  },
  'motor-driver': {
    supplyPins: ['vcc'],
    groundPins: ['gnd'],
    channels: [
      {
        enablePin: 'en1',
        input1Pin: 'in1',
        input2Pin: 'in2',
        output1Pin: 'out1',
        output2Pin: 'out2',
      },
      {
        enablePin: 'en2',
        input1Pin: 'in3',
        input2Pin: 'in4',
        output1Pin: 'out3',
        output2Pin: 'out4',
      },
    ],
  },
};

type DamageLimits = {
  /** Amps through the part before it lets the smoke out. */
  maxCurrent?: number;
  /** Volts across the part itself. */
  maxVoltage?: number;
  /** Watts the body can dissipate; the usual quarter watt resistor. */
  maxPower?: number;
};

/**
 * What each part survives. Only the ones with a resistance in the circuit model
 * can be measured this way, so only they are listed; everything else is judged
 * on its supply pin instead.
 */
const DAMAGE_LIMITS: Partial<Record<CircuitComponent['type'], DamageLimits>> = {
  // Current alone decides for LEDs. A pin driving one without a resistor is
  // sloppy but survivable at 5 V, exactly as on a real board; a battery pushes
  // far more through the same part and kills it.
  led: { maxCurrent: 0.03 },
  'rgb-led': { maxCurrent: 0.03 },
  diode: { maxCurrent: 1 },
  resistor: { maxPower: 0.25 },
  buzzer: { maxCurrent: 0.04 },
  'dc-motor': { maxCurrent: 1 },
  servo: { maxCurrent: 1, maxVoltage: 6.5 },
  relay: { maxCurrent: 0.1, maxVoltage: 6 },
};

/** Names a part answers to when it is looking for its supply. */
const SUPPLY_PIN_IDS = ['vcc', 'vin', '5v', 'vdd', 'v_in', 'logic5v'];

/** Modules that run on 3.3 V and do not forgive 5 V. */
const LOW_VOLTAGE_PARTS = new Set<CircuitComponent['type']>([
  'esp8266-module',
  'vl53l0x',
  'bme280',
  'sx1276-lora',
  'rfm69hcw',
  'ov7670-camera',
  'microsd-module',
]);

const DEFAULT_SUPPLY_LIMIT = 5.5;
const LOW_SUPPLY_LIMIT = 3.6;

export type DamageReason = 'overcurrent' | 'overvoltage' | 'overpower';

export type DamageRecord = {
  reason: DamageReason;
  detail: string;
};

const formatCurrent = (amps: number) =>
  amps >= 1 ? `${amps.toFixed(2)} A` : `${Math.round(amps * 1000)} mA`;

const formatVoltage = (volts: number) => `${volts.toFixed(1)} V`;

const formatPower = (watts: number) => `${watts.toFixed(2)} W`;

/**
 * Decides which parts have just been destroyed by what the solver measured, and
 * remembers them for the rest of the run. A part is never un-damaged while the
 * simulation is running; stopping it builds a fresh circuit.
 */
function computeComponentDamage(
  connectivity: Connectivity,
  netVoltages: Map<number, number>,
  resistiveEdges: ResistiveEdge[],
  damaged: Map<string, DamageRecord>,
  callbacks: RuntimeCallbacks
): void {
  const report = (component: CircuitComponent, record: DamageRecord) => {
    if (damaged.has(component.id)) return;
    damaged.set(component.id, record);
    callbacks.addSerialOutput(`[!] ${component.type}: ${record.detail}`);
  };

  for (const edge of resistiveEdges) {
    const limits = DAMAGE_LIMITS[edge.componentType];
    if (!limits) continue;

    const component = connectivity.components.find((item) => item.id === edge.componentId);
    if (!component || damaged.has(component.id)) continue;

    const fromVoltage = netVoltages.get(edge.fromNet);
    const toVoltage = netVoltages.get(edge.toNet);
    if (fromVoltage === undefined || toVoltage === undefined) continue;

    const volts = Math.abs(fromVoltage - toVoltage);
    const amps = volts / Math.max(edge.resistance, 0.0001);
    const watts = volts * amps;

    if (limits.maxCurrent !== undefined && amps > limits.maxCurrent) {
      report(component, {
        reason: 'overcurrent',
        detail: `${formatCurrent(amps)} > ${formatCurrent(limits.maxCurrent)}`,
      });
      continue;
    }

    if (limits.maxPower !== undefined && watts > limits.maxPower) {
      report(component, {
        reason: 'overpower',
        detail: `${formatPower(watts)} > ${formatPower(limits.maxPower)}`,
      });
      continue;
    }

    if (limits.maxVoltage !== undefined && volts > limits.maxVoltage) {
      report(component, {
        reason: 'overvoltage',
        detail: `${formatVoltage(volts)} > ${formatVoltage(limits.maxVoltage)}`,
      });
    }
  }

  // Everything else is judged by what arrives on its supply pin.
  for (const component of connectivity.components) {
    if (damaged.has(component.id)) continue;
    if (DAMAGE_LIMITS[component.type] || BATTERY_TYPES.has(component.type)) continue;

    const limit = LOW_VOLTAGE_PARTS.has(component.type)
      ? LOW_SUPPLY_LIMIT
      : DEFAULT_SUPPLY_LIMIT;

    for (const pin of component.pins) {
      if (!SUPPLY_PIN_IDS.includes(pin.id.toLowerCase())) continue;

      const net = getEndpointNet(connectivity, component.id, pin.id);
      const voltage = net === undefined ? undefined : netVoltages.get(net);
      if (voltage === undefined || voltage <= limit) continue;

      report(component, {
        reason: 'overvoltage',
        detail: `${formatVoltage(voltage)} > ${formatVoltage(limit)}`,
      });
      break;
    }
  }

  for (const [componentId, record] of damaged.entries()) {
    callbacks.setComponentState(componentId, {
      damaged: true,
      damageReason: record.reason,
      damageDetail: record.detail,
    });
  }
}

const NOOP_CALLBACKS: RuntimeCallbacks = {
  addSerialOutput: () => {},
  pushOscilloscopeSample: () => {},
  setLedState: () => {},
  clearLedStates: () => {},
  setComponentState: () => {},
  clearComponentStates: () => {},
  setPinStates: () => {},
};

/**
 * Terminal voltage as a function of remaining charge: `base` is what the pack
 * reads flat, `base + span` is what it reads fresh off the shelf.
 */
const FIXED_BATTERY_VOLTAGE: Partial<Record<CircuitComponent['type'], { base: number; span: number }>> = {
  // A carbon-zinc/alkaline PP3 sags from 9 V to about 6 V before it's "dead".
  '9v-battery': { base: 6, span: 3 },
  // A single alkaline AA/AAA cell: 1.5 V fresh, ~0.9 V at end of life.
  'aa-battery': { base: 0.9, span: 0.6 },
  // CR2032 coin cell: 3 V fresh, sags to ~2 V.
  'coin-cell-3v': { base: 2, span: 1 },
};

/**
 * Terminal voltage of a lithium pack: a cell sits near 3.3 V empty and 4.2 V
 * full, so a 3S pack reads about 12.6 V charged and 9.9 V flat.
 */
function getBatteryVoltage(component: CircuitComponent): number {
  const charge = clamp(getNumericProperty(component, 'chargePercent', 100), 0, 100) / 100;

  const fixed = FIXED_BATTERY_VOLTAGE[component.type];
  if (fixed) {
    return fixed.base + fixed.span * charge;
  }

  const cells = clamp(Math.round(getNumericProperty(component, 'cells', 1)), 1, 6);
  return cells * (3.3 + 0.9 * charge);
}

const BATTERY_TYPES = new Set<CircuitComponent['type']>([
  'li-ion-battery',
  'li-po-battery',
  '9v-battery',
  'aa-battery',
  'coin-cell-3v',
]);

/** Smallest gap between loop() iterations, so a sketch without delay() cannot spin. */
const MIN_LOOP_INTERVAL_MS = 4;

let activeStop: (() => void) | null = null;
const SUPPORTED_RUNTIME_BUILTINS = new Set([
  'F',
  'STRING',
  'MILLIS',
  'MICROS',
  'ANALOGREAD',
  'DIGITALREAD',
  'ABS',
  'MIN',
  'MAX',
  'CONSTRAIN',
  'ROUND',
  'FLOOR',
  'CEIL',
  'MAP',
]);

function endpointKey(componentId: string, pinId: string): string {
  return `${componentId}:${pinId}`;
}

function normalizeVariableName(name: string): string {
  return name.trim().toUpperCase();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getNumericProperty(component: CircuitComponent, key: string, fallback: number): number {
  const rawValue = component.properties[key];
  const parsed =
    typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string'
        ? Number(rawValue)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function decodeStringLiteral(literal: string): string {
  const trimmed = literal.trim();
  if (trimmed.length < 2) return trimmed;
  const quote = trimmed[0];
  if ((quote !== '"' && quote !== "'") || trimmed[trimmed.length - 1] !== quote) {
    return trimmed;
  }

  return trimmed
    .slice(1, -1)
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");
}

function splitTopLevel(expr: string, separator: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: string | null = null;

  for (let idx = 0; idx < expr.length; idx += 1) {
    const char = expr[idx];
    const prev = idx > 0 ? expr[idx - 1] : '';

    if (quote) {
      if (char === quote && prev !== '\\') quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);

    if (char === separator && depth === 0) {
      parts.push(expr.slice(start, idx));
      start = idx + 1;
    }
  }

  parts.push(expr.slice(start));
  return parts;
}

function buildVariableTables(code: string): VariableTables {
  const tables: VariableTables = {
    numeric: new Map<string, number>(),
    logic: new Map<string, boolean>(),
    pin: new Map<string, string>(),
    text: new Map<string, string>(),
  };

  const numericRegex =
    /\b(?:const\s+|constexpr\s+)?(?:unsigned\s+)?(?:int|long|short|byte|float|double|uint8_t|uint16_t|uint32_t|size_t)\s+([A-Za-z_]\w*)\s*=\s*(-?\d+(?:\.\d+)?)\s*;/gi;
  const logicRegex =
    /\b(?:const\s+|constexpr\s+)?(?:bool|boolean|int|byte)\s+([A-Za-z_]\w*)\s*=\s*(HIGH|LOW|true|false)\s*;/gi;
  const textRegex =
    /\b(?:const\s+|constexpr\s+)?(?:String|char\s*\*|const\s+char\s*\*)\s+([A-Za-z_]\w*)\s*=\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*;/gi;
  const pinRegex =
    /\b(?:const\s+|constexpr\s+)?(?:unsigned\s+)?(?:int|long|short|byte|uint8_t|uint16_t|uint32_t|size_t)\s+([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)\s*;/gi;
  const defineNumericRegex = /^\s*#define\s+([A-Za-z_]\w*)\s+(-?\d+(?:\.\d+)?)\b/gim;
  const defineLogicRegex = /^\s*#define\s+([A-Za-z_]\w*)\s+(HIGH|LOW|true|false)\b/gim;
  const definePinRegex = /^\s*#define\s+([A-Za-z_]\w*)\s+([A-Za-z_]\w*)\b/gim;
  const defineTextRegex =
    /^\s*#define\s+([A-Za-z_]\w*)\s+("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/gim;

  for (const match of code.matchAll(numericRegex)) {
    tables.numeric.set(normalizeVariableName(match[1]), Number(match[2]));
  }

  for (const match of code.matchAll(logicRegex)) {
    const value = match[2].toUpperCase();
    tables.logic.set(normalizeVariableName(match[1]), value === 'HIGH' || value === 'TRUE');
  }

  for (const match of code.matchAll(textRegex)) {
    tables.text.set(normalizeVariableName(match[1]), decodeStringLiteral(match[2]));
  }

  for (const match of code.matchAll(pinRegex)) {
    tables.pin.set(normalizeVariableName(match[1]), match[2].trim().toUpperCase());
  }

  for (const match of code.matchAll(defineNumericRegex)) {
    tables.numeric.set(normalizeVariableName(match[1]), Number(match[2]));
  }

  for (const match of code.matchAll(defineLogicRegex)) {
    const value = match[2].toUpperCase();
    tables.logic.set(normalizeVariableName(match[1]), value === 'HIGH' || value === 'TRUE');
  }

  for (const match of code.matchAll(definePinRegex)) {
    tables.pin.set(normalizeVariableName(match[1]), match[2].trim().toUpperCase());
  }

  for (const match of code.matchAll(defineTextRegex)) {
    tables.text.set(normalizeVariableName(match[1]), decodeStringLiteral(match[2]));
  }

  return tables;
}

function createRuntimeScope(variables: VariableTables): RuntimeScope {
  const scope: RuntimeScope = new Map<string, RuntimeValue>();

  for (const [name, value] of variables.numeric.entries()) {
    scope.set(name, value);
  }
  for (const [name, value] of variables.logic.entries()) {
    scope.set(name, value);
  }
  for (const [name, value] of variables.text.entries()) {
    scope.set(name, value);
  }
  for (const [name, value] of variables.pin.entries()) {
    scope.set(name, value);
  }

  return scope;
}

function getRuntimeScopeValue(
  name: string,
  variables: VariableTables,
  scope?: RuntimeScope
): RuntimeValue | undefined {
  const normalized = normalizeVariableName(name);

  if (scope?.has(normalized)) {
    return scope.get(normalized);
  }
  if (variables.numeric.has(normalized)) {
    return variables.numeric.get(normalized);
  }
  if (variables.logic.has(normalized)) {
    return variables.logic.get(normalized);
  }
  if (variables.text.has(normalized)) {
    return variables.text.get(normalized);
  }
  if (variables.pin.has(normalized)) {
    return variables.pin.get(normalized);
  }

  return undefined;
}

function toRuntimeNumber(value: RuntimeValue | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    return Number(value);
  }

  return null;
}

function toRuntimeBoolean(value: RuntimeValue | null | undefined): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    if (normalized === 'TRUE' || normalized === 'HIGH') return true;
    if (normalized === 'FALSE' || normalized === 'LOW' || normalized === '') return false;
  }

  return null;
}

function toRuntimeString(value: RuntimeValue | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'HIGH' : 'LOW';
  return String(value);
}

function isLikelyPinToken(token: string): boolean {
  return /^(?:\d+|D\d+|A\d+|GPIO\d+|IO\d+|TX|RX|SDA|SCL|MOSI|MISO|SCK|CLK|CMD|SD[0-3]|GND(?:_[A-Z0-9]+)?|5V|3V3|3\.3V|VCC|VIN|VU|VBUS|VBAT|BAT|EN|RST|RESET|AREF|LED_BUILTIN|RAW|DTR)$/i.test(
    token.trim()
  );
}

function resolveNumericExpression(
  expr: string,
  variables: VariableTables,
  scope?: RuntimeScope
): number | null {
  const trimmed = expr.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  const scopedValue = getRuntimeScopeValue(trimmed, variables, scope);
  const numericValue = toRuntimeNumber(scopedValue);
  if (numericValue !== null) {
    return numericValue;
  }

  return null;
}

function resolveLogicExpression(
  expr: string,
  variables: VariableTables,
  scope?: RuntimeScope
): boolean | null {
  const trimmed = expr.trim();
  const upper = trimmed.toUpperCase();

  if (upper === 'HIGH' || upper === 'TRUE') return true;
  if (upper === 'LOW' || upper === 'FALSE') return false;

  const scopedValue = getRuntimeScopeValue(trimmed, variables, scope);
  const logicValue = toRuntimeBoolean(scopedValue);
  if (logicValue !== null) {
    return logicValue;
  }

  return null;
}

function resolveSerialExpression(
  expr: string,
  variables: VariableTables,
  scope?: RuntimeScope,
  context?: RuntimeExecutionContext
): string {
  const trimmed = expr.trim();
  if (!trimmed) return '';

  const parts = splitTopLevel(trimmed, '+').map((part) => part.trim()).filter(Boolean);
  const rendered = parts.map((part) => {
    if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) {
      return decodeStringLiteral(part);
    }

    if (/^String\s*\(([\s\S]*)\)$/i.test(part)) {
      return resolveSerialExpression(
        part.replace(/^String\s*\(/i, '').replace(/\)\s*$/, ''),
        variables,
        scope,
        context
      );
    }

    const numericValue = resolveNumericExpression(part, variables, scope);
    if (numericValue !== null) return String(numericValue);

    const logicValue = resolveLogicExpression(part, variables, scope);
    if (logicValue !== null) return logicValue ? 'HIGH' : 'LOW';

    const scopedValue = getRuntimeScopeValue(part, variables, scope);
    if (typeof scopedValue === 'string') {
      return scopedValue;
    }

    // Serial.println(analogRead(A0)) and the like: only the expression evaluator
    // knows the builtins, and without it the call was printed as its own source
    // text instead of its result.
    if (context) {
      const evaluated = evaluateRuntimeExpression(
        part,
        variables,
        context.scope,
        context.clockMs,
        context
      );
      if (evaluated !== null && evaluated !== undefined) {
        const text = toRuntimeString(evaluated);
        if (text !== '') return text;
      }
    }

    return part;
  });

  return rendered.join('');
}

function normalizeArduinoPin(
  pinExpr: string,
  variables: VariableTables,
  scope?: RuntimeScope
): string | null {
  const trimmed = pinExpr.trim();
  const numericValue = resolveNumericExpression(trimmed, variables, scope);
  let rawValue = numericValue !== null ? String(numericValue) : trimmed;

  const scopedValue = getRuntimeScopeValue(rawValue, variables, scope);
  if (typeof scopedValue === 'number') {
    rawValue = String(scopedValue);
  } else if (typeof scopedValue === 'string') {
    rawValue = scopedValue;
  }

  const variableName = normalizeVariableName(rawValue);
  const mappedPin = variables.pin.get(variableName);
  const normalized = (mappedPin ?? rawValue).trim().toUpperCase();

  if (/^\d+$/.test(normalized)) {
    return `D${normalized}`;
  }
  if (normalized === 'LED_BUILTIN') {
    return 'D13';
  }
  return isLikelyPinToken(normalized) ? normalized : null;
}

function extractServoInstances(code: string): Set<string> {
  const instances = new Set<string>();
  const regex = /\bServo\s+([^;]+)\s*;/gi;

  for (const match of code.matchAll(regex)) {
    for (const declaration of splitTopLevel(match[1], ',')) {
      const cleaned = declaration.trim().replace(/\s*=.*$/, '');
      const nameMatch = /([A-Za-z_]\w*)$/.exec(cleaned);
      if (nameMatch) {
        instances.add(normalizeVariableName(nameMatch[1]));
      }
    }
  }

  return instances;
}

function createLcdBuffer(cols: number, rows: number): string[] {
  return Array.from({ length: Math.max(1, rows) }, () => ' '.repeat(Math.max(1, cols)));
}

function createDefaultLcdRuntimeState(
  pins: Pick<LcdRuntimeState, 'rsPin' | 'rwPin' | 'enablePin' | 'dataPins'>
): LcdRuntimeState {
  return {
    ...pins,
    cols: 16,
    rows: 2,
    cursorCol: 0,
    cursorRow: 0,
    displayOn: true,
    backlight: true,
    lines: createLcdBuffer(16, 2),
  };
}

function parseLiquidCrystalPins(
  args: string,
  variables: VariableTables
): Pick<LcdRuntimeState, 'rsPin' | 'rwPin' | 'enablePin' | 'dataPins'> | null {
  const parts = splitTopLevel(args, ',').map((part) => part.trim()).filter(Boolean);

  if (![6, 7, 10, 11].includes(parts.length)) {
    return null;
  }

  const hasRwPin = parts.length === 7 || parts.length === 11;
  const isEightBit = parts.length === 10 || parts.length === 11;
  const rsPin = normalizeArduinoPin(parts[0] ?? '', variables);
  const rwPin = hasRwPin ? normalizeArduinoPin(parts[1] ?? '', variables) : null;
  const enablePin = normalizeArduinoPin(parts[hasRwPin ? 2 : 1] ?? '', variables);
  const dataStartIndex = hasRwPin ? 3 : 2;
  const dataPins = parts
    .slice(dataStartIndex, dataStartIndex + (isEightBit ? 8 : 4))
    .map((pinExpr) => normalizeArduinoPin(pinExpr, variables))
    .filter((pin): pin is string => Boolean(pin));

  if (!rsPin || !enablePin || dataPins.length !== (isEightBit ? 8 : 4)) {
    return null;
  }

  return {
    rsPin,
    rwPin,
    enablePin,
    dataPins,
  };
}

function extractLcdInstances(code: string, variables: VariableTables): Map<string, LcdRuntimeState> {
  const instances = new Map<string, LcdRuntimeState>();
  const regex = /\b(LiquidCrystal(?:_I2C)?)\s+([^;]+)\s*;/gi;

  for (const match of code.matchAll(regex)) {
    const lcdType = match[1].trim();
    for (const declaration of splitTopLevel(match[2], ',')) {
      const cleaned = declaration.trim();
      if (!cleaned) continue;

      const directMatch = /^([A-Za-z_]\w*)\s*\(([\s\S]*)\)$/.exec(cleaned);
      const assignedMatch =
        /^([A-Za-z_]\w*)\s*=\s*LiquidCrystal(?:_I2C)?\s*\(([\s\S]*)\)$/i.exec(cleaned);
      const resolvedMatch = directMatch ?? assignedMatch;
      if (!resolvedMatch) continue;

      if (/LiquidCrystal_I2C/i.test(lcdType)) {
        const args = splitTopLevel(resolvedMatch[2], ',').map((part) => part.trim()).filter(Boolean);
        const cols = Math.round(resolveNumericExpression(args[1] ?? '16', variables) ?? 16) || 16;
        const rows = Math.round(resolveNumericExpression(args[2] ?? '2', variables) ?? 2) || 2;
        const runtimeState = createDefaultLcdRuntimeState({
          rsPin: null,
          rwPin: null,
          enablePin: null,
          dataPins: [],
        });
        resizeLcdBuffer(runtimeState, cols, rows);
        instances.set(normalizeVariableName(resolvedMatch[1]), runtimeState);
        continue;
      }

      const pins = parseLiquidCrystalPins(resolvedMatch[2], variables);
      if (!pins) continue;

      instances.set(
        normalizeVariableName(resolvedMatch[1]),
        createDefaultLcdRuntimeState(pins)
      );
    }
  }

  return instances;
}

/** Returns the function's body text along with the line it starts on, so
 * errors found while parsing that body (a substring with its own line-1
 * origin) can be reported against the sketch's real line numbers. */
function extractFunctionBody(
  code: string,
  functionName: 'setup' | 'loop'
): { body: string; baseLine: number } {
  const signature = new RegExp(`void\\s+${functionName}\\s*\\(\\s*\\)\\s*\\{`, 'i');
  const match = signature.exec(code);
  if (!match) return { body: '', baseLine: 1 };

  let depth = 1;
  let idx = match.index + match[0].length;
  const start = idx;

  while (idx < code.length && depth > 0) {
    const char = code[idx];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    idx += 1;
  }

  if (depth > 0) {
    throw new SketchSyntaxError(
      'unbalanced-brace',
      lineNumberAt(code, match.index),
      `Unclosed '{' for ${functionName}()`
    );
  }

  return {
    body: code.slice(start, Math.max(start, idx - 1)),
    baseLine: lineNumberAt(code, start),
  };
}

function pulseWidthToAngle(pulseWidthUs: number): number {
  const normalized = clamp(pulseWidthUs, 500, 2500);
  return Math.round(((normalized - 500) / 2000) * 180);
}

function resizeLcdBuffer(state: LcdRuntimeState, cols: number, rows: number): void {
  const nextCols = Math.max(1, cols);
  const nextRows = Math.max(1, rows);
  const nextLines = createLcdBuffer(nextCols, nextRows);

  for (let row = 0; row < Math.min(state.lines.length, nextRows); row += 1) {
    const currentLine = state.lines[row] ?? '';
    nextLines[row] = currentLine.padEnd(nextCols, ' ').slice(0, nextCols);
  }

  state.cols = nextCols;
  state.rows = nextRows;
  state.lines = nextLines;
  state.cursorCol = clamp(state.cursorCol, 0, nextCols - 1);
  state.cursorRow = clamp(state.cursorRow, 0, nextRows - 1);
}

function clearLcdBuffer(state: LcdRuntimeState): void {
  state.lines = createLcdBuffer(state.cols, state.rows);
  state.cursorCol = 0;
  state.cursorRow = 0;
}

function writeLcdChar(state: LcdRuntimeState, char: string): void {
  if (state.cursorRow < 0 || state.cursorRow >= state.rows) {
    return;
  }

  if (char === '\r') {
    return;
  }

  if (char === '\n') {
    state.cursorCol = 0;
    state.cursorRow = clamp(state.cursorRow + 1, 0, state.rows - 1);
    return;
  }

  if (state.cursorCol < 0) {
    state.cursorCol = 0;
  }

  if (state.cursorCol >= state.cols) {
    if (state.cursorRow >= state.rows - 1) {
      return;
    }
    state.cursorCol = 0;
    state.cursorRow += 1;
  }

  const line = (state.lines[state.cursorRow] ?? '').padEnd(state.cols, ' ');
  state.lines[state.cursorRow] =
    `${line.slice(0, state.cursorCol)}${char}${line.slice(state.cursorCol + 1)}`.slice(0, state.cols);

  state.cursorCol += 1;
  if (state.cursorCol >= state.cols && state.cursorRow < state.rows - 1) {
    state.cursorCol = 0;
    state.cursorRow += 1;
  }
}

function parseCommands(
  body: string,
  variables: VariableTables,
  servoInstances: Set<string>
): Command[] {
  const commands: Command[] = [];
  const regex =
    /Serial\.(?<serialMode>println|print)\((?<serialExpr>[\s\S]*?)\)\s*;|delay\((?<delayExpr>[\s\S]*?)\)\s*;|digitalWrite\((?<digitalPin>[\s\S]*?),\s*(?<digitalValue>[\s\S]*?)\)\s*;|analogWrite\((?<analogPin>[\s\S]*?),\s*(?<analogValue>[\s\S]*?)\)\s*;|(?<servoInstance>[A-Za-z_]\w*)\.(?<servoAction>attach|detach|writeMicroseconds|write)\((?<servoArgs>[\s\S]*?)\)\s*;/gi;

  for (const match of body.matchAll(regex)) {
    const groups = match.groups ?? {};

    if (groups.serialMode) {
      commands.push({
        type: 'serialPrint',
        value: resolveSerialExpression(groups.serialExpr ?? '', variables),
        newline: groups.serialMode.toLowerCase() === 'println',
      });
      continue;
    }

    if (groups.delayExpr) {
      const delayValue = resolveNumericExpression(groups.delayExpr, variables);
      if (delayValue !== null) {
        commands.push({
          type: 'delay',
          ms: Math.max(0, delayValue),
        });
      }
      continue;
    }

    if (groups.digitalPin && groups.digitalValue) {
      const pin = normalizeArduinoPin(groups.digitalPin, variables);
      const value = resolveLogicExpression(groups.digitalValue, variables);
      if (pin && value !== null) {
        commands.push({
          type: 'pinWrite',
          pin,
          value: value ? 255 : 0,
        });
      }
      continue;
    }

    if (groups.analogPin && groups.analogValue) {
      const pin = normalizeArduinoPin(groups.analogPin, variables);
      const value = resolveNumericExpression(groups.analogValue, variables);
      if (pin && value !== null) {
        commands.push({
          type: 'pinWrite',
          pin,
          value: clamp(Math.round(value), 0, 255),
        });
      }
      continue;
    }

    if (groups.servoInstance && groups.servoAction) {
      const instance = normalizeVariableName(groups.servoInstance);
      if (!servoInstances.has(instance)) continue;

      const action = groups.servoAction;
      const args = groups.servoArgs ?? '';

      if (action === 'detach') {
        commands.push({ type: 'servoDetach', instance });
        continue;
      }

      if (action === 'attach') {
        const [pinArg = ''] = splitTopLevel(args, ',');
        const pin = normalizeArduinoPin(pinArg, variables);
        if (pin) {
          commands.push({ type: 'servoAttach', instance, pin });
        }
        continue;
      }

      if (action === 'write') {
        const angle = resolveNumericExpression(args, variables);
        if (angle !== null) {
          commands.push({
            type: 'servoWrite',
            instance,
            angle: clamp(Math.round(angle), 0, 180),
            pulseWidthUs: null,
          });
        }
        continue;
      }

      if (action === 'writeMicroseconds') {
        const pulseWidthUs = resolveNumericExpression(args, variables);
        if (pulseWidthUs !== null) {
          commands.push({
            type: 'servoWrite',
            instance,
            angle: pulseWidthToAngle(Math.round(pulseWidthUs)),
            pulseWidthUs: Math.round(pulseWidthUs),
          });
        }
      }
    }
  }

  return commands;
}

type RuntimeToken = {
  type: 'number' | 'string' | 'identifier' | 'operator' | 'paren' | 'comma';
  value: string;
};

function stripRuntimeComments(code: string): string {
  let result = '';
  let index = 0;
  let quote: string | null = null;

  while (index < code.length) {
    const current = code[index];
    const next = code[index + 1] ?? '';

    if (quote) {
      result += current;
      if (current === quote && code[index - 1] !== '\\') {
        quote = null;
      }
      index += 1;
      continue;
    }

    if (current === '"' || current === "'") {
      quote = current;
      result += current;
      index += 1;
      continue;
    }

    if (current === '/' && next === '/') {
      while (index < code.length && code[index] !== '\n') {
        result += ' ';
        index += 1;
      }
      continue;
    }

    if (current === '/' && next === '*') {
      result += '  ';
      index += 2;
      while (index < code.length && !(code[index] === '*' && code[index + 1] === '/')) {
        result += code[index] === '\n' ? '\n' : ' ';
        index += 1;
      }
      if (index < code.length) {
        result += '  ';
        index += 2;
      }
      continue;
    }

    result += current;
    index += 1;
  }

  return result;
}

function skipRuntimeWhitespace(code: string, start: number): number {
  let index = start;
  while (index < code.length && /\s/.test(code[index])) {
    index += 1;
  }
  return index;
}

function startsWithRuntimeKeyword(code: string, start: number, keyword: string): boolean {
  if (!code.slice(start, start + keyword.length).toLowerCase().startsWith(keyword.toLowerCase())) {
    return false;
  }

  const before = start > 0 ? code[start - 1] : '';
  const after = code[start + keyword.length] ?? '';
  if (/[A-Za-z0-9_]/.test(before)) return false;
  if (/[A-Za-z0-9_]/.test(after)) return false;
  return true;
}

function extractRuntimeDelimited(
  code: string,
  start: number,
  openChar: string,
  closeChar: string,
  baseLine = 1
): { content: string; next: number } {
  if (code[start] !== openChar) {
    return { content: '', next: start };
  }

  let index = start + 1;
  let depth = 1;
  let quote: string | null = null;

  while (index < code.length && depth > 0) {
    const current = code[index];
    const previous = index > 0 ? code[index - 1] : '';

    if (quote) {
      if (current === quote && previous !== '\\') {
        quote = null;
      }
      index += 1;
      continue;
    }

    if (current === '"' || current === "'") {
      quote = current;
      index += 1;
      continue;
    }

    if (current === openChar) depth += 1;
    if (current === closeChar) depth -= 1;
    index += 1;
  }

  if (depth > 0) {
    throw new SketchSyntaxError(
      openChar === '{' ? 'unbalanced-brace' : 'unbalanced-paren',
      resolveLine(baseLine, code, start),
      `Unclosed '${openChar}'`
    );
  }

  return {
    content: code.slice(start + 1, Math.max(start + 1, index - 1)),
    next: index,
  };
}

function parseRuntimeStatement(
  code: string,
  start: number,
  baseLine = 1
): { statement: RuntimeStatement | null; next: number } {
  let index = skipRuntimeWhitespace(code, start);
  if (index >= code.length) {
    return { statement: null, next: index };
  }

  if (code[index] === ';') {
    return { statement: null, next: index + 1 };
  }

  if (code[index] === '{') {
    const block = extractRuntimeDelimited(code, index, '{', '}', baseLine);
    const blockBaseLine = resolveLine(baseLine, code, index);
    return {
      statement: { type: 'block', body: parseRuntimeStatements(block.content, blockBaseLine) },
      next: block.next,
    };
  }

  if (startsWithRuntimeKeyword(code, index, 'if')) {
    const conditionStart = skipRuntimeWhitespace(code, index + 2);
    const condition = extractRuntimeDelimited(code, conditionStart, '(', ')', baseLine);
    if (!condition.content.trim()) {
      throw new SketchSyntaxError(
        'empty-if-condition',
        resolveLine(baseLine, code, conditionStart),
        'Empty if() condition'
      );
    }
    if (endsWithDanglingOperator(condition.content)) {
      throw new SketchSyntaxError(
        'dangling-operator',
        resolveLine(baseLine, code, conditionStart),
        'Expression ends with a dangling operator'
      );
    }
    const consequent = parseRuntimeStatement(code, condition.next, baseLine);
    let next = consequent.next;
    let alternate: RuntimeStatement | null = null;
    const elseStart = skipRuntimeWhitespace(code, next);

    if (startsWithRuntimeKeyword(code, elseStart, 'else')) {
      const parsedAlternate = parseRuntimeStatement(code, elseStart + 4, baseLine);
      alternate = parsedAlternate.statement;
      next = parsedAlternate.next;
    }

    return {
      statement: {
        type: 'if',
        condition: condition.content,
        consequent: consequent.statement ?? { type: 'block', body: [] },
        alternate,
      },
      next,
    };
  }

  if (startsWithRuntimeKeyword(code, index, 'for')) {
    const headerStart = skipRuntimeWhitespace(code, index + 3);
    const header = extractRuntimeDelimited(code, headerStart, '(', ')', baseLine);
    const [init = '', condition = '', update = ''] = splitTopLevel(header.content, ';');
    for (const part of [init, condition, update]) {
      if (part.trim() && endsWithDanglingOperator(part)) {
        throw new SketchSyntaxError(
          'dangling-operator',
          resolveLine(baseLine, code, headerStart),
          'Expression ends with a dangling operator'
        );
      }
    }
    const body = parseRuntimeStatement(code, header.next, baseLine);

    return {
      statement: {
        type: 'for',
        init: init.trim(),
        condition: condition.trim(),
        update: update.trim(),
        body: body.statement ?? { type: 'block', body: [] },
      },
      next: body.next,
    };
  }

  if (startsWithRuntimeKeyword(code, index, 'while')) {
    throw new SketchSyntaxError(
      'unsupported-while',
      resolveLine(baseLine, code, index),
      "'while' is not supported — use a for() loop instead"
    );
  }
  if (startsWithRuntimeKeyword(code, index, 'do')) {
    throw new SketchSyntaxError(
      'unsupported-do-while',
      resolveLine(baseLine, code, index),
      "'do...while' is not supported — use a for() loop instead"
    );
  }
  if (startsWithRuntimeKeyword(code, index, 'switch')) {
    throw new SketchSyntaxError(
      'unsupported-switch',
      resolveLine(baseLine, code, index),
      "'switch' is not supported — use if/else if instead"
    );
  }

  let depth = 0;
  let quote: string | null = null;
  let cursor = index;

  while (cursor < code.length) {
    const current = code[cursor];
    const previous = cursor > 0 ? code[cursor - 1] : '';

    if (quote) {
      if (current === quote && previous !== '\\') {
        quote = null;
      }
      cursor += 1;
      continue;
    }

    if (current === '"' || current === "'") {
      quote = current;
      cursor += 1;
      continue;
    }

    if (current === '(') depth += 1;
    if (current === ')') depth = Math.max(0, depth - 1);

    if (current === ';' && depth === 0) {
      const sliced = code.slice(index, cursor).trim();
      validateFallbackExpression(sliced, code, index, baseLine);
      return {
        statement: {
          type: 'expr',
          code: sliced,
        },
        next: cursor + 1,
      };
    }

    cursor += 1;
  }

  const trailing = code.slice(index).trim();
  validateFallbackExpression(trailing, code, index, baseLine);
  return {
    statement: {
      type: 'expr',
      code: trailing,
    },
    next: code.length,
  };
}

/**
 * Last line of defense for the brace-blind fallback scanner above: a raw,
 * un-quoted '{'/'}' here means some construct desynced parsing instead of
 * being consumed by its own block (if/for do this themselves), and a
 * trailing operator means the statement was cut off mid-expression.
 */
function validateFallbackExpression(
  expr: string,
  code: string,
  offset: number,
  baseLine: number
): void {
  if (!expr) return;
  if (hasStrayBrace(expr)) {
    throw new SketchSyntaxError(
      'unknown',
      resolveLine(baseLine, code, offset),
      `Unexpected '{' or '}' in expression: ${expr}`
    );
  }
  if (endsWithDanglingOperator(expr)) {
    throw new SketchSyntaxError(
      'dangling-operator',
      resolveLine(baseLine, code, offset),
      'Expression ends with a dangling operator'
    );
  }
}

function hasStrayBrace(expr: string): boolean {
  let quote: string | null = null;
  for (let i = 0; i < expr.length; i += 1) {
    const ch = expr[i];
    if (quote) {
      if (ch === quote && expr[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '{' || ch === '}') return true;
  }
  return false;
}

function parseRuntimeStatements(code: string, baseLine = 1): RuntimeStatement[] {
  const stripped = stripRuntimeComments(code);
  const statements: RuntimeStatement[] = [];
  let index = 0;

  while (index < stripped.length) {
    const parsed = parseRuntimeStatement(stripped, index, baseLine);
    if (parsed.statement && !(parsed.statement.type === 'expr' && !parsed.statement.code)) {
      statements.push(parsed.statement);
    }
    if (parsed.next <= index) {
      break;
    }
    index = parsed.next;
  }

  return statements;
}

function tokenizeRuntimeExpression(expr: string): RuntimeToken[] {
  const tokens: RuntimeToken[] = [];
  let index = 0;

  while (index < expr.length) {
    const current = expr[index];

    if (/\s/.test(current)) {
      index += 1;
      continue;
    }

    if (current === '"' || current === "'") {
      const quote = current;
      let cursor = index + 1;
      while (cursor < expr.length) {
        if (expr[cursor] === quote && expr[cursor - 1] !== '\\') {
          break;
        }
        cursor += 1;
      }
      tokens.push({
        type: 'string',
        value: expr.slice(index, Math.min(expr.length, cursor + 1)),
      });
      index = Math.min(expr.length, cursor + 1);
      continue;
    }

    if (/\d/.test(current)) {
      let cursor = index + 1;
      while (cursor < expr.length && /[\d.]/.test(expr[cursor])) {
        cursor += 1;
      }
      tokens.push({ type: 'number', value: expr.slice(index, cursor) });
      index = cursor;
      continue;
    }

    if (/[A-Za-z_]/.test(current)) {
      let cursor = index + 1;
      while (cursor < expr.length && /[A-Za-z0-9_]/.test(expr[cursor])) {
        cursor += 1;
      }
      tokens.push({ type: 'identifier', value: expr.slice(index, cursor) });
      index = cursor;
      continue;
    }

    const twoCharOperator = expr.slice(index, index + 2);
    if (['&&', '||', '==', '!=', '<=', '>='].includes(twoCharOperator)) {
      tokens.push({ type: 'operator', value: twoCharOperator });
      index += 2;
      continue;
    }

    if (['+', '-', '*', '/', '%', '!', '<', '>'].includes(current)) {
      tokens.push({ type: 'operator', value: current });
      index += 1;
      continue;
    }

    if (['(', ')'].includes(current)) {
      tokens.push({ type: 'paren', value: current });
      index += 1;
      continue;
    }

    if (current === ',') {
      tokens.push({ type: 'comma', value: current });
      index += 1;
      continue;
    }

    index += 1;
  }

  return tokens;
}

/**
 * True when `expr` trails off on an operator with nothing after it — e.g. a
 * statement cut short mid-edit like `int x = 5 +;`. `i++`/`i--` are exempt:
 * this tokenizer has no compound `++`/`--` token, so a postfix increment
 * (by far the most common trailing pattern, via `for(...; i++)`) tokenizes as
 * two adjacent identical single-char operators and must not be flagged.
 */
function endsWithDanglingOperator(expr: string): boolean {
  const tokens = tokenizeRuntimeExpression(expr);
  if (tokens.length === 0) return false;

  const last = tokens[tokens.length - 1];
  if (last.type !== 'operator') return false;

  const prev = tokens[tokens.length - 2];
  if (
    prev?.type === 'operator' &&
    prev.value === last.value &&
    (last.value === '+' || last.value === '-')
  ) {
    return false;
  }

  return true;
}

function resolveRuntimeIdentifier(
  identifier: string,
  variables: VariableTables,
  scope: RuntimeScope
): RuntimeValue {
  const upper = identifier.trim().toUpperCase();

  if (upper === 'TRUE' || upper === 'HIGH') return true;
  if (upper === 'FALSE' || upper === 'LOW') return false;

  const scopedValue = getRuntimeScopeValue(identifier, variables, scope);
  if (scopedValue !== undefined) {
    return scopedValue;
  }

  if (isLikelyPinToken(identifier)) {
    return identifier.trim().toUpperCase();
  }

  return 0;
}

function hasUnsupportedRuntimeReferences(
  expr: string,
  variables: VariableTables,
  scope: RuntimeScope
): boolean {
  const tokens = tokenizeRuntimeExpression(expr);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== 'identifier') continue;

    const normalized = normalizeVariableName(token.value);
    if (
      normalized === 'TRUE' ||
      normalized === 'FALSE' ||
      normalized === 'HIGH' ||
      normalized === 'LOW'
    ) {
      continue;
    }

    const nextToken = tokens[index + 1];
    if (nextToken?.type === 'paren' && nextToken.value === '(') {
      if (!SUPPORTED_RUNTIME_BUILTINS.has(normalized)) {
        return true;
      }
      continue;
    }

    if (getRuntimeScopeValue(token.value, variables, scope) !== undefined) {
      continue;
    }

    if (isLikelyPinToken(token.value)) {
      continue;
    }

    return true;
  }

  return false;
}

function evaluateStrictRuntimeNumericExpression(
  expr: string,
  variables: VariableTables,
  scope: RuntimeScope,
  clockMs?: { value: number },
  runtimeContext?: RuntimeExecutionContext
): number | null {
  if (hasUnsupportedRuntimeReferences(expr, variables, scope)) {
    return null;
  }

  return toRuntimeNumber(
    evaluateRuntimeExpression(expr, variables, scope, clockMs, runtimeContext)
  );
}

function buildRuntimeReadNetState(context: RuntimeExecutionContext): NetState {
  const netState = buildBaseNetState(
    context.connectivity,
    context.pinValues,
    context.boardPins,
    context.logicHighVoltage
  );
  computeDriverStates(context.connectivity, netState, NOOP_CALLBACKS);
  return netState;
}

function resolveRuntimeReadPin(
  value: RuntimeValue | null | undefined,
  context: RuntimeExecutionContext
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeArduinoPin(String(value), context.baseVariables, context.scope);
}

function readRuntimeAnalogPin(
  pinValue: RuntimeValue | null | undefined,
  context: RuntimeExecutionContext
): number {
  const pin = resolveRuntimeReadPin(pinValue, context);
  if (!pin) {
    return 0;
  }

  const netState = buildRuntimeReadNetState(context);
  const net = getEndpointNet(context.connectivity, ARDUINO_COMPONENT_ID, pin);
  const voltage = getNetVoltage(netState, net);
  if (voltage !== null) {
    return clamp(
      Math.round((voltage / Math.max(context.logicHighVoltage, 0.001)) * 1023),
      0,
      1023
    );
  }

  const level = getNetLevel(netState, net);
  if (level === null) {
    return 0;
  }

  return clamp(Math.round((level / 255) * 1023), 0, 1023);
}

function readRuntimeDigitalPin(
  pinValue: RuntimeValue | null | undefined,
  context: RuntimeExecutionContext
): number {
  const pin = resolveRuntimeReadPin(pinValue, context);
  if (!pin) {
    return 0;
  }

  const netState = buildRuntimeReadNetState(context);
  const net = getEndpointNet(context.connectivity, ARDUINO_COMPONENT_ID, pin);
  const voltage = getNetVoltage(netState, net);
  if (voltage !== null) {
    return voltage >= context.logicHighVoltage * 0.5 ? 1 : 0;
  }

  const level = getNetLevel(netState, net);
  return level !== null && level >= 128 ? 1 : 0;
}

function callRuntimeBuiltin(
  name: string,
  args: RuntimeValue[],
  clockMs?: { value: number },
  runtimeContext?: RuntimeExecutionContext
): RuntimeValue {
  const normalized = normalizeVariableName(name);

  switch (normalized) {
    case 'F':
      return args[0] ?? '';
    case 'STRING':
      return toRuntimeString(args[0] ?? '');
    case 'MILLIS':
      return clockMs?.value ?? 0;
    case 'MICROS':
      return (clockMs?.value ?? 0) * 1000;
    case 'ANALOGREAD':
      return runtimeContext ? readRuntimeAnalogPin(args[0] ?? null, runtimeContext) : 0;
    case 'DIGITALREAD':
      return runtimeContext ? readRuntimeDigitalPin(args[0] ?? null, runtimeContext) : 0;
  }

  const numbers = args.map((arg) => toRuntimeNumber(arg) ?? 0);

  switch (normalized) {
    case 'ABS':
      return Math.abs(numbers[0] ?? 0);
    case 'MIN':
      return Math.min(numbers[0] ?? 0, numbers[1] ?? 0);
    case 'MAX':
      return Math.max(numbers[0] ?? 0, numbers[1] ?? 0);
    case 'CONSTRAIN':
      return clamp(numbers[0] ?? 0, numbers[1] ?? 0, numbers[2] ?? 0);
    case 'ROUND':
      return Math.round(numbers[0] ?? 0);
    case 'FLOOR':
      return Math.floor(numbers[0] ?? 0);
    case 'CEIL':
      return Math.ceil(numbers[0] ?? 0);
    case 'MAP': {
      const [value, inMin, inMax, outMin, outMax] = numbers;
      if (inMax === inMin) return outMin;
      // Arduino's map() is integer maths, so it drops the fraction rather than
      // rounding; printing 50.196 where a board shows 50 is a confusing lie.
      return Math.trunc(((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin);
    }
    default:
      return 0;
  }
}

function evaluateRuntimeExpression(
  expr: string,
  variables: VariableTables,
  scope: RuntimeScope,
  clockMs?: { value: number },
  runtimeContext?: RuntimeExecutionContext
): RuntimeValue | null {
  const tokens = tokenizeRuntimeExpression(expr);
  if (tokens.length === 0) return null;

  let index = 0;

  const peek = () => tokens[index] ?? null;
  const consume = () => tokens[index++] ?? null;
  const matchOperator = (...operators: string[]) => {
    const token = peek();
    if (token?.type === 'operator' && operators.includes(token.value)) {
      index += 1;
      return token.value;
    }
    return null;
  };
  const matchParen = (value: string) => {
    const token = peek();
    if (token?.type === 'paren' && token.value === value) {
      index += 1;
      return true;
    }
    return false;
  };
  const matchComma = () => {
    const token = peek();
    if (token?.type === 'comma') {
      index += 1;
      return true;
    }
    return false;
  };

  const parsePrimary = (): RuntimeValue | null => {
    const token = consume();
    if (!token) return null;

    if (token.type === 'number') {
      return Number(token.value);
    }

    if (token.type === 'string') {
      return decodeStringLiteral(token.value);
    }

    if (token.type === 'identifier') {
      if (matchParen('(')) {
        const args: RuntimeValue[] = [];
        if (!matchParen(')')) {
          do {
            args.push(parseLogicalOr() ?? 0);
          } while (matchComma());
          matchParen(')');
        }
        return callRuntimeBuiltin(token.value, args, clockMs, runtimeContext);
      }

      return resolveRuntimeIdentifier(token.value, variables, scope);
    }

    if (token.type === 'paren' && token.value === '(') {
      const nested = parseLogicalOr();
      matchParen(')');
      return nested;
    }

    return null;
  };

  const parseUnary = (): RuntimeValue | null => {
    const operator = matchOperator('!', '-', '+');
    if (!operator) {
      return parsePrimary();
    }

    const value = parseUnary();
    if (operator === '!') {
      return !(toRuntimeBoolean(value) ?? false);
    }

    const numericValue = toRuntimeNumber(value) ?? 0;
    return operator === '-' ? -numericValue : numericValue;
  };

  const parseMultiplicative = (): RuntimeValue | null => {
    let left = parseUnary();

    while (true) {
      const operator = matchOperator('*', '/', '%');
      if (!operator) break;
      const right = parseUnary();
      const leftNumber = toRuntimeNumber(left) ?? 0;
      const rightNumber = toRuntimeNumber(right) ?? 0;

      if (operator === '*') left = leftNumber * rightNumber;
      if (operator === '/') left = rightNumber === 0 ? 0 : leftNumber / rightNumber;
      if (operator === '%') left = rightNumber === 0 ? 0 : leftNumber % rightNumber;
    }

    return left;
  };

  const parseAdditive = (): RuntimeValue | null => {
    let left = parseMultiplicative();

    while (true) {
      const operator = matchOperator('+', '-');
      if (!operator) break;
      const right = parseMultiplicative();

      if (operator === '+' && (typeof left === 'string' || typeof right === 'string')) {
        left = `${toRuntimeString(left)}${toRuntimeString(right)}`;
        continue;
      }

      const leftNumber = toRuntimeNumber(left) ?? 0;
      const rightNumber = toRuntimeNumber(right) ?? 0;
      left = operator === '+' ? leftNumber + rightNumber : leftNumber - rightNumber;
    }

    return left;
  };

  const parseRelational = (): RuntimeValue | null => {
    let left = parseAdditive();

    while (true) {
      const operator = matchOperator('<', '>', '<=', '>=');
      if (!operator) break;
      const right = parseAdditive();
      const leftNumber = toRuntimeNumber(left) ?? 0;
      const rightNumber = toRuntimeNumber(right) ?? 0;

      if (operator === '<') left = leftNumber < rightNumber;
      if (operator === '>') left = leftNumber > rightNumber;
      if (operator === '<=') left = leftNumber <= rightNumber;
      if (operator === '>=') left = leftNumber >= rightNumber;
    }

    return left;
  };

  const parseEquality = (): RuntimeValue | null => {
    let left = parseRelational();

    while (true) {
      const operator = matchOperator('==', '!=');
      if (!operator) break;
      const right = parseRelational();
      const equals =
        typeof left === 'string' || typeof right === 'string'
          ? toRuntimeString(left) === toRuntimeString(right)
          : (toRuntimeNumber(left) ?? 0) === (toRuntimeNumber(right) ?? 0);
      left = operator === '==' ? equals : !equals;
    }

    return left;
  };

  const parseLogicalAnd = (): RuntimeValue | null => {
    let left = parseEquality();

    while (matchOperator('&&')) {
      const right = parseEquality();
      left = (toRuntimeBoolean(left) ?? false) && (toRuntimeBoolean(right) ?? false);
    }

    return left;
  };

  const parseLogicalOr = (): RuntimeValue | null => {
    let left = parseLogicalAnd();

    while (matchOperator('||')) {
      const right = parseLogicalAnd();
      left = (toRuntimeBoolean(left) ?? false) || (toRuntimeBoolean(right) ?? false);
    }

    return left;
  };

  return parseLogicalOr();
}

function evaluateRuntimeCondition(
  expr: string,
  variables: VariableTables,
  scope: RuntimeScope,
  clockMs?: { value: number },
  runtimeContext?: RuntimeExecutionContext
): boolean {
  return (
    toRuntimeBoolean(
      evaluateRuntimeExpression(expr, variables, scope, clockMs, runtimeContext)
    ) ?? false
  );
}

function appendRuntimeSerialOutput(
  expr: string,
  context: RuntimeExecutionContext,
  newline: boolean
): void {
  const text = resolveSerialExpression(expr, context.baseVariables, context.scope, context);
  context.appendSerialOutput(text, newline);
}

function updateRuntimeSimulationState(context: RuntimeExecutionContext): void {
  updateActuatorStates(
    context.connectivity,
    context.measurementConnectivity,
    context.pinValues,
    context.servoRuntime,
    context.lcdRuntime,
    context.boardPins,
    context.logicHighVoltage,
    context.callbacks,
    context.clockMs.value,
    context.damagedComponents
  );
}

function resolveLcdPrintText(expr: string, context: RuntimeExecutionContext): string {
  const trimmed = expr.trim();
  if (!trimmed) return '';

  const evaluated = evaluateRuntimeExpression(
    trimmed,
    context.baseVariables,
    context.scope,
    context.clockMs,
    context
  );

  if (typeof evaluated === 'string') {
    return evaluated;
  }

  if (typeof evaluated === 'number' || typeof evaluated === 'boolean') {
    return toRuntimeString(evaluated);
  }

  return resolveSerialExpression(trimmed, context.baseVariables, context.scope, context);
}

function applyLcdMethodCall(
  statement: string,
  context: RuntimeExecutionContext
): boolean {
  const lcdMatch =
    /^([A-Za-z_]\w*)\.(begin|init|clear|home|setCursor|print|println|display|noDisplay|backlight|noBacklight)\(([\s\S]*)\)$/i.exec(
      statement
    );
  if (!lcdMatch) {
    return false;
  }

  const instanceName = normalizeVariableName(lcdMatch[1]);
  const method = lcdMatch[2].toLowerCase();
  const args = lcdMatch[3].trim();
  const runtimeState = context.lcdRuntime.get(instanceName);
  if (!runtimeState) {
    return false;
  }

  if (method === 'begin' || method === 'init') {
    const [colsExpr = `${runtimeState.cols}`, rowsExpr = `${runtimeState.rows}`] = splitTopLevel(args, ',');
    const cols =
      Math.round(
        toRuntimeNumber(
          evaluateRuntimeExpression(
            colsExpr,
            context.baseVariables,
            context.scope,
            context.clockMs,
            context
          )
        ) ?? 16
      ) || 16;
    const rows =
      Math.round(
        toRuntimeNumber(
          evaluateRuntimeExpression(
            rowsExpr,
            context.baseVariables,
            context.scope,
            context.clockMs,
            context
          )
        ) ?? 2
      ) || 2;
    resizeLcdBuffer(runtimeState, cols, rows);
    clearLcdBuffer(runtimeState);
    updateRuntimeSimulationState(context);
    return true;
  }

  if (method === 'clear') {
    clearLcdBuffer(runtimeState);
    updateRuntimeSimulationState(context);
    return true;
  }

  if (method === 'home') {
    runtimeState.cursorCol = 0;
    runtimeState.cursorRow = 0;
    updateRuntimeSimulationState(context);
    return true;
  }

  if (method === 'setcursor') {
    const [colExpr = '0', rowExpr = '0'] = splitTopLevel(args, ',');
    const col = Math.round(
      toRuntimeNumber(
        evaluateRuntimeExpression(
          colExpr,
          context.baseVariables,
          context.scope,
          context.clockMs,
          context
        )
      ) ?? 0
    );
    const row = Math.round(
      toRuntimeNumber(
        evaluateRuntimeExpression(
          rowExpr,
          context.baseVariables,
          context.scope,
          context.clockMs,
          context
        )
      ) ?? 0
    );
    runtimeState.cursorCol = clamp(col, 0, Math.max(0, runtimeState.cols - 1));
    runtimeState.cursorRow = clamp(row, 0, Math.max(0, runtimeState.rows - 1));
    updateRuntimeSimulationState(context);
    return true;
  }

  if (method === 'display') {
    runtimeState.displayOn = true;
    updateRuntimeSimulationState(context);
    return true;
  }

  if (method === 'nodisplay') {
    runtimeState.displayOn = false;
    updateRuntimeSimulationState(context);
    return true;
  }

  if (method === 'backlight') {
    runtimeState.backlight = true;
    updateRuntimeSimulationState(context);
    return true;
  }

  if (method === 'nobacklight') {
    runtimeState.backlight = false;
    updateRuntimeSimulationState(context);
    return true;
  }

  if (method === 'print' || method === 'println') {
    const [valueExpr = ''] = splitTopLevel(args, ',');
    const text = resolveLcdPrintText(valueExpr, context);
    for (const char of text) {
      writeLcdChar(runtimeState, char);
    }
    if (method === 'println') {
      writeLcdChar(runtimeState, '\n');
    }
    updateRuntimeSimulationState(context);
    return true;
  }

  return false;
}

function applyRuntimeDeclaration(
  statement: string,
  context: RuntimeExecutionContext
): void {
  const match =
    /^(?:const\s+|constexpr\s+|static\s+|unsigned\s+)*(int|long|short|byte|float|double|bool|boolean|String|char\s*\*|const\s+char\s*\*|uint8_t|uint16_t|uint32_t|size_t)\s+([\s\S]+)$/i.exec(
      statement
    );
  if (!match) return;

  const typeName = match[1].toLowerCase();
  const declarations = splitTopLevel(match[2], ',');

  for (const declaration of declarations) {
    const cleaned = declaration.trim();
    if (!cleaned || cleaned.includes('[')) continue;

    const assignment = /^([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/.exec(cleaned);
    if (assignment) {
      const value =
        evaluateRuntimeExpression(
          assignment[2],
          context.baseVariables,
          context.scope,
          context.clockMs,
          context
        ) ??
        (typeName.includes('bool') ? false : typeName.includes('string') || typeName.includes('char') ? '' : 0);
      context.scope.set(normalizeVariableName(assignment[1]), value);
      continue;
    }

    const nameMatch = /^([A-Za-z_]\w*)$/.exec(cleaned);
    if (!nameMatch) continue;

    const defaultValue: RuntimeValue =
      typeName.includes('bool')
        ? false
        : typeName.includes('string') || typeName.includes('char')
          ? ''
          : 0;
    context.scope.set(normalizeVariableName(nameMatch[1]), defaultValue);
  }
}

function applyRuntimeAssignment(
  statement: string,
  context: RuntimeExecutionContext
): boolean {
  const incrementMatch = /^([A-Za-z_]\w*)\s*(\+\+|--)$|^(\+\+|--)\s*([A-Za-z_]\w*)$/.exec(statement);
  if (incrementMatch) {
    const name = incrementMatch[1] || incrementMatch[4];
    const operator = incrementMatch[2] || incrementMatch[3];
    const currentValue = toRuntimeNumber(
      getRuntimeScopeValue(name, context.baseVariables, context.scope)
    ) ?? 0;
    context.scope.set(
      normalizeVariableName(name),
      operator === '++' ? currentValue + 1 : currentValue - 1
    );
    return true;
  }

  const compoundMatch = /^([A-Za-z_]\w*)\s*(\+=|-=|\*=|\/=|%=)\s*([\s\S]+)$/.exec(statement);
  if (compoundMatch) {
    const name = normalizeVariableName(compoundMatch[1]);
    const currentValue = toRuntimeNumber(
      getRuntimeScopeValue(name, context.baseVariables, context.scope)
    ) ?? 0;
    const nextValue = toRuntimeNumber(
      evaluateRuntimeExpression(
        compoundMatch[3],
        context.baseVariables,
        context.scope,
        context.clockMs,
        context
      )
    ) ?? 0;

    let computed = currentValue;
    if (compoundMatch[2] === '+=') computed += nextValue;
    if (compoundMatch[2] === '-=') computed -= nextValue;
    if (compoundMatch[2] === '*=') computed *= nextValue;
    if (compoundMatch[2] === '/=') computed = nextValue === 0 ? currentValue : computed / nextValue;
    if (compoundMatch[2] === '%=') computed = nextValue === 0 ? currentValue : computed % nextValue;

    context.scope.set(name, computed);
    return true;
  }

  const assignmentMatch = /^([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/.exec(statement);
  if (assignmentMatch) {
    const value = evaluateRuntimeExpression(
      assignmentMatch[2],
      context.baseVariables,
      context.scope,
      context.clockMs,
      context
    );
    if (value !== null) {
      context.scope.set(normalizeVariableName(assignmentMatch[1]), value);
    }
    return true;
  }

  return false;
}

function executeRuntimeExpressionStatement(
  statement: string,
  context: RuntimeExecutionContext,
  done: () => void
): void {
  const trimmed = statement.trim().replace(/;$/, '');
  if (!trimmed || trimmed === 'return' || trimmed === 'break' || trimmed === 'continue') {
    done();
    return;
  }

  if (
    /^(?:const\s+|constexpr\s+|static\s+|unsigned\s+)*(?:int|long|short|byte|float|double|bool|boolean|String|char\s*\*|const\s+char\s*\*|uint8_t|uint16_t|uint32_t|size_t)\s+/i.test(
      trimmed
    )
  ) {
    applyRuntimeDeclaration(trimmed, context);
    done();
    return;
  }

  if (applyRuntimeAssignment(trimmed, context)) {
    done();
    return;
  }

  const serialMatch = /^Serial\.(println|print)\(([\s\S]*)\)$/i.exec(trimmed);
  if (serialMatch) {
    appendRuntimeSerialOutput(
      serialMatch[2],
      context,
      serialMatch[1].toLowerCase() === 'println'
    );
    done();
    return;
  }

  const delayMatch = /^delay\(([\s\S]*)\)$/i.exec(trimmed);
  if (delayMatch) {
    const delayValue =
      toRuntimeNumber(
        evaluateRuntimeExpression(
          delayMatch[1],
          context.baseVariables,
          context.scope,
          context.clockMs,
          context
        )
      ) ?? 0;
    context.clockMs.value += Math.max(0, delayValue);
    context.trackTimeout(done, Math.max(0, delayValue));
    return;
  }

  const writeMatch = /^(digitalWrite|analogWrite)\(([\s\S]*?),\s*([\s\S]*)\)$/i.exec(trimmed);
  if (writeMatch) {
    const pin = normalizeArduinoPin(writeMatch[2], context.baseVariables, context.scope);
    if (pin) {
      const rawValue =
        writeMatch[1].toLowerCase() === 'digitalwrite'
          ? (toRuntimeBoolean(
              evaluateRuntimeExpression(
                writeMatch[3],
                context.baseVariables,
                context.scope,
                context.clockMs,
                context
              )
            )
              ? 255
              : 0)
          : clamp(
              Math.round(
                toRuntimeNumber(
                  evaluateRuntimeExpression(
                    writeMatch[3],
                    context.baseVariables,
                    context.scope,
                    context.clockMs,
                    context
                  )
                ) ?? 0
              ),
              0,
              255
            );

      context.pinValues.set(pin, rawValue);
      updateRuntimeSimulationState(context);
    }
    done();
    return;
  }

  if (applyLcdMethodCall(trimmed, context)) {
    done();
    return;
  }

  const servoMatch =
    /^([A-Za-z_]\w*)\.(attach|detach|writeMicroseconds|write)\(([\s\S]*)\)$/i.exec(trimmed);
  if (servoMatch) {
    const instance = normalizeVariableName(servoMatch[1]);
    const action = servoMatch[2].toLowerCase();
    const args = servoMatch[3].trim();
    const current = context.servoRuntime.get(instance) ?? {
      pin: null,
      angle: 90,
      pulseWidthUs: null,
      hasWritten: false,
    };

    if (action === 'attach') {
      const [pinArg = ''] = splitTopLevel(args, ',');
      const pin = normalizeArduinoPin(pinArg, context.baseVariables, context.scope);
      if (pin) {
        context.servoRuntime.set(instance, { ...current, pin });
        updateRuntimeSimulationState(context);
      }
      done();
      return;
    }

    if (action === 'detach') {
      context.servoRuntime.set(instance, { ...current, pin: null });
      updateRuntimeSimulationState(context);
      done();
      return;
    }

    if (action === 'write') {
      const angle = clamp(
        Math.round(
          evaluateStrictRuntimeNumericExpression(
            args,
            context.baseVariables,
            context.scope,
            context.clockMs,
            context
          ) ?? current.angle
        ),
        0,
        180
      );
      context.servoRuntime.set(instance, {
        ...current,
        angle,
        pulseWidthUs: null,
        hasWritten: true,
      });
      updateRuntimeSimulationState(context);
      done();
      return;
    }

    if (action === 'writemicroseconds') {
      const pulseWidthUs = Math.round(
        evaluateStrictRuntimeNumericExpression(
          args,
          context.baseVariables,
          context.scope,
          context.clockMs,
          context
        ) ?? (current.pulseWidthUs ?? 1500)
      );
      context.servoRuntime.set(instance, {
        ...current,
        angle: pulseWidthToAngle(pulseWidthUs),
        pulseWidthUs,
        hasWritten: true,
      });
      updateRuntimeSimulationState(context);
      done();
      return;
    }
  }

  done();
}

function executeRuntimeInlineExpression(
  statement: string,
  context: RuntimeExecutionContext
): void {
  executeRuntimeExpressionStatement(statement, context, () => {});
}

function executeRuntimeStatement(
  statement: RuntimeStatement,
  context: RuntimeExecutionContext,
  done: () => void
): void {
  if (context.isCancelled()) return;

  if (statement.type === 'expr') {
    executeRuntimeExpressionStatement(statement.code, context, done);
    return;
  }

  if (statement.type === 'block') {
    executeRuntimeStatements(statement.body, context, done);
    return;
  }

  if (statement.type === 'if') {
    const branch = evaluateRuntimeCondition(
      statement.condition,
      context.baseVariables,
      context.scope,
      context.clockMs,
      context
    )
      ? statement.consequent
      : statement.alternate;

    if (!branch) {
      done();
      return;
    }

    executeRuntimeStatement(branch, context, done);
    return;
  }

  executeRuntimeInlineExpression(statement.init, context);
  let iterations = 0;
  const maxIterations = 1024;

  const stepLoop = () => {
    if (context.isCancelled()) return;
    if (iterations >= maxIterations) {
      done();
      return;
    }
    if (
      statement.condition &&
      !evaluateRuntimeCondition(
        statement.condition,
        context.baseVariables,
        context.scope,
        context.clockMs
      )
    ) {
      done();
      return;
    }

    iterations += 1;
    executeRuntimeStatement(statement.body, context, () => {
      executeRuntimeInlineExpression(statement.update, context);
      stepLoop();
    });
  };

  stepLoop();
}

function executeRuntimeStatements(
  statements: RuntimeStatement[],
  context: RuntimeExecutionContext,
  done: () => void
): void {
  let index = 0;

  const next = () => {
    if (context.isCancelled()) return;
    if (index >= statements.length) {
      done();
      return;
    }

    const current = statements[index];
    index += 1;

    // A statement can misbehave (bad index, a call the sketch shouldn't be
    // making, etc.) at any point — including inside a delay() callback that
    // fires ticks after this function returned, well outside any try/catch
    // an outer caller could set up. Catching it here, at the one place every
    // statement funnels through, stops the sketch cleanly instead of taking
    // the whole renderer down with it.
    try {
      executeRuntimeStatement(current, context, next);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.callbacks.addSerialOutput(`[!] ${message}`);
      context.callbacks.reportRuntimeError?.(message);
    }
  };

  next();
}

function addEdge(graph: Map<string, Set<string>>, left: string, right: string): void {
  if (!graph.has(left)) graph.set(left, new Set<string>());
  if (!graph.has(right)) graph.set(right, new Set<string>());
  graph.get(left)!.add(right);
  graph.get(right)!.add(left);
}

function connectPairs(graph: Map<string, Set<string>>, componentId: string, pinIds: string[]): void {
  for (let i = 0; i < pinIds.length; i += 1) {
    for (let j = i + 1; j < pinIds.length; j += 1) {
      addEdge(graph, endpointKey(componentId, pinIds[i]), endpointKey(componentId, pinIds[j]));
    }
  }
}

type ConnectivityBuildOptions = {
  bridgeResistors?: boolean;
  bridgePotentiometers?: boolean;
};

function finalizeConnectivity(
  graph: Map<string, Set<string>>,
  components: CircuitComponent[]
): Connectivity {
  const endpointToNet = new Map<string, number>();
  const netEndpoints = new Map<number, string[]>();
  let netId = 0;

  for (const start of graph.keys()) {
    if (endpointToNet.has(start)) continue;

    const stack = [start];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (endpointToNet.has(current)) continue;
      endpointToNet.set(current, netId);
      if (!netEndpoints.has(netId)) {
        netEndpoints.set(netId, []);
      }
      netEndpoints.get(netId)!.push(current);
      for (const next of graph.get(current) ?? []) {
        if (!endpointToNet.has(next)) stack.push(next);
      }
    }

    netId += 1;
  }

  return { endpointToNet, netEndpoints, components };
}

function buildConnectivity(
  components: CircuitComponent[],
  wires: Wire[],
  boardPins: Pin[],
  options: ConnectivityBuildOptions = {}
): Connectivity {
  const {
    bridgeResistors = true,
    bridgePotentiometers = true,
  } = options;
  const graph = new Map<string, Set<string>>();

  for (const pin of boardPins) {
    const key = endpointKey(ARDUINO_COMPONENT_ID, pin.id);
    if (!graph.has(key)) graph.set(key, new Set<string>());
  }

  for (const component of components) {
    for (const pin of component.pins) {
      const key = endpointKey(component.id, pin.id);
      if (!graph.has(key)) graph.set(key, new Set<string>());
    }
  }

  for (const hole of BREADBOARD_HOLES) {
    const key = endpointKey(BREADBOARD_COMPONENT_ID, hole.id);
    if (!graph.has(key)) graph.set(key, new Set<string>());
  }

  for (const wire of wires) {
    addEdge(
      graph,
      endpointKey(wire.startComponentId, wire.startPinId),
      endpointKey(wire.endComponentId, wire.endPinId)
    );
  }

  for (const strip of BREADBOARD_STRIP_GROUPS) {
    const stripKeys = strip.map((hole) => endpointKey(BREADBOARD_COMPONENT_ID, hole.id));
    for (let i = 0; i < stripKeys.length; i += 1) {
      for (let j = i + 1; j < stripKeys.length; j += 1) {
        addEdge(graph, stripKeys[i], stripKeys[j]);
      }
    }
  }

  for (const component of components) {
    if (bridgeResistors && component.type === 'resistor') {
      connectPairs(graph, component.id, component.pins.map((pin) => pin.id));
    }

    if (component.type === 'switch') {
      const common = component.pins.find((pin) => pin.id === 'common')?.id;
      const no = component.pins.find((pin) => pin.id === 'no')?.id;
      const nc = component.pins.find((pin) => pin.id === 'nc')?.id;
      if (component.properties.closed && common && no) {
        addEdge(graph, endpointKey(component.id, common), endpointKey(component.id, no));
      }
      if (!component.properties.closed && common && nc) {
        addEdge(graph, endpointKey(component.id, common), endpointKey(component.id, nc));
      }
    }

    if (component.type === 'button' && component.properties.pressed) {
      connectPairs(graph, component.id, ['pin1', 'pin2']);
      connectPairs(graph, component.id, ['pin3', 'pin4']);
    }

    if (bridgePotentiometers && component.type === 'potentiometer') {
      connectPairs(graph, component.id, ['pin1', 'wiper', 'pin2']);
    }

    if (component.type === 'relay') {
      const common = component.pins.find((pin) => pin.id === 'com')?.id;
      const no = component.pins.find((pin) => pin.id === 'no')?.id;
      const nc = component.pins.find((pin) => pin.id === 'nc')?.id;
      if (component.properties.activated && common && no) {
        addEdge(graph, endpointKey(component.id, common), endpointKey(component.id, no));
      }
      if (!component.properties.activated && common && nc) {
        addEdge(graph, endpointKey(component.id, common), endpointKey(component.id, nc));
      }
    }
  }

  return finalizeConnectivity(graph, components);
}

function getEndpointNet(
  connectivity: Connectivity,
  componentId: string,
  pinId: string
): number | undefined {
  return connectivity.endpointToNet.get(endpointKey(componentId, pinId));
}

export type WiringIssue =
  | { type: 'dead-short'; net: number; componentId?: string }
  | { type: 'floating-part'; componentId: string }
  | { type: 'part-no-resistor'; componentId: string }
  | { type: 'module-missing-supply'; componentId: string };

/**
 * Two-terminal loads: parts that simply sit there unless current can get in one
 * side and out the other, so "neither leg reaches the power system" is a real,
 * checkable mistake rather than a matter of taste.
 */
const TWO_TERMINAL_LOADS: Partial<Record<CircuitComponent['type'], [string, string]>> = {
  led: ['anode', 'cathode'],
  diode: ['anode', 'cathode'],
  buzzer: ['positive', 'negative'],
  'dc-motor': ['pin1', 'pin2'],
};

/** Parts that burn out fast when wired straight across a supply. */
const NEEDS_SERIES_RESISTOR = new Set<CircuitComponent['type']>(['led', 'diode']);

/** An RGB LED is really three LEDs sharing a leg. */
const RGB_LED_CHANNELS = ['red', 'green', 'blue'];

/**
 * Only batteries and board pins count as the power system here — NOT any
 * component whose own pins happen to be tagged type 'power'/'ground' (e.g. a
 * driver module's own VCC/GND input pins), because that would treat an
 * unpowered module as "live" and hide a real floating-LED case behind it.
 */
function collectPowerAndGroundKeys(components: CircuitComponent[], boardPins: Pin[]) {
  const powerKeys = new Set<string>();
  const groundKeys = new Set<string>();
  // Anything a sketch could actively drive HIGH, plus true power terminals —
  // consulted only by the LED-without-resistor check below.
  const hotCapableKeys = new Set<string>();

  for (const component of components) {
    if (!BATTERY_TYPES.has(component.type)) continue;
    const positiveKey = endpointKey(component.id, 'positive');
    powerKeys.add(positiveKey);
    hotCapableKeys.add(positiveKey);
    groundKeys.add(endpointKey(component.id, 'negative'));
  }

  for (const pin of boardPins) {
    const key = endpointKey(ARDUINO_COMPONENT_ID, pin.id);
    if (pin.type === 'power') {
      powerKeys.add(key);
      hotCapableKeys.add(key);
    } else if (pin.type === 'ground') {
      groundKeys.add(key);
    } else if (pin.type === 'digital' || pin.type === 'analog' || pin.type === 'pwm') {
      hotCapableKeys.add(key);
    }
  }

  return { powerKeys, groundKeys, hotCapableKeys };
}

function netHasEndpointFrom(
  connectivity: Connectivity,
  net: number | undefined,
  keys: Set<string>
): boolean {
  if (net === undefined) return false;
  return (connectivity.netEndpoints.get(net) ?? []).some((key) => keys.has(key));
}

/**
 * Static, pre-flight wiring checks — pure functions of the current component
 * and wire graph, so they run continuously (not gated on the sim running) to
 * surface obvious mistakes before the user ever presses Start. Deliberately a
 * short, sharp list rather than a general design-rule checker: reverse
 * polarity, resistor sizing, multi-battery correctness and non-LED loads are
 * all intentionally out of scope for v1.
 */
export function getCircuitWiringIssues(
  components: CircuitComponent[],
  wires: Wire[],
  boardPins: Pin[]
): WiringIssue[] {
  const issues: WiringIssue[] = [];
  const { powerKeys, groundKeys, hotCapableKeys } = collectPowerAndGroundKeys(components, boardPins);

  // A resistor (or potentiometer) is a real net boundary here, not a bridge,
  // so "wired straight across" can be told apart from "wired through
  // something that limits current" — the trick both checks below rely on.
  const strict = buildConnectivity(components, wires, boardPins, {
    bridgeResistors: false,
    bridgePotentiometers: false,
  });
  const relaxed = buildConnectivity(components, wires, boardPins);

  for (const [net, endpoints] of strict.netEndpoints) {
    const hasPower = endpoints.some((key) => powerKeys.has(key));
    const hasGround = endpoints.some((key) => groundKeys.has(key));
    if (!hasPower || !hasGround) continue;

    const batteryEndpoint = endpoints.find((key) =>
      components.some(
        (component) =>
          BATTERY_TYPES.has(component.type) &&
          (key === endpointKey(component.id, 'positive') ||
            key === endpointKey(component.id, 'negative'))
      )
    );
    issues.push({ type: 'dead-short', net, componentId: batteryEndpoint?.split(':')[0] });
  }

  /** Is either end of this pair attached to the power system at all? */
  const touchesPowerSystem = (componentId: string, pinIds: string[]): boolean =>
    pinIds.some((pinId) => {
      const net = getEndpointNet(relaxed, componentId, pinId);
      return (
        netHasEndpointFrom(relaxed, net, powerKeys) ||
        netHasEndpointFrom(relaxed, net, groundKeys)
      );
    });

  /**
   * True when the two pins sit directly across a supply with nothing in
   * between. Polarity-agnostic on purpose: computeComponentDamage judges
   * stress the same way (Math.abs of the voltage difference), so a backwards
   * part isn't quietly exempted from this check either.
   */
  const isWiredStraightAcross = (componentId: string, fromPin: string, toPin: string): boolean => {
    const fromNet = getEndpointNet(strict, componentId, fromPin);
    const toNet = getEndpointNet(strict, componentId, toPin);
    const fromHot = netHasEndpointFrom(strict, fromNet, hotCapableKeys);
    const fromGround = netHasEndpointFrom(strict, fromNet, groundKeys);
    const toHot = netHasEndpointFrom(strict, toNet, hotCapableKeys);
    const toGround = netHasEndpointFrom(strict, toNet, groundKeys);

    return (fromHot && toGround) || (toHot && fromGround);
  };

  for (const component of components) {
    const terminals = TWO_TERMINAL_LOADS[component.type];

    if (terminals) {
      if (!touchesPowerSystem(component.id, terminals)) {
        issues.push({ type: 'floating-part', componentId: component.id });
        continue;
      }

      if (
        NEEDS_SERIES_RESISTOR.has(component.type) &&
        isWiredStraightAcross(component.id, terminals[0], terminals[1])
      ) {
        issues.push({ type: 'part-no-resistor', componentId: component.id });
      }
      continue;
    }

    // An RGB LED is three LEDs behind one shared leg, so each colour is
    // checked against that leg the same way a plain LED is checked.
    if (component.type === 'rgb-led') {
      if (!touchesPowerSystem(component.id, ['common', ...RGB_LED_CHANNELS])) {
        issues.push({ type: 'floating-part', componentId: component.id });
        continue;
      }

      const unlimited = RGB_LED_CHANNELS.some((channel) =>
        isWiredStraightAcross(component.id, channel, 'common')
      );
      if (unlimited) {
        issues.push({ type: 'part-no-resistor', componentId: component.id });
      }
      continue;
    }

    // A module with a supply pin that reaches neither power nor ground can
    // never come alive, however carefully its data pins are wired.
    const supplyPin = component.pins.find((pin) =>
      SUPPLY_PIN_IDS.includes(pin.id.toLowerCase())
    );
    const groundPin = component.pins.find((pin) => pin.type === 'ground');
    if (supplyPin && groundPin) {
      const supplyNet = getEndpointNet(relaxed, component.id, supplyPin.id);
      const groundNet = getEndpointNet(relaxed, component.id, groundPin.id);
      const supplied = netHasEndpointFrom(relaxed, supplyNet, powerKeys);
      const grounded = netHasEndpointFrom(relaxed, groundNet, groundKeys);

      if (!supplied || !grounded) {
        issues.push({ type: 'module-missing-supply', componentId: component.id });
      }
    }
  }

  return issues;
}

function inferBoardPinVoltage(pin: Pin, logicHighVoltage: number): number | null {
  const token = `${pin.id} ${pin.name}`.toUpperCase();

  if (pin.type === 'ground' || token.includes('GND')) return 0;
  if (token.includes('3V3') || token.includes('3.3')) return 3.3;
  if (
    token.includes('5V') ||
    token.includes('VBUS') ||
    token.includes('VUSB') ||
    token.includes('VU') ||
    token.includes('USB')
  ) {
    return 5;
  }
  if (token.includes('VBAT') || token.includes('VBATT') || token.includes('BAT')) return 3.7;
  if (token.includes('VIN') || token.includes('RAW')) return 5;
  if (token.includes('VCC')) return logicHighVoltage;
  if (pin.type === 'power') return logicHighVoltage;

  return null;
}

function normalizeLevelToVoltage(level: number, logicHighVoltage: number): number {
  return (clamp(level, 0, 255) / 255) * logicHighVoltage;
}

function assignNetSignal(
  netState: NetState,
  net: number | undefined,
  value: number,
  voltage: number
): void {
  if (net === undefined) return;

  const nextValue = clamp(Math.round(value), 0, 255);
  const existing = netState.levels.get(net);
  if (existing === undefined) {
    netState.levels.set(net, nextValue);
    netState.voltages.set(net, voltage);
    return;
  }

  const existingStrength = Math.abs(existing - 127.5);
  const nextStrength = Math.abs(nextValue - 127.5);
  if (nextStrength >= existingStrength) {
    netState.levels.set(net, nextValue);
    netState.voltages.set(net, voltage);
  }
}

function applyInputComponentSignals(
  connectivity: Connectivity,
  netState: NetState,
  logicHighVoltage: number
): void {
  // A battery is the one part that brings its own voltage to the circuit, so it
  // is seeded here alongside the board's own rails.
  for (const component of connectivity.components) {
    if (!BATTERY_TYPES.has(component.type)) continue;

    const voltage = getBatteryVoltage(component);
    const positiveNet = getEndpointNet(connectivity, component.id, 'positive');
    const negativeNet = getEndpointNet(connectivity, component.id, 'negative');

    if (negativeNet !== undefined) {
      netState.groundNets.add(negativeNet);
      assignNetSignal(netState, negativeNet, 0, 0);
    }
    if (positiveNet !== undefined) {
      netState.powerNets.add(positiveNet);
      assignNetSignal(netState, positiveNet, 255, voltage);
    }
  }

  for (const component of connectivity.components) {
    if (component.type !== 'joystick') {
      continue;
    }

    const vccNet = getEndpointNet(connectivity, component.id, 'vcc');
    const gndNet = getEndpointNet(connectivity, component.id, 'gnd');
    const supplyVoltage = getNetVoltage(netState, vccNet) ?? logicHighVoltage;
    const powered = supplyVoltage > 0 && isNetHigh(netState, vccNet) && isNetLow(netState, gndNet);
    if (!powered) {
      continue;
    }

    const xAxis = clamp(Math.round(getNumericProperty(component, 'xAxis', 512)), 0, 1023);
    const yAxis = clamp(Math.round(getNumericProperty(component, 'yAxis', 512)), 0, 1023);
    const xRatio = xAxis / 1023;
    const yRatio = yAxis / 1023;
    const pressed = Boolean(component.properties.pressed);

    assignNetSignal(
      netState,
      getEndpointNet(connectivity, component.id, 'vrx'),
      Math.round(xRatio * 255),
      xRatio * supplyVoltage
    );
    assignNetSignal(
      netState,
      getEndpointNet(connectivity, component.id, 'vry'),
      Math.round(yRatio * 255),
      yRatio * supplyVoltage
    );
    assignNetSignal(
      netState,
      getEndpointNet(connectivity, component.id, 'sw'),
      pressed ? 0 : 255,
      pressed ? 0 : supplyVoltage
    );
  }
}

function buildBaseNetState(
  connectivity: Connectivity,
  pinValues: Map<string, number>,
  boardPins: Pin[],
  logicHighVoltage: number
): NetState {
  const netState: NetState = {
    levels: new Map<number, number>(),
    voltages: new Map<number, number>(),
    powerNets: new Set<number>(),
    groundNets: new Set<number>(),
  };

  for (const pin of boardPins) {
    const net = getEndpointNet(connectivity, ARDUINO_COMPONENT_ID, pin.id);
    if (net === undefined) continue;

    if (pin.type === 'power') {
      netState.powerNets.add(net);
      assignNetSignal(
        netState,
        net,
        255,
        inferBoardPinVoltage(pin, logicHighVoltage) ?? logicHighVoltage
      );
      continue;
    }

    if (pin.type === 'ground') {
      netState.groundNets.add(net);
      assignNetSignal(netState, net, 0, 0);
    }
  }

  for (const [pinId, value] of pinValues.entries()) {
    const net = getEndpointNet(connectivity, ARDUINO_COMPONENT_ID, pinId);
    assignNetSignal(netState, net, value, normalizeLevelToVoltage(value, logicHighVoltage));
  }

  applyInputComponentSignals(connectivity, netState, logicHighVoltage);

  return netState;
}

function getNetLevel(netState: NetState, net: number | undefined): number | null {
  if (net === undefined) return null;

  const hasPower = netState.powerNets.has(net);
  const hasGround = netState.groundNets.has(net);

  if (hasPower && !hasGround) return 255;
  if (hasGround && !hasPower) return 0;

  return netState.levels.get(net) ?? null;
}

function getNetVoltage(netState: NetState, net: number | undefined): number | null {
  if (net === undefined) return null;

  if (netState.groundNets.has(net) && !netState.powerNets.has(net)) {
    return 0;
  }

  return netState.voltages.get(net) ?? null;
}

function isNetHigh(netState: NetState, net: number | undefined): boolean {
  const level = getNetLevel(netState, net);
  return level !== null && level > 0;
}

function isNetLow(netState: NetState, net: number | undefined): boolean {
  const level = getNetLevel(netState, net);
  return level !== null && level <= 0;
}

function computeDriverStates(
  connectivity: Connectivity,
  netState: NetState,
  callbacks: RuntimeCallbacks,
  damaged?: Map<string, DamageRecord>
): void {
  for (const component of connectivity.components) {
    const definition = DRIVER_DEFINITIONS[component.type];
    if (!definition) continue;
    if (damaged?.has(component.id)) continue;

    const supplyVoltage = definition.supplyPins.reduce((highestVoltage, pinId) => {
      const voltage = getNetVoltage(netState, getEndpointNet(connectivity, component.id, pinId));
      return voltage === null ? highestVoltage : Math.max(highestVoltage, voltage);
    }, 0);
    const supplyReady = definition.supplyPins.some((pinId) =>
      isNetHigh(netState, getEndpointNet(connectivity, component.id, pinId))
    );
    const groundReady = definition.groundPins.some((pinId) =>
      isNetLow(netState, getEndpointNet(connectivity, component.id, pinId))
    );
    const powered = supplyReady && groundReady;
    const nextProperties: Record<string, SimulationPropertyValue> = {};

    for (const channel of definition.channels) {
      const enableNet = getEndpointNet(connectivity, component.id, channel.enablePin);
      const input1Net = getEndpointNet(connectivity, component.id, channel.input1Pin);
      const input2Net = getEndpointNet(connectivity, component.id, channel.input2Pin);
      const pwmLevel = powered ? clamp(getNetLevel(netState, enableNet) ?? 0, 0, 255) : 0;
      const input1High = powered && isNetHigh(netState, input1Net);
      const input2High = powered && isNetHigh(netState, input2Net);
      const enabled = powered && pwmLevel > 0;

      let output1Level = 0;
      let output2Level = 0;
      if (enabled && input1High !== input2High) {
        output1Level = input1High ? pwmLevel : 0;
        output2Level = input2High ? pwmLevel : 0;
      }

      assignNetSignal(
        netState,
        getEndpointNet(connectivity, component.id, channel.output1Pin),
        output1Level,
        (supplyVoltage * output1Level) / 255
      );
      assignNetSignal(
        netState,
        getEndpointNet(connectivity, component.id, channel.output2Pin),
        output2Level,
        (supplyVoltage * output2Level) / 255
      );

      if (channel.enabledProperty) {
        nextProperties[channel.enabledProperty] = enabled;
      }
      if (channel.pwmProperty) {
        nextProperties[channel.pwmProperty] = pwmLevel;
      }
    }

    const senseCurrent = definition.senseCurrentProperty
      ? Math.max(0, getNumericProperty(component, definition.senseCurrentProperty, 0))
      : 0;

    for (const bridge of definition.halfBridges ?? []) {
      const enableNet = getEndpointNet(connectivity, component.id, bridge.enablePin);
      const enabled = powered && isNetHigh(netState, enableNet);
      const pwmNet = getEndpointNet(connectivity, component.id, bridge.pwmPin);
      const duty = enabled ? clamp(getNetLevel(netState, pwmNet) ?? 0, 0, 255) : 0;

      // A disabled leg is high impedance, so it must not push anything onto its
      // output: the motor then sees nothing on that side and coasts.
      if (enabled) {
        assignNetSignal(
          netState,
          getEndpointNet(connectivity, component.id, bridge.outputPin),
          duty,
          (supplyVoltage * duty) / 255
        );
      }

      if (bridge.sensePin) {
        const senseVolts = (senseCurrent * (definition.senseVoltsPerAmp ?? 0) * duty) / 255;
        assignNetSignal(
          netState,
          getEndpointNet(connectivity, component.id, bridge.sensePin),
          supplyVoltage > 0 ? clamp(Math.round((senseVolts / supplyVoltage) * 255), 0, 255) : 0,
          senseVolts
        );
      }

      if (bridge.enabledProperty) {
        nextProperties[bridge.enabledProperty] = enabled;
      }
      if (bridge.pwmProperty) {
        nextProperties[bridge.pwmProperty] = duty;
      }
    }

    if (Object.keys(nextProperties).length > 0) {
      callbacks.setComponentState(component.id, nextProperties);
    }
  }
}

function computeLedStates(
  connectivity: Connectivity,
  netState: NetState,
  callbacks: RuntimeCallbacks,
  damaged: Map<string, DamageRecord>
): void {
  for (const led of connectivity.components.filter((component) => component.type === 'led')) {
    if (damaged.has(led.id)) {
      callbacks.setLedState(led.id, false, 0);
      continue;
    }

    const anodeLevel = getNetLevel(netState, getEndpointNet(connectivity, led.id, 'anode'));
    const cathodeLevel = getNetLevel(netState, getEndpointNet(connectivity, led.id, 'cathode'));
    const delta =
      anodeLevel === null || cathodeLevel === null ? 0 : clamp(anodeLevel - cathodeLevel, 0, 255);
    const brightness = delta / 255;

    callbacks.setLedState(led.id, brightness > 0.05, brightness);
  }

  // RGB LEDs report their three channel levels through their own properties
  // instead of the single on/brightness pair a plain LED uses.
  for (const rgbLed of connectivity.components.filter((component) => component.type === 'rgb-led')) {
    if (damaged.has(rgbLed.id)) {
      callbacks.setComponentState(rgbLed.id, { red: 0, green: 0, blue: 0 });
      continue;
    }

    const commonAnode = String(rgbLed.properties.commonType ?? 'cathode') === 'anode';
    const commonLevel = getNetLevel(netState, getEndpointNet(connectivity, rgbLed.id, 'common'));

    const channelBrightness = (pinId: string): number => {
      const level = getNetLevel(netState, getEndpointNet(connectivity, rgbLed.id, pinId));
      if (level === null || commonLevel === null) return 0;
      const delta = commonAnode ? commonLevel - level : level - commonLevel;
      return clamp(Math.round(delta), 0, 255);
    };

    callbacks.setComponentState(rgbLed.id, {
      red: channelBrightness('red'),
      green: channelBrightness('green'),
      blue: channelBrightness('blue'),
    });
  }
}

function computeServoStates(
  connectivity: Connectivity,
  servoRuntime: Map<string, ServoRuntimeState>,
  netState: NetState,
  callbacks: RuntimeCallbacks
): void {
  const servoNetState = new Map<number, ServoRuntimeState>();
  for (const runtimeState of servoRuntime.values()) {
    if (!runtimeState.pin) continue;
    const net = getEndpointNet(connectivity, ARDUINO_COMPONENT_ID, runtimeState.pin);
    if (net !== undefined) {
      servoNetState.set(net, runtimeState);
    }
  }

  for (const servo of connectivity.components.filter((component) => component.type === 'servo')) {
    const signalNet = getEndpointNet(connectivity, servo.id, 'signal');
    const vccNet = getEndpointNet(connectivity, servo.id, 'vcc');
    const gndNet = getEndpointNet(connectivity, servo.id, 'gnd');
    const powered = isNetHigh(netState, vccNet) && isNetLow(netState, gndNet);
    const runtimeState = signalNet !== undefined ? servoNetState.get(signalNet) : undefined;
    const fallbackAngle = getNumericProperty(servo, 'angle', 90);

    callbacks.setComponentState(servo.id, {
      angle:
        powered && runtimeState?.hasWritten
          ? runtimeState.angle
          : fallbackAngle,
    });
  }
}

function computeLcdStates(
  connectivity: Connectivity,
  lcdRuntime: Map<string, LcdRuntimeState>,
  netState: NetState,
  callbacks: RuntimeCallbacks
): void {
  const runtimeEntries = Array.from(lcdRuntime.values());
  const lcdComponents = connectivity.components.filter((component) => component.type === 'lcd-16x2');

  const getBoardNet = (pinId: string | null) =>
    pinId ? getEndpointNet(connectivity, ARDUINO_COMPONENT_ID, pinId) : undefined;

  for (const lcd of lcdComponents) {
    const powered =
      isNetHigh(netState, getEndpointNet(connectivity, lcd.id, 'pin2')) &&
      isNetLow(netState, getEndpointNet(connectivity, lcd.id, 'pin1'));
    const backlightPositiveNet = getEndpointNet(connectivity, lcd.id, 'pin15');
    const backlightNegativeNet = getEndpointNet(connectivity, lcd.id, 'pin16');
    const backlightPinsConnected =
      backlightPositiveNet !== undefined || backlightNegativeNet !== undefined;
    const hardwareBacklightReady = backlightPinsConnected
      ? isNetHigh(netState, backlightPositiveNet) && isNetLow(netState, backlightNegativeNet)
      : true;

    let matchedRuntime: LcdRuntimeState | null = null;
    let bestScore = -1;

    for (const candidate of runtimeEntries) {
      const fourBitDataPins = candidate.dataPins.length >= 4 ? candidate.dataPins.slice(-4) : [];
      const expectedPairs: Array<[string, number | undefined]> = [
        ['pin4', getBoardNet(candidate.rsPin)],
        ['pin6', getBoardNet(candidate.enablePin)],
        ['pin11', getBoardNet(fourBitDataPins[0] ?? null)],
        ['pin12', getBoardNet(fourBitDataPins[1] ?? null)],
        ['pin13', getBoardNet(fourBitDataPins[2] ?? null)],
        ['pin14', getBoardNet(fourBitDataPins[3] ?? null)],
      ];

      if (candidate.rwPin) {
        expectedPairs.push(['pin5', getBoardNet(candidate.rwPin)]);
      }

      if (candidate.dataPins.length >= 8) {
        const eightBitPairs: Array<[string, number | undefined]> = [
          ['pin7', getBoardNet(candidate.dataPins[0] ?? null)],
          ['pin8', getBoardNet(candidate.dataPins[1] ?? null)],
          ['pin9', getBoardNet(candidate.dataPins[2] ?? null)],
          ['pin10', getBoardNet(candidate.dataPins[3] ?? null)],
        ];
        expectedPairs.push(...eightBitPairs);
      }

      let score = 0;
      let mismatch = false;

      for (const [componentPinId, expectedNet] of expectedPairs) {
        const componentNet = getEndpointNet(connectivity, lcd.id, componentPinId);
        if (expectedNet === undefined || componentNet === undefined || expectedNet !== componentNet) {
          mismatch = true;
          break;
        }
        score += 1;
      }

      if (!mismatch && score > bestScore) {
        bestScore = score;
        matchedRuntime = candidate;
      }
    }

    if (!matchedRuntime && runtimeEntries.length === 1 && lcdComponents.length === 1) {
      matchedRuntime = runtimeEntries[0];
    }

    const displayOn = powered && Boolean(matchedRuntime?.displayOn);
    const text1 = displayOn ? (matchedRuntime?.lines[0] ?? '').replace(/\s+$/u, '') : '';
    const text2 = displayOn ? (matchedRuntime?.lines[1] ?? '').replace(/\s+$/u, '') : '';

    callbacks.setComponentState(lcd.id, {
      text1,
      text2,
      backlight: displayOn && Boolean(matchedRuntime?.backlight) && hardwareBacklightReady,
      displayOn,
    });
  }
}

function computeDcMotorStates(
  connectivity: Connectivity,
  netState: NetState,
  callbacks: RuntimeCallbacks,
  damaged: Map<string, DamageRecord>
): void {
  for (const motor of connectivity.components.filter((component) => component.type === 'dc-motor')) {
    if (damaged.has(motor.id)) {
      callbacks.setComponentState(motor.id, { rpm: 0 });
      continue;
    }

    const pin1Level = getNetLevel(netState, getEndpointNet(connectivity, motor.id, 'pin1'));
    const pin2Level = getNetLevel(netState, getEndpointNet(connectivity, motor.id, 'pin2'));
    const delta = pin1Level === null || pin2Level === null ? 0 : pin1Level - pin2Level;
    const rpm = Math.abs(delta) < 16 ? 0 : Math.round((delta / 255) * 240);

    callbacks.setComponentState(motor.id, { rpm });
  }
}

type MultimeterMode = 'voltage' | 'current' | 'resistance' | 'continuity';

type MultimeterReading = {
  reading: number;
  unit: string;
  displayText: string;
  continuity: boolean;
  status: string;
};

function addResistiveEdge(
  edges: ResistiveEdge[],
  connectivity: Connectivity,
  component: CircuitComponent,
  fromPinId: string,
  toPinId: string,
  resistance: number
): void {
  const fromNet = getEndpointNet(connectivity, component.id, fromPinId);
  const toNet = getEndpointNet(connectivity, component.id, toPinId);

  if (
    fromNet === undefined ||
    toNet === undefined ||
    fromNet === toNet ||
    !Number.isFinite(resistance) ||
    resistance <= 0
  ) {
    return;
  }

  edges.push({
    fromNet,
    toNet,
    resistance,
    componentId: component.id,
    componentType: component.type,
    pinIds: [fromPinId, toPinId],
  });
}

function buildResistiveEdges(connectivity: Connectivity): ResistiveEdge[] {
  const edges: ResistiveEdge[] = [];

  for (const component of connectivity.components) {
    switch (component.type) {
      case 'resistor':
        addResistiveEdge(
          edges,
          connectivity,
          component,
          'pin1',
          'pin2',
          Math.max(0.1, getNumericProperty(component, 'resistance', 220))
        );
        break;
      case 'potentiometer': {
        const totalResistance = Math.max(1, getNumericProperty(component, 'resistance', 10000));
        const position = clamp(getNumericProperty(component, 'position', 50), 0, 100) / 100;
        addResistiveEdge(
          edges,
          connectivity,
          component,
          'pin1',
          'wiper',
          Math.max(0.1, totalResistance * position)
        );
        addResistiveEdge(
          edges,
          connectivity,
          component,
          'wiper',
          'pin2',
          Math.max(0.1, totalResistance * (1 - position))
        );
        break;
      }
      case 'led':
        addResistiveEdge(edges, connectivity, component, 'anode', 'cathode', 180);
        break;
      case 'rgb-led':
        addResistiveEdge(edges, connectivity, component, 'red', 'common', 180);
        addResistiveEdge(edges, connectivity, component, 'green', 'common', 180);
        addResistiveEdge(edges, connectivity, component, 'blue', 'common', 180);
        break;
      case 'diode':
        addResistiveEdge(edges, connectivity, component, 'anode', 'cathode', 220);
        break;
      case 'buzzer':
        addResistiveEdge(edges, connectivity, component, 'positive', 'negative', 32);
        break;
      case 'dc-motor':
        addResistiveEdge(edges, connectivity, component, 'pin1', 'pin2', 18);
        break;
      case 'relay':
        addResistiveEdge(edges, connectivity, component, 'coil1', 'coil2', 70);
        break;
      case 'servo':
        addResistiveEdge(edges, connectivity, component, 'vcc', 'gnd', 220);
        break;
      default:
        break;
    }
  }

  return edges;
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] | null {
  const size = matrix.length;
  if (size === 0) return [];

  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let pivot = 0; pivot < size; pivot += 1) {
    let maxRow = pivot;
    let maxValue = Math.abs(augmented[pivot][pivot] ?? 0);
    for (let row = pivot + 1; row < size; row += 1) {
      const candidate = Math.abs(augmented[row][pivot] ?? 0);
      if (candidate > maxValue) {
        maxValue = candidate;
        maxRow = row;
      }
    }

    if (maxValue < 1e-9) {
      return null;
    }

    if (maxRow !== pivot) {
      [augmented[pivot], augmented[maxRow]] = [augmented[maxRow], augmented[pivot]];
    }

    const pivotValue = augmented[pivot][pivot];
    for (let col = pivot; col <= size; col += 1) {
      augmented[pivot][col] /= pivotValue;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      if (Math.abs(factor) < 1e-9) continue;
      for (let col = pivot; col <= size; col += 1) {
        augmented[row][col] -= factor * augmented[pivot][col];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function solveMeasurementVoltages(
  connectivity: Connectivity,
  netState: NetState
): { voltages: Map<number, number>; resistiveEdges: ResistiveEdge[] } {
  const resistiveEdges = buildResistiveEdges(connectivity);
  const voltages = new Map<number, number>(netState.voltages);

  if (resistiveEdges.length === 0) {
    return { voltages, resistiveEdges };
  }

  const adjacency = new Map<number, ResistiveEdge[]>();
  for (const edge of resistiveEdges) {
    if (!adjacency.has(edge.fromNet)) adjacency.set(edge.fromNet, []);
    if (!adjacency.has(edge.toNet)) adjacency.set(edge.toNet, []);
    adjacency.get(edge.fromNet)!.push(edge);
    adjacency.get(edge.toNet)!.push(edge);
  }

  const visited = new Set<number>();
  for (const startNet of adjacency.keys()) {
    if (visited.has(startNet)) continue;

    const componentNets: number[] = [];
    const stack = [startNet];
    visited.add(startNet);

    while (stack.length > 0) {
      const currentNet = stack.pop()!;
      componentNets.push(currentNet);
      for (const edge of adjacency.get(currentNet) ?? []) {
        const nextNet = edge.fromNet === currentNet ? edge.toNet : edge.fromNet;
        if (!visited.has(nextNet)) {
          visited.add(nextNet);
          stack.push(nextNet);
        }
      }
    }

    const knownNets = componentNets.filter((net) => voltages.has(net));
    const unknownNets = componentNets.filter((net) => !voltages.has(net));
    if (knownNets.length === 0 || unknownNets.length === 0) {
      continue;
    }

    const unknownIndex = new Map<number, number>();
    unknownNets.forEach((net, index) => {
      unknownIndex.set(net, index);
    });

    const matrix = unknownNets.map(() => Array.from({ length: unknownNets.length }, () => 0));
    const vector = unknownNets.map(() => 0);

    for (const edge of resistiveEdges) {
      if (
        !unknownIndex.has(edge.fromNet) &&
        !unknownIndex.has(edge.toNet) &&
        !knownNets.includes(edge.fromNet) &&
        !knownNets.includes(edge.toNet)
      ) {
        continue;
      }

      const conductance = 1 / edge.resistance;
      const fromIndex = unknownIndex.get(edge.fromNet);
      const toIndex = unknownIndex.get(edge.toNet);
      const fromVoltage = voltages.get(edge.fromNet);
      const toVoltage = voltages.get(edge.toNet);

      if (fromIndex !== undefined) {
        matrix[fromIndex][fromIndex] += conductance;
        if (toIndex !== undefined) {
          matrix[fromIndex][toIndex] -= conductance;
        } else if (toVoltage !== undefined) {
          vector[fromIndex] += conductance * toVoltage;
        }
      }

      if (toIndex !== undefined) {
        matrix[toIndex][toIndex] += conductance;
        if (fromIndex !== undefined) {
          matrix[toIndex][fromIndex] -= conductance;
        } else if (fromVoltage !== undefined) {
          vector[toIndex] += conductance * fromVoltage;
        }
      }
    }

    const solution = solveLinearSystem(matrix, vector);
    if (!solution) continue;

    unknownNets.forEach((net, index) => {
      const value = solution[index];
      if (Number.isFinite(value)) {
        voltages.set(net, value);
      }
    });
  }

  return { voltages, resistiveEdges };
}

function buildResistanceAdjacency(
  resistiveEdges: ResistiveEdge[]
): Map<number, Array<{ net: number; resistance: number }>> {
  const adjacency = new Map<number, Array<{ net: number; resistance: number }>>();

  for (const edge of resistiveEdges) {
    if (!adjacency.has(edge.fromNet)) adjacency.set(edge.fromNet, []);
    if (!adjacency.has(edge.toNet)) adjacency.set(edge.toNet, []);
    adjacency.get(edge.fromNet)!.push({ net: edge.toNet, resistance: edge.resistance });
    adjacency.get(edge.toNet)!.push({ net: edge.fromNet, resistance: edge.resistance });
  }

  return adjacency;
}

function findShortestResistancePath(
  resistiveEdges: ResistiveEdge[],
  startNet: number,
  endNet: number
): number | null {
  if (startNet === endNet) return 0;

  const adjacency = buildResistanceAdjacency(resistiveEdges);
  const distances = new Map<number, number>([[startNet, 0]]);
  const visited = new Set<number>();

  while (true) {
    let currentNet: number | null = null;
    let currentDistance = Infinity;

    for (const [net, distance] of distances.entries()) {
      if (visited.has(net)) continue;
      if (distance < currentDistance) {
        currentNet = net;
        currentDistance = distance;
      }
    }

    if (currentNet === null) break;
    if (currentNet === endNet) return currentDistance;

    visited.add(currentNet);
    for (const edge of adjacency.get(currentNet) ?? []) {
      if (visited.has(edge.net)) continue;
      const nextDistance = currentDistance + edge.resistance;
      if (nextDistance < (distances.get(edge.net) ?? Infinity)) {
        distances.set(edge.net, nextDistance);
      }
    }
  }

  return null;
}

function normalizeMultimeterMode(value: unknown): MultimeterMode {
  const token = String(value ?? 'voltage').trim().toLowerCase();
  if (token.includes('current') || token.includes('akim') || token === 'amp' || token === 'amps') {
    return 'current';
  }
  if (token.includes('resist') || token.includes('direnc') || token === 'ohm' || token === 'ohms') {
    return 'resistance';
  }
  if (token.includes('continuity') || token.includes('surekl') || token.includes('beep')) {
    return 'continuity';
  }
  return 'voltage';
}

function formatDisplayNumber(value: number, digits: number): string {
  return value.toFixed(digits);
}

function formatMultimeterReading(
  mode: MultimeterMode,
  value: number,
  autoRange: boolean,
  continuity: boolean
): MultimeterReading {
  if (mode === 'continuity') {
    return {
      reading: Number.isFinite(value) ? value : 0,
      unit: 'Ω',
      displayText: continuity ? 'BEEP' : 'OPEN',
      continuity,
      status: continuity ? 'BEEP' : 'OPEN',
    };
  }

  if (mode === 'resistance') {
    if (!Number.isFinite(value)) {
      return {
        reading: 0,
        unit: 'Ω',
        displayText: 'OPEN',
        continuity: false,
        status: 'OPEN',
      };
    }

    const magnitude = Math.abs(value);
    if (autoRange && magnitude >= 1_000_000) {
      const scaled = value / 1_000_000;
      return {
        reading: scaled,
        unit: 'MΩ',
        displayText: `${formatDisplayNumber(scaled, 2)} MΩ`,
        continuity: continuity,
        status: 'READY',
      };
    }
    if (autoRange && magnitude >= 1_000) {
      const scaled = value / 1_000;
      return {
        reading: scaled,
        unit: 'kΩ',
        displayText: `${formatDisplayNumber(scaled, 2)} kΩ`,
        continuity: continuity,
        status: 'READY',
      };
    }

    return {
      reading: value,
      unit: 'Ω',
      displayText: `${formatDisplayNumber(value, magnitude >= 100 ? 1 : 2)} Ω`,
      continuity: continuity,
      status: 'READY',
    };
  }

  if (mode === 'current') {
    const magnitude = Math.abs(value);
    if (autoRange && magnitude < 1) {
      const scaled = value * 1000;
      return {
        reading: scaled,
        unit: 'mA',
        displayText: `${formatDisplayNumber(scaled, magnitude < 0.1 ? 2 : 1)} mA`,
        continuity: false,
        status: 'READY',
      };
    }

    return {
      reading: value,
      unit: 'A',
      displayText: `${formatDisplayNumber(value, magnitude >= 10 ? 1 : 2)} A`,
      continuity: false,
      status: 'READY',
    };
  }

  const magnitude = Math.abs(value);
  if (autoRange && magnitude < 1) {
    const scaled = value * 1000;
    return {
      reading: scaled,
      unit: 'mV',
      displayText: `${formatDisplayNumber(scaled, magnitude < 0.1 ? 1 : 0)} mV`,
      continuity: false,
      status: 'READY',
    };
  }

  return {
    reading: value,
    unit: 'V',
    displayText: `${formatDisplayNumber(value, magnitude >= 10 ? 1 : 2)} V`,
    continuity: false,
    status: 'READY',
  };
}

function formatOscilloscopeDisplayText(voltage: number): string {
  if (!Number.isFinite(voltage)) {
    return 'OPEN';
  }

  const magnitude = Math.abs(voltage);
  if (magnitude < 1) {
    const scaled = voltage * 1000;
    return `${formatDisplayNumber(scaled, magnitude < 0.1 ? 1 : 0)} mV`;
  }

  return `${formatDisplayNumber(voltage, magnitude >= 10 ? 1 : 2)} V`;
}

function computeMultimeterStates(
  connectivity: Connectivity,
  netVoltages: Map<number, number>,
  resistiveEdges: ResistiveEdge[],
  callbacks: RuntimeCallbacks
): void {
  for (const meter of connectivity.components.filter((component) => component.type === 'multimeter')) {
    const mode = normalizeMultimeterMode(meter.properties.mode);
    const autoRange = Boolean(meter.properties.autoRange);
    const positivePinId = mode === 'current' ? 'a_probe' : 'v_probe';
    const positiveNet = getEndpointNet(connectivity, meter.id, positivePinId);
    const commonNet = getEndpointNet(connectivity, meter.id, 'com');

    if (positiveNet === undefined || commonNet === undefined) {
      callbacks.setComponentState(meter.id, {
        reading: 0,
        unit: mode === 'current' ? 'A' : mode === 'voltage' ? 'V' : 'Ω',
        displayText: 'OPEN',
        continuity: false,
        status: 'OPEN',
      });
      continue;
    }

    const voltageDiff =
      positiveNet === commonNet
        ? 0
        : netVoltages.has(positiveNet) && netVoltages.has(commonNet)
          ? (netVoltages.get(positiveNet) ?? 0) - (netVoltages.get(commonNet) ?? 0)
          : null;
    const pathResistance = findShortestResistancePath(resistiveEdges, positiveNet, commonNet);
    const continuity = positiveNet === commonNet || (pathResistance !== null && pathResistance <= 50);

    let readingState: MultimeterReading;

    if (mode === 'resistance') {
      readingState = formatMultimeterReading(
        mode,
        positiveNet === commonNet ? 0 : (pathResistance ?? Number.POSITIVE_INFINITY),
        autoRange,
        continuity
      );
    } else if (mode === 'continuity') {
      readingState = formatMultimeterReading(
        mode,
        positiveNet === commonNet ? 0 : (pathResistance ?? Number.POSITIVE_INFINITY),
        autoRange,
        continuity
      );
    } else if (mode === 'current') {
      if (voltageDiff === null || pathResistance === null || pathResistance <= 0) {
        readingState = {
          reading: 0,
          unit: 'A',
          displayText: 'OPEN',
          continuity: false,
          status: 'OPEN',
        };
      } else {
        readingState = formatMultimeterReading(
          mode,
          voltageDiff / pathResistance,
          autoRange,
          false
        );
      }
    } else if (voltageDiff === null) {
      readingState = {
        reading: 0,
        unit: 'V',
        displayText: 'OPEN',
        continuity: false,
        status: 'OPEN',
      };
    } else {
      readingState = formatMultimeterReading(mode, voltageDiff, autoRange, false);
    }

    callbacks.setComponentState(meter.id, {
      mode,
      reading: Number(readingState.reading.toFixed(4)),
      unit: readingState.unit,
      displayText: readingState.displayText,
      continuity: readingState.continuity,
      status: readingState.status,
    });
  }
}

function computeProbeDrivenMultimeterStates(
  connectivity: Connectivity,
  netVoltages: Map<number, number>,
  resistiveEdges: ResistiveEdge[],
  callbacks: RuntimeCallbacks
): void {
  const getProbeTarget = (
    meter: CircuitComponent,
    slot: 'black' | 'red'
  ): { componentId: string; pinId: string } | null => {
    const componentKey =
      slot === 'black' ? 'blackProbeTargetComponentId' : 'redProbeTargetComponentId';
    const pinKey = slot === 'black' ? 'blackProbeTargetPinId' : 'redProbeTargetPinId';
    const componentId = String(meter.properties[componentKey] ?? '').trim();
    const pinId = String(meter.properties[pinKey] ?? '').trim();

    if (!componentId || !pinId) {
      return null;
    }

    return { componentId, pinId };
  };

  for (const meter of connectivity.components.filter((component) => component.type === 'multimeter')) {
    const mode = normalizeMultimeterMode(meter.properties.mode);
    const autoRange = Boolean(meter.properties.autoRange);
    const positiveTarget = getProbeTarget(meter, 'red');
    const commonTarget = getProbeTarget(meter, 'black');
    const positiveNet = positiveTarget
      ? getEndpointNet(connectivity, positiveTarget.componentId, positiveTarget.pinId)
      : undefined;
    const commonNet = commonTarget
      ? getEndpointNet(connectivity, commonTarget.componentId, commonTarget.pinId)
      : undefined;

    if (positiveNet === undefined || commonNet === undefined) {
      callbacks.setComponentState(meter.id, {
        reading: 0,
        unit: mode === 'current' ? 'A' : mode === 'voltage' ? 'V' : 'Ω',
        displayText: 'OPEN',
        continuity: false,
        status: 'open',
      });
      continue;
    }

    const voltageDiff =
      positiveNet === commonNet
        ? 0
        : netVoltages.has(positiveNet) && netVoltages.has(commonNet)
          ? (netVoltages.get(positiveNet) ?? 0) - (netVoltages.get(commonNet) ?? 0)
          : null;
    const pathResistance = findShortestResistancePath(resistiveEdges, positiveNet, commonNet);
    const continuity = positiveNet === commonNet || (pathResistance !== null && pathResistance <= 50);

    let readingState: MultimeterReading;

    if (mode === 'resistance') {
      if (positiveNet === commonNet) {
        readingState = {
          reading: 0,
          unit: 'Ω',
          displayText: '0.00 Ω',
          continuity: true,
          status: 'ready',
        };
      } else if (pathResistance === null) {
        readingState = {
          reading: 0,
          unit: 'Ω',
          displayText: 'OPEN',
          continuity: false,
          status: 'open',
        };
      } else if (pathResistance >= 1_000_000 && autoRange) {
        const scaled = pathResistance / 1_000_000;
        readingState = {
          reading: scaled,
          unit: 'MΩ',
          displayText: `${formatDisplayNumber(scaled, 2)} MΩ`,
          continuity,
          status: 'ready',
        };
      } else if (pathResistance >= 1_000 && autoRange) {
        const scaled = pathResistance / 1_000;
        readingState = {
          reading: scaled,
          unit: 'kΩ',
          displayText: `${formatDisplayNumber(scaled, 2)} kΩ`,
          continuity,
          status: 'ready',
        };
      } else {
        readingState = {
          reading: pathResistance,
          unit: 'Ω',
          displayText: `${formatDisplayNumber(pathResistance, pathResistance >= 100 ? 1 : 2)} Ω`,
          continuity,
          status: 'ready',
        };
      }
    } else if (mode === 'continuity') {
      readingState = {
        reading: positiveNet === commonNet ? 0 : (pathResistance ?? 0),
        unit: 'Ω',
        displayText: continuity ? 'BEEP' : 'OPEN',
        continuity,
        status: continuity ? 'beep' : 'open',
      };
    } else if (mode === 'current') {
      if (voltageDiff === null || pathResistance === null || pathResistance <= 0) {
        readingState = {
          reading: 0,
          unit: 'A',
          displayText: 'OPEN',
          continuity: false,
          status: 'open',
        };
      } else {
        const amps = voltageDiff / pathResistance;
        const magnitude = Math.abs(amps);
        if (autoRange && magnitude < 1) {
          const scaled = amps * 1000;
          readingState = {
            reading: scaled,
            unit: 'mA',
            displayText: `${formatDisplayNumber(scaled, magnitude < 0.1 ? 2 : 1)} mA`,
            continuity: false,
            status: 'ready',
          };
        } else {
          readingState = {
            reading: amps,
            unit: 'A',
            displayText: `${formatDisplayNumber(amps, magnitude >= 10 ? 1 : 2)} A`,
            continuity: false,
            status: 'ready',
          };
        }
      }
    } else if (voltageDiff === null) {
      readingState = {
        reading: 0,
        unit: 'V',
        displayText: 'OPEN',
        continuity: false,
        status: 'open',
      };
    } else {
      const magnitude = Math.abs(voltageDiff);
      if (autoRange && magnitude < 1) {
        const scaled = voltageDiff * 1000;
        readingState = {
          reading: scaled,
          unit: 'mV',
          displayText: `${formatDisplayNumber(scaled, magnitude < 0.1 ? 1 : 0)} mV`,
          continuity: false,
          status: 'ready',
        };
      } else {
        readingState = {
          reading: voltageDiff,
          unit: 'V',
          displayText: `${formatDisplayNumber(voltageDiff, magnitude >= 10 ? 1 : 2)} V`,
          continuity: false,
          status: 'ready',
        };
      }
    }

    callbacks.setComponentState(meter.id, {
      mode,
      reading: Number(readingState.reading.toFixed(4)),
      unit: readingState.unit,
      displayText: readingState.displayText,
      continuity: readingState.continuity,
      status: readingState.status,
    });
  }
}

function computeOscilloscopeStates(
  connectivity: Connectivity,
  netVoltages: Map<number, number>,
  callbacks: RuntimeCallbacks,
  clockMs: number
): void {
  for (const scope of connectivity.components.filter(
    (component) => component.type === 'oscilloscope'
  )) {
    const signalNet = getEndpointNet(connectivity, scope.id, 'ch1');
    const groundNet = getEndpointNet(connectivity, scope.id, 'gnd');

    if (signalNet === undefined || groundNet === undefined) {
      callbacks.setComponentState(scope.id, {
        reading: 0,
        displayText: 'OPEN',
        status: 'open',
      });
      continue;
    }

    const voltage =
      signalNet === groundNet
        ? 0
        : netVoltages.has(signalNet) && netVoltages.has(groundNet)
          ? (netVoltages.get(signalNet) ?? 0) - (netVoltages.get(groundNet) ?? 0)
          : null;

    if (voltage === null) {
      callbacks.setComponentState(scope.id, {
        reading: 0,
        displayText: 'OPEN',
        status: 'open',
      });
      continue;
    }

    const roundedVoltage = Number(voltage.toFixed(4));
    callbacks.setComponentState(scope.id, {
      reading: roundedVoltage,
      displayText: formatOscilloscopeDisplayText(roundedVoltage),
      status: 'live',
    });
    callbacks.pushOscilloscopeSample(scope.id, {
      timeMs: Math.max(0, Math.round(clockMs)),
      voltage: roundedVoltage,
    });
  }
}

function updateActuatorStates(
  connectivity: Connectivity,
  measurementConnectivity: Connectivity,
  pinValues: Map<string, number>,
  servoRuntime: Map<string, ServoRuntimeState>,
  lcdRuntime: Map<string, LcdRuntimeState>,
  boardPins: Pin[],
  logicHighVoltage: number,
  callbacks: RuntimeCallbacks,
  clockMs: number,
  damaged: Map<string, DamageRecord>
): void {
  callbacks.clearLedStates();
  callbacks.clearComponentStates();
  callbacks.setPinStates(Object.fromEntries(pinValues));

  const netState = buildBaseNetState(connectivity, pinValues, boardPins, logicHighVoltage);
  computeDriverStates(connectivity, netState, callbacks, damaged);
  computeLedStates(connectivity, netState, callbacks, damaged);
  computeServoStates(connectivity, servoRuntime, netState, callbacks);
  computeLcdStates(connectivity, lcdRuntime, netState, callbacks);
  computeDcMotorStates(connectivity, netState, callbacks, damaged);

  const measurementNetState = buildBaseNetState(
    measurementConnectivity,
    pinValues,
    boardPins,
    logicHighVoltage
  );
  computeDriverStates(measurementConnectivity, measurementNetState, NOOP_CALLBACKS, damaged);
  const { voltages, resistiveEdges } = solveMeasurementVoltages(
    measurementConnectivity,
    measurementNetState
  );
  computeComponentDamage(measurementConnectivity, voltages, resistiveEdges, damaged, callbacks);
  computeProbeDrivenMultimeterStates(measurementConnectivity, voltages, resistiveEdges, callbacks);
  computeOscilloscopeStates(measurementConnectivity, voltages, callbacks, clockMs);
}

export function stopMockArduinoRuntime(): void {
  activeStop?.();
  activeStop = null;
}

function parseSketch(code: string): {
  setupStatements: RuntimeStatement[];
  loopStatements: RuntimeStatement[];
  loopBody: string;
} {
  const setup = extractFunctionBody(code, 'setup');
  const setupStatements = parseRuntimeStatements(setup.body, setup.baseLine);
  const loop = extractFunctionBody(code, 'loop');
  const loopStatements = parseRuntimeStatements(loop.body, loop.baseLine);
  return { setupStatements, loopStatements, loopBody: loop.body };
}

/**
 * Structural syntax check only (unbalanced braces, unsupported control flow,
 * an expression cut off mid-statement) — never a full type-/semantic-checker.
 * Never throws itself; always resolves to a value, since this runs on every
 * render to drive the live warning banner, independent of pressing Start.
 */
export function findSketchCompileError(code: string): CompileError | null {
  try {
    parseSketch(code);
    return null;
  } catch (error) {
    if (error instanceof SketchSyntaxError) {
      return { reason: error.reason, line: error.line, detail: error.message };
    }
    return {
      reason: 'unknown',
      line: 0,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export type SketchDiagnosticKind = 'undeclared-variable' | 'type-mismatch';

export type SketchDiagnostic = {
  kind: SketchDiagnosticKind;
  line: number;
  /** The offending name or assignment, quoted back to the user as-is. */
  detail: string;
};

/** C/Arduino words that are never a variable being read. */
const SKETCH_RESERVED_WORDS = new Set([
  'IF', 'ELSE', 'FOR', 'WHILE', 'DO', 'SWITCH', 'CASE', 'DEFAULT', 'BREAK', 'CONTINUE',
  'RETURN', 'GOTO', 'SIZEOF', 'STRUCT', 'ENUM', 'UNION', 'TYPEDEF', 'CLASS', 'PUBLIC',
  'PRIVATE', 'PROTECTED', 'NEW', 'DELETE', 'NAMESPACE', 'USING', 'TEMPLATE', 'OPERATOR',
  'SETUP', 'LOOP',
]);

const SKETCH_TYPE_WORDS = new Set([
  'VOID', 'INT', 'LONG', 'SHORT', 'CHAR', 'BYTE', 'BOOL', 'BOOLEAN', 'FLOAT', 'DOUBLE',
  'STRING', 'UNSIGNED', 'SIGNED', 'CONST', 'CONSTEXPR', 'STATIC', 'VOLATILE', 'EXTERN',
  'UINT8_T', 'UINT16_T', 'UINT32_T', 'UINT64_T', 'INT8_T', 'INT16_T', 'INT32_T',
  'INT64_T', 'SIZE_T', 'WORD', 'AUTO', 'NULLPTR', 'NULL',
]);

/** Constants the board itself provides, so using one is never "undeclared". */
const SKETCH_BUILTIN_CONSTANTS = new Set([
  'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'INPUT_PULLDOWN', 'LED_BUILTIN',
  'TRUE', 'FALSE', 'DEC', 'HEX', 'OCT', 'BIN', 'PI', 'HALF_PI', 'TWO_PI', 'DEG_TO_RAD',
  'RAD_TO_DEG', 'EULER', 'SERIAL', 'MSBFIRST', 'LSBFIRST', 'CHANGE', 'RISING', 'FALLING',
  'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12',
  'A13', 'A14', 'A15',
]);

const NUMERIC_TYPE_WORDS = new Set([
  'INT', 'LONG', 'SHORT', 'BYTE', 'FLOAT', 'DOUBLE', 'UINT8_T', 'UINT16_T', 'UINT32_T',
  'INT8_T', 'INT16_T', 'INT32_T', 'SIZE_T', 'WORD', 'BOOL', 'BOOLEAN',
]);

/**
 * Replaces every string/char literal's contents with spaces, so a scan can walk
 * the code without tripping over words inside `Serial.println("no such var")`.
 * Offsets are preserved, keeping reported line numbers honest.
 */
function blankSketchLiterals(code: string): string {
  let result = '';
  let index = 0;
  let quote: string | null = null;

  while (index < code.length) {
    const current = code[index];

    if (quote) {
      if (current === quote && code[index - 1] !== '\\') {
        quote = null;
        result += current;
      } else {
        result += current === '\n' ? '\n' : ' ';
      }
      index += 1;
      continue;
    }

    if (current === '"' || current === "'") {
      quote = current;
      result += current;
      index += 1;
      continue;
    }

    result += current;
    index += 1;
  }

  return result;
}

/** Every name the sketch itself introduces: variables, #defines, objects. */
function collectDeclaredSketchNames(code: string): Set<string> {
  const declared = new Set<string>();

  // `int a = 1, b, c[4];` — the type word, then every declarator after it.
  const declarationRegex =
    /\b(?:const\s+|constexpr\s+|static\s+|volatile\s+|extern\s+|unsigned\s+|signed\s+)*(?:int|long|short|char|byte|bool|boolean|float|double|String|uint8_t|uint16_t|uint32_t|uint64_t|int8_t|int16_t|int32_t|int64_t|size_t|word)\s+([^;{)]*)/gi;

  for (const match of code.matchAll(declarationRegex)) {
    for (const part of match[1].split(',')) {
      const name = /^\s*\*?\s*([A-Za-z_]\w*)/.exec(part);
      if (name) declared.add(normalizeVariableName(name[1]));
    }
  }

  // `Servo arm;` / `LiquidCrystal lcd(12, 11, 5, 4, 3, 2);` — a class instance.
  // The class name counts as known too, otherwise the type word in the
  // declaration itself would be read back as an unknown variable.
  for (const match of code.matchAll(/\b([A-Z][A-Za-z0-9_]*)\s+([A-Za-z_]\w*)\s*[;(=]/g)) {
    if (SKETCH_TYPE_WORDS.has(match[1].toUpperCase())) continue;
    declared.add(normalizeVariableName(match[1]));
    declared.add(normalizeVariableName(match[2]));
  }

  for (const match of code.matchAll(/^\s*#define\s+([A-Za-z_]\w*)/gim)) {
    declared.add(normalizeVariableName(match[1]));
  }

  return declared;
}

/**
 * Semantic checks the parser cannot make: a name that was never declared, and
 * an initialiser whose type obviously cannot fit the variable. These are
 * advisory — unlike a syntax error they never block Start, because a
 * false positive here would otherwise make a perfectly good sketch unrunnable.
 */
export function findSketchDiagnostics(code: string): SketchDiagnostic[] {
  const scanned = blankSketchLiterals(stripRuntimeComments(code));
  const declared = collectDeclaredSketchNames(scanned);
  const diagnostics: SketchDiagnostic[] = [];
  const reported = new Set<string>();

  const identifierRegex = /[A-Za-z_]\w*/g;
  for (const match of scanned.matchAll(identifierRegex)) {
    const raw = match[0];
    const normalized = normalizeVariableName(raw);
    const start = match.index ?? 0;
    const before = scanned.slice(0, start);
    const after = scanned.slice(start + raw.length);

    // A call, a member, or the object a member is read from — none of these is
    // a plain variable read, and checking them needs a real symbol table.
    if (/^\s*[(.]/.test(after)) continue;
    if (/[.>]\s*$/.test(before)) continue;
    // `#include <Servo.h>` and friends.
    if (/#\s*\w*\s*[<"]?[\w./]*$/.test(before.slice(-40))) continue;

    if (
      SKETCH_RESERVED_WORDS.has(normalized) ||
      SKETCH_TYPE_WORDS.has(normalized) ||
      SKETCH_BUILTIN_CONSTANTS.has(normalized) ||
      SUPPORTED_RUNTIME_BUILTINS.has(normalized) ||
      declared.has(normalized) ||
      reported.has(normalized)
    ) {
      continue;
    }

    reported.add(normalized);
    diagnostics.push({
      kind: 'undeclared-variable',
      line: lineNumberAt(scanned, start),
      detail: raw,
    });
  }

  // A string parked in a number, or a number parked in a String.
  const initialiserRegex =
    /\b(?:const\s+|constexpr\s+|static\s+|volatile\s+)*(int|long|short|byte|bool|boolean|float|double|String|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|size_t|word)\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/gi;

  // Literals are needed intact here, so this reads the commentless source
  // rather than the blanked-out copy the identifier scan above walks.
  const withLiterals = stripRuntimeComments(code);
  for (const match of withLiterals.matchAll(initialiserRegex)) {
    const type = match[1].toUpperCase();
    const name = match[2];
    const value = match[3].trim();
    const isStringLiteral = /^"(?:\\.|[^"\\])*"$/.test(value);
    const isNumberLiteral = /^-?\d+(?:\.\d+)?$/.test(value);

    if (NUMERIC_TYPE_WORDS.has(type) && isStringLiteral) {
      diagnostics.push({
        kind: 'type-mismatch',
        line: lineNumberAt(withLiterals, match.index ?? 0),
        detail: `${match[1]} ${name} = ${value}`,
      });
    } else if (type === 'STRING' && isNumberLiteral) {
      diagnostics.push({
        kind: 'type-mismatch',
        line: lineNumberAt(withLiterals, match.index ?? 0),
        detail: `${match[1]} ${name} = ${value}`,
      });
    }
  }

  return diagnostics.sort((a, b) => a.line - b.line);
}

export function startMockArduinoRuntime(
  code: string,
  components: CircuitComponent[],
  wires: Wire[],
  boardPins: Pin[],
  logicHighVoltage: number,
  callbacks: RuntimeCallbacks
): void {
  stopMockArduinoRuntime();

  const variables = buildVariableTables(code);
  const servoInstances = extractServoInstances(code);
  const lcdRuntime = extractLcdInstances(code, variables);
  const { setupStatements, loopStatements, loopBody } = parseSketch(code);
  const connectivity = buildConnectivity(components, wires, boardPins);
  const measurementConnectivity = buildConnectivity(components, wires, boardPins, {
    bridgeResistors: false,
    bridgePotentiometers: false,
  });
  const pinValues = new Map<string, number>();
  const damagedComponents = new Map<string, DamageRecord>();
  const servoRuntime = new Map<string, ServoRuntimeState>();
  const scope = createRuntimeScope(variables);
  const clockMs = { value: 0 };
  const timers = new Set<number>();
  let cancelled = false;
  let serialBuffer = '';

  for (const instance of servoInstances) {
    servoRuntime.set(instance, {
      pin: null,
      angle: 90,
      pulseWidthUs: null,
      hasWritten: false,
    });
  }

  const trackTimeout = (fn: () => void, ms: number) => {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      if (!cancelled) fn();
    }, ms);
    timers.add(timer);
  };

  const flushSerialBuffer = () => {
    if (!serialBuffer) return;
    callbacks.addSerialOutput(serialBuffer);
    serialBuffer = '';
  };
  const appendSerialOutput = (text: string, newline: boolean) => {
    serialBuffer += text;
    if (newline) {
      callbacks.addSerialOutput(serialBuffer);
      serialBuffer = '';
    }
  };

  const executionContext: RuntimeExecutionContext = {
    baseVariables: variables,
    scope,
    clockMs,
    pinValues,
    servoRuntime,
    lcdRuntime,
    connectivity,
    measurementConnectivity,
    boardPins,
    logicHighVoltage,
    callbacks,
    trackTimeout,
    flushSerialBuffer,
    appendSerialOutput,
    damagedComponents,
    isCancelled: () => cancelled,
  };

  // A loop that paces itself with delay() needs no help. One that does not gets
  // a slow tick so the sketch still advances without pinning a core; looking at
  // the whole sketch used to count a delay() in setup() and spin the loop flat out.
  const loopDelayFallback = loopBody.includes('delay(') ? MIN_LOOP_INTERVAL_MS : 250;

  const runLoop = () => {
    if (cancelled || loopStatements.length === 0) return;
    executeRuntimeStatements(loopStatements, executionContext, () => {
      flushSerialBuffer();
      if (loopDelayFallback > MIN_LOOP_INTERVAL_MS) {
        clockMs.value += loopDelayFallback;
      }
      trackTimeout(runLoop, loopDelayFallback);
    });
  };

  updateActuatorStates(
    connectivity,
    measurementConnectivity,
    pinValues,
    servoRuntime,
    lcdRuntime,
    boardPins,
    logicHighVoltage,
    callbacks,
    clockMs.value,
    damagedComponents
  );
  executeRuntimeStatements(setupStatements, executionContext, () => {
    flushSerialBuffer();
    runLoop();
  });

  activeStop = () => {
    cancelled = true;
    flushSerialBuffer();
    for (const timer of timers) {
      window.clearTimeout(timer);
    }
    timers.clear();
  };
}

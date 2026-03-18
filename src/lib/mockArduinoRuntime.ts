import type { CircuitComponent, Pin, Wire } from '../models/types';
import { ARDUINO_COMPONENT_ID } from '../models/arduinoUno';
import {
  BREADBOARD_COMPONENT_ID,
  BREADBOARD_HOLES,
  BREADBOARD_STRIP_GROUPS,
} from '../models/breadboard';

type SimulationPropertyValue = string | number | boolean;

type RuntimeCallbacks = {
  addSerialOutput: (text: string) => void;
  setLedState: (componentId: string, on: boolean, brightness: number) => void;
  clearLedStates: () => void;
  setComponentState: (
    componentId: string,
    properties: Record<string, SimulationPropertyValue>
  ) => void;
  clearComponentStates: () => void;
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
  connectivity: Connectivity;
  measurementConnectivity: Connectivity;
  boardPins: Pin[];
  logicHighVoltage: number;
  callbacks: RuntimeCallbacks;
  trackTimeout: (fn: () => void, ms: number) => void;
  flushSerialBuffer: () => void;
  appendSerialOutput: (text: string, newline: boolean) => void;
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

type DriverDefinition = {
  supplyPins: string[];
  groundPins: string[];
  channels: DriverChannelDefinition[];
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

const NOOP_CALLBACKS: RuntimeCallbacks = {
  addSerialOutput: () => {},
  setLedState: () => {},
  clearLedStates: () => {},
  setComponentState: () => {},
  clearComponentStates: () => {},
};

let activeStop: (() => void) | null = null;

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
  scope?: RuntimeScope
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
        scope
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

function extractFunctionBody(code: string, functionName: 'setup' | 'loop'): string {
  const signature = new RegExp(`void\\s+${functionName}\\s*\\(\\s*\\)\\s*\\{`, 'i');
  const match = signature.exec(code);
  if (!match) return '';

  let depth = 1;
  let idx = match.index + match[0].length;
  const start = idx;

  while (idx < code.length && depth > 0) {
    const char = code[idx];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    idx += 1;
  }

  return code.slice(start, Math.max(start, idx - 1));
}

function pulseWidthToAngle(pulseWidthUs: number): number {
  const normalized = clamp(pulseWidthUs, 500, 2500);
  return Math.round(((normalized - 500) / 2000) * 180);
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
  closeChar: string
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

  return {
    content: code.slice(start + 1, Math.max(start + 1, index - 1)),
    next: index,
  };
}

function parseRuntimeStatement(
  code: string,
  start: number
): { statement: RuntimeStatement | null; next: number } {
  let index = skipRuntimeWhitespace(code, start);
  if (index >= code.length) {
    return { statement: null, next: index };
  }

  if (code[index] === ';') {
    return { statement: null, next: index + 1 };
  }

  if (code[index] === '{') {
    const block = extractRuntimeDelimited(code, index, '{', '}');
    return {
      statement: { type: 'block', body: parseRuntimeStatements(block.content) },
      next: block.next,
    };
  }

  if (startsWithRuntimeKeyword(code, index, 'if')) {
    const conditionStart = skipRuntimeWhitespace(code, index + 2);
    const condition = extractRuntimeDelimited(code, conditionStart, '(', ')');
    const consequent = parseRuntimeStatement(code, condition.next);
    let next = consequent.next;
    let alternate: RuntimeStatement | null = null;
    const elseStart = skipRuntimeWhitespace(code, next);

    if (startsWithRuntimeKeyword(code, elseStart, 'else')) {
      const parsedAlternate = parseRuntimeStatement(code, elseStart + 4);
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
    const header = extractRuntimeDelimited(code, headerStart, '(', ')');
    const [init = '', condition = '', update = ''] = splitTopLevel(header.content, ';');
    const body = parseRuntimeStatement(code, header.next);

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
      return {
        statement: {
          type: 'expr',
          code: code.slice(index, cursor).trim(),
        },
        next: cursor + 1,
      };
    }

    cursor += 1;
  }

  return {
    statement: {
      type: 'expr',
      code: code.slice(index).trim(),
    },
    next: code.length,
  };
}

function parseRuntimeStatements(code: string): RuntimeStatement[] {
  const stripped = stripRuntimeComments(code);
  const statements: RuntimeStatement[] = [];
  let index = 0;

  while (index < stripped.length) {
    const parsed = parseRuntimeStatement(stripped, index);
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

function callRuntimeBuiltin(
  name: string,
  args: RuntimeValue[],
  clockMs?: { value: number }
): RuntimeValue {
  const normalized = normalizeVariableName(name);
  const numbers = args.map((arg) => toRuntimeNumber(arg) ?? 0);

  switch (normalized) {
    case 'MILLIS':
      return clockMs?.value ?? 0;
    case 'MICROS':
      return (clockMs?.value ?? 0) * 1000;
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
      return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    }
    default:
      return 0;
  }
}

function evaluateRuntimeExpression(
  expr: string,
  variables: VariableTables,
  scope: RuntimeScope,
  clockMs?: { value: number }
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
        return callRuntimeBuiltin(token.value, args, clockMs);
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
  clockMs?: { value: number }
): boolean {
  return toRuntimeBoolean(evaluateRuntimeExpression(expr, variables, scope, clockMs)) ?? false;
}

function appendRuntimeSerialOutput(
  expr: string,
  context: RuntimeExecutionContext,
  newline: boolean
): void {
  const text = resolveSerialExpression(expr, context.baseVariables, context.scope);
  context.appendSerialOutput(text, newline);
}

function updateRuntimeSimulationState(context: RuntimeExecutionContext): void {
  updateActuatorStates(
    context.connectivity,
    context.measurementConnectivity,
    context.pinValues,
    context.servoRuntime,
    context.boardPins,
    context.logicHighVoltage,
    context.callbacks
  );
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
          context.clockMs
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
        context.clockMs
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
      context.clockMs
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
          context.clockMs
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
                context.clockMs
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
                    context.clockMs
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
          toRuntimeNumber(
            evaluateRuntimeExpression(
              args,
              context.baseVariables,
              context.scope,
              context.clockMs
            )
          ) ?? current.angle
        ),
        0,
        180
      );
      context.servoRuntime.set(instance, {
        ...current,
        angle,
        pulseWidthUs: null,
      });
      updateRuntimeSimulationState(context);
      done();
      return;
    }

    if (action === 'writemicroseconds') {
      const pulseWidthUs = Math.round(
        toRuntimeNumber(
          evaluateRuntimeExpression(
            args,
            context.baseVariables,
            context.scope,
            context.clockMs
          )
        ) ?? (current.pulseWidthUs ?? 1500)
      );
      context.servoRuntime.set(instance, {
        ...current,
        angle: pulseWidthToAngle(pulseWidthUs),
        pulseWidthUs,
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
      context.clockMs
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
    executeRuntimeStatement(current, context, next);
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
  callbacks: RuntimeCallbacks
): void {
  for (const component of connectivity.components) {
    const definition = DRIVER_DEFINITIONS[component.type];
    if (!definition) continue;

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

    if (Object.keys(nextProperties).length > 0) {
      callbacks.setComponentState(component.id, nextProperties);
    }
  }
}

function computeLedStates(
  connectivity: Connectivity,
  netState: NetState,
  callbacks: RuntimeCallbacks
): void {
  for (const led of connectivity.components.filter((component) => component.type === 'led')) {
    const anodeLevel = getNetLevel(netState, getEndpointNet(connectivity, led.id, 'anode'));
    const cathodeLevel = getNetLevel(netState, getEndpointNet(connectivity, led.id, 'cathode'));
    const delta =
      anodeLevel === null || cathodeLevel === null ? 0 : clamp(anodeLevel - cathodeLevel, 0, 255);
    const brightness = delta / 255;

    callbacks.setLedState(led.id, brightness > 0.05, brightness);
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

    callbacks.setComponentState(servo.id, {
      angle: powered && runtimeState ? runtimeState.angle : 90,
    });
  }
}

function computeDcMotorStates(
  connectivity: Connectivity,
  netState: NetState,
  callbacks: RuntimeCallbacks
): void {
  for (const motor of connectivity.components.filter((component) => component.type === 'dc-motor')) {
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

function updateActuatorStates(
  connectivity: Connectivity,
  measurementConnectivity: Connectivity,
  pinValues: Map<string, number>,
  servoRuntime: Map<string, ServoRuntimeState>,
  boardPins: Pin[],
  logicHighVoltage: number,
  callbacks: RuntimeCallbacks
): void {
  callbacks.clearLedStates();
  callbacks.clearComponentStates();

  const netState = buildBaseNetState(connectivity, pinValues, boardPins, logicHighVoltage);
  computeDriverStates(connectivity, netState, callbacks);
  computeLedStates(connectivity, netState, callbacks);
  computeServoStates(connectivity, servoRuntime, netState, callbacks);
  computeDcMotorStates(connectivity, netState, callbacks);

  const measurementNetState = buildBaseNetState(
    measurementConnectivity,
    pinValues,
    boardPins,
    logicHighVoltage
  );
  computeDriverStates(measurementConnectivity, measurementNetState, NOOP_CALLBACKS);
  const { voltages, resistiveEdges } = solveMeasurementVoltages(
    measurementConnectivity,
    measurementNetState
  );
  computeProbeDrivenMultimeterStates(measurementConnectivity, voltages, resistiveEdges, callbacks);
}

export function stopMockArduinoRuntime(): void {
  activeStop?.();
  activeStop = null;
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
  const setupStatements = parseRuntimeStatements(extractFunctionBody(code, 'setup'));
  const loopStatements = parseRuntimeStatements(extractFunctionBody(code, 'loop'));
  const connectivity = buildConnectivity(components, wires, boardPins);
  const measurementConnectivity = buildConnectivity(components, wires, boardPins, {
    bridgeResistors: false,
    bridgePotentiometers: false,
  });
  const pinValues = new Map<string, number>();
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
    connectivity,
    measurementConnectivity,
    boardPins,
    logicHighVoltage,
    callbacks,
    trackTimeout,
    flushSerialBuffer,
    appendSerialOutput,
    isCancelled: () => cancelled,
  };

  const loopDelayFallback = code.includes('delay(') ? 0 : 250;

  const runLoop = () => {
    if (cancelled || loopStatements.length === 0) return;
    executeRuntimeStatements(loopStatements, executionContext, () => {
      flushSerialBuffer();
      if (loopDelayFallback > 0) {
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
    boardPins,
    logicHighVoltage,
    callbacks
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

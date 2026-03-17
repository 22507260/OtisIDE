import type { CircuitComponent, Pin, Wire } from '../models/types';
import { ARDUINO_COMPONENT_ID } from '../models/arduinoUno';
import {
  BREADBOARD_COMPONENT_ID,
  BREADBOARD_HOLES,
  BREADBOARD_STRIP_GROUPS,
} from '../models/breadboard';

type RuntimeCallbacks = {
  addSerialOutput: (text: string) => void;
  setLedState: (componentId: string, on: boolean, brightness: number) => void;
  clearLedStates: () => void;
};

type Command =
  | { type: 'delay'; ms: number }
  | { type: 'serialPrint'; value: string; newline: boolean }
  | { type: 'digitalWrite'; pin: string; value: boolean };

type VariableTables = {
  numeric: Map<string, number>;
  logic: Map<string, boolean>;
  text: Map<string, string>;
};

type Connectivity = {
  endpointToNet: Map<string, number>;
  components: CircuitComponent[];
};

let activeStop: (() => void) | null = null;

function endpointKey(componentId: string, pinId: string): string {
  return `${componentId}:${pinId}`;
}

function normalizeVariableName(name: string): string {
  return name.trim().toUpperCase();
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
    text: new Map<string, string>(),
  };

  const numericRegex = /\b(?:const\s+)?(?:unsigned\s+)?(?:int|long|short|byte)\s+([A-Za-z_]\w*)\s*=\s*(-?\d+)\s*;/gi;
  const logicRegex = /\b(?:const\s+)?(?:bool|boolean|int|byte)\s+([A-Za-z_]\w*)\s*=\s*(HIGH|LOW|true|false)\s*;/gi;
  const textRegex = /\b(?:const\s+)?(?:String|char\s*\*|const\s+char\s*\*)\s+([A-Za-z_]\w*)\s*=\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*;/gi;

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

  return tables;
}

function resolveNumericExpression(expr: string, variables: VariableTables): number | null {
  const trimmed = expr.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  const name = normalizeVariableName(trimmed);
  if (variables.numeric.has(name)) {
    return variables.numeric.get(name)!;
  }

  return null;
}

function resolveLogicExpression(expr: string, variables: VariableTables): boolean | null {
  const trimmed = expr.trim();
  const upper = trimmed.toUpperCase();

  if (upper === 'HIGH' || upper === 'TRUE') return true;
  if (upper === 'LOW' || upper === 'FALSE') return false;

  const name = normalizeVariableName(trimmed);
  if (variables.logic.has(name)) {
    return variables.logic.get(name)!;
  }

  return null;
}

function resolveSerialExpression(expr: string, variables: VariableTables): string {
  const trimmed = expr.trim();
  if (!trimmed) return '';

  const parts = splitTopLevel(trimmed, '+').map((part) => part.trim()).filter(Boolean);
  const rendered = parts.map((part) => {
    if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) {
      return decodeStringLiteral(part);
    }

    if (/^String\s*\(([\s\S]*)\)$/i.test(part)) {
      return resolveSerialExpression(part.replace(/^String\s*\(/i, '').replace(/\)\s*$/, ''), variables);
    }

    const numericValue = resolveNumericExpression(part, variables);
    if (numericValue !== null) return String(numericValue);

    const logicValue = resolveLogicExpression(part, variables);
    if (logicValue !== null) return logicValue ? 'HIGH' : 'LOW';

    const variableName = normalizeVariableName(part);
    if (variables.text.has(variableName)) {
      return variables.text.get(variableName)!;
    }

    return part;
  });

  return rendered.join('');
}

function normalizeArduinoPin(pinExpr: string, variables: VariableTables): string | null {
  const trimmed = pinExpr.trim();
  const numericValue = resolveNumericExpression(trimmed, variables);
  const rawValue = numericValue !== null ? String(numericValue) : trimmed;
  const normalized = rawValue.trim().toUpperCase();

  if (/^\d+$/.test(normalized)) {
    return `D${normalized}`;
  }
  if (normalized === 'LED_BUILTIN') {
    return 'D13';
  }
  return normalized || null;
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

function parseCommands(body: string, variables: VariableTables): Command[] {
  const commands: Command[] = [];
  const regex = /Serial\.(println|print)\(([\s\S]*?)\)\s*;|delay\(([\s\S]*?)\)\s*;|digitalWrite\(([\s\S]*?),\s*([\s\S]*?)\)\s*;/gi;

  for (const match of body.matchAll(regex)) {
    if (match[1]) {
      commands.push({
        type: 'serialPrint',
        value: resolveSerialExpression(match[2] ?? '', variables),
        newline: match[1].toLowerCase() === 'println',
      });
      continue;
    }

    if (match[3]) {
      const delayValue = resolveNumericExpression(match[3], variables);
      if (delayValue !== null) {
        commands.push({
          type: 'delay',
          ms: Math.max(0, delayValue),
        });
      }
      continue;
    }

    if (match[4] && match[5]) {
      const pin = normalizeArduinoPin(match[4], variables);
      const value = resolveLogicExpression(match[5], variables);
      if (pin && value !== null) {
        commands.push({
          type: 'digitalWrite',
          pin,
          value,
        });
      }
    }
  }

  return commands;
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

function buildConnectivity(
  components: CircuitComponent[],
  wires: Wire[],
  boardPins: Pin[]
): Connectivity {
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
    addEdge(graph, endpointKey(wire.startComponentId, wire.startPinId), endpointKey(wire.endComponentId, wire.endPinId));
  }

  for (const strip of BREADBOARD_STRIP_GROUPS) {
    const stripKeys = strip.map((hole) =>
      endpointKey(BREADBOARD_COMPONENT_ID, hole.id)
    );
    for (let i = 0; i < stripKeys.length; i += 1) {
      for (let j = i + 1; j < stripKeys.length; j += 1) {
        addEdge(graph, stripKeys[i], stripKeys[j]);
      }
    }
  }

  for (const component of components) {
    if (component.type === 'resistor') {
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

    if (component.type === 'potentiometer') {
      connectPairs(graph, component.id, ['pin1', 'wiper', 'pin2']);
    }
  }

  const endpointToNet = new Map<string, number>();
  let netId = 0;

  for (const start of graph.keys()) {
    if (endpointToNet.has(start)) continue;

    const stack = [start];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (endpointToNet.has(current)) continue;
      endpointToNet.set(current, netId);
      for (const next of graph.get(current) ?? []) {
        if (!endpointToNet.has(next)) stack.push(next);
      }
    }

    netId += 1;
  }

  return { endpointToNet, components };
}

function computeLedStates(
  connectivity: Connectivity,
  pinStates: Map<string, boolean>,
  boardPins: Pin[],
  callbacks: RuntimeCallbacks
): void {
  callbacks.clearLedStates();

  const highNets = new Set<number>();
  const lowNets = new Set<number>();
  const groundNets = new Set<number>();

  const pushNet = (pinId: string, target: Set<number>) => {
    const net = connectivity.endpointToNet.get(endpointKey(ARDUINO_COMPONENT_ID, pinId));
    if (net !== undefined) target.add(net);
  };

  for (const groundPin of boardPins.filter((pin) => pin.type === 'ground')) {
    pushNet(groundPin.id, groundNets);
  }

  for (const [pinId, value] of pinStates.entries()) {
    const net = connectivity.endpointToNet.get(endpointKey(ARDUINO_COMPONENT_ID, pinId));
    if (net === undefined) continue;
    if (value) highNets.add(net);
    else lowNets.add(net);
  }

  for (const led of connectivity.components.filter((component) => component.type === 'led')) {
    const anodeNet = connectivity.endpointToNet.get(endpointKey(led.id, 'anode'));
    const cathodeNet = connectivity.endpointToNet.get(endpointKey(led.id, 'cathode'));

    const isOn =
      anodeNet !== undefined &&
      cathodeNet !== undefined &&
      highNets.has(anodeNet) &&
      (groundNets.has(cathodeNet) || lowNets.has(cathodeNet));

    callbacks.setLedState(led.id, isOn, isOn ? 1 : 0);
  }
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
  callbacks: RuntimeCallbacks
): void {
  stopMockArduinoRuntime();

  const variables = buildVariableTables(code);
  const setupCommands = parseCommands(extractFunctionBody(code, 'setup'), variables);
  const loopCommands = parseCommands(extractFunctionBody(code, 'loop'), variables);
  const connectivity = buildConnectivity(components, wires, boardPins);
  const pinStates = new Map<string, boolean>();
  const timers = new Set<number>();
  let cancelled = false;
  let serialBuffer = '';

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

  const applyCommand = (command: Command) => {
    if (command.type === 'serialPrint') {
      serialBuffer += command.value;
      if (command.newline) {
        callbacks.addSerialOutput(serialBuffer);
        serialBuffer = '';
      }
      return 0;
    }

    if (command.type === 'digitalWrite') {
      pinStates.set(command.pin, command.value);
      computeLedStates(connectivity, pinStates, boardPins, callbacks);
      return 0;
    }

    return command.ms;
  };

  const runSequence = (commands: Command[], onDone: () => void) => {
    if (commands.length === 0) {
      onDone();
      return;
    }

    let idx = 0;
    const step = () => {
      if (cancelled) return;
      if (idx >= commands.length) {
        flushSerialBuffer();
        onDone();
        return;
      }

      const delay = applyCommand(commands[idx]);
      idx += 1;
      trackTimeout(step, Math.max(0, delay));
    };

    step();
  };

  const loopDelayFallback = loopCommands.some((command) => command.type === 'delay') ? 0 : 250;

  const runLoop = () => {
    if (cancelled || loopCommands.length === 0) return;
    runSequence(loopCommands, () => {
      trackTimeout(runLoop, loopDelayFallback);
    });
  };

  computeLedStates(connectivity, pinStates, boardPins, callbacks);
  runSequence(setupCommands, runLoop);

  activeStop = () => {
    cancelled = true;
    flushSerialBuffer();
    for (const timer of timers) {
      window.clearTimeout(timer);
    }
    timers.clear();
  };
}

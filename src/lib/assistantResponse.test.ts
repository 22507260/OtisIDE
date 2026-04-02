import { test, expect } from 'vitest';
import {
  extractArduinoCode,
  extractTypedJsonArray,
  isCircuitArray,
  isWireArray,
} from './assistantResponse';

test('extractTypedJsonArray reads circuit data from a named fence', () => {
  const content = `Here is the circuit:

\`\`\`circuit
[
  {"ref":"led1","type":"led","x":220,"y":280}
]
\`\`\`
`;

  const items = extractTypedJsonArray(content, 'circuit', isCircuitArray);
  expect(items).toBeTruthy();
  expect(items?.length).toBe(1);
  expect(items?.[0]?.type).toBe('led');
});

test('extractTypedJsonArray accepts alias fields inside json fences', () => {
  const content = `\`\`\`json
{"connections":[{"from":{"component":"arduino","pin":"D13"},"to":{"component":"led1","pin":"anode"}}]}
\`\`\``;

  const items = extractTypedJsonArray(content, 'wires', isWireArray);
  expect(items).toBeTruthy();
  expect(items?.length).toBe(1);
  expect(items?.[0]?.from.pin).toBe('D13');
});

test('extractArduinoCode returns the code fence body', () => {
  const content = `\`\`\`arduino
void setup() {
  pinMode(13, OUTPUT);
}
\`\`\``;

  expect(extractArduinoCode(content)).toBe(`void setup() {
  pinMode(13, OUTPUT);
}`);
});

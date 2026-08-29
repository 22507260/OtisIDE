import { describe, expect, it } from 'vitest';
import { findSketchDiagnostics } from '../mockArduinoRuntime';

/** The sketch every new project opens with — it must never be flagged. */
const DEFAULT_SKETCH = `// Arduino sketch
void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
  Serial.println("LED Blink!");
}
`;

const kinds = (code: string) => findSketchDiagnostics(code).map((item) => item.kind);
const names = (code: string) => findSketchDiagnostics(code).map((item) => item.detail);

describe('findSketchDiagnostics — no false positives', () => {
  it('accepts the default blink sketch', () => {
    expect(findSketchDiagnostics(DEFAULT_SKETCH)).toEqual([]);
  });

  it('accepts declared variables and a for-loop counter', () => {
    const code = `
      int ledPin = 9;
      int brightness = 0;
      void setup() { pinMode(ledPin, OUTPUT); }
      void loop() {
        for (int i = 0; i < 255; i++) {
          analogWrite(ledPin, i);
          delay(5);
        }
        brightness = brightness + 1;
      }
    `;
    expect(findSketchDiagnostics(code)).toEqual([]);
  });

  it('accepts library objects, #include lines and #define constants', () => {
    const code = `
      #include <Servo.h>
      #include <LiquidCrystal.h>
      #define SWITCH_PIN 7
      Servo arm;
      LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
      void setup() {
        arm.attach(9);
        lcd.begin(16, 2);
        pinMode(SWITCH_PIN, INPUT_PULLUP);
      }
      void loop() {
        int reading = digitalRead(SWITCH_PIN);
        if (reading == LOW) { arm.write(90); }
      }
    `;
    expect(findSketchDiagnostics(code)).toEqual([]);
  });

  it('accepts several declarators sharing one type', () => {
    const code = `
      int a = 1, b = 2, c;
      float ratio;
      void setup() {}
      void loop() { a = b + c; ratio = a; }
    `;
    expect(findSketchDiagnostics(code)).toEqual([]);
  });

  it('does not read words inside string literals as variables', () => {
    const code = `
      void setup() { Serial.begin(9600); }
      void loop() { Serial.println("thisWordIsNotAVariable"); }
    `;
    expect(findSketchDiagnostics(code)).toEqual([]);
  });

  it('accepts board constants such as HIGH, A0 and LED_BUILTIN', () => {
    const code = `
      void setup() { pinMode(LED_BUILTIN, OUTPUT); }
      void loop() {
        int raw = analogRead(A0);
        digitalWrite(LED_BUILTIN, raw > 500 ? HIGH : LOW);
      }
    `;
    expect(findSketchDiagnostics(code)).toEqual([]);
  });

  it('accepts the core Arduino API', () => {
    const code = `
      void setup() {
        pinMode(9, OUTPUT);
        randomSeed(analogRead(A0));
      }
      void loop() {
        int level = map(random(0, 1023), 0, 1023, 0, 255);
        analogWrite(9, constrain(level, 0, 255));
        tone(8, 440, 100);
        delayMicroseconds(500);
      }
    `;
    expect(findSketchDiagnostics(code)).toEqual([]);
  });

  it('accepts a function the sketch defines itself, called or passed by name', () => {
    const code = `
      int ledPin = 9;
      void blink(int times);

      void setup() {
        pinMode(ledPin, OUTPUT);
        attachInterrupt(digitalPinToInterrupt(2), onPress, RISING);
      }

      void onPress() { blink(2); }

      void blink(int times) {
        for (int i = 0; i < times; i++) {
          digitalWrite(ledPin, HIGH);
          delay(100);
          digitalWrite(ledPin, LOW);
          delay(100);
        }
      }

      void loop() { blink(1); }
    `;
    expect(findSketchDiagnostics(code)).toEqual([]);
  });

  it('accepts a function-like macro and a cast', () => {
    const code = `
      #define SQUARE(x) ((x) * (x))
      void setup() {}
      void loop() {
        float reading = analogRead(A0);
        int scaled = (int)(SQUARE(reading) / 1024.0);
        analogWrite(9, scaled);
      }
    `;
    expect(findSketchDiagnostics(code)).toEqual([]);
  });
});

describe('findSketchDiagnostics — real problems', () => {
  it('reports a variable that was never declared', () => {
    const code = `
      void setup() {}
      void loop() { digitalWrite(ledPin, HIGH); }
    `;
    expect(kinds(code)).toContain('undeclared-variable');
    expect(names(code)).toContain('ledPin');
  });

  it('reports each undeclared name only once', () => {
    const code = `
      void setup() {}
      void loop() {
        digitalWrite(ledPin, HIGH);
        digitalWrite(ledPin, LOW);
      }
    `;
    expect(names(code).filter((name) => name === 'ledPin')).toHaveLength(1);
  });

  it('reports a string parked in a numeric variable', () => {
    const code = `
      int count = "hello";
      void setup() {}
      void loop() {}
    `;
    expect(kinds(code)).toContain('type-mismatch');
  });

  it('reports a bare number parked in a String', () => {
    const code = `
      String label = 42;
      void setup() {}
      void loop() {}
    `;
    expect(kinds(code)).toContain('type-mismatch');
  });

  it('reports a call to a function nothing declares', () => {
    const code = `
      int redPin = 9;
      void setup() { pinModeXXX(redPin, OUTPUT); }
      void loop() {}
    `;
    expect(kinds(code)).toContain('unknown-function');
    expect(names(code)).toContain('pinModeXXX');
  });

  it('points at the line the unknown call is on', () => {
    const code = [
      'int redPin = 9;',
      'void setup() {',
      '  pinModeXXX(redPin, OUTPUT);',
      '}',
      'void loop() {}',
    ].join('\n');
    const [first] = findSketchDiagnostics(code);
    expect(first.kind).toBe('unknown-function');
    expect(first.line).toBe(3);
  });

  it('does not mistake an undeclared name for an unknown call', () => {
    const code = `
      void setup() {}
      void loop() { digitalWrite(ledPin, HIGH); }
    `;
    expect(kinds(code)).toEqual(['undeclared-variable']);
  });

  it('points at the line the problem is on', () => {
    const code = ['void setup() {}', 'void loop() {', '  int x = missingThing;', '}'].join('\n');
    const [first] = findSketchDiagnostics(code);
    expect(first.line).toBe(3);
  });
});

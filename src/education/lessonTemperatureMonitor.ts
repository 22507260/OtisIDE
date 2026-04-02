import type { Lesson } from './types';
import { EMPTY_SKETCH, lt } from './catalogUtils';

export const temperatureMonitorLesson: Lesson = {
  id: 'temperature-monitor',
  title: lt('Temperature Monitor', 'Sicaklik Izleyici'),
  description: lt(
    'Wire an LM35 sensor to A0 and print a temperature reading to serial output.',
    "LM35 sensorunu A0'a bagla ve sicaklik degerini seri cikti olarak yazdir."
  ),
  outcome: lt(
    'You will practice analog sensor wiring and basic serial telemetry.',
    'Analog sensor kablolamasi ve temel seri telemetri pratigi yapacaksin.'
  ),
  estimatedMinutes: 12,
  difficulty: 'starter',
  boardType: 'uno',
  allowedComponents: ['lm35'],
  starterProject: {
    boardType: 'uno',
    code: EMPTY_SKETCH,
    components: [],
    wires: [],
  },
  steps: [
    {
      id: 'temp-add-sensor',
      title: lt('Add the sensor', 'Sensoru ekle'),
      instruction: lt('Add one LM35 temperature sensor.', 'Bir adet LM35 sicaklik sensoru ekle.'),
      hint: lt('You only need the LM35 for this lesson.', 'Bu derste yalnizca LM35 gerekiyor.'),
      explanation: lt(
        'LM35 is a simple analog temperature sensor with VCC, VOUT, and GND pins.',
        'LM35; VCC, VOUT ve GND pinlerine sahip basit bir analog sicaklik sensorudur.'
      ),
      success: lt('LM35 is ready for wiring.', 'LM35 kablolamaya hazir.'),
      checks: [
        {
          id: 'lm35-present',
          type: 'component',
          componentType: 'lm35',
          ref: 'temp1',
          passText: lt('LM35 added.', 'LM35 eklendi.'),
          failText: lt('Add one LM35 sensor.', 'Bir adet LM35 sensoru ekle.'),
        },
      ],
      solutionProject: {
        boardType: 'uno',
        code: EMPTY_SKETCH,
        components: [{ ref: 'temp1', type: 'lm35', x: 266, y: 286 }],
        wires: [],
      },
    },
    {
      id: 'temp-wire-sensor',
      title: lt('Wire VCC, signal, and GND', "VCC, sinyal ve GND'yi bagla"),
      instruction: lt(
        'Connect the LM35 VCC pin to 5V, Vout to A0, and GND to GND.',
        "LM35'in VCC pinini 5V'a, Vout pinini A0'a ve GND pinini GND'ye bagla."
      ),
      hint: lt(
        'Analog sensors usually need power, ground, and one analog signal line.',
        'Analog sensorler genelde guc, toprak ve bir analog sinyal hatti ister.'
      ),
      explanation: lt(
        'A0 reads the analog voltage from Vout, which represents the temperature.',
        'A0, sicakligi temsil eden Vout analog voltajini okur.'
      ),
      success: lt('The sensor is wired correctly.', 'Sensor dogru baglandi.'),
      checks: [
        {
          id: 'temp-vcc',
          type: 'connection',
          from: { component: 'arduino', pin: '5V' },
          to: { component: 'temp1', pin: 'vcc' },
          passText: lt('LM35 receives power.', 'LM35 guc aliyor.'),
          failText: lt('Connect 5V to LM35 VCC.', "5V'u LM35 VCC pinine bagla."),
        },
        {
          id: 'temp-vout',
          type: 'connection',
          from: { component: 'temp1', pin: 'vout' },
          to: { component: 'arduino', pin: 'A0' },
          passText: lt('LM35 output reaches A0.', "LM35 cikisi A0'a ulasiyor."),
          failText: lt('Connect LM35 Vout to A0.', "LM35 Vout pinini A0'a bagla."),
          hintText: lt('The sensor is wired, but its signal is not reaching A0 yet.', "Sensor bagli ama sinyali henuz A0'a gitmiyor."),
        },
        {
          id: 'temp-ground',
          type: 'connection',
          from: { component: 'temp1', pin: 'gnd' },
          to: { component: 'arduino', pin: 'GND' },
          passText: lt('LM35 ground is connected.', 'LM35 topragi bagli.'),
          failText: lt('Connect LM35 GND to GND.', "LM35 GND pinini GND'ye bagla."),
        },
      ],
      solutionProject: {
        boardType: 'uno',
        code: EMPTY_SKETCH,
        components: [{ ref: 'temp1', type: 'lm35', x: 266, y: 286 }],
        wires: [
          { from: { component: 'arduino', pin: '5V' }, to: { component: 'temp1', pin: 'vcc' }, color: '#e67e22' },
          { from: { component: 'temp1', pin: 'vout' }, to: { component: 'arduino', pin: 'A0' }, color: '#3498db' },
          { from: { component: 'temp1', pin: 'gnd' }, to: { component: 'arduino', pin: 'GND' }, color: '#2c3e50' },
        ],
      },
    },
    {
      id: 'temp-code',
      title: lt('Print the reading', 'Degeri yazdir'),
      instruction: lt(
        'Initialize serial, read A0 with analogRead, and print the converted temperature.',
        "Seri haberlesmeyi baslat, A0'i analogRead ile oku ve donusturulmus sicakligi yazdir."
      ),
      hint: lt(
        'Look for Serial.begin, analogRead(A0), and Serial.println.',
        'Serial.begin, analogRead(A0) ve Serial.println kullan.'
      ),
      explanation: lt(
        'This lesson is about the basic analog sensing flow: read voltage, convert it, and send it to the serial monitor.',
        'Bu ders temel analog algilama akisini ogretir: voltaj oku, donustur ve seri ekrana gonder.'
      ),
      success: lt('Temperature monitor lesson complete.', 'Sicaklik izleyici dersi tamamlandi.'),
      checks: [
        {
          id: 'temp-serial-begin',
          type: 'code',
          regex: true,
          patterns: ['Serial\\.begin\\s*\\(\\s*9600\\s*\\)'],
          passText: lt('Serial is initialized.', 'Serial baslatilmis.'),
          failText: lt('Start serial output with Serial.begin(9600).', 'Serial.begin(9600) ile seri ciktiyi baslat.'),
        },
        {
          id: 'temp-analog-read',
          type: 'code',
          regex: true,
          patterns: ['analogRead\\s*\\(\\s*(?:A0|sensorPin)\\s*\\)'],
          passText: lt('The sketch reads A0.', 'Kod A0 pinini okuyor.'),
          failText: lt('Use analogRead(A0) to read the sensor.', 'Sensoru okumak icin analogRead(A0) kullan.'),
        },
        {
          id: 'temp-serial-print',
          type: 'code',
          regex: true,
          patterns: ['Serial\\.(?:print|println)\\s*\\('],
          passText: lt('The reading is printed.', 'Okuma degeri yazdiriliyor.'),
          failText: lt('Print the temperature to serial output.', 'Sicakligi seri ciktiya yazdir.'),
        },
      ],
      solutionProject: {
        boardType: 'uno',
        code: `const int sensorPin = A0;

void setup() {
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(sensorPin);
  float voltage = raw * (5.0 / 1023.0);
  float temperatureC = voltage * 100.0;
  Serial.println(temperatureC);
  delay(500);
}
`,
        components: [{ ref: 'temp1', type: 'lm35', x: 266, y: 286 }],
        wires: [
          { from: { component: 'arduino', pin: '5V' }, to: { component: 'temp1', pin: 'vcc' }, color: '#e67e22' },
          { from: { component: 'temp1', pin: 'vout' }, to: { component: 'arduino', pin: 'A0' }, color: '#3498db' },
          { from: { component: 'temp1', pin: 'gnd' }, to: { component: 'arduino', pin: 'GND' }, color: '#2c3e50' },
        ],
      },
    },
  ],
};





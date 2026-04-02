import type { Lesson } from './types';
import { EMPTY_SKETCH, lt } from './catalogUtils';

export const buzzerAlarmLesson: Lesson = {
  id: 'buzzer-alarm',
  title: lt('Buzzer Alarm', 'Buzzer Alarmi'),
  description: lt(
    'Create a simple buzzer alarm controlled by a push button input.',
    'Bir buton girisi ile kontrol edilen basit bir buzzer alarmi kur.'
  ),
  outcome: lt(
    'You will combine one digital input with one digital output in the same sketch.',
    'Ayni kod icinde bir dijital giris ile bir dijital cikisi birlestireceksin.'
  ),
  estimatedMinutes: 14,
  difficulty: 'starter',
  boardType: 'uno',
  allowedComponents: ['buzzer', 'button', 'resistor'],
  starterProject: {
    boardType: 'uno',
    code: EMPTY_SKETCH,
    components: [],
    wires: [],
  },
  steps: [
    {
      id: 'alarm-parts',
      title: lt('Add buzzer, button, and resistor', 'Buzzer, buton ve direnc ekle'),
      instruction: lt(
        'Add one buzzer, one push button, and one resistor.',
        'Bir buzzer, bir buton ve bir direnc ekle.'
      ),
      hint: lt('This lesson combines one input and one output.', 'Bu ders bir giris ile bir cikisi birlestirir.'),
      explanation: lt(
        'The buzzer is the output device. The button and resistor create the control input.',
        'Buzzer cikis cihazidir. Buton ve direnc ise kontrol girisini olusturur.'
      ),
      success: lt('Alarm parts are ready.', 'Alarm parcalari hazir.'),
      checks: [
        {
          id: 'alarm-buzzer',
          type: 'component',
          componentType: 'buzzer',
          ref: 'buzzer1',
          passText: lt('Buzzer added.', 'Buzzer eklendi.'),
          failText: lt('Add one buzzer.', 'Bir buzzer ekle.'),
        },
        {
          id: 'alarm-button',
          type: 'component',
          componentType: 'button',
          ref: 'button1',
          passText: lt('Button added.', 'Buton eklendi.'),
          failText: lt('Add one button.', 'Bir buton ekle.'),
        },
        {
          id: 'alarm-resistor',
          type: 'component',
          componentType: 'resistor',
          ref: 'res1',
          passText: lt('Resistor added.', 'Direnc eklendi.'),
          failText: lt('Add one resistor for the button input.', 'Buton girisi icin bir direnc ekle.'),
        },
      ],
      solutionProject: {
        boardType: 'uno',
        code: EMPTY_SKETCH,
        components: [
          { ref: 'buzzer1', type: 'buzzer', x: 296, y: 244 },
          { ref: 'button1', type: 'button', x: 264, y: 310 },
          { ref: 'res1', type: 'resistor', x: 214, y: 352, properties: { resistance: 10000 } },
        ],
        wires: [],
      },
    },
    {
      id: 'alarm-wire',
      title: lt('Wire input and output', 'Giris ve cikisi bagla'),
      instruction: lt(
        'Connect the buzzer to D8 and GND. Build the button input on D2 with a pull-down resistor to GND.',
        "Buzzer'i D8 ve GND'ye bagla. Buton girisini D2 uzerinde pull-down direnc ile GND'ye kur."
      ),
      hint: lt(
        'The buzzer path is short. The button path should look similar to the Button Input lesson.',
        'Buzzer hatti kisadir. Buton hatti Buton Girisi dersine benzer gorunmeli.'
      ),
      explanation: lt(
        'This project mixes one actuator with one sensor-style input, which is a common beginner pattern.',
        'Bu proje bir cikis aygitini sensor benzeri bir girisle birlestirir; bu da sik gorulen bir baslangic desenidir.'
      ),
      success: lt('The alarm hardware is wired.', 'Alarm donanimi baglandi.'),
      checks: [
        {
          id: 'alarm-buzzer-positive',
          type: 'connection',
          from: { component: 'arduino', pin: 'D8' },
          to: { component: 'buzzer1', pin: 'positive' },
          passText: lt('Buzzer positive is on D8.', "Buzzer arti ucu D8'de."),
          failText: lt('Connect D8 to the buzzer positive pin.', "D8'i buzzerin arti pinine bagla."),
        },
        {
          id: 'alarm-buzzer-ground',
          type: 'connection',
          from: { component: 'buzzer1', pin: 'negative' },
          to: { component: 'arduino', pin: 'GND' },
          passText: lt('Buzzer ground is connected.', 'Buzzer topragi bagli.'),
          failText: lt('Connect the buzzer negative pin to GND.', "Buzzer eksi pinini GND'ye bagla."),
        },
        {
          id: 'alarm-button-input',
          type: 'connection',
          from: { component: 'button1', pin: 'pin2' },
          to: { component: 'arduino', pin: 'D2' },
          passText: lt('The button reaches D2.', "Buton D2'ye ulasiyor."),
          failText: lt('Connect the button signal side to D2.', "Butonun sinyal tarafini D2'ye bagla."),
        },
        {
          id: 'alarm-resistor-ground',
          type: 'connection',
          from: { component: 'res1', pin: 'pin2' },
          to: { component: 'arduino', pin: 'GND' },
          passText: lt('The pull-down resistor is grounded.', 'Pull-down direnc topraga bagli.'),
          failText: lt('Ground the pull-down resistor.', 'Pull-down direnci topraga bagla.'),
        },
      ],
      solutionProject: {
        boardType: 'uno',
        code: EMPTY_SKETCH,
        components: [
          { ref: 'buzzer1', type: 'buzzer', x: 296, y: 244 },
          { ref: 'button1', type: 'button', x: 264, y: 310 },
          { ref: 'res1', type: 'resistor', x: 214, y: 352, properties: { resistance: 10000 } },
        ],
        wires: [
          { from: { component: 'arduino', pin: 'D8' }, to: { component: 'buzzer1', pin: 'positive' }, color: '#e74c3c' },
          { from: { component: 'buzzer1', pin: 'negative' }, to: { component: 'arduino', pin: 'GND' }, color: '#2c3e50' },
          { from: { component: 'arduino', pin: '5V' }, to: { component: 'button1', pin: 'pin1' }, color: '#e67e22' },
          { from: { component: 'button1', pin: 'pin2' }, to: { component: 'arduino', pin: 'D2' }, color: '#3498db' },
          { from: { component: 'button1', pin: 'pin2' }, to: { component: 'res1', pin: 'pin1' }, color: '#f1c40f' },
          { from: { component: 'res1', pin: 'pin2' }, to: { component: 'arduino', pin: 'GND' }, color: '#2c3e50' },
        ],
      },
    },
    {
      id: 'alarm-code',
      title: lt('Trigger the alarm', 'Alarmi tetikle'),
      instruction: lt(
        'Read D2 and turn the buzzer on when the button is active.',
        "D2'yi oku ve buton aktifken buzzer'i calistir."
      ),
      hint: lt(
        'Use pinMode for D2 and D8, read the button with digitalRead, then drive the buzzer with digitalWrite.',
        "D2 ve D8 icin pinMode kullan, butonu digitalRead ile oku ve ardindan buzzer'i digitalWrite ile sur."
      ),
      explanation: lt(
        "This is a compact example of 'read input, decide, drive output', which is the heart of embedded programming.",
        "Bu, gomulu programlamanin ozu olan 'girisi oku, karar ver, cikisi sur' akisinin kisa bir ornegidir."
      ),
      success: lt('Buzzer alarm lesson complete.', 'Buzzer alarmi dersi tamamlandi.'),
      checks: [
        {
          id: 'alarm-pinmodes',
          type: 'code',
          regex: true,
          patterns: [
            'pinMode\\s*\\(\\s*2\\s*,\\s*INPUT\\s*\\)',
            'pinMode\\s*\\(\\s*8\\s*,\\s*OUTPUT\\s*\\)',
          ],
          passText: lt('Input and output pins are configured.', 'Giris ve cikis pinleri ayarlanmis.'),
          failText: lt('Set D2 as INPUT and D8 as OUTPUT.', "D2'yi INPUT ve D8'i OUTPUT yap."),
        },
        {
          id: 'alarm-read',
          type: 'code',
          regex: true,
          patterns: ['digitalRead\\s*\\(\\s*(?:2|buttonPin)\\s*\\)'],
          passText: lt('The sketch reads the button.', 'Kod butonu okuyor.'),
          failText: lt('Use digitalRead(2) for the button.', 'Buton icin digitalRead(2) kullan.'),
        },
        {
          id: 'alarm-drive',
          type: 'code',
          regex: true,
          patterns: ['digitalWrite\\s*\\(\\s*(?:8|buzzerPin)\\s*,'],
          passText: lt('The sketch drives the buzzer pin.', 'Kod buzzer pinini suruyor.'),
          failText: lt('Use digitalWrite on D8 to control the buzzer.', "Buzzer'i kontrol etmek icin D8 uzerinde digitalWrite kullan."),
        },
      ],
      solutionProject: {
        boardType: 'uno',
        code: `const int buzzerPin = 8;
const int buttonPin = 2;

void setup() {
  pinMode(buttonPin, INPUT);
  pinMode(buzzerPin, OUTPUT);
}

void loop() {
  int alarmState = digitalRead(buttonPin);
  digitalWrite(buzzerPin, alarmState);
  delay(50);
}
`,
        components: [
          { ref: 'buzzer1', type: 'buzzer', x: 296, y: 244 },
          { ref: 'button1', type: 'button', x: 264, y: 310 },
          { ref: 'res1', type: 'resistor', x: 214, y: 352, properties: { resistance: 10000 } },
        ],
        wires: [
          { from: { component: 'arduino', pin: 'D8' }, to: { component: 'buzzer1', pin: 'positive' }, color: '#e74c3c' },
          { from: { component: 'buzzer1', pin: 'negative' }, to: { component: 'arduino', pin: 'GND' }, color: '#2c3e50' },
          { from: { component: 'arduino', pin: '5V' }, to: { component: 'button1', pin: 'pin1' }, color: '#e67e22' },
          { from: { component: 'button1', pin: 'pin2' }, to: { component: 'arduino', pin: 'D2' }, color: '#3498db' },
          { from: { component: 'button1', pin: 'pin2' }, to: { component: 'res1', pin: 'pin1' }, color: '#f1c40f' },
          { from: { component: 'res1', pin: 'pin2' }, to: { component: 'arduino', pin: 'GND' }, color: '#2c3e50' },
        ],
      },
    },
  ],
};





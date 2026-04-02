import type { Lesson } from './types';
import { EMPTY_SKETCH, lt } from './catalogUtils';

export const buttonInputLesson: Lesson = {
  id: 'button-input',
  title: lt('Button Input', 'Buton Girisi'),
  description: lt(
    'Create a basic button input circuit and print the button state to the serial monitor.',
    'Temel bir buton giris devresi kur ve buton durumunu seri ekrana yazdir.'
  ),
  outcome: lt(
    'You will learn digital input wiring, pull-down logic, and Serial.begin usage.',
    'Dijital giris kablolamasini, pull-down mantigini ve Serial.begin kullanimini ogreneceksin.'
  ),
  estimatedMinutes: 10,
  difficulty: 'starter',
  boardType: 'uno',
  allowedComponents: ['button', 'resistor'],
  starterProject: {
    boardType: 'uno',
    code: EMPTY_SKETCH,
    components: [],
    wires: [],
  },
  steps: [
    {
      id: 'add-button-parts',
      title: lt('Add the button parts', 'Buton parcalarini ekle'),
      instruction: lt(
        'Add one push button and one resistor.',
        'Bir adet buton ve bir adet direnc ekle.'
      ),
      hint: lt(
        'This lesson only needs a button and a resistor on the canvas.',
        'Bu derste tuvalde yalnizca bir buton ve bir direnc olmali.'
      ),
      explanation: lt(
        'The resistor will keep the input stable when the button is not pressed.',
        'Direnc, butona basilmadiginda girisin kararli kalmasini saglar.'
      ),
      success: lt(
        'Good. Your input parts are on the board.',
        'Guzel. Giris parcalarin hazir.'
      ),
      checks: [
        {
          id: 'button-present',
          type: 'component',
          componentType: 'button',
          ref: 'button1',
          passText: lt('Button added.', 'Buton eklendi.'),
          failText: lt('Add one push button.', 'Bir adet buton ekle.'),
        },
        {
          id: 'button-resistor-present',
          type: 'component',
          componentType: 'resistor',
          ref: 'res1',
          passText: lt('Pull-down resistor added.', 'Pull-down direnc eklendi.'),
          failText: lt('Add one resistor for the input line.', 'Giris hatti icin bir direnc ekle.'),
        },
      ],
      solutionProject: {
        boardType: 'uno',
        code: EMPTY_SKETCH,
        components: [
          { ref: 'button1', type: 'button', x: 262, y: 278 },
          {
            ref: 'res1',
            type: 'resistor',
            x: 208,
            y: 322,
            properties: { resistance: 10000 },
          },
        ],
        wires: [],
      },
    },
    {
      id: 'wire-button',
      title: lt('Wire a digital input', 'Dijital girisi bagla'),
      instruction: lt(
        'Wire 5V to the button, route the same button side to D2, and use the resistor as a pull-down to GND.',
        "5V'u butona bagla, ayni buton tarafini D2'ye gotur ve direnci GND'ye pull-down olarak kullan."
      ),
      hint: lt(
        'The input node should touch D2, one button leg, and one side of the resistor.',
        "Giris dugumu D2'ye, butonun bir bacagina ve direncin bir ucuna temas etmeli."
      ),
      explanation: lt(
        'Without a pull-down resistor, the input can float. The resistor keeps D2 at LOW until the button ties it to 5V.',
        "Pull-down direnc olmadan giris bosta kalabilir. Direnc, buton 5V'a baglayana kadar D2 pinini LOW tutar."
      ),
      success: lt(
        'Great. The input node now has power, signal, and ground reference.',
        'Harika. Giris dugumunde artik guc, sinyal ve toprak referansi var.'
      ),
      checks: [
        {
          id: 'five-to-button',
          type: 'connection',
          from: { component: 'arduino', pin: '5V' },
          to: { component: 'button1', pin: 'pin1' },
          passText: lt('5V reaches the button.', '5V butona ulasiyor.'),
          failText: lt('Wire 5V to one side of the button.', "5V'u butonun bir tarafina bagla."),
        },
        {
          id: 'button-to-d2',
          type: 'connection',
          from: { component: 'button1', pin: 'pin2' },
          to: { component: 'arduino', pin: 'D2' },
          passText: lt('Button is connected to D2.', "Buton D2'ye bagli."),
          failText: lt('Connect the signal side of the button to D2.', "Butonun sinyal tarafini D2'ye bagla."),
          hintText: lt('You wired the button, but the signal is not reaching D2 yet.', "Buton bagli ama sinyal henuz D2'ye ulasmiyor."),
        },
        {
          id: 'button-to-resistor',
          type: 'connection',
          from: { component: 'button1', pin: 'pin2' },
          to: { component: 'res1', pin: 'pin1' },
          passText: lt('The input node reaches the resistor.', 'Giris dugumu dirence gidiyor.'),
          failText: lt('Connect the D2 button side to the resistor.', "D2'ye giden buton tarafini dirence bagla."),
        },
        {
          id: 'resistor-to-ground',
          type: 'connection',
          from: { component: 'res1', pin: 'pin2' },
          to: { component: 'arduino', pin: 'GND' },
          passText: lt('Pull-down resistor is grounded.', 'Pull-down direnc topraga bagli.'),
          failText: lt('Ground the free side of the resistor.', 'Direncin bosta kalan ucunu topraga bagla.'),
        },
      ],
      solutionProject: {
        boardType: 'uno',
        code: EMPTY_SKETCH,
        components: [
          { ref: 'button1', type: 'button', x: 262, y: 278 },
          {
            ref: 'res1',
            type: 'resistor',
            x: 208,
            y: 322,
            properties: { resistance: 10000 },
          },
        ],
        wires: [
          { from: { component: 'arduino', pin: '5V' }, to: { component: 'button1', pin: 'pin1' }, color: '#e67e22' },
          { from: { component: 'button1', pin: 'pin2' }, to: { component: 'arduino', pin: 'D2' }, color: '#3498db' },
          { from: { component: 'button1', pin: 'pin2' }, to: { component: 'res1', pin: 'pin1' }, color: '#f1c40f' },
          { from: { component: 'res1', pin: 'pin2' }, to: { component: 'arduino', pin: 'GND' }, color: '#2c3e50' },
        ],
      },
    },
    {
      id: 'code-button',
      title: lt('Read the button', 'Butonu oku'),
      instruction: lt(
        'Initialize serial, read D2, and print the button state repeatedly.',
        "Seri haberlesmeyi baslat, D2'yi oku ve buton durumunu surekli yazdir."
      ),
      hint: lt(
        'Look for pinMode(2, INPUT), Serial.begin(9600), digitalRead(2), and Serial.println.',
        'pinMode(2, INPUT), Serial.begin(9600), digitalRead(2) ve Serial.println kullan.'
      ),
      explanation: lt(
        'A good beginner input sketch makes the pin mode explicit and prints the reading so you can debug with the serial monitor.',
        'Iyi bir baslangic seviyesi giris kodu, pin modunu acikca ayarlar ve okumayi seri ekrana yazar.'
      ),
      success: lt('Button input lesson complete.', 'Buton girisi dersi tamamlandi.'),
      checks: [
        {
          id: 'button-pinmode',
          type: 'code',
          regex: true,
          patterns: ['pinMode\\s*\\(\\s*2\\s*,\\s*INPUT\\s*\\)'],
          passText: lt('D2 is configured as INPUT.', 'D2 INPUT olarak ayarlanmis.'),
          failText: lt('Configure D2 as INPUT in setup().', 'setup() icinde D2 pinini INPUT olarak ayarla.'),
        },
        {
          id: 'button-serial-begin',
          type: 'code',
          regex: true,
          patterns: ['Serial\\.begin\\s*\\(\\s*9600\\s*\\)'],
          passText: lt('Serial.begin is ready.', 'Serial.begin hazir.'),
          failText: lt('Start serial communication with Serial.begin(9600).', 'Serial.begin(9600) ile seri haberlesmeyi baslat.'),
        },
        {
          id: 'button-digital-read',
          type: 'code',
          regex: true,
          patterns: ['digitalRead\\s*\\(\\s*(?:2|buttonPin)\\s*\\)'],
          passText: lt('The sketch reads D2.', 'Kod D2 pinini okuyor.'),
          failText: lt('Use digitalRead(2) to read the button.', 'Butonu okumak icin digitalRead(2) kullan.'),
        },
        {
          id: 'button-serial-print',
          type: 'code',
          regex: true,
          patterns: ['Serial\\.(?:print|println)\\s*\\('],
          passText: lt('The button state is printed.', 'Buton durumu yazdiriliyor.'),
          failText: lt('Print the button value to serial output.', 'Buton degerini seri ciktiya yazdir.'),
        },
      ],
      solutionProject: {
        boardType: 'uno',
        code: `const int buttonPin = 2;

void setup() {
  pinMode(buttonPin, INPUT);
  Serial.begin(9600);
}

void loop() {
  int buttonState = digitalRead(buttonPin);
  Serial.println(buttonState);
  delay(150);
}
`,
        components: [
          { ref: 'button1', type: 'button', x: 262, y: 278 },
          {
            ref: 'res1',
            type: 'resistor',
            x: 208,
            y: 322,
            properties: { resistance: 10000 },
          },
        ],
        wires: [
          { from: { component: 'arduino', pin: '5V' }, to: { component: 'button1', pin: 'pin1' }, color: '#e67e22' },
          { from: { component: 'button1', pin: 'pin2' }, to: { component: 'arduino', pin: 'D2' }, color: '#3498db' },
          { from: { component: 'button1', pin: 'pin2' }, to: { component: 'res1', pin: 'pin1' }, color: '#f1c40f' },
          { from: { component: 'res1', pin: 'pin2' }, to: { component: 'arduino', pin: 'GND' }, color: '#2c3e50' },
        ],
      },
    },
  ],
};





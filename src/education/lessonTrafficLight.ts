import type { Lesson } from './types';
import { EMPTY_SKETCH, lt } from './catalogUtils';

export const trafficLightLesson: Lesson = {
  id: 'traffic-light',
  title: lt('Traffic Light', 'Trafik Lambasi'),
  description: lt(
    'Build a three-LED traffic light and animate it with a timing sequence.',
    "Uc LED'li bir trafik lambasi kur ve zamanlamali bir sira ile calistir."
  ),
  outcome: lt(
    'You will practice multi-output wiring and repeated timing patterns.',
    'Coklu cikis kablolamasi ve tekrar eden zamanlama desenleri uzerinde calisacaksin.'
  ),
  estimatedMinutes: 14,
  difficulty: 'starter',
  boardType: 'uno',
  allowedComponents: ['led', 'resistor'],
  starterProject: {
    boardType: 'uno',
    code: EMPTY_SKETCH,
    components: [],
    wires: [],
  },
  steps: [
    {
      id: 'traffic-parts',
      title: lt('Add three LEDs and resistors', 'Uc LED ve direnc ekle'),
      instruction: lt(
        'Add red, yellow, and green LEDs plus one resistor for each LED.',
        'Kirmizi, sari ve yesil LED ile her LED icin bir direnc ekle.'
      ),
      hint: lt('You should end up with 3 LEDs and 3 resistors.', 'Sonunda 3 LED ve 3 direnc olmali.'),
      explanation: lt(
        'Each traffic light channel should have its own resistor and output pin.',
        'Her trafik lambasi kanali kendi direncine ve cikis pinine sahip olmali.'
      ),
      success: lt('All traffic light parts are in place.', 'Tum trafik lambasi parcalari hazir.'),
      checks: [
        {
          id: 'traffic-leds',
          type: 'component',
          componentType: 'led',
          minimum: 3,
          passText: lt('Three LEDs found.', 'Uc LED bulundu.'),
          failText: lt('Add three LEDs for red, yellow, and green.', 'Kirmizi, sari ve yesil icin uc LED ekle.'),
        },
        {
          id: 'traffic-resistors',
          type: 'component',
          componentType: 'resistor',
          minimum: 3,
          passText: lt('Three resistors found.', 'Uc direnc bulundu.'),
          failText: lt('Add one resistor for each LED.', 'Her LED icin bir direnc ekle.'),
        },
      ],
      solutionProject: {
        boardType: 'uno',
        code: EMPTY_SKETCH,
        components: [
          { ref: 'ledRed', type: 'led', x: 286, y: 252, properties: { color: 'red' } },
          { ref: 'ledYellow', type: 'led', x: 286, y: 294, properties: { color: 'yellow' } },
          { ref: 'ledGreen', type: 'led', x: 286, y: 336, properties: { color: 'green' } },
          { ref: 'resRed', type: 'resistor', x: 234, y: 252, properties: { resistance: 220 } },
          { ref: 'resYellow', type: 'resistor', x: 234, y: 294, properties: { resistance: 220 } },
          { ref: 'resGreen', type: 'resistor', x: 234, y: 336, properties: { resistance: 220 } },
        ],
        wires: [],
      },
    },
    {
      id: 'traffic-wire',
      title: lt('Wire three output channels', 'Uc cikis kanalini bagla'),
      instruction: lt(
        'Use D10 for red, D9 for yellow, and D8 for green. Each LED still needs GND on the cathode side.',
        "Kirmizi icin D10, sari icin D9 ve yesil icin D8 kullan. Her LED'in katot tarafi yine GND'ye gitmeli."
      ),
      hint: lt(
        'Think of it as three copies of the blink circuit sharing ground.',
        'Bunu ortak topragi paylasan uc blink devresi gibi dusun.'
      ),
      explanation: lt(
        'Splitting the circuit into repeated channels makes larger projects easier to reason about.',
        'Devreyi tekrar eden kanallara bolmek, daha buyuk projeleri anlamayi kolaylastirir.'
      ),
      success: lt('All three traffic light channels are wired.', 'Uc trafik isigi kanali da baglandi.'),
      checks: [
        {
          id: 'traffic-red',
          type: 'connection',
          from: { component: 'arduino', pin: 'D10' },
          to: { component: 'resRed', pin: 'pin1' },
          passText: lt('Red channel starts at D10.', "Kirmizi kanal D10'dan basliyor."),
          failText: lt('Connect D10 to the red resistor.', "D10'u kirmizi dirence bagla."),
        },
        {
          id: 'traffic-red-led',
          type: 'connection',
          from: { component: 'resRed', pin: 'pin2' },
          to: { component: 'ledRed', pin: 'anode' },
          passText: lt('Red LED is in series.', 'Kirmizi LED seri hatta.'),
          failText: lt('Connect the red resistor to the red LED anode.', 'Kirmizi direnci kirmizi LED anoduna bagla.'),
        },
        {
          id: 'traffic-red-ground',
          type: 'connection',
          from: { component: 'ledRed', pin: 'cathode' },
          to: { component: 'arduino', pin: 'GND' },
          passText: lt('Red LED is grounded.', 'Kirmizi LED topraga bagli.'),
          failText: lt('Ground the red LED cathode.', 'Kirmizi LED katodunu topraga bagla.'),
        },
        {
          id: 'traffic-yellow',
          type: 'connection',
          from: { component: 'arduino', pin: 'D9' },
          to: { component: 'resYellow', pin: 'pin1' },
          passText: lt('Yellow channel starts at D9.', "Sari kanal D9'dan basliyor."),
          failText: lt('Connect D9 to the yellow resistor.', "D9'u sari dirence bagla."),
        },
        {
          id: 'traffic-green',
          type: 'connection',
          from: { component: 'arduino', pin: 'D8' },
          to: { component: 'resGreen', pin: 'pin1' },
          passText: lt('Green channel starts at D8.', "Yesil kanal D8'den basliyor."),
          failText: lt('Connect D8 to the green resistor.', "D8'i yesil dirence bagla."),
        },
      ],
      solutionProject: {
        boardType: 'uno',
        code: EMPTY_SKETCH,
        components: [
          { ref: 'ledRed', type: 'led', x: 286, y: 252, properties: { color: 'red' } },
          { ref: 'ledYellow', type: 'led', x: 286, y: 294, properties: { color: 'yellow' } },
          { ref: 'ledGreen', type: 'led', x: 286, y: 336, properties: { color: 'green' } },
          { ref: 'resRed', type: 'resistor', x: 234, y: 252, properties: { resistance: 220 } },
          { ref: 'resYellow', type: 'resistor', x: 234, y: 294, properties: { resistance: 220 } },
          { ref: 'resGreen', type: 'resistor', x: 234, y: 336, properties: { resistance: 220 } },
        ],
        wires: [
          { from: { component: 'arduino', pin: 'D10' }, to: { component: 'resRed', pin: 'pin1' }, color: '#e74c3c' },
          { from: { component: 'resRed', pin: 'pin2' }, to: { component: 'ledRed', pin: 'anode' }, color: '#ff7675' },
          { from: { component: 'ledRed', pin: 'cathode' }, to: { component: 'arduino', pin: 'GND' }, color: '#2c3e50' },
          { from: { component: 'arduino', pin: 'D9' }, to: { component: 'resYellow', pin: 'pin1' }, color: '#f1c40f' },
          { from: { component: 'resYellow', pin: 'pin2' }, to: { component: 'ledYellow', pin: 'anode' }, color: '#ffe066' },
          { from: { component: 'ledYellow', pin: 'cathode' }, to: { component: 'arduino', pin: 'GND' }, color: '#2c3e50' },
          { from: { component: 'arduino', pin: 'D8' }, to: { component: 'resGreen', pin: 'pin1' }, color: '#27ae60' },
          { from: { component: 'resGreen', pin: 'pin2' }, to: { component: 'ledGreen', pin: 'anode' }, color: '#55efc4' },
          { from: { component: 'ledGreen', pin: 'cathode' }, to: { component: 'arduino', pin: 'GND' }, color: '#2c3e50' },
        ],
      },
    },
    {
      id: 'traffic-code',
      title: lt('Sequence the lights', 'Isiklari sirala'),
      instruction: lt(
        'Set D10, D9, and D8 as outputs, then write a red -> yellow -> green timing loop.',
        "D10, D9 ve D8'i cikis yap, sonra kirmizi -> sari -> yesil zaman siralamasi yaz."
      ),
      hint: lt(
        'You need three pinMode calls, digitalWrite calls for each color, and delays between phases.',
        'Uc pinMode, her renk icin digitalWrite ve asamalar arasinda delay kullan.'
      ),
      explanation: lt(
        'Traffic lights are a good way to practice repeated states and transitions inside loop().',
        'Trafik lambalari, loop() icinde tekrar eden durumlar ve gecisler calismak icin iyidir.'
      ),
      success: lt('Traffic light lesson complete.', 'Trafik lambasi dersi tamamlandi.'),
      checks: [
        {
          id: 'traffic-pinmodes',
          type: 'code',
          regex: true,
          patterns: [
            'pinMode\\s*\\(\\s*10\\s*,\\s*OUTPUT\\s*\\)',
            'pinMode\\s*\\(\\s*9\\s*,\\s*OUTPUT\\s*\\)',
            'pinMode\\s*\\(\\s*8\\s*,\\s*OUTPUT\\s*\\)',
          ],
          passText: lt('All traffic pins are OUTPUT.', 'Tum trafik pinleri OUTPUT.'),
          failText: lt('Set pins 10, 9, and 8 as OUTPUT.', '10, 9 ve 8 pinlerini OUTPUT yap.'),
        },
        {
          id: 'traffic-writes',
          type: 'code',
          regex: true,
          patterns: ['digitalWrite\\s*\\(\\s*10\\s*,', 'digitalWrite\\s*\\(\\s*9\\s*,', 'digitalWrite\\s*\\(\\s*8\\s*,'],
          passText: lt('The sketch controls all three channels.', 'Kod uc kanalin hepsini kontrol ediyor.'),
          failText: lt('Drive each traffic LED with digitalWrite.', "Her trafik LED'ini digitalWrite ile sur."),
        },
        {
          id: 'traffic-delays',
          type: 'code',
          regex: true,
          patterns: ['delay\\s*\\(\\s*\\d+\\s*\\)'],
          passText: lt('Timing delays found.', 'Zamanlama gecikmeleri bulundu.'),
          failText: lt('Add delays between traffic light states.', 'Trafik isigi durumlari arasina delay ekle.'),
        },
        {
          id: 'traffic-run',
          type: 'simulation',
          passText: lt('Simulation is running.', 'Simulasyon calisiyor.'),
          failText: lt('Start the simulation to watch the light sequence.', 'Isik sirasini gormek icin simulasyonu baslat.'),
        },
      ],
      solutionProject: {
        boardType: 'uno',
        code: `const int redPin = 10;
const int yellowPin = 9;
const int greenPin = 8;

void setup() {
  pinMode(redPin, OUTPUT);
  pinMode(yellowPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
}

void loop() {
  digitalWrite(redPin, HIGH);
  digitalWrite(yellowPin, LOW);
  digitalWrite(greenPin, LOW);
  delay(1200);

  digitalWrite(redPin, LOW);
  digitalWrite(yellowPin, HIGH);
  digitalWrite(greenPin, LOW);
  delay(450);

  digitalWrite(redPin, LOW);
  digitalWrite(yellowPin, LOW);
  digitalWrite(greenPin, HIGH);
  delay(1200);
}
`,
        components: [
          { ref: 'ledRed', type: 'led', x: 286, y: 252, properties: { color: 'red' } },
          { ref: 'ledYellow', type: 'led', x: 286, y: 294, properties: { color: 'yellow' } },
          { ref: 'ledGreen', type: 'led', x: 286, y: 336, properties: { color: 'green' } },
          { ref: 'resRed', type: 'resistor', x: 234, y: 252, properties: { resistance: 220 } },
          { ref: 'resYellow', type: 'resistor', x: 234, y: 294, properties: { resistance: 220 } },
          { ref: 'resGreen', type: 'resistor', x: 234, y: 336, properties: { resistance: 220 } },
        ],
        wires: [
          { from: { component: 'arduino', pin: 'D10' }, to: { component: 'resRed', pin: 'pin1' }, color: '#e74c3c' },
          { from: { component: 'resRed', pin: 'pin2' }, to: { component: 'ledRed', pin: 'anode' }, color: '#ff7675' },
          { from: { component: 'ledRed', pin: 'cathode' }, to: { component: 'arduino', pin: 'GND' }, color: '#2c3e50' },
          { from: { component: 'arduino', pin: 'D9' }, to: { component: 'resYellow', pin: 'pin1' }, color: '#f1c40f' },
          { from: { component: 'resYellow', pin: 'pin2' }, to: { component: 'ledYellow', pin: 'anode' }, color: '#ffe066' },
          { from: { component: 'ledYellow', pin: 'cathode' }, to: { component: 'arduino', pin: 'GND' }, color: '#2c3e50' },
          { from: { component: 'arduino', pin: 'D8' }, to: { component: 'resGreen', pin: 'pin1' }, color: '#27ae60' },
          { from: { component: 'resGreen', pin: 'pin2' }, to: { component: 'ledGreen', pin: 'anode' }, color: '#55efc4' },
          { from: { component: 'ledGreen', pin: 'cathode' }, to: { component: 'arduino', pin: 'GND' }, color: '#2c3e50' },
        ],
      },
    },
  ],
};





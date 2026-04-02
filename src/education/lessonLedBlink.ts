import type { Lesson } from './types';
import { EMPTY_SKETCH, lt } from './catalogUtils';

export const ledBlinkLesson: Lesson = {
  id: 'led-blink',
  title: lt('LED Blink', 'LED Blink'),
  description: lt(
    'Build the classic blink circuit with one LED, one resistor, and the Arduino Uno.',
    'Bir LED, bir direnc ve Arduino Uno ile klasik blink devresini kur.'
  ),
  outcome: lt(
    'You will learn basic output wiring, safe current limiting, and the pinMode/digitalWrite loop.',
    'Temel cikis kablolamasini, akim sinirlamayi ve pinMode/digitalWrite dongusunu ogreneceksin.'
  ),
  estimatedMinutes: 8,
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
      id: 'add-led-parts',
      title: lt('Add the parts', 'Parcalari ekle'),
      instruction: lt(
        'Add one LED and one resistor to the breadboard area.',
        'Breadboard alanina bir LED ve bir direnc ekle.'
      ),
      hint: lt(
        'Use only two parts for this step: LED and resistor.',
        'Bu adimda sadece iki parca kullan: LED ve direnc.'
      ),
      explanation: lt(
        'The resistor protects the LED from too much current. Beginners often forget it, so this step checks for both parts.',
        "Direnc, LED'i fazla akimdan korur. Yeni baslayanlar bunu sik unuttugu icin bu adim iki parcayi da kontrol eder."
      ),
      success: lt(
        'Nice. The LED and resistor are ready for wiring.',
        'Guzel. LED ve direnc kablolama icin hazir.'
      ),
      checks: [
        {
          id: 'led-present',
          type: 'component',
          componentType: 'led',
          ref: 'led1',
          passText: lt('LED added.', 'LED eklendi.'),
          failText: lt('Add one LED to the canvas first.', 'Once tuvale bir LED ekle.'),
        },
        {
          id: 'resistor-present',
          type: 'component',
          componentType: 'resistor',
          ref: 'res1',
          passText: lt('Resistor added.', 'Direnc eklendi.'),
          failText: lt('Add a resistor so the LED is protected.', 'LED korunmasi icin bir direnc ekle.'),
        },
      ],
      solutionProject: {
        boardType: 'uno',
        code: EMPTY_SKETCH,
        components: [
          { ref: 'led1', type: 'led', x: 262, y: 278 },
          {
            ref: 'res1',
            type: 'resistor',
            x: 214,
            y: 278,
            properties: { resistance: 220 },
          },
        ],
        wires: [],
      },
    },
    {
      id: 'wire-led',
      title: lt('Wire the LED safely', "LED'i guvenli sekilde bagla"),
      instruction: lt(
        'Connect D13 to the resistor, the resistor to the LED anode, and the LED cathode to GND.',
        "D13 pinini dirence, direnci LED anoda ve LED katodu GND'ye bagla."
      ),
      hint: lt(
        'Think of the path as D13 -> resistor -> LED -> GND.',
        'Yolu D13 -> direnc -> LED -> GND olarak dusun.'
      ),
      explanation: lt(
        'A correct blink circuit needs a complete path from the output pin to ground. The resistor should sit in series with the LED.',
        'Dogru bir blink devresi, cikis pininden topraga giden tam bir yol ister. Direnc LED ile seri durmalidir.'
      ),
      success: lt(
        'Perfect. The LED path is fully wired.',
        'Harika. LED hatti tamamen baglandi.'
      ),
      checks: [
        {
          id: 'd13-to-resistor',
          type: 'connection',
          from: { component: 'arduino', pin: 'D13' },
          to: { component: 'res1', pin: 'pin1' },
          passText: lt('D13 reaches the resistor.', 'D13 dirence ulasiyor.'),
          failText: lt('Wire D13 to one side of the resistor.', 'D13 pinini direncin bir ucuna bagla.'),
          hintText: lt('Something is connected near D13, but not to the resistor input yet.', 'D13 yakininda baglanti var ama henuz direncin girisine gitmiyor.'),
        },
        {
          id: 'resistor-to-led',
          type: 'connection',
          from: { component: 'res1', pin: 'pin2' },
          to: { component: 'led1', pin: 'anode' },
          passText: lt('Resistor feeds the LED anode.', 'Direnc LED anoduna gidiyor.'),
          failText: lt('Connect the free side of the resistor to the LED anode.', 'Direncin bosta kalan ucunu LED anoduna bagla.'),
          hintText: lt('The LED is wired, but the anode is not fed from the resistor yet.', 'LED bagli gorunuyor ama anodu henuz direncten beslenmiyor.'),
        },
        {
          id: 'led-to-ground',
          type: 'connection',
          from: { component: 'led1', pin: 'cathode' },
          to: { component: 'arduino', pin: 'GND' },
          passText: lt('LED cathode is grounded.', 'LED katodu topraga bagli.'),
          failText: lt('Connect the LED cathode to GND.', "LED katodunu GND'ye bagla."),
          hintText: lt('The LED has a wire, but its cathode is not grounded yet.', "LED'de kablo var ama katot henuz topraga gitmiyor."),
        },
      ],
      solutionProject: {
        boardType: 'uno',
        code: EMPTY_SKETCH,
        components: [
          { ref: 'led1', type: 'led', x: 262, y: 278 },
          {
            ref: 'res1',
            type: 'resistor',
            x: 214,
            y: 278,
            properties: { resistance: 220 },
          },
        ],
        wires: [
          { from: { component: 'arduino', pin: 'D13' }, to: { component: 'res1', pin: 'pin1' }, color: '#e74c3c' },
          { from: { component: 'res1', pin: 'pin2' }, to: { component: 'led1', pin: 'anode' }, color: '#f1c40f' },
          { from: { component: 'led1', pin: 'cathode' }, to: { component: 'arduino', pin: 'GND' }, color: '#2c3e50' },
        ],
      },
    },
    {
      id: 'code-led',
      title: lt('Write the blink sketch', 'Blink kodunu yaz'),
      instruction: lt(
        'Use pinMode on pin 13, then turn the LED on and off with a delay in loop().',
        "13 numarali pine pinMode uygula, sonra loop() icinde LED'i gecikmeli olarak yakip sondur."
      ),
      hint: lt(
        'You need pinMode(13, OUTPUT), digitalWrite, and delay.',
        'pinMode(13, OUTPUT), digitalWrite ve delay kullanman gerekiyor.'
      ),
      explanation: lt(
        'setup() prepares the pin once. loop() keeps repeating the HIGH/LOW pattern forever.',
        'setup() pini bir kez hazirlar. loop() ise HIGH/LOW desenini surekli tekrar eder.'
      ),
      success: lt(
        'Blink lesson complete. You built and ran your first output circuit.',
        'Blink dersi tamamlandi. Ilk cikis devreni kurup calistirdin.'
      ),
      checks: [
        {
          id: 'pinmode-output',
          type: 'code',
          regex: true,
          patterns: ['pinMode\\s*\\(\\s*(?:13|LED_BUILTIN)\\s*,\\s*OUTPUT\\s*\\)'],
          passText: lt('The LED pin is configured as OUTPUT.', 'LED pini OUTPUT olarak ayarlanmis.'),
          failText: lt('Configure pin 13 as OUTPUT in setup().', 'setup() icinde 13 pinini OUTPUT olarak ayarla.'),
        },
        {
          id: 'digitalwrite-used',
          type: 'code',
          regex: true,
          patterns: [
            'digitalWrite\\s*\\(\\s*(?:13|LED_BUILTIN)\\s*,\\s*HIGH\\s*\\)',
            'digitalWrite\\s*\\(\\s*(?:13|LED_BUILTIN)\\s*,\\s*LOW\\s*\\)',
          ],
          passText: lt('The sketch toggles the LED pin.', 'Kod LED pinini degistiriyor.'),
          failText: lt('Use digitalWrite to drive the LED HIGH and LOW.', "LED'i HIGH ve LOW yapmak icin digitalWrite kullan."),
          hintText: lt('You started the output logic, but both HIGH and LOW writes are not there yet.', 'Cikis mantigi baslamis ama hem HIGH hem LOW yazimi henuz yok.'),
        },
        {
          id: 'delay-used',
          type: 'code',
          regex: true,
          patterns: ['delay\\s*\\(\\s*\\d+\\s*\\)'],
          passText: lt('Delay found.', 'Gecikme bulundu.'),
          failText: lt('Add a delay so the blink is visible.', 'Blink gorunur olsun diye bir gecikme ekle.'),
        },
        {
          id: 'simulation-running',
          type: 'simulation',
          passText: lt('Simulation is running.', 'Simulasyon calisiyor.'),
          failText: lt('Start the simulation to confirm the blink loop.', 'Blink dongusunu dogrulamak icin simulasyonu baslat.'),
          hintText: lt('Your wiring and code look ready. Now click Start Simulation.', 'Baglanti ve kod hazir gorunuyor. Simdi Simulasyonu Baslat dugmesine bas.'),
        },
      ],
      solutionProject: {
        boardType: 'uno',
        code: `void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}
`,
        components: [
          { ref: 'led1', type: 'led', x: 262, y: 278 },
          {
            ref: 'res1',
            type: 'resistor',
            x: 214,
            y: 278,
            properties: { resistance: 220 },
          },
        ],
        wires: [
          { from: { component: 'arduino', pin: 'D13' }, to: { component: 'res1', pin: 'pin1' }, color: '#e74c3c' },
          { from: { component: 'res1', pin: 'pin2' }, to: { component: 'led1', pin: 'anode' }, color: '#f1c40f' },
          { from: { component: 'led1', pin: 'cathode' }, to: { component: 'arduino', pin: 'GND' }, color: '#2c3e50' },
        ],
      },
    },
  ],
};





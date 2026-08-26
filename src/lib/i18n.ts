import type { ComponentType } from '../models/types';

export type AppLanguage = 'en' | 'tr';

export const LANGUAGE_OPTIONS: Array<{ value: AppLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'tr', label: 'Türkçe' },
];

const UI_STRINGS = {
  en: {
    appTitle: 'OtisIDE',
    componentsPanel: 'Components',
    searchComponents: 'Search Components',
    searchComponentsPlaceholder: 'Search components...',
    noComponentsFound: 'No matching components found.',
    propertiesTab: 'Properties',
    aiAssistantTab: 'AI Assistant',
    save: 'Save',
    open: 'Open',
    newProject: 'New',
    exportPng: 'Export PNG',
    selectTool: 'Select',
    wireTool: 'Wire',
    panTool: 'Pan',
    deleteTool: 'Delete',
    selectToolTitle: 'Selection Tool (S)',
    wireToolTitle: 'Wire Tool (W) - click empty space to bend the cable',
    panToolTitle: 'Pan Tool (P)',
    deleteToolTitle: 'Delete Tool (D)',
    board: 'Board',
    selectBoard: 'Select controller board',
    usbIde: 'USB IDE',
    usbDevice: 'USB device',
    selectUsbDevice: 'Select device',
    noUsbDevice: 'No USB device',
    refreshPorts: 'Refresh ports',
    refreshPortsShort: 'Refresh',
    prepareIde: 'Prepare IDE',
    verifySketch: 'Verify',
    uploadSketch: 'Upload',
    uploadingSketch: 'Uploading...',
    ideReady: 'IDE ready',
    ideOffline: 'IDE offline',
    preparing: 'Preparing...',
    detectedBoard: 'Detected',
    language: 'Language',
    zoomReset: 'Reset zoom',
    startSimulation: 'Start Simulation',
    stopSimulation: 'Stop',
    running: 'Running',
    stopped: 'Stopped',
    clickOrDrag: 'Click or drag',
    arduinoCode: 'Arduino Code',
    serialMonitor: 'Serial Monitor',
    deviceConsole: 'Device Console',
    oscilloscope: 'Oscilloscope',
    clear: 'Clear',
    codePlaceholder: '// Write your Arduino sketch here...',
    serialWaiting: 'Waiting for serial output...',
    serialStartPrompt: 'Start the simulation to see serial output.',
    codeWorkspace: 'Code Workspace',
    serialFeed: 'Serial Feed',
    oscilloscopeHint:
      'Watch the CH1 waveform from a wired oscilloscope component in real time.',
    oscilloscopeAddPrompt:
      'Add an oscilloscope from the palette, then wire CH1 and GND to the circuit.',
    oscilloscopeConnectPrompt:
      'Wire the oscilloscope CH1 and GND pins to the circuit to start capturing.',
    oscilloscopeWaiting:
      'Simulation is running. Waiting for waveform updates from the oscilloscope...',
    deviceConsoleHint:
      'Watch real upload logs and USB serial output from the connected board.',
    deviceConsoleEmpty:
      'Prepare the IDE, upload a sketch, or open the monitor to see device logs here.',
    openMonitor: 'Open monitor',
    closeMonitor: 'Close monitor',
    monitorOpen: 'Monitor open',
    monitorClosed: 'Monitor closed',
    hardwarePrepareFailed: 'Hardware IDE could not be prepared.',
    hardwareScanFailed: 'USB devices could not be scanned.',
    serialMonitorFailed: 'Serial monitor could not be opened.',
    codeWorkspaceHint:
      'Edit your Arduino sketch with syntax highlighting and line numbers.',
    serialFeedHint:
      'Watch runtime logs and Serial.print output in one place.',
    lineCount: '{{count}} lines',
    charCount: '{{count}} chars',
    logCount: '{{count}} logs',
    sampleCount: '{{count}} samples',
    serialLive: 'Serial live',
    serialIdle: 'Serial idle',
    oscilloscopeLive: 'Scope live',
    oscilloscopeIdle: 'Scope idle',
    oscilloscopeOpen: 'Probe open',
    timeWindow: 'Time Window',
    selectComponentPrompt: 'Select a component\nor drag one from the palette',
    id: 'ID',
    componentName: 'Name',
    componentDescription: 'Description',
    position: 'Position',
    angle: 'Angle',
    values: 'Values',
    pins: 'Pins',
    deleteComponent: 'Delete Component',
    passive: 'Passive',
    active: 'Active',
    output: 'Output',
    sensor: 'Sensor',
    display: 'Display',
    other: 'Other',
    red: 'Red',
    green: 'Green',
    blue: 'Blue',
    yellow: 'Yellow',
    white: 'White',
    orange: 'Orange',
    commonCathode: 'Common Cathode',
    commonAnode: 'Common Anode',
    newChat: 'New chat',
    aiHistory: 'AI History',
    chats: '{{count}} chats',
    noMessagesYet: 'No messages yet',
    emptyMessage: 'Empty message',
    menu: 'Menu',
    settings: 'Settings',
    apiSettings: 'API settings',
    aiSettingsTitle: 'AI Settings',
    aiSettingsSubtitle: 'Manage provider and model details',
    back: 'Back',
    provider: 'Provider',
    apiKey: 'API Key',
    model: 'Model',
    customOption: 'Custom...',
    baseUrl: 'Base URL',
    providerHelp:
      'You can use Groq, OpenAI, Google Gemini, or an OpenAI-compatible service. Suggested default: {{provider}} / {{model}}',
    saveAndContinue: 'Save and Continue',
    historyEmptyTitle: 'No chat history yet',
    historyEmptyText:
      'Start a new chat to get help with circuit design, code, and wiring.',
    deleteConversation: 'Delete conversation',
    aiAssistantTitle: 'AI Circuit Assistant',
    aiAssistantIntro:
      'Describe your circuit and we can prepare the code and wiring together.',
    thinking: 'Thinking...',
    requestPlaceholder: 'Describe the circuit you want to build...',
    send: 'Send',
    errorPrefix: 'Error',
    historyTitleFallback: 'New chat',
    circuitEmpty: 'The circuit is empty - no components have been added yet.',
    currentCircuit: 'Current circuit:',
    componentsLabel: 'Components',
    wiresLabel: 'Wires',
    noWiresYet: 'No wires yet',
    boardLabel: 'Board',
    boardPinsLabel: 'Board pins',
    select: 'Select',
    startWire: 'Start wire',
    rotate90: 'Rotate 90deg',
    wireMode: 'Wire mode',
    deleteWire: 'Delete wire',
    chooseBoard: 'Choose board',
    switchToWireMode: 'Switch to wire mode',
    selectionTool: 'Selection tool',
    wireToolMenu: 'Wire tool',
    pan: 'Pan',
    undo: 'Undo',
    redo: 'Redo',
    openAIPanel: 'Open AI panel',
    detect: 'DETECT',
    idle: 'IDLE',
    alarm: 'ALARM',
    safe: 'SAFE',
    card: 'CARD',
    noCard: 'NO CARD',
    rxOn: 'RX ON',
    rxIdle: 'RX IDLE',
    sound: 'SOUND',
    quiet: 'QUIET',
    stepOn: 'STEP ON',
    stepIdle: 'STEP IDLE',
    txOn: 'TX ON',
    txIdle: 'TX IDLE',
    wifiOn: 'WIFI ON',
    wifiOff: 'WIFI OFF',
    gasPrefix: 'GAS',
    triggered: 'TRIGGER',
    openState: 'OPEN',
    projectFileName: 'circuit-project.json',
    projectFilterName: 'Circuit Project',
    invalidProjectFile: 'This file could not be read as an OtisIDE project.',
    saveProjectDialogTitle: 'Save Project',
    openProjectDialogTitle: 'Open Project',
    exportPngDialogTitle: 'Export as PNG',
    pngFileName: 'circuit.png',
    pngFilterName: 'PNG Image',
    multimeterVoltageMode: 'DC Voltage',
    multimeterCurrentMode: 'DC Current',
    multimeterResistanceMode: 'Resistance',
    multimeterContinuityMode: 'Continuity',
    multimeterReady: 'Ready',
    multimeterOpen: 'Open',
    multimeterBeep: 'Beep',
    updateBadge: 'Update',
    updateAvailableTitle: 'A new version of OtisIDE is available',
    updateReadyTitle: 'Update ready to install',
    updateVersionLine: 'Installed: {{current}} · New: {{next}}',
    updateNotes: 'What is new',
    updateNow: 'Update now',
    updateLater: 'Later',
    updateBackground: 'Continue in background',
    updateReadyText:
      'The update has been downloaded. OtisIDE will restart to finish the installation.',
    updateRestartNow: 'Restart and install',
    updateOnNextLaunch: 'Install on next launch',
    updateCheckNow: 'Check for updates',
    updateCheckingShort: 'Checking...',
    updateAvailableShort: 'Update ready',
    updateCheckingTitle: 'Checking for updates...',
    updateUpToDateTitle: 'OtisIDE is up to date',
    updateFailedTitle: 'Update check failed',
    updateUnsupportedTitle: 'Update check unavailable',
    updateUnsupportedText:
      'Auto-update only works in the installed app, not in this development build.',
    updateCurrentVersionLine: 'Installed version: {{current}}',
    close: 'Close',
    crashTitle: 'OtisIDE ran into a problem',
    crashText:
      'The window could not be drawn. Your last saved project file is untouched.',
    crashRetry: 'Try again',
    crashReload: 'Restart the view',
    crashDetails: 'Technical details',
    wireProperties: 'Wire',
    wireFrom: 'From',
    wireTo: 'To',
    wireColorTitle: 'Colour',
    wireWidthTitle: 'Thickness',
    thinWire: 'Thinner ([)',
    thickenWire: 'Thicker (])',
    wireReplugHint:
      'Drag either end of the wire onto another pin to replug it. Double-click the wire to add a bend.',
    size: 'Size',
    mirror: 'Mirror',
    on: 'ON',
    off: 'OFF',
    live: 'Live',
    resetZoom: 'Zoom 100%',
    editorLoading: 'Loading editor...',
    burned: 'BURNED',
    multiSelection: '{{count}} parts selected',
    multiSelectionHint: 'Editing the last one you picked. Move or delete acts on all of them.',
    damageStatus: 'Condition',
    damageOvercurrent: 'Burned out — too much current',
    damageOvervoltage: 'Burned out — too much voltage',
    damageOverpower: 'Burned out — too much power',
    circuitWarningsTitle: 'Circuit warnings',
    circuitWarningNoCode: 'No setup()/loop() found in the sketch — nothing will run.',
    circuitWarningRuntimeError: 'Sketch error: {{error}}',
    driverForward: 'FORWARD',
    driverReverse: 'REVERSE',
    driverBrake: 'BRAKE',
    driverCoast: 'COAST',
  },
  tr: {
    appTitle: 'OtisIDE',
    componentsPanel: 'Bileşenler',
    searchComponents: 'Bileşen Ara',
    searchComponentsPlaceholder: 'Bileşen ara...',
    noComponentsFound: 'Eşleşen bileşen bulunamadı.',
    propertiesTab: 'Özellikler',
    aiAssistantTab: 'AI Asistan',
    save: 'Kaydet',
    open: 'Aç',
    newProject: 'Yeni',
    exportPng: 'PNG Al',
    selectTool: 'Seç',
    wireTool: 'Kablo',
    panTool: 'Kaydır',
    deleteTool: 'Sil',
    selectToolTitle: 'Seçim Aracı (S)',
    wireToolTitle: 'Kablo Aracı (W) - boş alana tıklayarak kabloyu kıvır',
    panToolTitle: 'Kaydırma Aracı (P)',
    deleteToolTitle: 'Silme Aracı (D)',
    board: 'Kart',
    selectBoard: 'Kontrol kartını seç',
    usbIde: 'USB IDE',
    usbDevice: 'USB cihazı',
    selectUsbDevice: 'Cihaz seç',
    noUsbDevice: 'USB cihazı yok',
    refreshPorts: 'Portları yenile',
    refreshPortsShort: 'Yenile',
    prepareIde: 'IDE hazırla',
    verifySketch: 'Doğrula',
    uploadSketch: 'Yükle',
    uploadingSketch: 'Yükleniyor...',
    ideReady: 'IDE hazır',
    ideOffline: 'IDE kapalı',
    preparing: 'Hazırlanıyor...',
    detectedBoard: 'Algılanan',
    language: 'Dil',
    zoomReset: 'Yakınlaştırmayı sıfırla',
    startSimulation: 'Simülasyonu Başlat',
    stopSimulation: 'Durdur',
    running: 'Çalışıyor',
    stopped: 'Durdu',
    clickOrDrag: 'Tıkla veya sürükle',
    arduinoCode: 'Arduino Kodu',
    serialMonitor: 'Seri Monitör',
    deviceConsole: 'Cihaz Konsolu',
    oscilloscope: 'Osiloskop',
    clear: 'Temizle',
    codePlaceholder: '// Arduino kodunuzu buraya yazın...',
    serialWaiting: 'Seri çıktı bekleniyor...',
    serialStartPrompt: 'Seri çıktı için simülasyonu başlatın.',
    codeWorkspace: 'Kod Alanı',
    serialFeed: 'Seri Akış',
    oscilloscopeHint:
      'Kablolanmış osiloskop bileşeninin CH1 dalga formunu canlı izleyin.',
    oscilloscopeAddPrompt:
      'Paletten bir osiloskop ekleyin, sonra CH1 ve GND pinlerini devreye bağlayın.',
    oscilloscopeConnectPrompt:
      'Kayıt başlatmak için osiloskobun CH1 ve GND pinlerini devreye bağlayın.',
    oscilloscopeWaiting:
      'Simülasyon çalışıyor. Osiloskoptan dalga formu verisi bekleniyor...',
    deviceConsoleHint:
      'Gerçek yükleme günlüklerini ve USB seri çıktısını burada izleyin.',
    deviceConsoleEmpty:
      'Günlükleri görmek için IDE hazırla, kod yükle veya monitörü aç.',
    openMonitor: 'Monitörü aç',
    closeMonitor: 'Monitörü kapat',
    monitorOpen: 'Monitör açık',
    monitorClosed: 'Monitör kapalı',
    hardwarePrepareFailed: 'Donanım IDE hazırlanamadı.',
    hardwareScanFailed: 'USB cihazları taranamadı.',
    serialMonitorFailed: 'Seri monitör açılamadı.',
    codeWorkspaceHint:
      'Arduino kodunu satır numaraları ve renklendirme ile düzenleyin.',
    serialFeedHint:
      'Çalışma günlüklerini ve Serial.print çıktısını tek yerde izleyin.',
    lineCount: '{{count}} satır',
    charCount: '{{count}} karakter',
    logCount: '{{count}} log',
    sampleCount: '{{count}} örnek',
    serialLive: 'Seri canlı',
    serialIdle: 'Seri beklemede',
    oscilloscopeLive: 'Scope canlı',
    oscilloscopeIdle: 'Scope beklemede',
    oscilloscopeOpen: 'Prob açık',
    timeWindow: 'Zaman Penceresi',
    selectComponentPrompt: 'Bir bileşen seçin\nveya paletten sürükleyin',
    id: 'ID',
    componentName: 'Ad',
    componentDescription: 'Açıklama',
    position: 'Konum',
    angle: 'Açı',
    values: 'Değerler',
    pins: 'Pinler',
    deleteComponent: 'Bileşeni Sil',
    passive: 'Pasif',
    active: 'Aktif',
    output: 'Çıkış',
    sensor: 'Sensör',
    display: 'Ekran',
    other: 'Diğer',
    red: 'Kırmızı',
    green: 'Yeşil',
    blue: 'Mavi',
    yellow: 'Sarı',
    white: 'Beyaz',
    orange: 'Turuncu',
    commonCathode: 'Ortak Katot',
    commonAnode: 'Ortak Anot',
    newChat: 'Yeni sohbet',
    aiHistory: 'AI Geçmişi',
    chats: '{{count}} sohbet',
    noMessagesYet: 'Henüz mesaj yok',
    emptyMessage: 'Boş mesaj',
    menu: 'Menü',
    settings: 'Ayar',
    apiSettings: 'API ayarları',
    aiSettingsTitle: 'AI Ayarları',
    aiSettingsSubtitle: 'Sağlayıcı ve model bilgilerini yönet',
    back: 'Geri',
    provider: 'Sağlayıcı',
    apiKey: 'API Anahtarı',
    model: 'Model',
    customOption: 'Özel...',
    baseUrl: 'Base URL',
    providerHelp:
      'Groq, OpenAI, Google Gemini veya OpenAI uyumlu bir servis kullanabilirsiniz. Önerilen varsayılan: {{provider}} / {{model}}',
    saveAndContinue: 'Kaydet ve Devam Et',
    historyEmptyTitle: 'Sohbet geçmişi boş',
    historyEmptyText:
      'Yeni bir sohbet başlatıp devre tasarımı, kod ve bağlantı yardımı alabilirsiniz.',
    deleteConversation: 'Sohbeti sil',
    aiAssistantTitle: 'AI Devre Asistanı',
    aiAssistantIntro:
      'Devreni tarif et, istersen kodu ve kabloları birlikte hazırlayalım.',
    thinking: 'Düşünüyor...',
    requestPlaceholder: 'Devre isteğinizi yazın...',
    send: 'Gönder',
    errorPrefix: 'Hata',
    historyTitleFallback: 'Yeni sohbet',
    circuitEmpty: 'Devre boş - henüz bileşen eklenmedi.',
    currentCircuit: 'Mevcut devre:',
    componentsLabel: 'Bileşenler',
    wiresLabel: 'Kablolar',
    noWiresYet: 'Henüz kablo yok',
    boardLabel: 'Kart',
    boardPinsLabel: 'Kart pinleri',
    select: 'Seç',
    startWire: 'Kablo çek',
    rotate90: '90° döndür',
    wireMode: 'Kablo modu',
    deleteWire: 'Kabloyu sil',
    chooseBoard: 'Kart seç',
    switchToWireMode: 'Kablo moduna geç',
    selectionTool: 'Seçim aracı',
    wireToolMenu: 'Kablo aracı',
    pan: 'Kaydır',
    undo: 'Geri al',
    redo: 'İleri al',
    openAIPanel: 'AI panelini aç',
    detect: 'ALGILA',
    idle: 'BOŞTA',
    alarm: 'ALARM',
    safe: 'GÜVENLİ',
    card: 'KART',
    noCard: 'KART YOK',
    rxOn: 'RX AÇIK',
    rxIdle: 'RX BOŞTA',
    sound: 'SES',
    quiet: 'SESSİZ',
    stepOn: 'STEP AÇIK',
    stepIdle: 'STEP BOŞTA',
    txOn: 'TX AÇIK',
    txIdle: 'TX BOŞTA',
    wifiOn: 'WIFI AÇIK',
    wifiOff: 'WIFI KAPALI',
    gasPrefix: 'GAZ',
    triggered: 'TETİK',
    openState: 'AÇIK',
    projectFileName: 'devre-projesi.json',
    projectFilterName: 'Devre Projesi',
    invalidProjectFile: 'Bu dosya bir OtisIDE projesi olarak okunamadı.',
    saveProjectDialogTitle: 'Projeyi Kaydet',
    openProjectDialogTitle: 'Proje Aç',
    exportPngDialogTitle: 'PNG Olarak Dışa Aktar',
    pngFileName: 'devre.png',
    pngFilterName: 'PNG Resmi',
    multimeterVoltageMode: 'DC Voltaj',
    multimeterCurrentMode: 'DC Akım',
    multimeterResistanceMode: 'Direnç',
    multimeterContinuityMode: 'Süreklilik',
    multimeterReady: 'Hazır',
    multimeterOpen: 'Açık Devre',
    multimeterBeep: 'Süreklilik',
    updateBadge: 'Güncelleme',
    updateAvailableTitle: 'OtisIDE\'nin yeni sürümü hazır',
    updateReadyTitle: 'Güncelleme kuruluma hazır',
    updateVersionLine: 'Yüklü: {{current}} · Yeni: {{next}}',
    updateNotes: 'Yenilikler',
    updateNow: 'Şimdi güncelle',
    updateLater: 'Daha sonra',
    updateBackground: 'Arka planda devam et',
    updateReadyText:
      'Güncelleme indirildi. Kurulumu tamamlamak için OtisIDE yeniden başlatılacak.',
    updateRestartNow: 'Yeniden başlat ve kur',
    updateOnNextLaunch: 'Bir sonraki açılışta kur',
    updateCheckNow: 'Güncellemeleri denetle',
    updateCheckingShort: 'Denetleniyor...',
    updateAvailableShort: 'Güncelleme hazır',
    updateCheckingTitle: 'Güncellemeler denetleniyor...',
    updateUpToDateTitle: 'OtisIDE güncel',
    updateFailedTitle: 'Güncelleme denetimi başarısız',
    updateUnsupportedTitle: 'Güncelleme denetimi kullanılamıyor',
    updateUnsupportedText:
      'Otomatik güncelleme yalnızca kurulu uygulamada çalışır, bu geliştirme derlemesinde çalışmaz.',
    updateCurrentVersionLine: 'Yüklü sürüm: {{current}}',
    close: 'Kapat',
    crashTitle: 'OtisIDE bir sorunla karşılaştı',
    crashText:
      'Pencere çizilemedi. En son kaydettiğin proje dosyasına bir şey olmadı.',
    crashRetry: 'Yeniden dene',
    crashReload: 'Görünümü yeniden başlat',
    crashDetails: 'Teknik ayrıntı',
    wireProperties: 'Kablo',
    wireFrom: 'Başlangıç',
    wireTo: 'Bitiş',
    wireColorTitle: 'Renk',
    wireWidthTitle: 'Kalınlık',
    thinWire: 'İncelt ([)',
    thickenWire: 'Kalınlaştır (])',
    wireReplugHint:
      'Kablonun ucunu tutup başka bir pine sürükleyerek yerini değiştirebilirsin. Kabloya çift tıklayarak kıvrım eklersin.',
    size: 'Boyut',
    mirror: 'Aynala',
    on: 'AÇIK',
    off: 'KAPALI',
    live: 'Canlı',
    resetZoom: 'Yakınlaştırma %100',
    editorLoading: 'Editör yükleniyor...',
    burned: 'YANDI',
    multiSelection: '{{count}} bileşen seçili',
    multiSelectionHint: 'Son seçtiğin düzenleniyor. Taşıma ve silme hepsine uygulanır.',
    damageStatus: 'Durum',
    damageOvercurrent: 'Yandı — aşırı akım',
    damageOvervoltage: 'Yandı — aşırı gerilim',
    damageOverpower: 'Yandı — aşırı güç',
    circuitWarningsTitle: 'Devre uyarıları',
    circuitWarningNoCode: 'Kodda setup()/loop() bulunamadı — hiçbir şey çalışmayacak.',
    circuitWarningRuntimeError: 'Kod hatası: {{error}}',
    driverForward: 'İLERİ',
    driverReverse: 'GERİ',
    driverBrake: 'FREN',
    driverCoast: 'SERBEST',
  },
} as const;

export type TranslationKey = keyof typeof UI_STRINGS.en;

/** Exported so a test can prove every catalog part has a Turkish name. */
export const COMPONENT_NAME_TR: Partial<Record<ComponentType, string>> = {
  led: 'LED',
  resistor: 'Direnç',
  capacitor: 'Kondansatör',
  diode: 'Diyot',
  button: 'Buton',
  switch: 'Anahtar',
  potentiometer: 'Potansiyometre',
  joystick: 'Joystick',
  buzzer: 'Buzzer',
  servo: 'Servo Motor',
  'dc-motor': 'DC Motor',
  'rgb-led': 'RGB LED',
  ldr: 'LDR',
  lm35: 'LM35 Sıcaklık',
  dht11: 'DHT11',
  'pir-sensor': 'PIR Sensör',
  'flame-sensor': 'Alev Sensörü',
  mq2: 'MQ-2 Gaz',
  'vl53l0x': 'VL53L0X ToF',
  'reed-switch-module': 'Reed Switch',
  acs712: 'ACS712 Akım',
  'rf-433-receiver': '433MHz Alıcı',
  'sound-sensor': 'Ses Sensörü',
  'ds18b20-probe': 'DS18B20 Prob',
  hx711: 'HX711 Yük Hücresi Yükselteci',
  'microsd-module': 'microSD Modül',
  'ds3231-rtc': 'DS3231 RTC',
  'max7219-matrix': 'MAX7219 8x8 Matris',
  'ov7670-camera': 'OV7670 Kamera',
  tcrt5000: 'TCRT5000 Sensör',
  'tp4056-charger': 'TP4056 Şarj Modülü',
  rfm69hcw: 'RFM69HCW Radyo',
  'shaft-encoder': 'Mil Enkoder',
  tcs230: 'TCS230 Renk',
  'uv-sensor': 'UV Sensör',
  rc522: 'RC522 RFID',
  'hc-sr04': 'HC-SR04 Ultrasonik',
  'ir-sensor': 'IR Sensör',
  'seven-segment': '7 Segment',
  'lcd-16x2': 'LCD 16x2',
  'oled-i2c': 'OLED I2C',
  tm1637: 'TM1637 Ekran',
  'hc-05': 'Bluetooth HC-05',
  'keypad-4x4': 'Keypad 4x4',
  'stepper-28byj48': '28BYJ-48 Step Motor',
  'l298n-driver': 'L298N Sürücü',
  'bts7960-driver': 'BTS7960 Motor Sürücü',
  'li-ion-battery': 'Li-ion Pil',
  'li-po-battery': 'Li-Po Pil',
  '9v-battery': '9V Pil',
  'aa-battery': '1.5V Kalem Pil',
  'coin-cell-3v': '3V Düğme Pil',
  'breadboard-power-supply': 'Breadboard PSU',
  'logic-level-converter': 'Seviye Dönüştürücü',
  'uln2003-driver': 'ULN2003 Sürücü',
  'rf-433-transmitter': '433MHz Verici',
  'deneyap-gps-glonass': 'Deneyap GPS/GLONASS',
  'deneyap-9-axis-imu': 'Deneyap 9 Eksen IMU',
  'deneyap-touch-keypad': 'Deneyap Dokunmatik Tuş Takımı',
  'deneyap-rain-sensor-center': 'Deneyap Yağmur Merkezi',
  'deneyap-rain-sensor-surface': 'Deneyap Yağmur Yüzeyi',
  'esp8266-module': 'ESP8266 Modül',
  bme280: 'BME280 Çevre Sensörü',
  ina219: 'INA219 Akım Sensörü',
  'sx1276-lora': 'SX1276 LoRa Modülü',
  'a4988-driver': 'A4988 Step Motor Sürücü',
  relay: 'Röle',
  'transistor-npn': 'NPN Transistör',
  'transistor-pnp': 'PNP Transistör',
  multimeter: 'Dijital Avometre',
  oscilloscope: 'Osiloskop',
  'motor-driver': 'Motor Sürücü',
};

const CATEGORY_NAME_TR: Record<string, string> = {
  Passive: UI_STRINGS.tr.passive,
  Active: UI_STRINGS.tr.active,
  Output: UI_STRINGS.tr.output,
  Sensor: UI_STRINGS.tr.sensor,
  Display: UI_STRINGS.tr.display,
  Other: UI_STRINGS.tr.other,
};

const PROPERTY_NAME_EN: Record<string, string> = {
  color: 'Color',
  resistance: 'Resistance',
  capacitance: 'Capacitance',
  forwardVoltage: 'Forward Voltage',
  pressed: 'Pressed',
  closed: 'Closed',
  frequency: 'Frequency',
  angle: 'Angle',
  minAngle: 'Min Angle',
  maxAngle: 'Max Angle',
  rpm: 'RPM',
  red: 'Red',
  green: 'Green',
  blue: 'Blue',
  clear: 'Clear',
  commonType: 'Common Type',
  lightLevel: 'Light Level',
  temperature: 'Temperature (°C)',
  humidity: 'Humidity (%)',
  pressure: 'Pressure (hPa)',
  address: 'Address',
  distance: 'Distance (cm)',
  detected: 'Detected',
  segments: 'Segments',
  text1: 'Line 1',
  text2: 'Line 2',
  backlight: 'Backlight',
  coilVoltage: 'Coil Voltage',
  activated: 'Activated',
  hfe: 'hFE',
  type: 'Type',
  position: 'Position (%)',
  active: 'Active',
  unit: 'Unit',
  xAxis: 'X Axis',
  yAxis: 'Y Axis',
  range: 'Range',
  flameDetected: 'Flame Detected',
  sensitivity: 'Sensitivity',
  gasLevel: 'Gas Level',
  threshold: 'Threshold',
  connected: 'Connected',
  baudRate: 'Baud Rate',
  inverted: 'Inverted',
  cardPresent: 'Card Present',
  uid: 'UID',
  lastKey: 'Last Key',
  debounceMs: 'Debounce (ms)',
  stepsPerRevolution: 'Steps / Revolution',
  pwmA: 'PWM A',
  pwmB: 'PWM B',
  enabledA: 'Enabled A',
  enabledB: 'Enabled B',
  pwmR: 'PWM Right',
  pwmL: 'PWM Left',
  enabledR: 'Right Enabled',
  enabledL: 'Left Enabled',
  motorCurrentA: 'Motor Current (A)',
  cells: 'Cells',
  chargePercent: 'Charge (%)',
  capacityMah: 'Capacity (mAh)',
  voltage: 'Voltage (V)',
  timingBudget: 'Timing Budget (ms)',
  triggered: 'Triggered',
  analogLevel: 'Analog Level',
  leftRail: 'Left Rail',
  rightRail: 'Right Rail',
  enabled: 'Enabled',
  current: 'Current',
  busVoltage: 'Bus Voltage (V)',
  power: 'Power (W)',
  sensitivityMvPerA: 'Sensitivity (mV/A)',
  lowVoltage: 'Low Voltage',
  highVoltage: 'High Voltage',
  signal: 'Signal',
  frequencyMHz: 'Frequency (MHz)',
  spreadingFactor: 'Spreading Factor',
  bandwidthKhz: 'Bandwidth (kHz)',
  level: 'Level',
  value: 'Value',
  brightness: 'Brightness',
  stepIndex: 'Step Index',
  currentLimit: 'Current Limit (A)',
  stepMode: 'Step Mode',
  transmitting: 'Transmitting',
  ssid: 'SSID',
  mode: 'Mode',
  uvIndex: 'UV Index',
  reading: 'Reading',
  gain: 'Gain',
  mounted: 'Mounted',
  filename: 'Filename',
  date: 'Date',
  time: 'Time',
  latitude: 'Latitude',
  longitude: 'Longitude',
  satellites: 'Satellites',
  fix: 'GPS Fix',
  pitch: 'Pitch',
  roll: 'Roll',
  heading: 'Heading',
  lastTouch: 'Last Touch',
  touchCount: 'Touch Count',
  wet: 'Wet',
  moisture: 'Moisture',
  pattern: 'Pattern',
  resolution: 'Resolution',
  charging: 'Charging',
  batteryPercent: 'Battery (%)',
  pulses: 'Pulses',
  autoRange: 'Auto Range',
  displayText: 'Display',
  continuity: 'Continuity',
  status: 'Status',
  timeWindowMs: 'Time Window (ms)',
};

const PROPERTY_NAME_TR: Partial<Record<string, string>> = {
  color: 'Renk',
  resistance: 'Direnç',
  capacitance: 'Kapasite',
  forwardVoltage: 'İleri Gerilim',
  pressed: 'Basılmış',
  closed: 'Kapalı',
  frequency: 'Frekans',
  angle: 'Açı',
  minAngle: 'Min Açı',
  maxAngle: 'Maks Açı',
  commonType: 'Ortak Tip',
  lightLevel: 'Işık Seviyesi',
  temperature: 'Sıcaklık (°C)',
  humidity: 'Nem (%)',
  pressure: 'Basınç (hPa)',
  address: 'Adres',
  distance: 'Mesafe (cm)',
  detected: 'Algılandı',
  segments: 'Segmentler',
  text1: 'Satır 1',
  text2: 'Satır 2',
  backlight: 'Arka Işık',
  coilVoltage: 'Bobin Gerilimi',
  activated: 'Aktif',
  type: 'Tip',
  position: 'Pozisyon (%)',
  active: 'Aktif',
  unit: 'Birim',
  xAxis: 'X Ekseni',
  yAxis: 'Y Ekseni',
  range: 'Menzil',
  flameDetected: 'Alev Algısı',
  sensitivity: 'Hassasiyet',
  gasLevel: 'Gaz Seviyesi',
  threshold: 'Eşik',
  connected: 'Bağlı',
  baudRate: 'Baud Hızı',
  inverted: 'Ters Çevir',
  cardPresent: 'Kart Var',
  lastKey: 'Son Tuş',
  debounceMs: 'Debounce (ms)',
  stepsPerRevolution: 'Tur Başına Adım',
  enabledA: 'A Aktif',
  enabledB: 'B Aktif',
  pwmR: 'PWM Sağ',
  pwmL: 'PWM Sol',
  enabledR: 'Sağ Aktif',
  enabledL: 'Sol Aktif',
  motorCurrentA: 'Motor Akımı (A)',
  cells: 'Hücre Sayısı',
  chargePercent: 'Şarj (%)',
  capacityMah: 'Kapasite (mAh)',
  voltage: 'Gerilim (V)',
  timingBudget: 'Zaman Bütçesi (ms)',
  triggered: 'Tetiklendi',
  analogLevel: 'Analog Seviye',
  leftRail: 'Sol Hat',
  rightRail: 'Sağ Hat',
  enabled: 'Etkin',
  current: 'Akım',
  busVoltage: 'Hat Gerilimi (V)',
  power: 'Güç (W)',
  sensitivityMvPerA: 'Hassasiyet (mV/A)',
  lowVoltage: 'Düşük Gerilim',
  highVoltage: 'Yüksek Gerilim',
  signal: 'Sinyal',
  frequencyMHz: 'Frekans (MHz)',
  spreadingFactor: 'Yayılım Faktörü',
  bandwidthKhz: 'Bant Genişliği (kHz)',
  level: 'Seviye',
  value: 'Değer',
  brightness: 'Parlaklık',
  stepIndex: 'Adım İndeksi',
  currentLimit: 'Akım Limiti (A)',
  stepMode: 'Adım Modu',
  transmitting: 'Yayında',
  mode: 'Mod',
  uvIndex: 'UV İndeksi',
  reading: 'Okuma',
  gain: 'Kazanç',
  mounted: 'Takılı',
  filename: 'Dosya Adı',
  date: 'Tarih',
  time: 'Saat',
  latitude: 'Enlem',
  longitude: 'Boylam',
  satellites: 'Uydu',
  fix: 'GPS Sabiti',
  pitch: 'Pitch',
  roll: 'Roll',
  heading: 'Yön',
  lastTouch: 'Son Dokunuş',
  touchCount: 'Dokunuş Sayısı',
  wet: 'Islak',
  moisture: 'Nemlilik',
  pattern: 'Desen',
  resolution: 'Çözünürlük',
  charging: 'Şarj Oluyor',
  batteryPercent: 'Pil (%)',
  pulses: 'Darbe',
  autoRange: 'Otomatik Aralık',
  displayText: 'Ekran',
  continuity: 'Süreklilik',
  status: 'Durum',
  timeWindowMs: 'Zaman Penceresi (ms)',
};

const WIRE_COLOR_NAME_TR: Record<string, string> = {
  Red: 'Kırmızı',
  Black: 'Siyah',
  Green: 'Yeşil',
  Blue: 'Mavi',
  Yellow: 'Sarı',
  Orange: 'Turuncu',
  White: 'Beyaz',
};

export function t(
  language: AppLanguage,
  key: TranslationKey,
  vars?: Record<string, string | number>
): string {
  const template = UI_STRINGS[language][key] as string;
  if (!vars) return template;

  let text = template;
  for (const [name, value] of Object.entries(vars)) {
    text = text.split(`{{${name}}}`).join(String(value));
  }

  return text;
}

export function getDefaultConversationTitle(language: AppLanguage): string {
  return t(language, 'historyTitleFallback');
}

export function getComponentDisplayName(
  language: AppLanguage,
  type: ComponentType,
  fallback: string
): string {
  if (language === 'tr') {
    return COMPONENT_NAME_TR[type] ?? fallback;
  }

  return fallback;
}

const PIN_TYPE_NAME_TR: Record<string, string> = {
  digital: 'dijital',
  analog: 'analog',
  power: 'güç',
  ground: 'toprak',
  pwm: 'PWM',
  passive: 'pasif',
};

const DAMAGE_KEYS = {
  overcurrent: 'damageOvercurrent',
  overvoltage: 'damageOvervoltage',
  overpower: 'damageOverpower',
} as const;

/** Why a part burned out, in words. */
export function getDamageLabel(language: AppLanguage, reason: string): string {
  const key = DAMAGE_KEYS[reason as keyof typeof DAMAGE_KEYS];
  return key ? t(language, key) : t(language, 'burned');
}

/** What a pin does, for the list at the bottom of the properties panel. */
export function getPinTypeLabel(language: AppLanguage, pinType: string): string {
  if (language === 'tr') {
    return PIN_TYPE_NAME_TR[pinType] ?? pinType;
  }

  return pinType;
}

export function getCategoryDisplayName(
  language: AppLanguage,
  category: string
): string {
  if (language === 'tr') {
    return CATEGORY_NAME_TR[category] ?? category;
  }

  return category;
}

export function getPropertyDisplayName(
  language: AppLanguage,
  key: string
): string {
  if (language === 'tr') {
    return PROPERTY_NAME_TR[key] ?? PROPERTY_NAME_EN[key] ?? key;
  }

  return PROPERTY_NAME_EN[key] ?? key;
}

export function getWireColorDisplayName(
  language: AppLanguage,
  fallback: string
): string {
  if (language === 'tr') {
    return WIRE_COLOR_NAME_TR[fallback] ?? fallback;
  }

  return fallback;
}

export function getMultimeterModeLabel(
  language: AppLanguage,
  mode: string
): string {
  const normalized = mode.trim().toLowerCase();

  if (normalized === 'current') {
    return t(language, 'multimeterCurrentMode');
  }
  if (normalized === 'resistance') {
    return t(language, 'multimeterResistanceMode');
  }
  if (normalized === 'continuity') {
    return t(language, 'multimeterContinuityMode');
  }

  return t(language, 'multimeterVoltageMode');
}

export function getMultimeterStatusLabel(
  language: AppLanguage,
  status: string
): string {
  const normalized = status.trim().toLowerCase();

  if (normalized === 'open') {
    return t(language, 'multimeterOpen');
  }
  if (normalized === 'beep') {
    return t(language, 'multimeterBeep');
  }

  return t(language, 'multimeterReady');
}

export function getOscilloscopeStatusLabel(
  language: AppLanguage,
  status: string
): string {
  const normalized = status.trim().toLowerCase();

  if (normalized === 'live') {
    return t(language, 'oscilloscopeLive');
  }
  if (normalized === 'open') {
    return t(language, 'oscilloscopeOpen');
  }

  return t(language, 'oscilloscopeIdle');
}

export function getLocalizedOscilloscopeDisplayText(
  language: AppLanguage,
  text: string
): string {
  const normalized = text.trim().toLowerCase();
  if (normalized === 'open') {
    return t(language, 'oscilloscopeOpen');
  }

  return text;
}

export function getExamplePrompts(language: AppLanguage): string[] {
  if (language === 'tr') {
    return [
      'LED yakıp söndüren bir devre tasarla ve kabloları da ekle',
      'Trafik lambası devresi kur ve Arduino bağlantılarını yap',
      'Mevcut devreyi kontrol et, eksik kabloları tamamla',
    ];
  }

  return [
    'Build an LED blink circuit and add the wiring too',
    'Create a traffic light circuit and wire it to Arduino',
    'Inspect the current circuit and complete any missing wires',
  ];
}

export function getConversationLocale(language: AppLanguage): string {
  return language === 'tr' ? 'tr-TR' : 'en-US';
}

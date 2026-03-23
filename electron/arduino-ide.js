const { app } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const ESP8266_PACKAGE_URL = 'http://arduino.esp8266.com/stable/package_esp8266com_index.json';
const ESP32_PACKAGE_URL =
  'https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json';
const RP2040_PACKAGE_URL =
  'https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json';
const SPARKFUN_PACKAGE_URL =
  'https://raw.githubusercontent.com/sparkfun/Arduino_Boards/main/IDE_Board_Manager/package_sparkfun_index.json';
const DENEYAP_PACKAGE_URL =
  'https://raw.githubusercontent.com/deneyapkart/deneyapkart-arduino-core/master/package_deneyapkart_index.json';

const BOARD_UPLOAD_PROFILES = {
  uno: {
    label: 'Arduino Uno',
    aliases: ['uno', 'arduinouno'],
    searchQueries: ['Arduino Uno'],
    fallbackFqbn: 'arduino:avr:uno',
  },
  'uno-r4-wifi': {
    label: 'Arduino UNO R4 WiFi',
    aliases: ['unor4wifi', 'unor4', 'arduinounor4wifi', 'uno r4 wifi'],
    searchQueries: ['Arduino UNO R4 WiFi', 'UNO R4 WiFi'],
    fallbackFqbn: 'arduino:renesas_uno:unor4wifi',
  },
  nano: {
    label: 'Arduino Nano',
    aliases: ['nano', 'arduinonano'],
    searchQueries: ['Arduino Nano'],
    fallbackFqbn: 'arduino:avr:nano',
  },
  mega: {
    label: 'Arduino Mega',
    aliases: ['mega', 'mega2560', 'arduinomega'],
    searchQueries: ['Arduino Mega 2560', 'Arduino Mega'],
    fallbackFqbn: 'arduino:avr:mega',
  },
  leonardo: {
    label: 'Arduino Leonardo',
    aliases: ['leonardo', 'arduinoleonardo'],
    searchQueries: ['Arduino Leonardo'],
    fallbackFqbn: 'arduino:avr:leonardo',
  },
  'deneyap-kart-1a': {
    label: 'Deneyap Kart 1A',
    aliases: ['deneyapkart1a'],
    searchQueries: ['Deneyap Kart 1A'],
    additionalUrls: [DENEYAP_PACKAGE_URL],
  },
  'deneyap-kart-1a-v2': {
    label: 'Deneyap Kart 1A v2',
    aliases: ['deneyapkart1av2', 'deneyapkart1a'],
    searchQueries: ['Deneyap Kart 1A v2', 'Deneyap Kart 1A V2'],
    additionalUrls: [DENEYAP_PACKAGE_URL],
  },
  'deneyap-kart-g': {
    label: 'Deneyap Kart G',
    aliases: ['deneyapkartg'],
    searchQueries: ['Deneyap Kart G'],
    additionalUrls: [DENEYAP_PACKAGE_URL],
  },
  'deneyap-mini': {
    label: 'Deneyap Mini',
    aliases: ['deneyapmini'],
    searchQueries: ['Deneyap Mini'],
    additionalUrls: [DENEYAP_PACKAGE_URL],
  },
  'deneyap-mini-v2': {
    label: 'Deneyap Mini v2',
    aliases: ['deneyapminiv2', 'deneyapmini'],
    searchQueries: ['Deneyap Mini v2', 'Deneyap Mini V2'],
    additionalUrls: [DENEYAP_PACKAGE_URL],
  },
  nodemcu: {
    label: 'NodeMCU ESP8266',
    aliases: ['nodemcu', 'esp8266', 'nodemcuesp8266'],
    searchQueries: ['NodeMCU 1.0', 'NodeMCU ESP8266'],
    fallbackFqbn: 'esp8266:esp8266:nodemcuv2',
    additionalUrls: [ESP8266_PACKAGE_URL],
  },
  'nodemcu-v3': {
    label: 'NodeMCU V3 (LoLin)',
    aliases: ['nodemcuv3', 'lolinv3', 'nodemcuv3lolin'],
    searchQueries: ['NodeMCU 1.0', 'NodeMCU V3'],
    fallbackFqbn: 'esp8266:esp8266:nodemcuv2',
    additionalUrls: [ESP8266_PACKAGE_URL],
  },
  'wemos-d1-mini': {
    label: 'WeMos D1 Mini',
    aliases: ['wemosd1mini', 'd1mini', 'lolind1mini'],
    searchQueries: ['LOLIN(WEMOS) D1 mini', 'D1 mini'],
    fallbackFqbn: 'esp8266:esp8266:d1_mini',
    additionalUrls: [ESP8266_PACKAGE_URL],
  },
  'arduino-fio': {
    label: 'Arduino Fio',
    aliases: ['fio', 'arduinofio'],
    searchQueries: ['Arduino Fio'],
    fallbackFqbn: 'arduino:avr:fio',
  },
  'pro-micro': {
    label: 'SparkFun Pro Micro',
    aliases: ['promicro', 'sparkfunpromicro'],
    searchQueries: ['SparkFun Pro Micro', 'Pro Micro'],
    fallbackFqbn: 'SparkFun:avr:promicro:cpu=16MHzatmega32U4',
    additionalUrls: [SPARKFUN_PACKAGE_URL],
    menuDefaults: {
      cpu: '16MHzatmega32U4',
    },
  },
  pico: {
    label: 'Raspberry Pi Pico',
    aliases: ['pico', 'raspberrypipico', 'rp2040'],
    searchQueries: ['Raspberry Pi Pico'],
    fallbackFqbn: 'rp2040:rp2040:rpipico',
    additionalUrls: [RP2040_PACKAGE_URL],
  },
  'feather-huzzah32': {
    label: 'Adafruit HUZZAH32 Feather',
    aliases: ['huzzah32', 'featherhuzzah32', 'adafruithuzzah32'],
    searchQueries: ['Adafruit HUZZAH32 Feather', 'Feather ESP32'],
    fallbackFqbn: 'esp32:esp32:featheresp32',
    additionalUrls: [ESP32_PACKAGE_URL],
  },
  'esp32-s3-devkitc-1': {
    label: 'ESP32-S3 DevKitC-1',
    aliases: [
      'esp32s3',
      'esp32s3devkitc1',
      'esp32s3devmodule',
      'devkitc1',
      'esp32 s3',
    ],
    searchQueries: ['ESP32S3 Dev Module', 'ESP32-S3 DevKitC-1', 'ESP32 S3 Dev Module'],
    fallbackFqbn: 'esp32:esp32:esp32s3',
    additionalUrls: [ESP32_PACKAGE_URL],
  },
};

const BOARD_TYPES = Object.keys(BOARD_UPLOAD_PROFILES);
const MAX_CONSOLE_LINES = 500;
const INDEX_REFRESH_MS = 1000 * 60 * 60 * 12;

let mainWindowGetter = null;
let idePreparationPromise = null;
let lastIndexRefreshAt = 0;
let activeSerialMonitor = null;
const boardFqbnCache = new Map();

function setArduinoIdeWindowGetter(getter) {
  mainWindowGetter = getter;
}

function getMainWindow() {
  return typeof mainWindowGetter === 'function' ? mainWindowGetter() : null;
}

function getArduinoIdeRoot() {
  return path.join(app.getPath('userData'), 'arduino-ide');
}

function getArduinoCliDownloadDir() {
  return path.join(getArduinoIdeRoot(), 'tools', 'arduino-cli');
}

function getArduinoCliExecutableName() {
  return process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli';
}

function getBundledArduinoCliPath() {
  return path.join(getArduinoCliDownloadDir(), getArduinoCliExecutableName());
}

function getArduinoCliConfigPath() {
  return path.join(getArduinoIdeRoot(), 'arduino-cli.yaml');
}

function getArduinoSketchesDir() {
  return path.join(getArduinoIdeRoot(), 'sketches');
}

function getNormalizedPathKey(value) {
  return process.platform === 'win32'
    ? String(value || '').toLowerCase()
    : String(value || '');
}

function normalizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function yamlSafePath(value) {
  return String(value).replace(/\\/g, '/');
}

function getAllAdditionalUrls() {
  const urls = new Set();
  for (const profile of Object.values(BOARD_UPLOAD_PROFILES)) {
    for (const url of profile.additionalUrls || []) {
      urls.add(url);
    }
  }
  return [...urls];
}

function ensureArduinoCliConfig() {
  const root = getArduinoIdeRoot();
  const configPath = getArduinoCliConfigPath();
  const dataDir = path.join(root, 'data');
  const downloadsDir = path.join(root, 'downloads');
  const userDir = path.join(root, 'user');

  ensureDirSync(root);
  ensureDirSync(dataDir);
  ensureDirSync(downloadsDir);
  ensureDirSync(userDir);
  ensureDirSync(getArduinoCliDownloadDir());
  ensureDirSync(getArduinoSketchesDir());

  const additionalUrls = getAllAdditionalUrls()
    .map((url) => `    - ${url}`)
    .join('\n');

  const config = [
    'board_manager:',
    '  additional_urls:',
    additionalUrls || '    []',
    'directories:',
    `  data: "${yamlSafePath(dataDir)}"`,
    `  downloads: "${yamlSafePath(downloadsDir)}"`,
    `  user: "${yamlSafePath(userDir)}"`,
    'updater:',
    '  enable_notification: false',
    '',
  ].join('\n');

  fs.writeFileSync(configPath, config, 'utf8');
  return configPath;
}

function findExecutableInPath() {
  return new Promise((resolve) => {
    const command = process.platform === 'win32' ? 'where' : 'which';
    const lookup = spawn(command, ['arduino-cli'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    let stdout = '';
    lookup.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    lookup.on('error', () => resolve(null));
    lookup.on('close', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }

      const firstLine = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);
      resolve(firstLine || null);
    });
  });
}

async function resolveArduinoCliPath({ autoDownload = false } = {}) {
  const envPath = process.env.ARDUINO_CLI_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  const bundledPath = getBundledArduinoCliPath();
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  const pathLookup = await findExecutableInPath();
  if (pathLookup && fs.existsSync(pathLookup)) {
    return pathLookup;
  }

  if (!autoDownload) {
    return null;
  }

  return downloadArduinoCli();
}

function getAssetMatcher() {
  if (process.platform === 'win32') {
    if (process.arch === 'arm64') {
      return /windows.*arm64.*\.zip$/i;
    }
    return /windows.*64bit.*\.zip$/i;
  }

  if (process.platform === 'darwin') {
    if (process.arch === 'arm64') {
      return /(macos|darwin).*arm64.*\.(zip|tar\.gz)$/i;
    }
    return /(macos|darwin).*(64bit|amd64|x64).*\.(zip|tar\.gz)$/i;
  }

  if (process.arch === 'arm64') {
    return /linux.*arm64.*\.(tar\.gz|zip)$/i;
  }

  return /linux.*64bit.*\.(tar\.gz|zip)$/i;
}

async function downloadFile(url, destinationPath) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'OtisIDE',
      Accept: 'application/octet-stream, application/json;q=0.9, */*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download Arduino CLI (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(destinationPath, Buffer.from(arrayBuffer));
}

function findFileRecursive(rootDir, fileName) {
  const queue = [rootDir];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || !fs.existsSync(current)) continue;

    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name === fileName) {
        return entryPath;
      }
    }
  }

  return null;
}

function runProcess(command, args, options = {}) {
  const {
    cwd,
    env,
    onStdout,
    onStderr,
    allowFailure = false,
  } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...env,
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      onStdout?.(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      onStderr?.(text);
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0 && !allowFailure) {
        const error = new Error(
          stderr.trim() ||
            stdout.trim() ||
            `${command} exited with code ${code}`
        );
        error.code = code;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }

      resolve({
        code: code ?? 0,
        stdout,
        stderr,
      });
    });
  });
}

async function extractArchive(archivePath, destinationPath) {
  ensureDirSync(destinationPath);

  try {
    await runProcess('tar', ['-xf', archivePath, '-C', destinationPath]);
    return;
  } catch (error) {
    if (process.platform !== 'win32') {
      throw error;
    }
  }

  const command = [
    '-NoProfile',
    '-Command',
    `Expand-Archive -Path '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destinationPath.replace(/'/g, "''")}' -Force`,
  ];
  await runProcess('powershell', command);
}

async function downloadArduinoCli() {
  const cliDir = getArduinoCliDownloadDir();
  ensureDirSync(cliDir);

  const releaseResponse = await fetch(
    'https://api.github.com/repos/arduino/arduino-cli/releases/latest',
    {
      headers: {
        'User-Agent': 'OtisIDE',
        Accept: 'application/vnd.github+json',
      },
    }
  );

  if (!releaseResponse.ok) {
    throw new Error(
      `Arduino CLI release metadata could not be fetched (${releaseResponse.status})`
    );
  }

  const release = await releaseResponse.json();
  const assetMatcher = getAssetMatcher();
  const asset = Array.isArray(release.assets)
    ? release.assets.find((item) => assetMatcher.test(item.name || ''))
    : null;

  if (!asset?.browser_download_url) {
    throw new Error('This platform is not supported by the Arduino CLI downloader.');
  }

  const tempRoot = path.join(os.tmpdir(), `arduino-cli-${Date.now()}`);
  const archivePath = path.join(tempRoot, asset.name);
  const extractDir = path.join(tempRoot, 'extract');
  ensureDirSync(tempRoot);
  ensureDirSync(extractDir);

  await downloadFile(asset.browser_download_url, archivePath);
  await extractArchive(archivePath, extractDir);

  const extractedExecutable = findFileRecursive(
    extractDir,
    getArduinoCliExecutableName()
  );
  if (!extractedExecutable) {
    throw new Error('Arduino CLI executable could not be extracted.');
  }

  const targetPath = getBundledArduinoCliPath();
  fs.copyFileSync(extractedExecutable, targetPath);
  if (process.platform !== 'win32') {
    fs.chmodSync(targetPath, 0o755);
  }

  return targetPath;
}

function parseCliVersion(stdout, stderr) {
  const combined = `${stdout}\n${stderr}`.trim();
  if (!combined) return '';

  try {
    const parsed = JSON.parse(combined);
    return (
      parsed.VersionString ||
      parsed.version ||
      parsed.versionString ||
      ''
    );
  } catch {
    const match = combined.match(/version[:\s]+([0-9][^\s]*)/i);
    return match?.[1] || combined.split(/\r?\n/)[0] || '';
  }
}

async function runArduinoCli(args, options = {}) {
  const cliPath = await resolveArduinoCliPath({
    autoDownload: options.autoDownload ?? false,
  });

  if (!cliPath) {
    throw new Error('Arduino CLI is not installed yet.');
  }

  const configPath = ensureArduinoCliConfig();
  const result = await runProcess(
    cliPath,
    ['--config-file', configPath, ...args],
    options
  );

  return {
    ...result,
    cliPath,
  };
}

async function getArduinoCliStatus({ autoDownload = false } = {}) {
  const cliPath = await resolveArduinoCliPath({ autoDownload });
  if (!cliPath) {
    return {
      cliAvailable: false,
      cliVersion: '',
      cliPath: '',
    };
  }

  const versionResult = await runProcess(
    cliPath,
    ['version', '--format', 'json'],
    {
      allowFailure: true,
    }
  );

  return {
    cliAvailable: true,
    cliVersion: parseCliVersion(versionResult.stdout, versionResult.stderr),
    cliPath,
  };
}

async function ensureArduinoIdeReady({ force = false } = {}) {
  if (idePreparationPromise && !force) {
    return idePreparationPromise;
  }

  idePreparationPromise = (async () => {
    const status = await getArduinoCliStatus({ autoDownload: true });
    if (!status.cliAvailable) {
      throw new Error('Arduino CLI could not be prepared.');
    }

    if (force || Date.now() - lastIndexRefreshAt > INDEX_REFRESH_MS) {
      await runArduinoCli(['core', 'update-index'], {
        autoDownload: false,
      });
      lastIndexRefreshAt = Date.now();
    }

    return status;
  })();

  try {
    return await idePreparationPromise;
  } finally {
    idePreparationPromise = null;
  }
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function dedupeStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function getBoardProfile(boardType) {
  return BOARD_UPLOAD_PROFILES[boardType] || null;
}

function getBoardAliases(boardType) {
  const profile = getBoardProfile(boardType);
  if (!profile) return [];
  return dedupeStrings([
    profile.label,
    ...(profile.aliases || []),
    ...(profile.searchQueries || []),
  ]);
}

function scoreBoardCandidate(candidate, boardType) {
  const profile = getBoardProfile(boardType);
  if (!profile) return -1;

  const normalizedName = normalizeToken(candidate.name);
  const normalizedFqbn = normalizeToken(candidate.fqbn);
  let score = 0;

  for (const alias of getBoardAliases(boardType)) {
    const normalizedAlias = normalizeToken(alias);
    if (!normalizedAlias) continue;

    if (normalizedAlias === normalizedName) score += 120;
    if (normalizedName.includes(normalizedAlias)) score += 55;
    if (normalizedAlias.includes(normalizedName) && normalizedName) score += 30;
    if (normalizedFqbn.includes(normalizedAlias)) score += 18;
  }

  if (profile.fallbackFqbn) {
    const fallbackBase = profile.fallbackFqbn.split(':').slice(0, 3).join(':');
    if (candidate.fqbn === profile.fallbackFqbn) score += 150;
    if (candidate.fqbn.startsWith(fallbackBase)) score += 85;
  }

  if (candidate.platform && normalizeToken(candidate.platform).includes(normalizeToken(profile.label))) {
    score += 12;
  }

  return score;
}

function applyMenuDefaults(fqbn, boardType) {
  const profile = getBoardProfile(boardType);
  const menuDefaults = profile?.menuDefaults;

  if (!fqbn || !menuDefaults || Object.keys(menuDefaults).length === 0) {
    return fqbn;
  }

  const parts = fqbn.split(':');
  if (parts.length < 3) return fqbn;

  const prefix = parts.slice(0, 3).join(':');
  const existingOptions = new Map();
  const rawOptions = parts.slice(3).join(':');
  if (rawOptions) {
    for (const item of rawOptions.split(',')) {
      const [key, value] = item.split('=');
      if (key && value) {
        existingOptions.set(key, value);
      }
    }
  }

  for (const [key, value] of Object.entries(menuDefaults)) {
    if (!existingOptions.has(key)) {
      existingOptions.set(key, value);
    }
  }

  if (existingOptions.size === 0) {
    return prefix;
  }

  return `${prefix}:${[...existingOptions.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .join(',')}`;
}

function parseBoardSearchResults(stdout) {
  const parsed = parseJsonLoose(stdout);
  const jsonBoards = parsed?.boards || parsed?.results || parsed?.items;
  if (Array.isArray(jsonBoards)) {
    return jsonBoards
      .map((item) => ({
        name: item.name || item.boardName || item.board_name || '',
        fqbn: item.fqbn || item.FQBN || '',
        platform:
          item.platform?.name ||
          item.platform ||
          item.platform_name ||
          '',
      }))
      .filter((item) => item.name && item.fqbn);
  }

  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .slice(1)
    .map((line) => {
      const match = line.match(/^(.+?)\s{2,}([A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+(?:[:][^ ]+)?)\s*(.*)$/);
      if (!match) return null;
      return {
        name: match[1].trim(),
        fqbn: match[2].trim(),
        platform: match[3].trim(),
      };
    })
    .filter(Boolean);
}

async function resolveBoardFqbn(boardType) {
  if (boardFqbnCache.has(boardType)) {
    return boardFqbnCache.get(boardType);
  }

  const profile = getBoardProfile(boardType);
  if (!profile) {
    throw new Error(`Unsupported board type: ${boardType}`);
  }

  await ensureArduinoIdeReady();

  const candidates = [];

  for (const query of profile.searchQueries || []) {
    const result = await runArduinoCli(
      ['board', 'search', query, '--format', 'json'],
      {
        allowFailure: true,
      }
    );

    candidates.push(...parseBoardSearchResults(result.stdout));
  }

  const uniqueCandidates = [];
  const seenFqbns = new Set();

  for (const candidate of candidates) {
    if (!candidate?.fqbn || seenFqbns.has(candidate.fqbn)) continue;
    seenFqbns.add(candidate.fqbn);
    uniqueCandidates.push(candidate);
  }

  uniqueCandidates.sort(
    (a, b) => scoreBoardCandidate(b, boardType) - scoreBoardCandidate(a, boardType)
  );

  const winner = uniqueCandidates.find(
    (candidate) => scoreBoardCandidate(candidate, boardType) > 0
  );

  const fqbn = applyMenuDefaults(
    winner?.fqbn || profile.fallbackFqbn || '',
    boardType
  );

  if (!fqbn) {
    throw new Error(
      `No Arduino CLI board definition could be resolved for ${profile.label}.`
    );
  }

  boardFqbnCache.set(boardType, fqbn);
  return fqbn;
}

function getCoreIdFromFqbn(fqbn) {
  return fqbn.split(':').slice(0, 2).join(':');
}

function parseInstalledCores(stdout) {
  const parsed = parseJsonLoose(stdout);
  const items = parsed?.platforms || parsed?.installed_platforms || parsed?.items;
  if (Array.isArray(items)) {
    return items
      .map((item) => item.id || item.ID || item.platform?.id || '')
      .filter(Boolean);
  }

  return stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s{2,}/)[0])
    .filter(Boolean);
}

async function ensureCoreInstalled(fqbn) {
  const coreId = getCoreIdFromFqbn(fqbn);
  if (!coreId) {
    throw new Error('FQBN is missing a valid core identifier.');
  }

  const listResult = await runArduinoCli(['core', 'list', '--format', 'json'], {
    allowFailure: true,
  });
  const installedCores = new Set(parseInstalledCores(listResult.stdout));

  if (installedCores.has(coreId)) {
    return coreId;
  }

  await runArduinoCli(['core', 'install', coreId]);
  return coreId;
}

function trimConsoleLines(lines) {
  return lines.slice(-MAX_CONSOLE_LINES);
}

function toConsoleLines(text, type) {
  return trimConsoleLines(
    String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map((line) => ({ type, text: line }))
  );
}

function formatError(error) {
  return (
    error?.stderr?.trim() ||
    error?.stdout?.trim() ||
    error?.message ||
    String(error)
  );
}

function makeSketchDirectory() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+$/, '')
    .replace('T', '-');
  const sketchName = `sketch-${timestamp}`;
  const sketchDir = path.join(getArduinoSketchesDir(), sketchName);
  ensureDirSync(sketchDir);
  return {
    sketchName,
    sketchDir,
    sketchFilePath: path.join(sketchDir, `${sketchName}.ino`),
  };
}

async function listSerialPortsSafe() {
  try {
    return await SerialPort.list();
  } catch {
    return [];
  }
}

function normalizePortRecord(port) {
  return {
    path: port.path || port.address || '',
    label: port.label || port.address || port.path || '',
    protocol: port.protocol || 'serial',
    protocolLabel:
      port.protocolLabel ||
      port.protocol_label ||
      (port.protocol === 'serial' || !port.protocol ? 'Serial' : String(port.protocol)),
    manufacturer:
      port.manufacturer ||
      port.properties?.manufacturer ||
      port.properties?.vendorName ||
      '',
    serialNumber:
      port.serialNumber ||
      port.properties?.serialNumber ||
      port.properties?.serialnumber ||
      '',
    vendorId:
      port.vendorId ||
      port.properties?.vid ||
      port.properties?.vendorId ||
      '',
    productId:
      port.productId ||
      port.properties?.pid ||
      port.properties?.productId ||
      '',
    fqbn: port.fqbn || '',
    boardName: port.boardName || '',
    boardType: port.boardType || null,
    detected: Boolean(port.detected || port.boardName || port.fqbn),
    serialCapable: port.serialCapable ?? true,
  };
}

function parseDetectedPorts(stdout) {
  const parsed = parseJsonLoose(stdout);
  const rawPorts = Array.isArray(parsed)
    ? parsed
    : parsed?.detected_ports || parsed?.ports || [];

  if (!Array.isArray(rawPorts)) {
    return [];
  }

  return rawPorts.map((entry) => {
    const port = entry.port || entry;
    const properties = port.properties || {};
    const matchingBoards = toArray(
      entry.matching_boards || entry.matchingBoards || entry.boards
    );
    const firstBoard = matchingBoards[0] || {};

    return normalizePortRecord({
      path: port.address || port.path || port.label || '',
      label: port.label || port.address || port.path || '',
      protocol: port.protocol || '',
      protocolLabel: port.protocol_label || port.protocolLabel || '',
      manufacturer: properties.manufacturer || properties.vendorName || '',
      serialNumber: properties.serialNumber || properties.serialnumber || '',
      vendorId: properties.vid || properties.vendorId || '',
      productId: properties.pid || properties.productId || '',
      fqbn: firstBoard.fqbn || firstBoard.FQBN || '',
      boardName: firstBoard.name || firstBoard.boardName || '',
      detected: matchingBoards.length > 0,
      serialCapable:
        String(port.protocol || '').toLowerCase() === 'serial' ||
        /^com\d+$/i.test(String(port.address || port.path || port.label || '')),
    });
  });
}

function inferBoardTypeFromDetectedInfo(port) {
  const haystack = normalizeToken(
    [port.boardName, port.fqbn, port.manufacturer, port.label].filter(Boolean).join(' ')
  );
  if (!haystack) return null;

  const rankedMatches = BOARD_TYPES.map((boardType) => {
    const aliasScore = getBoardAliases(boardType).reduce((score, alias) => {
      const normalizedAlias = normalizeToken(alias);
      if (!normalizedAlias) return score;
      return haystack.includes(normalizedAlias)
        ? Math.max(score, normalizedAlias.length)
        : score;
    }, 0);

    return { boardType, score: aliasScore };
  }).sort((a, b) => b.score - a.score);

  if (rankedMatches[0]?.score > 0) {
    return rankedMatches[0].boardType;
  }

  if (haystack.includes('nodemcuv2') || haystack.includes('nodemcu')) {
    return port.manufacturer.toLowerCase().includes('lolin')
      ? 'nodemcu-v3'
      : 'nodemcu';
  }

  if (haystack.includes('d1mini') || haystack.includes('wemos')) {
    return 'wemos-d1-mini';
  }

  if (haystack.includes('featheresp32') || haystack.includes('huzzah32')) {
    return 'feather-huzzah32';
  }

  if (haystack.includes('rpipico') || haystack.includes('raspberrypipico')) {
    return 'pico';
  }

  return null;
}

async function listHardwareDevices() {
  const serialPorts = await listSerialPortsSafe();
  const serialMap = new Map(
    serialPorts.map((port) => [
      getNormalizedPathKey(port.path),
      normalizePortRecord({
        ...port,
        detected: false,
        serialCapable: true,
      }),
    ])
  );

  const cliStatus = await getArduinoCliStatus({ autoDownload: false });
  let cliPorts = [];

  if (cliStatus.cliAvailable) {
    const boardListResult = await runArduinoCli(
      ['board', 'list', '--format', 'json'],
      {
        allowFailure: true,
      }
    );
    cliPorts = parseDetectedPorts(boardListResult.stdout);
  }

  for (const cliPort of cliPorts) {
    const key = getNormalizedPathKey(cliPort.path);
    const existing = serialMap.get(key) || normalizePortRecord(cliPort);
    const merged = normalizePortRecord({
      ...existing,
      ...cliPort,
      manufacturer: cliPort.manufacturer || existing.manufacturer,
      serialNumber: cliPort.serialNumber || existing.serialNumber,
      vendorId: cliPort.vendorId || existing.vendorId,
      productId: cliPort.productId || existing.productId,
      serialCapable: existing.serialCapable || cliPort.serialCapable,
    });
    serialMap.set(key, merged);
  }

  const ports = [...serialMap.values()]
    .map((port) => ({
      ...port,
      boardType: inferBoardTypeFromDetectedInfo(port),
    }))
    .sort((a, b) => {
      if (a.detected && !b.detected) return -1;
      if (!a.detected && b.detected) return 1;
      return a.path.localeCompare(b.path);
    });

  return {
    cliAvailable: cliStatus.cliAvailable,
    cliVersion: cliStatus.cliVersion,
    ports,
  };
}

async function suspendSerialMonitorForPort(portPath) {
  if (!activeSerialMonitor || activeSerialMonitor.path !== portPath) {
    return null;
  }

  const snapshot = {
    path: activeSerialMonitor.path,
    baudRate: activeSerialMonitor.baudRate,
  };
  await closeSerialMonitor();
  return snapshot;
}

async function restoreSerialMonitor(snapshot) {
  if (!snapshot?.path) return;
  try {
    await openSerialMonitor(snapshot.path, snapshot.baudRate);
  } catch {
    // Ignore monitor restore failures after upload.
  }
}

async function verifyOrUploadSketch({
  boardType,
  code,
  portPath,
  upload = false,
}) {
  if (!code || !String(code).trim()) {
    throw new Error('Arduino code is empty.');
  }

  await ensureArduinoIdeReady();

  let activeBoardType = boardType;
  let detectedFqbn = '';
  let detectedBoardName = '';

  if (portPath) {
    const hardwareState = await listHardwareDevices();
    const selectedPort = hardwareState.ports.find((port) => port.path === portPath);
    if (selectedPort?.boardType) {
      activeBoardType = selectedPort.boardType;
    }
    if (selectedPort?.fqbn) {
      detectedFqbn = selectedPort.fqbn;
    }
    if (selectedPort?.boardName) {
      detectedBoardName = selectedPort.boardName;
    }
  }

  const fqbn = applyMenuDefaults(
    detectedFqbn || (await resolveBoardFqbn(activeBoardType)),
    activeBoardType
  );
  await ensureCoreInstalled(fqbn);

  const { sketchDir, sketchFilePath } = makeSketchDirectory();
  fs.writeFileSync(sketchFilePath, code, 'utf8');

  const logs = [];
  const compileResult = await runArduinoCli([
    'compile',
    '--fqbn',
    fqbn,
    sketchDir,
    '--verbose',
  ]);

  logs.push(...toConsoleLines(compileResult.stdout, 'upload'));
  logs.push(...toConsoleLines(compileResult.stderr, 'upload'));

  if (!upload) {
    return {
      ok: true,
      boardType: activeBoardType,
      boardName: detectedBoardName || getBoardProfile(activeBoardType)?.label || '',
      fqbn,
      logs: trimConsoleLines(logs),
    };
  }

  if (!portPath) {
    throw new Error('No connected USB device is selected.');
  }

  const suspendedMonitor = await suspendSerialMonitorForPort(portPath);

  try {
    const uploadResult = await runArduinoCli([
      'upload',
      '--port',
      portPath,
      '--fqbn',
      fqbn,
      sketchDir,
      '--verbose',
    ]);

    logs.push(...toConsoleLines(uploadResult.stdout, 'upload'));
    logs.push(...toConsoleLines(uploadResult.stderr, 'upload'));

    return {
      ok: true,
      boardType: activeBoardType,
      boardName: detectedBoardName || getBoardProfile(activeBoardType)?.label || '',
      fqbn,
      logs: trimConsoleLines(logs),
    };
  } finally {
    await restoreSerialMonitor(suspendedMonitor);
  }
}

function sendToRenderer(channel, payload) {
  const mainWindow = getMainWindow();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

async function closeSerialMonitor() {
  if (!activeSerialMonitor) {
    return { ok: true };
  }

  const monitor = activeSerialMonitor;
  activeSerialMonitor = null;

  try {
    monitor.parser?.removeAllListeners();
    monitor.port?.removeAllListeners('error');
    monitor.port?.removeAllListeners('close');

    if (monitor.port?.isOpen) {
      await new Promise((resolve) => {
        monitor.port.close(() => resolve());
      });
    }
  } catch {
    // Ignore close failures.
  }

  sendToRenderer('ide-serial-status', {
    open: false,
    path: monitor.path,
  });

  return { ok: true };
}

async function openSerialMonitor(portPath, baudRate = 115200) {
  if (!portPath) {
    throw new Error('A serial-capable port must be selected first.');
  }

  if (
    activeSerialMonitor &&
    activeSerialMonitor.path === portPath &&
    activeSerialMonitor.baudRate === baudRate
  ) {
    return { ok: true };
  }

  await closeSerialMonitor();

  const port = new SerialPort({
    path: portPath,
    baudRate,
    autoOpen: false,
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

  parser.on('data', (line) => {
    sendToRenderer('ide-serial-data', {
      path: portPath,
      line: String(line).replace(/\r$/, ''),
    });
  });

  port.on('error', (error) => {
    sendToRenderer('ide-serial-error', {
      path: portPath,
      error: formatError(error),
    });
  });

  port.on('close', () => {
    if (activeSerialMonitor?.path === portPath) {
      activeSerialMonitor = null;
    }

    sendToRenderer('ide-serial-status', {
      open: false,
      path: portPath,
    });
  });

  await new Promise((resolve, reject) => {
    port.open((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  activeSerialMonitor = {
    path: portPath,
    baudRate,
    port,
    parser,
  };

  sendToRenderer('ide-serial-status', {
    open: true,
    path: portPath,
    baudRate,
  });

  return { ok: true };
}

async function prepareArduinoIde(payload = {}) {
  const status = await ensureArduinoIdeReady({ force: Boolean(payload.force) });
  return {
    ok: true,
    ...status,
  };
}

async function getHardwareList() {
  const hardware = await listHardwareDevices();
  return {
    ok: true,
    ...hardware,
  };
}

async function verifyHardwareSketch(payload = {}) {
  try {
    const result = await verifyOrUploadSketch({
      boardType: payload.boardType,
      code: payload.code,
      portPath: payload.portPath,
      upload: false,
    });

    return result;
  } catch (error) {
    return {
      ok: false,
      error: formatError(error),
      logs: toConsoleLines(formatError(error), 'error'),
    };
  }
}

async function uploadHardwareSketch(payload = {}) {
  try {
    const result = await verifyOrUploadSketch({
      boardType: payload.boardType,
      code: payload.code,
      portPath: payload.portPath,
      upload: true,
    });

    return result;
  } catch (error) {
    return {
      ok: false,
      error: formatError(error),
      logs: toConsoleLines(formatError(error), 'error'),
    };
  }
}

async function openHardwareSerialMonitor(payload = {}) {
  try {
    return await openSerialMonitor(payload.portPath, Number(payload.baudRate) || 115200);
  } catch (error) {
    return {
      ok: false,
      error: formatError(error),
    };
  }
}

async function closeHardwareSerialMonitor() {
  return closeSerialMonitor();
}

async function disposeArduinoIde() {
  await closeSerialMonitor();
}

module.exports = {
  setArduinoIdeWindowGetter,
  prepareArduinoIde,
  getHardwareList,
  verifyHardwareSketch,
  uploadHardwareSketch,
  openHardwareSerialMonitor,
  closeHardwareSerialMonitor,
  disposeArduinoIde,
};

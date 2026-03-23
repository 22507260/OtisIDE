const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const sourcePath = path.join(rootDir, 'build', 'icon-source.png');
const pngOutputPath = path.join(rootDir, 'build', 'icon.png');
const icoOutputPath = path.join(rootDir, 'build', 'icon.ico');
const generatorScript = path.join(__dirname, 'generate-icons.ps1');

function log(message) {
  console.log(`[build:icons] ${message}`);
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function getModifiedTime(filePath) {
  return fs.statSync(filePath).mtimeMs;
}

function outputsExist() {
  return fileExists(pngOutputPath) && fileExists(icoOutputPath);
}

function outputsAreFresh() {
  if (!fileExists(sourcePath) || !outputsExist()) {
    return false;
  }

  const sourceModified = getModifiedTime(sourcePath);
  return getModifiedTime(pngOutputPath) >= sourceModified && getModifiedTime(icoOutputPath) >= sourceModified;
}

function runPowerShellGenerator() {
  const result = spawnSync(
    'powershell',
    ['-ExecutionPolicy', 'Bypass', '-File', generatorScript],
    {
      cwd: rootDir,
      stdio: 'inherit',
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (outputsAreFresh()) {
  log('Using committed icon assets.');
  process.exit(0);
}

if (outputsExist() && process.platform !== 'win32') {
  log('Icon source is newer than generated assets, but the committed icons are reusable on this platform.');
  process.exit(0);
}

if (process.platform !== 'win32') {
  if (outputsExist()) {
    log('Using committed icon assets.');
    process.exit(0);
  }

  console.error('[build:icons] Missing build/icon.png or build/icon.ico. Generate them on Windows first.');
  process.exit(1);
}

if (!fileExists(sourcePath)) {
  console.error('[build:icons] Missing build/icon-source.png.');
  process.exit(1);
}

log('Generating desktop icons from build/icon-source.png...');
runPowerShellGenerator();

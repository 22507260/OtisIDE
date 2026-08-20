#!/usr/bin/env node
/**
 * Copies the installer produced by `npm run electron:build` into the download
 * site and refreshes the version, file size and checksum shown on the page.
 *
 * Usage: npm run website:prepare
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const version = pkg.version;
const installerName = `OtisIDE-${version}-x64.exe`;

const releasePath = path.join(root, 'release', installerName);
const downloadsDir = path.join(root, 'website', 'downloads');
const targetPath = path.join(downloadsDir, installerName);
const pagePath = path.join(root, 'website', 'index.html');

if (!fs.existsSync(releasePath)) {
  console.error(
    `Installer not found: ${releasePath}\nRun "npm run electron:build" first.`
  );
  process.exit(1);
}

fs.mkdirSync(downloadsDir, { recursive: true });

// Drop installers left over from earlier versions.
for (const entry of fs.readdirSync(downloadsDir)) {
  if (entry.endsWith('.exe') && entry !== installerName) {
    fs.unlinkSync(path.join(downloadsDir, entry));
    console.log(`removed old installer: ${entry}`);
  }
}

fs.copyFileSync(releasePath, targetPath);

const installer = fs.readFileSync(targetPath);
const sizeLabel = `${Math.round(installer.length / (1024 * 1024))} MB`;
const sha256 = crypto.createHash('sha256').update(installer).digest('hex');

let page = fs.readFileSync(pagePath, 'utf8');
page = page
  .replace(/releases\/download\/v\d+\.\d+\.\d+\//g, `releases/download/v${version}/`)
  .replace(/OtisIDE-\d+\.\d+\.\d+-x64\.exe/g, installerName)
  .replace(/(<b>)\d+\.\d+\.\d+(<\/b>)/g, `$1${version}$2`)
  .replace(/Sürüm \d+\.\d+\.\d+/g, `Sürüm ${version}`)
  .replace(/(<span data-file-size>)[^<]*(<\/span>)/g, `$1${sizeLabel}$2`)
  .replace(/(<code data-sha256>)[^<]*(<\/code>)/g, `$1${sha256}$2`);
fs.writeFileSync(pagePath, page, 'utf8');

console.log(`website/downloads/${installerName} (${sizeLabel})`);
console.log(`sha256: ${sha256}`);
console.log('website/index.html updated');

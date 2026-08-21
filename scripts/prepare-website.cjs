#!/usr/bin/env node
/**
 * Refreshes the version, file size and checksum shown on the download page.
 *
 * The installer is normally built by the release workflow rather than locally,
 * so the published asset is measured straight from GitHub. When a local build
 * exists it is used instead, and also copied into website/downloads/ for anyone
 * deploying the folder by hand.
 *
 * Usage: npm run website:prepare
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const version = pkg.version;
const installerName = `OtisIDE-${version}-x64.exe`;
const assetUrl = `https://github.com/22507260/OtisIDE/releases/download/v${version}/${installerName}`;

const releasePath = path.join(root, 'release', installerName);
const downloadsDir = path.join(root, 'website', 'downloads');
const pagePath = path.join(root, 'website', 'index.html');

/** Hashes a published asset without keeping it on disk. */
function measurePublishedAsset(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'OtisIDE-website-prepare' } }, (response) => {
        const { statusCode, headers } = response;

        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          response.resume();
          if (redirectsLeft === 0) {
            reject(new Error('Too many redirects while fetching the installer'));
            return;
          }
          resolve(measurePublishedAsset(headers.location, redirectsLeft - 1));
          return;
        }

        if (statusCode !== 200) {
          response.resume();
          reject(new Error(`Installer not published yet (HTTP ${statusCode}): ${url}`));
          return;
        }

        const hash = crypto.createHash('sha256');
        let size = 0;
        response.on('data', (chunk) => {
          size += chunk.length;
          hash.update(chunk);
        });
        response.on('end', () => resolve({ size, sha256: hash.digest('hex') }));
        response.on('error', reject);
      })
      .on('error', reject);
  });
}

function measureLocalBuild() {
  const installer = fs.readFileSync(releasePath);

  fs.mkdirSync(downloadsDir, { recursive: true });
  for (const entry of fs.readdirSync(downloadsDir)) {
    if (entry.endsWith('.exe') && entry !== installerName) {
      fs.unlinkSync(path.join(downloadsDir, entry));
      console.log(`removed old installer: ${entry}`);
    }
  }
  fs.copyFileSync(releasePath, path.join(downloadsDir, installerName));

  return {
    size: installer.length,
    sha256: crypto.createHash('sha256').update(installer).digest('hex'),
    source: `release/${installerName}`,
  };
}

async function main() {
  const measurement = fs.existsSync(releasePath)
    ? measureLocalBuild()
    : { ...(await measurePublishedAsset(assetUrl)), source: assetUrl };

  const sizeLabel = `${Math.round(measurement.size / (1024 * 1024))} MB`;

  let page = fs.readFileSync(pagePath, 'utf8');
  page = page
    .replace(/releases\/download\/v\d+\.\d+\.\d+\//g, `releases/download/v${version}/`)
    .replace(/OtisIDE-\d+\.\d+\.\d+-x64\.exe/g, installerName)
    .replace(/(<b>)\d+\.\d+\.\d+(<\/b>)/g, `$1${version}$2`)
    .replace(/Sürüm \d+\.\d+\.\d+/g, `Sürüm ${version}`)
    .replace(/(<span data-file-size>)[^<]*(<\/span>)/g, `$1${sizeLabel}$2`)
    .replace(/(<code data-sha256>)[^<]*(<\/code>)/g, `$1${measurement.sha256}$2`);
  fs.writeFileSync(pagePath, page, 'utf8');

  console.log(`measured: ${measurement.source} (${sizeLabel})`);
  console.log(`sha256: ${measurement.sha256}`);
  console.log('website/index.html updated');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

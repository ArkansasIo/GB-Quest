'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const [bundlePath, manifestPath] = process.argv.slice(2);
if (!bundlePath || !manifestPath) throw new Error('Usage: node tools/write-game-update-manifest.cjs <bundle.html> <manifest.json>');
const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const taggedVersion = String(process.env.GITHUB_REF_NAME || '').replace(/^desktop-v/, '');
if (taggedVersion && taggedVersion !== packageInfo.version) throw new Error(`Release tag ${taggedVersion} must match package.json version ${packageInfo.version}.`);
const bundle = fs.readFileSync(bundlePath);
const manifest = {
  version: packageInfo.version,
  file: 'gbquest-fullscreen.html',
  size: bundle.length,
  sha256: crypto.createHash('sha256').update(bundle).digest('hex'),
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

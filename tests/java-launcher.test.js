import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { needs, IMAGES } from './support/needs.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Java launcher metadata points to a real manifest entry class', { skip: needs('java-launcher/src/main/java/io/arkansasio/gbquest/Main.java') }, () => {
  const metadata = JSON.parse(read('game-metadata.json'));
  const pom = read('java-launcher/pom.xml');
  const source = read('java-launcher/src/main/java/io/arkansasio/gbquest/Main.java');
  assert.equal(metadata.java.jarClassName, 'io.arkansasio.gbquest.Main');
  assert.match(pom, /<mainClass>io\.arkansasio\.gbquest\.Main<\/mainClass>/);
  assert.match(source, /package io\.arkansasio\.gbquest;/);
  assert.match(source, /public static void main\(String\[\] args\)/);
});

test('Java launcher opens the generated full-window HTML build by default', { skip: needs('java-launcher/src/main/java/io/arkansasio/gbquest/Main.java') }, () => {
  const source = read('java-launcher/src/main/java/io/arkansasio/gbquest/Main.java');
  assert.match(source, /Path\.of\("dist",\s*"gbquest-fullscreen\.html"\)/);
  assert.match(source, /Desktop\.getDesktop\(\)\.browse\(uri\)/);
  assert.match(source, /Files\.isRegularFile\(gameFile\)/);
});

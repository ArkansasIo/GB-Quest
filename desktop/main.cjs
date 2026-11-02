'use strict';

const { app, BrowserWindow, Menu, dialog, session, shell, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');

const GAME_FILE = path.join(__dirname, '..', 'dist', 'gbquest-fullscreen.html');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'desktop-settings.json');
const USER_DATA = app.getPath('userData');
const UPDATE_DIR = path.join(USER_DATA, 'game-updates');
const UPDATE_STATE = path.join(UPDATE_DIR, 'current.json');
const STORAGE_MIRROR = path.join(USER_DATA, 'game-storage-mirror.json');
const REPO = 'ArkansasIo/GB-Quest';
const BACKEND_OPTIONS = process.platform === 'win32'
  ? [
      ['auto', 'Automatic (recommended)'],
      ['directx11', 'DirectX 11'],
      ['directx12', 'DirectX 12 via D3D11on12'],
      ['vulkan', 'Vulkan'],
      ['opengl', 'OpenGL'],
    ]
  : process.platform === 'darwin'
    ? [['auto', 'Automatic (recommended)'], ['metal', 'Apple Metal'], ['opengl', 'OpenGL']]
    : [['auto', 'Automatic (recommended)'], ['vulkan', 'Vulkan'], ['opengl', 'OpenGL']];
function readBackend() {
  try {
    const value = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')).graphicsBackend;
    return BACKEND_OPTIONS.some(([key]) => key === value) ? value : 'auto';
  } catch { return 'auto'; }
}
const graphicsBackend = readBackend();
const ANGLE_BACKENDS = { directx11: 'd3d11', directx12: 'd3d11on12', vulkan: 'vulkan', opengl: 'gl', metal: 'metal' };
if (ANGLE_BACKENDS[graphicsBackend]) {
  app.commandLine.appendSwitch('use-gl', 'angle');
  app.commandLine.appendSwitch('use-angle', ANGLE_BACKENDS[graphicsBackend]);
}
let gameWindow;

function activeGameFile() {
  try {
    const state = JSON.parse(fs.readFileSync(UPDATE_STATE, 'utf8'));
    if (!versionParts(state.version) || !isNewerVersion(state.version, app.getVersion())) return GAME_FILE;
    const file = path.join(UPDATE_DIR, `v${state.version}`, 'gbquest-fullscreen.html');
    return fs.existsSync(file) ? file : GAME_FILE;
  } catch { return GAME_FILE; }
}
function installedGameVersion() {
  try {
    const state = JSON.parse(fs.readFileSync(UPDATE_STATE, 'utf8'));
    const file = path.join(UPDATE_DIR, `v${state.version}`, 'gbquest-fullscreen.html');
    if (fs.existsSync(file) && isNewerVersion(state.version, app.getVersion())) return state.version;
  } catch {}
  return app.getVersion();
}

function requestBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects while contacting GitHub.'));
    const target = new URL(url);
    if (target.protocol !== 'https:') return reject(new Error('Updates must come from HTTPS.'));
    const req = https.get(target, { headers: { 'User-Agent': 'Shadowbane-Chronicles-Updater', Accept: 'application/vnd.github+json' }, timeout: 60000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); return resolve(requestBuffer(new URL(res.headers.location, target).href, redirects + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`GitHub returned HTTP ${res.statusCode}.`)); }
      const chunks = []; let size = 0;
      res.on('data', chunk => { size += chunk.length; if (size > 100 * 1024 * 1024) req.destroy(new Error('Update file exceeds the 100 MB safety limit.')); else chunks.push(chunk); });
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('timeout', () => req.destroy(new Error('GitHub update request timed out.')));
    req.on('error', reject);
  });
}

function versionParts(value) {
  const match = String(value).match(/^(?:desktop-)?v?(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}
function isNewerVersion(next, current) {
  const a = versionParts(next), b = versionParts(current);
  return !!a && !!b && a.some((n, i) => n > b[i] && a.slice(0, i).every((p, j) => p === b[j]));
}

async function checkForGameUpdates() {
  try {
    const release = JSON.parse((await requestBuffer(`https://api.github.com/repos/${REPO}/releases/latest`)).toString('utf8'));
    const latest = String(release.tag_name || '').replace(/^desktop-v/, '');
    const current = installedGameVersion();
    if (!versionParts(latest)) throw new Error('The latest GitHub release has an invalid version tag.');
    if (!isNewerVersion(latest, current)) {
      await dialog.showMessageBox(gameWindow, { type: 'info', title: 'Game is up to date', message: `You have game version ${current}.`, detail: `Latest GitHub release: ${latest}.` });
      return;
    }
    const assets = release.assets || [];
    const findAsset = name => assets.find(asset => asset.name === name);
    const manifestAsset = findAsset('game-update.json'), bundleAsset = findAsset('gbquest-fullscreen.html');
    if (!manifestAsset || !bundleAsset) throw new Error(`Release ${release.tag_name} is missing the game patch files.`);
    const manifest = JSON.parse((await requestBuffer(manifestAsset.browser_download_url)).toString('utf8'));
    if (manifest.version !== latest || manifest.file !== 'gbquest-fullscreen.html' || !/^[a-f0-9]{64}$/i.test(manifest.sha256 || '')) throw new Error('The GitHub update manifest is invalid or does not match this release.');
    const choice = await dialog.showMessageBox(gameWindow, { type: 'info', title: 'Game update available', message: `Download game version ${latest}?`, detail: 'The patch updates the bundled game and keeps your save data in your desktop profile.', buttons: ['Download update', 'Later'], defaultId: 0, cancelId: 1 });
    if (choice.response !== 0) return;
    const bundle = await requestBuffer(bundleAsset.browser_download_url);
    if (manifest.size !== bundle.length || crypto.createHash('sha256').update(bundle).digest('hex') !== manifest.sha256.toLowerCase()) throw new Error('The downloaded patch failed its size or SHA-256 integrity check.');
    const versionDir = path.join(UPDATE_DIR, `v${latest}`), destination = path.join(versionDir, manifest.file), temp = `${destination}.download`;
    fs.mkdirSync(versionDir, { recursive: true });
    fs.writeFileSync(temp, bundle);
    if (fs.existsSync(destination)) fs.unlinkSync(destination);
    fs.renameSync(temp, destination);
    const applied = await dialog.showMessageBox(gameWindow, { type: 'info', title: 'Update downloaded', message: `Game version ${latest} is ready.`, detail: 'Restart now to apply the patch. Your saved game will be preserved.', buttons: ['Restart now', 'Later'], defaultId: 0, cancelId: 1 });
    if (applied.response === 0) {
      const snapshot = await gameWindow.webContents.executeJavaScript(`(() => { try { window.GBQ?.saveGame?.(); } catch {} return Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]); })()`);
      if (!Array.isArray(snapshot)) throw new Error('Could not snapshot local game storage before applying the patch.');
      fs.writeFileSync(STORAGE_MIRROR, JSON.stringify(snapshot));
      const stateTemp = `${UPDATE_STATE}.tmp`;
      fs.writeFileSync(stateTemp, JSON.stringify({ version: latest, sha256: manifest.sha256 }, null, 2));
      if (fs.existsSync(UPDATE_STATE)) fs.unlinkSync(UPDATE_STATE);
      fs.renameSync(stateTemp, UPDATE_STATE);
      app.relaunch(); app.exit(0);
    }
  } catch (error) {
    await dialog.showMessageBox(gameWindow, { type: 'error', title: 'Update failed', message: 'The game could not check or apply the GitHub update.', detail: error.message });
  }
}

ipcMain.on('gbq:read-storage-mirror', event => {
  try { event.returnValue = JSON.parse(fs.readFileSync(STORAGE_MIRROR, 'utf8')); }
  catch { event.returnValue = null; }
});
ipcMain.on('gbq:storage-mirror-imported', () => {
  try { fs.unlinkSync(STORAGE_MIRROR); } catch {}
});

function chooseGraphicsBackend(backend) {
  if (backend === graphicsBackend) return;
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ graphicsBackend: backend }, null, 2));
  } catch (error) {
    dialog.showErrorBox('Graphics setting not saved', error.message);
    return;
  }
  const relaunch = () => { app.relaunch(); app.exit(0); };
  if (gameWindow && !gameWindow.isDestroyed()) {
    gameWindow.webContents.executeJavaScript('window.GBQ?.saveGame?.()').catch(() => {}).finally(relaunch);
  } else relaunch();
}

function installMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    { label: 'File', submenu: [ ...(isMac ? [] : [{ role: 'about' }, { type: 'separator' }]), { role: 'quit' }] },
    { label: 'View', submenu: [{ role: 'togglefullscreen' }, { type: 'separator' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }] },
    { label: 'Graphics API', submenu: BACKEND_OPTIONS.map(([key, label]) => ({
      label, type: 'radio', checked: graphicsBackend === key, click: () => chooseGraphicsBackend(key),
    })) },
    { label: 'Help', submenu: [
      { label: 'Check for Game Updates…', click: checkForGameUpdates },
      { type: 'separator' },
      { label: 'Open project page', click: () => shell.openExternal('https://github.com/ArkansasIo/GB-Quest') },
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  gameWindow = new BrowserWindow({
    title: 'Lost Kingdom of Shadowbane Chronicles',
    width: 1280,
    height: 900,
    minWidth: 640,
    minHeight: 576,
    backgroundColor: '#080a08',
    autoHideMenuBar: true,
    fullscreenable: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  gameWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  gameWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
  gameWindow.loadFile(activeGameFile());
  gameWindow.on('closed', () => { gameWindow = null; });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  installMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

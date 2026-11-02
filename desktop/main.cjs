'use strict';

const { app, BrowserWindow, Menu, dialog, session, shell, ipcMain, safeStorage } = require('electron');
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
const REALM_SESSION_FILE = path.join(USER_DATA, 'realm-session.bin');
let realmSession = null;
let gameLaunchContext = null;
let realmStreamController = null;
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
function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); }
  catch { return {}; }
}
function writeSettings(patch) {
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ ...readSettings(), ...patch }, null, 2), { mode: 0o600 });
}
function readBackend() {
  const value = readSettings().graphicsBackend;
  return BACKEND_OPTIONS.some(([key]) => key === value) ? value : 'auto';
}
function realmBaseUrl(input) {
  const raw = String(input || readSettings().realmUrl || 'http://127.0.0.1:8787').trim();
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error('Enter a valid realm URL, such as https://realm.example.com'); }
  const local = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) throw new Error('Realm connections must use HTTPS. HTTP is allowed only for localhost testing.');
  if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('Realm URL must not contain credentials, query parameters, or a fragment.');
  if (parsed.pathname !== '/' && parsed.pathname !== '') throw new Error('Enter the realm server base URL without an API path.');
  return parsed.origin;
}
function secureStorageAvailable() {
  try {
    return safeStorage.isEncryptionAvailable()
      && safeStorage.getSelectedStorageBackend?.() !== 'basic_text';
  } catch { return false; }
}
function loadRealmSession() {
  try {
    if (!secureStorageAvailable()) return;
    const token = safeStorage.decryptString(fs.readFileSync(REALM_SESSION_FILE));
    if (/^[0-9a-f]{64}$/.test(token)) realmSession = { token };
  } catch {}
}
async function realmRequest(base, endpoint, { method = 'GET', body: payload, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (payload !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(base + endpoint, {
    method, headers, body: payload === undefined ? undefined : JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) { const error = new Error(data.error || `Realm server returned HTTP ${response.status}.`); error.status = response.status; throw error; }
  return data;
}
function persistRealmSession(token) {
  realmSession = { token };
  if (!secureStorageAvailable()) return false;
  fs.mkdirSync(USER_DATA, { recursive: true });
  const encrypted = safeStorage.encryptString(token);
  fs.writeFileSync(REALM_SESSION_FILE, encrypted, { mode: 0o600 });
  return true;
}
function clearRealmSession() {
  realmSession = null;
  try { fs.unlinkSync(REALM_SESSION_FILE); } catch {}
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

const REALM_CENTERS = {
  na: ['Northstar', 'Ironwood', 'Sunreach', 'Stormhold'],
  eu: ['Crownfall', 'Evermere'],
  jp: ['Dawnveil', 'Mooncrest', 'Starfall', 'Ashen'],
  oc: ['Southern Cross'],
};
ipcMain.on('gbq:launch-game', (event, selection = {}) => {
  if (!gameWindow || event.sender !== gameWindow.webContents) return;
  const region = String(selection.region || '');
  const dataCenter = String(selection.dataCenter || '');
  const world = String(selection.world || '');
  const validWorld = region === 'oc' ? /^0[1-5]$/.test(world) : /^0[1-8]$/.test(world);
  if (!Object.hasOwn(REALM_CENTERS, region) || !REALM_CENTERS[region].includes(dataCenter) || !validWorld) {
    dialog.showErrorBox('Invalid realm selection', 'Choose a valid region, data center, and world.');
    return;
  }
  const characterSlot = selection.characterSlot === null || selection.characterSlot === undefined || selection.characterSlot === '' ? '' : String(selection.characterSlot);
  if (characterSlot && !/^[0-2]$/.test(characterSlot)) { dialog.showErrorBox('Invalid character selection', 'Choose one of the three cloud save slots.'); return; }
  gameLaunchContext = { region, dataCenter, world, characterSlot: characterSlot === '' ? null : Number(characterSlot) };
  gameWindow.setTitle(`Lost Kingdom of Shadowbane Chronicles — ${dataCenter} / World ${world}`);
  gameWindow.loadFile(activeGameFile(), { query: { region, dataCenter, world, characterSlot } });
});
ipcMain.on('gbq:check-updates', event => {
  if (gameWindow && event.sender === gameWindow.webContents) checkForGameUpdates();
});
ipcMain.on('gbq:open-project', event => {
  if (gameWindow && event.sender === gameWindow.webContents) shell.openExternal('https://github.com/ArkansasIo/GB-Quest');
});
ipcMain.on('gbq:open-docs', event => {
  if (gameWindow && event.sender === gameWindow.webContents) shell.openExternal('https://github.com/ArkansasIo/GB-Quest/tree/main/desktop');
});

ipcMain.handle('gbq:realm-check', async (event, input = {}) => {
  if (!gameWindow || event.sender !== gameWindow.webContents) throw new Error('Unauthorized launcher request.');
  const base = realmBaseUrl(input.url);
  writeSettings({ realmUrl: base });
  const [health, directory] = await Promise.all([
    realmRequest(base, '/api/health'),
    realmRequest(base, '/api/realms'),
  ]);
  return { ok: !!health.ok, realm: health.realm || 'Realm', players: Number(health.players) || 0, accounts: Number(health.accounts) || 0, realms: Array.isArray(directory.realms) ? directory.realms : [], url: base };
});
ipcMain.handle('gbq:realm-auth', async (event, input = {}) => {
  if (!gameWindow || event.sender !== gameWindow.webContents) throw new Error('Unauthorized launcher request.');
  const base = realmBaseUrl(input.url);
  const mode = input.mode === 'register' ? 'register' : 'login';
  const username = String(input.username || '').trim();
  const password = String(input.password || '');
  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) throw new Error('Username must be 3–16 letters, digits, or underscores.');
  if (password.length < 8 || password.length > 72) throw new Error('Password must be 8–72 characters.');
  const result = await realmRequest(base, `/api/${mode}`, { method: 'POST', body: { username, password } });
  if (!result.token || !result.account) throw new Error('Realm server returned an invalid session response.');
  const encrypted = persistRealmSession(result.token);
  writeSettings({ realmUrl: base });
  return { account: { id: result.account.id, name: result.account.name, created: result.account.created }, persistentSession: encrypted };
});
ipcMain.handle('gbq:realm-session', async event => {
  if (!gameWindow || event.sender !== gameWindow.webContents) throw new Error('Unauthorized launcher request.');
  if (!realmSession) return { authenticated: false };
  try {
    const base = realmBaseUrl();
    const result = await realmRequest(base, '/api/me', { token: realmSession.token });
    return { authenticated: true, account: result.account || null };
  } catch (error) {
    if (/401|Log in first|HTTP 401/i.test(error.message)) clearRealmSession();
    return { authenticated: false, error: error.message };
  }
});
ipcMain.handle('gbq:realm-saves', async event => {
  if (!gameWindow || event.sender !== gameWindow.webContents) throw new Error('Unauthorized launcher request.');
  if (!realmSession) throw new Error('Sign in to view cloud characters.');
  const base = realmBaseUrl();
  const result = await realmRequest(base, '/api/saves', { token: realmSession.token });
  return Array.isArray(result.slots) ? result.slots : [];
});
ipcMain.handle('gbq:game-session', async event => {
  if (!gameWindow || event.sender !== gameWindow.webContents || !event.senderFrame.url.startsWith('file://')) throw new Error('Unauthorized game session request.');
  if (!realmSession) return { authenticated: false, characterSlot: gameLaunchContext?.characterSlot ?? null };
  const base = realmBaseUrl();
  try {
    const result = await realmRequest(base, '/api/me', { token: realmSession.token });
    return { authenticated: true, url: base, account: result.account || null, characterSlot: gameLaunchContext?.characterSlot ?? null };
  } catch (error) {
    if (error.status === 401) clearRealmSession();
    return { authenticated: false, characterSlot: gameLaunchContext?.characterSlot ?? null, error: error.message };
  }
});
ipcMain.handle('gbq:realm-api', async (event, input = {}) => {
  if (!gameWindow || event.sender !== gameWindow.webContents || !event.senderFrame.url.startsWith('file://')) throw new Error('Unauthorized game API request.');
  if (!realmSession) throw new Error('Sign in through the desktop launcher first.');
  const endpoint = String(input.path || '');
  const method = String(input.method || 'GET').toUpperCase();
  if (!endpoint.startsWith('/api/') || endpoint.startsWith('/api/stream') || !['GET', 'POST', 'PUT', 'DELETE'].includes(method)) throw new Error('Unsupported realm API request.');
  if (input.body !== undefined && Buffer.byteLength(JSON.stringify(input.body)) > 1024 * 1024) throw new Error('Realm API request body is too large.');
  return realmRequest(realmBaseUrl(), endpoint, { method, body: input.body, token: realmSession.token });
});
ipcMain.on('gbq:realm-stream-stop', event => {
  if (gameWindow && event.sender === gameWindow.webContents && realmStreamController) {
    realmStreamController.abort();
    realmStreamController = null;
  }
});
ipcMain.on('gbq:realm-stream-start', event => {
  if (!gameWindow || event.sender !== gameWindow.webContents || !event.senderFrame.url.startsWith('file://') || !realmSession) return;
  if (realmStreamController) realmStreamController.abort();
  const controller = new AbortController();
  realmStreamController = controller;
  (async () => {
    const response = await fetch(realmBaseUrl() + '/api/stream', {
      headers: { Accept: 'text/event-stream', Authorization: `Bearer ${realmSession.token}` },
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error(`Realm stream returned HTTP ${response.status}.`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (!controller.signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        let eventName = 'message';
        const data = [];
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          else if (line.startsWith('data:')) data.push(line.slice(5).trim());
        }
        if (data.length && gameWindow && !gameWindow.isDestroyed()) {
          gameWindow.webContents.send('gbq:realm-stream-event', { event: eventName, data: data.join('\n') });
        }
      }
    }
  })().catch(error => {
    if (!controller.signal.aborted && gameWindow && !gameWindow.isDestroyed()) {
      gameWindow.webContents.send('gbq:realm-stream-error', error.message);
    }
  }).finally(() => {
    if (realmStreamController === controller) realmStreamController = null;
  });
});
ipcMain.handle('gbq:realm-logout', async event => {
  if (!gameWindow || event.sender !== gameWindow.webContents) throw new Error('Unauthorized launcher request.');
  if (realmSession) {
    try { await realmRequest(realmBaseUrl(), '/api/logout', { method: 'POST', token: realmSession.token }); }
    finally { clearRealmSession(); }
  }
  return { ok: true };
});

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
    writeSettings({ graphicsBackend: backend });
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
  gameWindow.loadFile(path.join(__dirname, 'launcher.html'));
  gameWindow.on('closed', () => { gameWindow = null; });
}

app.whenReady().then(() => {
  loadRealmSession();
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  installMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

'use strict';

const { app, BrowserWindow, Menu, dialog, session, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const GAME_FILE = path.join(__dirname, '..', 'dist', 'gbquest-fullscreen.html');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'desktop-settings.json');
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
    { label: 'Help', submenu: [{ label: 'Open project page', click: () => shell.openExternal('https://github.com/ArkansasIo/GB-Quest') }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  gameWindow = new BrowserWindow({
    title: 'Shadowbane Chronicles',
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
    },
  });

  gameWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  gameWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
  gameWindow.loadFile(GAME_FILE);
  gameWindow.on('closed', () => { gameWindow = null; });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  installMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

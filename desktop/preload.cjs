'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const MIRROR_MARKER = '__gbq_desktop_storage_mirror_v1__';

try {
  const entries = ipcRenderer.sendSync('gbq:read-storage-mirror');
  if (Array.isArray(entries) && localStorage.getItem(MIRROR_MARKER) !== '1') {
    for (const pair of entries) {
      if (Array.isArray(pair) && pair.length === 2 && typeof pair[0] === 'string' && typeof pair[1] === 'string' && pair[0] !== MIRROR_MARKER) {
        localStorage.setItem(pair[0], pair[1]);
      }
    }
    localStorage.setItem(MIRROR_MARKER, '1');
  }
  ipcRenderer.send('gbq:storage-mirror-imported');
} catch {}

contextBridge.exposeInMainWorld('gbqLauncher', Object.freeze({
  launch: selection => ipcRenderer.send('gbq:launch-game', selection),
  checkUpdates: () => ipcRenderer.send('gbq:check-updates'),
  openProject: () => ipcRenderer.send('gbq:open-project'),
  openDocs: () => ipcRenderer.send('gbq:open-docs'),
  checkRealm: url => ipcRenderer.invoke('gbq:realm-check', { url }),
  authenticate: credentials => ipcRenderer.invoke('gbq:realm-auth', credentials),
  getSession: () => ipcRenderer.invoke('gbq:realm-session'),
  listCharacters: () => ipcRenderer.invoke('gbq:realm-saves'),
  logout: () => ipcRenderer.invoke('gbq:realm-logout'),
}));

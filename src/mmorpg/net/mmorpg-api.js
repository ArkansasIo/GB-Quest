import { MultiplayerClient } from './multiplayer-client.js';

/** HTTP account API plus the authoritative WSS transport for the standalone itch.io client. */
export class GBQuestMMOApi {
  constructor({ baseUrl, fetchImpl = globalThis.fetch, WebSocketImpl = globalThis.WebSocket, onMessage, onStatus } = {}) {
    if (!baseUrl) throw new TypeError('baseUrl is required');
    this.baseUrl = new URL(baseUrl).origin;
    if (!['https:', 'http:'].includes(new URL(baseUrl).protocol)) throw new TypeError('baseUrl must use HTTPS in production');
    this.fetch = fetchImpl;
    this.token = null;
    this.multiplayer = new MultiplayerClient({ onMessage, onStatus, WebSocketImpl });
  }
  async request(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (auth && this.token) headers.authorization = 'Bearer ' + this.token;
    const response = await this.fetch(this.baseUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'omit' });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || 'request_failed'), { status: response.status, code: data.error });
    return data;
  }
  async register(username, password) {
    const result = await this.request('/api/register', { method: 'POST', body: { username, password }, auth: false });
    this.token = result.token; return result;
  }
  async login(username, password) {
    const result = await this.request('/api/login', { method: 'POST', body: { username, password }, auth: false });
    this.token = result.token; return result;
  }
  me() { return this.request('/api/me'); }
  characters() { return this.request('/api/characters'); }
  createCharacter(name, characterClass) {
    return this.request('/api/characters', { method: 'POST', body: { name, class: characterClass } });
  }
  connect() {
    if (!this.token) throw new Error('Log in before connecting to the realm');
    const wsUrl = new URL('/ws', this.baseUrl);
    wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    if (wsUrl.protocol !== 'wss:' && globalThis.location?.protocol === 'https:') throw new Error('Secure WSS is required for the hosted game');
    this.multiplayer.connect(wsUrl.toString(), this.token);
  }
  selectCharacter(characterId) {
    if (!this.multiplayer.send('character.select', { characterId })) throw new Error('Connect to the realm before selecting a character');
  }
  send(type, payload) { return this.multiplayer.send(type, payload); }
  disconnect() { this.multiplayer.disconnect(); }
  logout() { this.disconnect(); this.token = null; }
}

import { MultiplayerClient } from './multiplayer-client.js';

/** HTTP account API plus the authoritative WSS transport for the standalone itch.io client. */
export class GBQuestMMOApi {
  constructor({ baseUrl, fetchImpl = globalThis.fetch, WebSocketImpl = globalThis.WebSocket, onMessage, onStatus } = {}) {
    if (!baseUrl) throw new TypeError('baseUrl is required');
    this.baseUrl = new URL(baseUrl).origin;
    const parsedBase = new URL(baseUrl);
    const localDevelopmentHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(parsedBase.host);
    if (parsedBase.protocol !== 'https:' && !(parsedBase.protocol === 'http:' && localDevelopmentHost)) throw new TypeError('Remote MMO API must use HTTPS; HTTP is allowed only on localhost');
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
  characters(realmId) {
    const query = realmId ? '?realm=' + encodeURIComponent(realmId) : '';
    return this.request('/api/characters' + query);
  }
  regions() { return this.request('/api/regions', { auth: false }); }
  realms(regionId) {
    const query = regionId ? '?region=' + encodeURIComponent(regionId) : '';
    return this.request('/api/realms' + query, { auth: false });
  }
  createCharacter(name, characterClass, realmId, species, background) {
    return this.request('/api/characters', {
      method: 'POST', body: {
        name, class: characterClass, ...(realmId ? { realmId } : {}),
        ...(species ? { species } : {}), ...(background ? { background } : {})
      }
    });
  }
  whispers(characterId, { withCharacterId, limit } = {}) {
    const query = new URLSearchParams();
    if (withCharacterId) query.set('with', withCharacterId);
    if (limit) query.set('limit', String(limit));
    const suffix = query.size ? '?' + query.toString() : '';
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/whispers' + suffix);
  }
  sendWhisper(characterId, toCharacterId, text) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/whispers', {
      method: 'POST', body: { toCharacterId, text }
    });
  }
  inventory(characterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/inventory');
  }
  equipItem(characterId, inventoryId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/equip', { method: 'POST', body: { inventoryId } });
  }
  unequipItem(characterId, slot) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/unequip', { method: 'POST', body: { slot } });
  }
  useItem(characterId, inventoryId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/use-item', { method: 'POST', body: { inventoryId } });
  }
  quests(characterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/quests');
  }
  acceptQuest(characterId, questId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/quests', { method: 'POST', body: { questId } });
  }
  dungeonCatalog() {
    return this.request('/api/dungeons/catalog', { auth: false });
  }
  joinDungeonQueue(characterId, dungeonId, role) {
    return this.request('/api/dungeons/queue', {
      method: 'POST', body: { characterId, dungeonId, role }
    });
  }
  dungeonQueueStatus(characterId) {
    return this.request('/api/dungeons/queue/' + encodeURIComponent(characterId));
  }
  leaveDungeonQueue(characterId) {
    return this.request('/api/dungeons/queue/' + encodeURIComponent(characterId), { method: 'DELETE' });
  }
  dungeonGroup(groupId) {
    return this.request('/api/dungeons/groups/' + encodeURIComponent(groupId));
  }
  startDungeonGroup(groupId) {
    return this.request('/api/dungeons/groups/' + encodeURIComponent(groupId) + '/start', { method: 'POST', body: {} });
  }
  completeDungeonGroup(groupId) {
    return this.request('/api/dungeons/groups/' + encodeURIComponent(groupId) + '/complete', { method: 'POST', body: {} });
  }
  trades(characterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/trades');
  }
  createTrade(characterId, toCharacterId, offer = {}) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/trades', {
      method: 'POST', body: { ...offer, toCharacterId }
    });
  }
  acceptTrade(tradeId) {
    return this.request('/api/trades/' + encodeURIComponent(tradeId) + '/accept', { method: 'POST', body: {} });
  }
  cancelTrade(tradeId) {
    return this.request('/api/trades/' + encodeURIComponent(tradeId) + '/cancel', { method: 'POST', body: {} });
  }
  bank(characterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/bank');
  }
  depositGold(characterId, amount) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/bank/deposit', { method: 'POST', body: { amount } });
  }
  withdrawGold(characterId, amount) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/bank/withdraw', { method: 'POST', body: { amount } });
  }
  wallet(characterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/wallet');
  }
  vendors() {
    return this.request('/api/vendors');
  }
  vendor(vendorId) {
    return this.request('/api/vendors/' + encodeURIComponent(vendorId));
  }
  buyFromVendor(characterId, vendorId, itemId, quantity = 1) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/vendor/buy', {
      method: 'POST', body: { vendorId, itemId, quantity }
    });
  }
  sellToVendor(characterId, vendorId, itemId, inventoryId, quantity = 1) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/vendor/sell', {
      method: 'POST', body: { vendorId, itemId, inventoryId, quantity }
    });
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

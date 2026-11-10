import { MultiplayerClient } from './multiplayer-client.js';

/** HTTP account API plus the authoritative WSS transport for the standalone itch.io client. */
export class GBQuestMMOApi {
  constructor({ baseUrl, fetchImpl = globalThis.fetch, WebSocketImpl = globalThis.WebSocket, onMessage, onStatus, autoReconnect = false, reconnectDelayMs = 1000, maxReconnectDelayMs = 30000 } = {}) {
    if (!baseUrl) throw new TypeError('baseUrl is required');
    this.baseUrl = new URL(baseUrl).origin;
    const parsedBase = new URL(baseUrl);
    const localDevelopmentHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(parsedBase.host);
    if (parsedBase.protocol !== 'https:' && !(parsedBase.protocol === 'http:' && localDevelopmentHost)) throw new TypeError('Remote MMO API must use HTTPS; HTTP is allowed only on localhost');
    this.fetch = fetchImpl;
    this.token = null;
    this.multiplayer = new MultiplayerClient({ onMessage, onStatus, WebSocketImpl, autoReconnect, reconnectDelayMs, maxReconnectDelayMs });
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
  worldStatus({ refresh = false } = {}) { return this.request('/api/world/status' + (refresh ? '?refresh=1' : '')); }
  chatHistory(characterId, channel = 'zone', limit = 50) {
    const query = '?channel=' + encodeURIComponent(channel) + '&limit=' + encodeURIComponent(limit);
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/chat' + query);
  }
  whisperHistory(characterId, peerCharacterId, limit = 50) {
    const query = '?with=' + encodeURIComponent(peerCharacterId) + '&limit=' + encodeURIComponent(limit);
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/whispers' + query);
  }

  /**
   * Rebuild the character's durable UI state after reconnecting. WebSocket events
   * are transient, so each resource is fetched independently and failures are
   * returned without discarding successful recovery results.
   */
  async recoverSession(characterId, { chatLimit = 50 } = {}) {
    if (typeof characterId !== 'string' || !characterId.trim()) throw new TypeError('characterId is required');
    const resources = {
      profile: () => this.characterProfile(characterId),
      inventory: () => this.inventory(characterId),
      quests: () => this.quests(characterId),
      party: () => this.party(characterId),
      raidGroup: () => this.raidGroup(characterId),
      raidLockouts: () => this.raidLockouts(characterId),
      guild: () => this.guild(characterId),
      instance: () => this.instance(characterId),
      mail: () => this.mail(characterId),
      friends: () => this.friends(characterId),
      trades: () => this.trades(characterId),
      zoneChat: () => this.chatHistory(characterId, 'zone', chatLimit),
      realmChat: () => this.chatHistory(characterId, 'realm', chatLimit)
    };
    const names = Object.keys(resources);
    const results = await Promise.allSettled(names.map(name => resources[name]()));
    const recovered = {}, errors = [];
    results.forEach((result, index) => {
      const name = names[index];
      if (result.status === 'fulfilled') recovered[name] = result.value;
      else errors.push({ resource: name, message: result.reason?.message || 'recovery_failed', status: result.reason?.status || null });
    });
    return { characterId, recoveredAt: new Date().toISOString(), resources: recovered, errors };
  }
  regions() { return this.request('/api/regions'); }
  realms(regionId) {
    const query = regionId ? '?region=' + encodeURIComponent(regionId) : '';
    return this.request('/api/realms' + query);
  }
  createCharacter(name, characterClass, realmId) {
    const body = { name, class: characterClass };
    if (realmId) body.realmId = realmId;
    return this.request('/api/characters', { method: 'POST', body });
  }
  characterProfile(characterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/profile');
  }
  allocateAttribute(characterId, attribute, points = 1) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/attributes', {
      method: 'POST', body: { attribute, points }
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
  trades(characterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/trades');
  }
  party(characterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/party');
  }
  createParty(characterId, name = '') {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/party', { method: 'POST', body: { name } });
  }
  inviteToParty(partyId, inviterCharacterId, inviteeCharacterId) {
    return this.request('/api/parties/' + encodeURIComponent(partyId) + '/invites', {
      method: 'POST', body: { inviterCharacterId, inviteeCharacterId }
    });
  }
  acceptPartyInvite(inviteId, characterId) {
    return this.request('/api/party-invites/' + encodeURIComponent(inviteId) + '/accept', {
      method: 'POST', body: { characterId }
    });
  }
  leaveParty(characterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/party', { method: 'DELETE' });
  }
  setPartyRole(partyId, actorCharacterId, targetCharacterId, role) {
    return this.request('/api/parties/' + encodeURIComponent(partyId) + '/members/' + encodeURIComponent(targetCharacterId) + '/role', {
      method: 'POST', body: { actorCharacterId, role }
    });
  }
  pvpMatches(characterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/pvp-matches');
  }
  challengeDuel(characterId, targetCharacterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/pvp-challenges', { method: 'POST', body: { targetCharacterId } });
  }
  acceptDuel(matchId, characterId) {
    return this.request('/api/pvp-matches/' + encodeURIComponent(matchId) + '/accept', { method: 'POST', body: { characterId } });
  }
  declineDuel(matchId, characterId) {
    return this.request('/api/pvp-matches/' + encodeURIComponent(matchId) + '/decline', { method: 'POST', body: { characterId } });
  }
  cancelDuel(matchId, characterId) {
    return this.request('/api/pvp-matches/' + encodeURIComponent(matchId) + '/cancel', { method: 'POST', body: { characterId } });
  }
  forfeitDuel(matchId, characterId) {
    return this.request('/api/pvp-matches/' + encodeURIComponent(matchId) + '/forfeit', { method: 'POST', body: { characterId } });
  }
  mail(characterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/mail');
  }
  sendMail(characterId, recipientCharacterId, { subject = '', body = '', gold = 0, attachments = [] } = {}) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/mail/send', { method: 'POST', body: { recipientCharacterId, subject, body, gold, attachments } });
  }
  claimMail(mailId, characterId) {
    return this.request('/api/mail/' + encodeURIComponent(mailId) + '/claim', { method: 'POST', body: { characterId } });
  }
  auctions(realmId, itemId = '') {
    const query = '?realmId=' + encodeURIComponent(realmId) + (itemId ? '&itemId=' + encodeURIComponent(itemId) : '');
    return this.request('/api/auctions' + query);
  }
  createAuction(characterId, itemId, quantity, buyoutGold, durationHours = 24) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/auctions', { method: 'POST', body: { itemId, quantity, buyoutGold, durationHours } });
  }
  buyAuction(listingId, characterId) {
    return this.request('/api/auctions/' + encodeURIComponent(listingId) + '/buy', { method: 'POST', body: { characterId } });
  }
  cancelAuction(listingId, characterId) {
    return this.request('/api/auctions/' + encodeURIComponent(listingId) + '/cancel', { method: 'POST', body: { characterId } });
  }
  friends(characterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/friends');
  }
  requestFriend(characterId, targetCharacterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/friends', { method: 'POST', body: { targetCharacterId } });
  }
  acceptFriend(characterId, friendCharacterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/friends/' + encodeURIComponent(friendCharacterId) + '/accept', { method: 'POST', body: {} });
  }
  removeFriend(characterId, friendCharacterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/friends/' + encodeURIComponent(friendCharacterId), { method: 'DELETE' });
  }
  blockPlayer(characterId, targetCharacterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/blocks', { method: 'POST', body: { targetCharacterId } });
  }
  raidGroup(characterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/raid-group');
  }
  raidLockouts(characterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/raid-lockouts');
  }
  createRaidGroup(characterId, { name = '', raidSize = 10 } = {}) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/raid-group', { method: 'POST', body: { name, raidSize } });
  }
  inviteToRaid(raidGroupId, inviterCharacterId, inviteeCharacterId) {
    return this.request('/api/raids/' + encodeURIComponent(raidGroupId) + '/invites', { method: 'POST', body: { inviterCharacterId, inviteeCharacterId } });
  }
  acceptRaidInvite(inviteId, characterId) {
    return this.request('/api/raid-invites/' + encodeURIComponent(inviteId) + '/accept', { method: 'POST', body: { characterId } });
  }
  setRaidRole(raidGroupId, actorCharacterId, targetCharacterId, role) {
    return this.request('/api/raids/' + encodeURIComponent(raidGroupId) + '/members/' + encodeURIComponent(targetCharacterId) + '/role', { method: 'POST', body: { actorCharacterId, role } });
  }
  transferRaidLeadership(raidGroupId, actorCharacterId, targetCharacterId) {
    return this.request('/api/raids/' + encodeURIComponent(raidGroupId) + '/transfer', { method: 'POST', body: { actorCharacterId, targetCharacterId } });
  }
  leaveRaid(characterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/raid-group', { method: 'DELETE' });
  }
  disbandRaid(raidGroupId, characterId) {
    return this.request('/api/raids/' + encodeURIComponent(raidGroupId) + '?characterId=' + encodeURIComponent(characterId), { method: 'DELETE' });
  }
  instance(characterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/instances');
  }
  createInstance(characterId, dungeonId, difficulty = 'normal') {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/instances', { method: 'POST', body: { dungeonId, difficulty } });
  }
  leaveInstance(instanceId, characterId) {
    return this.request('/api/instances/' + encodeURIComponent(instanceId) + '/leave', { method: 'POST', body: { characterId } });
  }
  completeInstance(instanceId, characterId, status = 'completed') {
    return this.request('/api/instances/' + encodeURIComponent(instanceId) + '/complete', { method: 'POST', body: { characterId, status } });
  }
  startReadyCheck(characterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/ready-checks', { method: 'POST', body: {} });
  }
  readyCheck(readyCheckId, characterId) {
    return this.request('/api/ready-checks/' + encodeURIComponent(readyCheckId) + '?characterId=' + encodeURIComponent(characterId));
  }
  respondReadyCheck(readyCheckId, characterId, ready) {
    return this.request('/api/ready-checks/' + encodeURIComponent(readyCheckId) + '/respond', { method: 'POST', body: { characterId, ready } });
  }
  guild(characterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/guild');
  }
  createGuild(characterId, name) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/guild', { method: 'POST', body: { name } });
  }
  inviteToGuild(guildId, inviterCharacterId, inviteeCharacterId) {
    return this.request('/api/guilds/' + encodeURIComponent(guildId) + '/invites', {
      method: 'POST', body: { inviterCharacterId, inviteeCharacterId }
    });
  }
  acceptGuildInvite(inviteId, characterId) {
    return this.request('/api/guild-invites/' + encodeURIComponent(inviteId) + '/accept', {
      method: 'POST', body: { characterId }
    });
  }
  leaveGuild(characterId) {
    return this.request('/api/characters/' + encodeURIComponent(characterId) + '/guild', { method: 'DELETE' });
  }
  setGuildMemberRank(guildId, actorCharacterId, targetCharacterId, rank) {
    return this.request('/api/guilds/' + encodeURIComponent(guildId) + '/members/' + encodeURIComponent(targetCharacterId) + '/rank', {
      method: 'POST', body: { actorCharacterId, rank }
    });
  }
  updateGuildMotd(guildId, characterId, motd) {
    return this.request('/api/guilds/' + encodeURIComponent(guildId) + '/motd', {
      method: 'POST', body: { characterId, motd }
    });
  }
  transferGuildLeadership(guildId, actorCharacterId, targetCharacterId) {
    return this.request('/api/guilds/' + encodeURIComponent(guildId) + '/transfer', {
      method: 'POST', body: { actorCharacterId, targetCharacterId }
    });
  }
  disbandGuild(guildId, characterId) {
    return this.request('/api/guilds/' + encodeURIComponent(guildId) + '?characterId=' + encodeURIComponent(characterId), { method: 'DELETE' });
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
    if (!this.multiplayer.selectCharacter(characterId)) throw new Error('Connect to the realm before selecting a character');
  }
  send(type, payload) { return this.multiplayer.send(type, payload); }
  disconnect() { this.multiplayer.disconnect(); }
  logout() { this.disconnect(); this.token = null; }
}

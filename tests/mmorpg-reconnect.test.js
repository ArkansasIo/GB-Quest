import test from 'node:test';
import assert from 'node:assert/strict';
import { MultiplayerClient } from '../src/mmorpg/net/multiplayer-client.js';

class FakeSocket {
  static sockets = [];
  constructor(url) { this.url = url; this.readyState = 0; this.handlers = {}; this.sent = []; FakeSocket.sockets.push(this); }
  addEventListener(type, handler) { this.handlers[type] = handler; }
  emit(type, data) { this.handlers[type]?.(data); }
  open() { this.readyState = 1; this.emit('open'); }
  send(message) { this.sent.push(JSON.parse(message)); }
  close(code = 1000) { this.readyState = 3; this.emit('close', { code }); }
  receive(type, payload = {}) { this.emit('message', { data: JSON.stringify({ type, sequence: 1, payload }) }); }
}

test('reconnect reauthenticates and selects character only after authenticated response', async () => {
  FakeSocket.sockets = [];
  const statuses = [];
  const client = new MultiplayerClient({ WebSocketImpl: FakeSocket, autoReconnect: true, reconnectDelayMs: 5, maxReconnectDelayMs: 5, onStatus: s => statuses.push(s) });
  const id = '11111111-1111-4111-8111-111111111111';
  client.connect('wss://game.example/ws', 'secret-token');
  client.selectCharacter(id);
  const first = FakeSocket.sockets[0];
  first.open();
  assert.equal(first.sent[0].type, 'authenticate');
  first.receive('authenticated');
  assert.equal(first.sent[1].type, 'character.select');
  first.close();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(FakeSocket.sockets.length, 2);
  const second = FakeSocket.sockets[1];
  second.open();
  assert.equal(second.sent.length, 1);
  assert.equal(second.sent[0].type, 'authenticate');
  second.receive('authenticated');
  assert.equal(second.sent[1].type, 'character.select');
  assert.equal(second.sent[1].payload.characterId, id);
  assert.ok(statuses.includes('reconnecting'));
  client.disconnect();
});

test('manual disconnect never reconnects', async () => {
  FakeSocket.sockets = [];
  const client = new MultiplayerClient({ WebSocketImpl: FakeSocket, autoReconnect: true, reconnectDelayMs: 5 });
  client.connect('wss://game.example/ws', 'token');
  client.disconnect();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(FakeSocket.sockets.length, 1);
});

test('rejects invalid character IDs', () => {
  const client = new MultiplayerClient({ WebSocketImpl: FakeSocket });
  assert.throws(() => client.selectCharacter('bad'), TypeError);
});


test('invalid or expired authentication stops automatic reconnect and requests a fresh token', async () => {
  FakeSocket.sockets = [];
  const statuses = [];
  const client = new MultiplayerClient({ WebSocketImpl: FakeSocket, autoReconnect: true, reconnectDelayMs: 5, onStatus: s => statuses.push(s) });
  client.connect('wss://game.example/ws', 'expired-token');
  FakeSocket.sockets[0].open();
  FakeSocket.sockets[0].close(4401);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(FakeSocket.sockets.length, 1);
  assert.ok(statuses.includes('authentication_required'));
  assert.equal(client.lastConnection, null);
});

test('server authentication rate limit stops retries instead of amplifying the limit', async () => {
  FakeSocket.sockets = [];
  const statuses = [];
  const client = new MultiplayerClient({ WebSocketImpl: FakeSocket, autoReconnect: true, reconnectDelayMs: 5, onStatus: s => statuses.push(s) });
  client.connect('wss://game.example/ws', 'token');
  FakeSocket.sockets[0].open();
  FakeSocket.sockets[0].close(4429);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(FakeSocket.sockets.length, 1);
  assert.ok(statuses.includes('rate_limited'));
});

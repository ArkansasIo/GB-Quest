import test from "node:test";
import assert from "node:assert/strict";
import { MultiplayerClient } from "../../src/mmorpg/net/multiplayer-client.js";

class FakeWebSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.listeners = new Map();
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }
  addEventListener(type, callback) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(callback);
    this.listeners.set(type, listeners);
  }
  emit(type, event = {}) {
    if (type === "open") this.readyState = 1;
    if (type === "close") this.readyState = 3;
    for (const callback of this.listeners.get(type) ?? []) callback(event);
  }
  send(data) { this.sent.push(JSON.parse(data)); }
  close() { this.emit("close"); }
}

test("client requires secure transport and a token", () => {
  const client = new MultiplayerClient({ WebSocketImpl: FakeWebSocket });
  assert.throws(() => client.connect("ws://localhost", "token"), /wss/);
  assert.throws(() => client.connect("wss://example.test", ""), /token/);
});

test("client authenticates on open and sequences outgoing messages", () => {
  FakeWebSocket.instances.length = 0;
  const statuses = [];
  const client = new MultiplayerClient({ WebSocketImpl: FakeWebSocket, onStatus: s => statuses.push(s) });
  client.connect("wss://realm.example.test/socket", "opaque-token");
  const socket = FakeWebSocket.instances[0];
  socket.emit("open");
  assert.equal(socket.sent[0].type, "authenticate");
  assert.equal(socket.sent[0].sequence, 1);
  assert.equal(client.send("party.invite", { target: "player-2" }), true);
  assert.equal(socket.sent[1].sequence, 2);
  assert.equal(socket.sent[1].payload.target, "player-2");
  assert.deepEqual(statuses, ["connecting", "connected"]);
});

test("client ignores malformed incoming messages and reports valid messages", () => {
  const received = [];
  const client = new MultiplayerClient({ WebSocketImpl: FakeWebSocket, onMessage: m => received.push(m) });
  client.connect("wss://realm.example.test/socket", "opaque-token");
  const socket = FakeWebSocket.instances.at(-1);
  socket.emit("message", { data: "not-json" });
  socket.emit("message", { data: JSON.stringify({ type: "realm.snapshot", sequence: 4, payload: {} }) });
  socket.emit("message", { data: JSON.stringify({ type: 12, sequence: "bad" }) });
  assert.equal(received.length, 1);
  assert.equal(received[0].type, "realm.snapshot");
});

test("client disconnect closes and clears the transport", () => {
  const client = new MultiplayerClient({ WebSocketImpl: FakeWebSocket });
  client.connect("wss://realm.example.test/socket", "opaque-token");
  const socket = FakeWebSocket.instances.at(-1);
  client.disconnect();
  assert.equal(socket.readyState, 3);
  assert.equal(client.socket, null);
  assert.equal(client.send("chat.send", { text: "hello" }), false);
});

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

test("reconnecting ignores events from the replaced socket", () => {
  FakeWebSocket.instances.length = 0;
  const statuses = [], received = [];
  const client = new MultiplayerClient({ WebSocketImpl: FakeWebSocket, onStatus: s => statuses.push(s), onMessage: m => received.push(m) });
  client.connect("wss://realm.example.test/socket", "opaque-token");
  const first = FakeWebSocket.instances[0];
  first.emit("open");
  client.connect("wss://realm.example.test/socket", "opaque-token");
  const second = FakeWebSocket.instances[1];
  second.emit("open");
  statuses.length = 0;
  // late events from the old socket must not touch the live connection
  first.emit("close"); first.emit("error");
  first.emit("message", { data: JSON.stringify({ type: "realm.snapshot", sequence: 1, payload: {} }) });
  assert.deepEqual(statuses, []);
  assert.equal(received.length, 0);
  assert.equal(client.socket, second);
  // the live socket closing is reported once and clears the transport
  second.emit("close");
  assert.deepEqual(statuses, ["disconnected"]);
  assert.equal(client.socket, null);
});

test("disconnect reports one status change", () => {
  const statuses = [];
  const client = new MultiplayerClient({ WebSocketImpl: FakeWebSocket, onStatus: s => statuses.push(s) });
  client.connect("wss://realm.example.test/socket", "opaque-token");
  statuses.length = 0;
  client.disconnect();
  assert.deepEqual(statuses, ["disconnected"]);
});

test("client can send every command the server validator accepts", async () => {
  const { validateClientCommand } = await import("../../src/mmorpg/net/server-validation.js");
  const client = new MultiplayerClient({ WebSocketImpl: FakeWebSocket });
  client.connect("wss://realm.example.test/socket", "opaque-token");
  FakeWebSocket.instances.at(-1).emit("open");
  for (const type of ["move", "interact", "attack", "cast_spell", "equip", "use_item", "accept_quest", "loot"]) {
    assert.equal(validateClientCommand({ type, requestId: "r1" }).ok, true, type);
    assert.equal(client.send(type, {}), true, type);
  }
  for (const bad of ["Cast", "a..b", "_x", "x_", "x._y"]) assert.throws(() => client.send(bad), /Invalid message type/, bad);
});

/** Browser WebSocket transport wrapper. The server is authoritative for all game state. */
// Message types are dotted lowercase words; words may use underscores to match the server's
// command names (cast_spell, use_item, accept_quest in server-validation.js).
const MESSAGE_TYPE = /^[a-z]+(?:_[a-z]+)*(?:\.[a-z]+(?:_[a-z]+)*)*$/;

export class MultiplayerClient {
  constructor({ onMessage = () => {}, onStatus = () => {}, WebSocketImpl = globalThis.WebSocket, autoReconnect = false, reconnectDelayMs = 1000, maxReconnectDelayMs = 30000 } = {}) {
    this.onMessage = onMessage; this.onStatus = onStatus; this.WebSocketImpl = WebSocketImpl; this.socket = null; this.sequence = 0;
    this.autoReconnect = autoReconnect; this.reconnectDelayMs = reconnectDelayMs; this.maxReconnectDelayMs = maxReconnectDelayMs;
    this.reconnectAttempt = 0; this.reconnectTimer = null; this.intentionalClose = false;
    this.lastConnection = null; this.selectedCharacterId = null;
  }
  connect(url, token) {
    if (!this.WebSocketImpl) throw new Error("WebSocket is not available in this runtime");
    if (!/^wss:\/\//.test(url) && !(/^ws:\/\//.test(url) && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(new URL(url).host))) throw new TypeError("Multiplayer requires wss://, or ws:// on localhost for development");
    if (!token || typeof token !== "string") throw new TypeError("An authentication token is required");
    this.disconnect();
    this.intentionalClose = false;
    this.lastConnection = { url, token };
    const socket = new this.WebSocketImpl(url);
    this.socket = socket;
    this.onStatus("connecting");
    // a replaced socket keeps firing events (its close arrives after the new one is up): ignore it
    const current = () => this.socket === socket;
    socket.addEventListener("open", () => {
      if (!current()) return;
      this.onStatus("connected");
      this.send("authenticate", { token });
    });
    socket.addEventListener("message", event => {
      if (!current()) return;
      let message;
      try { message = JSON.parse(event.data); } catch { this.onStatus("invalid_message"); return; }
      if (!message || typeof message.type !== "string" || typeof message.sequence !== "number") return;
      if (message.type === "authenticated") {
        this.reconnectAttempt = 0;
        if (this.selectedCharacterId) this.send("character.select", { characterId: this.selectedCharacterId });
      }
      this.onMessage(message);
    });
    socket.addEventListener("close", () => {
      if (!current()) return;
      this.socket = null;
      this.onStatus("disconnected");
      if (this.autoReconnect && !this.intentionalClose && this.lastConnection) this.scheduleReconnect();
    });
    socket.addEventListener("error", () => { if (current()) this.onStatus("error"); });
  }
  scheduleReconnect() {
    if (this.reconnectTimer !== null || !this.lastConnection) return;
    const delay = Math.min(this.maxReconnectDelayMs, this.reconnectDelayMs * 2 ** Math.min(this.reconnectAttempt++, 10));
    this.onStatus("reconnecting");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionalClose && this.lastConnection) this.connect(this.lastConnection.url, this.lastConnection.token);
    }, delay);
  }
  selectCharacter(characterId) {
    if (typeof characterId !== "string" || !/^[0-9a-f-]{36}$/i.test(characterId)) throw new TypeError("Invalid character ID");
    this.selectedCharacterId = characterId;
    return this.send("character.select", { characterId });
  }
  send(type, payload = {}) {
    if (!this.socket || this.socket.readyState !== 1) return false;
    if (typeof type !== "string" || !MESSAGE_TYPE.test(type)) throw new TypeError("Invalid message type");
    this.socket.send(JSON.stringify({ type, sequence: ++this.sequence, payload }));
    return true;
  }
  disconnect() {
    this.intentionalClose = true;
    if (this.reconnectTimer !== null) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    const socket = this.socket;
    if (!socket) return;
    this.socket = null; // detach first so the socket's own close event is not reported twice
    socket.close();
    this.onStatus("disconnected");
  }
}

/** Browser WebSocket transport wrapper. The server is authoritative for all game state. */
// Message types are dotted lowercase words; words may use underscores to match the server's
// command names (cast_spell, use_item, accept_quest in server-validation.js).
const MESSAGE_TYPE = /^[a-z]+(?:_[a-z]+)*(?:\.[a-z]+(?:_[a-z]+)*)*$/;

export class MultiplayerClient {
  constructor({ onMessage = () => {}, onStatus = () => {}, WebSocketImpl = globalThis.WebSocket } = {}) {
    this.onMessage = onMessage; this.onStatus = onStatus; this.WebSocketImpl = WebSocketImpl; this.socket = null; this.sequence = 0;
  }
  connect(url, token) {
    if (!this.WebSocketImpl) throw new Error("WebSocket is not available in this runtime");
    if (!/^wss:\/\//.test(url) && !(/^ws:\/\//.test(url) && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(new URL(url).host))) throw new TypeError("Multiplayer requires wss://, or ws:// on localhost for development");
    if (!token || typeof token !== "string") throw new TypeError("An authentication token is required");
    this.disconnect();
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
      this.onMessage(message);
    });
    socket.addEventListener("close", () => { if (current()) { this.socket = null; this.onStatus("disconnected"); } });
    socket.addEventListener("error", () => { if (current()) this.onStatus("error"); });
  }
  send(type, payload = {}) {
    if (!this.socket || this.socket.readyState !== 1) return false;
    if (typeof type !== "string" || !MESSAGE_TYPE.test(type)) throw new TypeError("Invalid message type");
    this.socket.send(JSON.stringify({ type, sequence: ++this.sequence, payload }));
    return true;
  }
  disconnect() {
    const socket = this.socket;
    if (!socket) return;
    this.socket = null; // detach first so the socket's own close event is not reported twice
    socket.close();
    this.onStatus("disconnected");
  }
}

/** Browser WebSocket transport wrapper. The server is authoritative for all game state. */
export class MultiplayerClient {
  constructor({ onMessage = () => {}, onStatus = () => {}, WebSocketImpl = globalThis.WebSocket } = {}) {
    this.onMessage = onMessage; this.onStatus = onStatus; this.WebSocketImpl = WebSocketImpl; this.socket = null; this.sequence = 0;
  }
  connect(url, token) {
    if (!this.WebSocketImpl) throw new Error("WebSocket is not available in this runtime");
    if (!/^wss:\/\//.test(url)) throw new TypeError("Production multiplayer requires a secure wss:// endpoint");
    if (!token || typeof token !== "string") throw new TypeError("An authentication token is required");
    this.disconnect();
    this.socket = new this.WebSocketImpl(url);
    this.onStatus("connecting");
    this.socket.addEventListener("open", () => {
      this.onStatus("connected");
      this.send("authenticate", { token });
    });
    this.socket.addEventListener("message", event => {
      let message;
      try { message = JSON.parse(event.data); } catch { this.onStatus("invalid_message"); return; }
      if (!message || typeof message.type !== "string" || typeof message.sequence !== "number") return;
      this.onMessage(message);
    });
    this.socket.addEventListener("close", () => this.onStatus("disconnected"));
    this.socket.addEventListener("error", () => this.onStatus("error"));
  }
  send(type, payload = {}) {
    if (!this.socket || this.socket.readyState !== 1) return false;
    if (typeof type !== "string" || !/^[a-z]+(?:\.[a-z]+)*$/.test(type)) throw new TypeError("Invalid message type");
    this.socket.send(JSON.stringify({ type, sequence: ++this.sequence, payload }));
    return true;
  }
  disconnect() {
    if (this.socket) { this.socket.close(); this.socket = null; this.onStatus("disconnected"); }
  }
}

/* Optional PeerJS-compatible adapter for the independent Cloudflare relay.
   A deployment must pass cross-network tests before choosing this transport. */
export const RELAY_URL = ""; // Set after the isolated Worker is deployed and verified.
export const RELAY_READY = false; // Emergency kill switch: false always uses existing PeerJS.

function emit(handlers, event, ...args) {
  for (const callback of handlers.get(event) || []) callback(...args);
}
class RelayEvents {
  constructor() { this.handlers = new Map(); }
  on(event, callback) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event).push(callback);
    return this;
  }
  emit(event, ...args) { emit(this.handlers, event, ...args); }
}
class RelayConnection extends RelayEvents {
  constructor(owner, token) {
    super();
    this.owner = owner;
    this.token = token;
    this.open = true;
  }
  send(value) {
    if (!this.open || this.owner.socket?.readyState !== WebSocket.OPEN) return;
    const message = this.owner.host
      ? { type: "snapshot", token: this.token, payload: value }
      : value;
    this.owner.socket.send(JSON.stringify(message));
  }
  close() {
    if (!this.open) return;
    this.open = false;
    this.emit("close");
    if (!this.owner.host) this.owner.socket?.close();
  }
}
export class RelayPeer extends RelayEvents {
  constructor(id) {
    super();
    this.host = Boolean(id);
    this.id = id;
    this.socket = null;
    this.connections = new Map();
    this.allowedTokens = [];
    this.disconnected = false;
    this.destroyed = false;
    this.secret = null;
    if (this.host) {
      const key = "quizpro-relay-host:" + id;
      this.secret = sessionStorage.getItem(key);
      if (!this.secret) {
        const bytes = new Uint8Array(24);
        crypto.getRandomValues(bytes);
        this.secret = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
        sessionStorage.setItem(key, this.secret);
      }
      this.connectSocket();
    } else {
      queueMicrotask(() => this.emit("open", "relay-client"));
    }
  }
  setAllowedTokens(tokens) {
    this.allowedTokens = tokens;
    if (this.host && this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify({ type: "register", tokens }));
  }
  connect(peerId) {
    if (this.host) throw new Error("Host cannot join as a player");
    this.id = peerId;
    this.teamToken = new URL(window.location.href).hash.split("/").pop();
    this.connectSocket();
    const conn = new RelayConnection(this, this.teamToken);
    conn.open = false;
    this.clientConnection = conn;
    return conn;
  }
  connectSocket() {
    if (this.destroyed) return;
    const code = String(this.id || "").replace(/^quizpro-/i, "").toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) { this.emit("error", new Error("Invalid session code")); return; }
    const url = new URL(RELAY_URL.replace(/\/$/, "") + "/session/" + code);
    url.searchParams.set("role", this.host ? "host" : "team");
    if (this.host) url.searchParams.set("secret", this.secret);
    else url.searchParams.set("token", this.teamToken);
    const socket = new WebSocket(url.href);
    this.socket = socket;
    socket.onopen = () => {
      this.disconnected = false;
      if (this.host) {
        this.setAllowedTokens(this.allowedTokens);
        this.emit("open", this.id);
      } else {
        this.clientConnection.open = true;
        this.clientConnection.emit("open");
      }
    };
    socket.onmessage = event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (this.host) {
        if (message.type === "team-joined") {
          const conn = new RelayConnection(this, message.token);
          this.connections.set(message.token, conn);
          this.emit("connection", conn);
        } else if (message.type === "team-left") {
          this.connections.get(message.token)?.close();
          this.connections.delete(message.token);
        } else if (message.type === "team-message") {
          this.connections.get(message.token)?.emit("data", message.payload);
        }
      } else {
        this.clientConnection?.emit("data", message);
      }
    };
    socket.onclose = () => {
      if (this.destroyed) return;
      this.disconnected = true;
      if (this.host) this.emit("disconnected");
      else this.clientConnection?.emit("close");
    };
    socket.onerror = () => this.emit("error", { type: "network", message: "Relay connection unavailable" });
  }
  reconnect() {
    if (!this.destroyed) this.connectSocket();
  }
  destroy() {
    this.destroyed = true;
    this.connections.forEach(conn => conn.close());
    this.connections.clear();
    this.socket?.close();
  }
}

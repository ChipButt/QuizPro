// QuizPro cross-network WebSocket relay. No quiz content is publicly listed.
// Durable Object state is scoped to a six-character session code.
export class QuizSession {
  constructor(state, env) {
    this.state = state;
    this.host = null;
    this.teams = new Map();
    this.allowed = new Set();
    this.secret = null;
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket required", { status: 426 });
    }
    const role = url.searchParams.get("role");
    const token = url.searchParams.get("token") || "";
    const secret = url.searchParams.get("secret") || "";
    if (role !== "host" && role !== "team") return new Response("Invalid role", { status: 403 });
    if (role === "host") {
      if (!/^[a-f0-9]{32,128}$/i.test(secret)) return new Response("Invalid host secret", { status: 403 });
      if (!this.secret) {
        this.secret = await this.state.storage.get("hostSecret");
        if (!this.secret) { this.secret = secret; await this.state.storage.put("hostSecret", secret); }
      }
      if (secret !== this.secret) return new Response("Session controlled by another host", { status: 403 });
    } else if (!/^[a-z0-9-]{12,80}$/i.test(token)) {
      return new Response("Invalid team token", { status: 403 });
    }
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    server.accept();
    if (role === "host") {
      this.host?.close(1000, "Host reconnected");
      this.host = server;
      server.send(JSON.stringify({ type: "relay-ready" }));
    } else {
      this.teams.get(token)?.close(1000, "Team reconnected");
      this.teams.set(token,server);
    }
    server.addEventListener("message", async event => {
      let msg; try { msg = JSON.parse(event.data); } catch { return; }
      if (!msg || typeof msg !== "object") return;
      if (role === "host") {
        if (this.host !== server) return;
        if (msg.type === "register" && Array.isArray(msg.tokens)) {
          this.allowed = new Set(msg.tokens.filter(t => typeof t === "string" && /^[a-z0-9-]{12,80}$/i.test(t)).slice(0,200));
          for (const [id, connection] of this.teams) {
            if (this.allowed.has(id)) this.host.send(JSON.stringify({ type: "team-joined", token:id }));
            else { connection.send(JSON.stringify({ type: "rejected", reason:"Invalid team QR code" })); connection.close(1008); }
          }
        } else if (msg.type === "snapshot" && typeof msg.token === "string") {
          if (!this.allowed.has(msg.token)) return;
          const conn = this.teams.get(msg.token);
          if (conn?.readyState === WebSocket.OPEN && msg.payload?.type === "snapshot")
            conn.send(JSON.stringify(msg.payload));
        }
      } else {
        if (this.teams.get(token) !== server) return;
        if (!this.host || this.host.readyState !== WebSocket.OPEN) return;
        if (!this.allowed.has(token)) {
          server.send(JSON.stringify({ type:"rejected", reason:"Invalid team QR code" })); server.close(1008); return;
        }
        if (msg.type === "hello" || msg.type === "save-answer" || msg.type === "set-team-name" || msg.type === "lock-round") {
          this.host.send(JSON.stringify({ type:"team-message", token, payload:msg }));
        }
      }
    });
    const close = () => {
      if (role === "host" && this.host === server) this.host = null;
      if (role === "team" && this.teams.get(token) === server) {
        this.teams.delete(token);
        if (this.host?.readyState === WebSocket.OPEN)
          this.host.send(JSON.stringify({ type:"team-left",token }));
      }
    };
    server.addEventListener("close",close);
    server.addEventListener("error",close);
    return new Response(null,{status:101,webSocket:client});
  }
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    const match=url.pathname.match(/^\/session\/([A-Z0-9]{6})$/);
    if (!match) return new Response("Not found",{status:404});
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      return new Response("WebSocket required",{status:426});
    const id=env.QUIZ_SESSIONS.idFromName(match[1]);
    return env.QUIZ_SESSIONS.get(id).fetch(request);
  }
};

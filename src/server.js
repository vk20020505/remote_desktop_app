// TCP command server + UDP LAN discovery. UI-agnostic: reports through events.
//   "state"   (running: boolean)
//   "clients" (clients: ClientInfo[])
//   "log"     (message: string)
const net = require("net");
const os = require("os");
const dgram = require("dgram");
const crypto = require("crypto");
const { EventEmitter } = require("events");
const { handleCommand, b64decode, OS_NAME } = require("./controls");

const DEFAULT_PORT = 12345;
const DISCOVERY_PORT = 12346;
const DISCOVERY_REQUEST = "REMOTE_MOUSE_DISCOVER";

function getLocalIp() {
  // Prefer a private LAN address (Wi-Fi/Ethernet) over VPN/virtual adapters.
  const candidates = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== "IPv4" || a.internal) continue;
      const lan = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address);
      const virtual = /vbox|vmnet|docker|veth|utun|tun|tap|br-|virtual|vethernet|wsl/i.test(name);
      candidates.push({ address: a.address, score: (lan ? 2 : 0) + (virtual ? 0 : 1) });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] ? candidates[0].address : "127.0.0.1";
}

const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest();

class RemoteServer extends EventEmitter {
  constructor() {
    super();
    this.port = DEFAULT_PORT;
    this.password = ""; // empty = no password required
    this.running = false;
    this.startedAt = null;
    this.commandCount = 0;
    this._server = null;
    this._discovery = null;
    this._clients = new Map(); // id -> { socket, info }
    this._nextId = 1;
  }

  clients() {
    return [...this._clients.values()].map((c) => ({ ...c.info }));
  }

  start(port) {
    if (this.running) return Promise.resolve();
    this.port = port || this.port;
    return new Promise((resolve, reject) => {
      const server = net.createServer((socket) => this._handleClient(socket));
      server.once("error", reject);
      server.listen(this.port, "0.0.0.0", () => {
        server.removeListener("error", reject);
        server.on("error", (e) => this.emit("log", `Server error: ${e.message}`));
        this._server = server;
        this.running = true;
        this.startedAt = Date.now();
        this._startDiscovery();
        this.emit("log", `Server started on ${getLocalIp()}:${this.port}`);
        this.emit("state", true);
        resolve();
      });
    });
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.startedAt = null;
    this._server.close();
    this._server = null;
    if (this._discovery) {
      try { this._discovery.close(); } catch (_) { /* already closed */ }
      this._discovery = null;
    }
    for (const c of this._clients.values()) c.socket.destroy();
    this.emit("log", "Server stopped");
    this.emit("state", false);
  }

  disconnect(id) {
    const c = this._clients.get(id);
    if (c) c.socket.destroy();
  }

  _startDiscovery() {
    // Answers LAN broadcasts so the phone can find this computer without typing the IP.
    const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
    sock.on("message", (msg, rinfo) => {
      if (msg.toString().trim() !== DISCOVERY_REQUEST) return;
      const name = os.hostname().replace(/ /g, "_");
      sock.send(`REMOTE_MOUSE ${name} ${this.port} ${OS_NAME}`, rinfo.port, rinfo.address);
    });
    sock.on("error", (e) => {
      // Discovery is a convenience; the server still works by typing the IP.
      this.emit("log", `Auto-discovery unavailable (${e.code || e.message})`);
      try { sock.close(); } catch (_) { /* ignore */ }
      if (this._discovery === sock) this._discovery = null;
    });
    sock.bind(DISCOVERY_PORT, "0.0.0.0");
    this._discovery = sock;
  }

  _emitClients() {
    this.emit("clients", this.clients());
  }

  _handleClient(socket) {
    socket.setNoDelay(true);
    const id = this._nextId++;
    const info = {
      id,
      ip: (socket.remoteAddress || "").replace(/^::ffff:/, ""),
      connectedAt: Date.now(),
      authed: !this.password,
    };
    this._clients.set(id, { socket, info });
    this._emitClients();
    this.emit("log", `${info.ip} connected`);

    const reply = (line) => { if (!socket.destroyed) socket.write(line + "\n"); };
    let buffer = "";
    // Commands run strictly in order; a slow one (APP_LIST) must not let later MOVEs jump ahead.
    let queue = Promise.resolve();

    socket.on("data", (chunk) => {
      buffer += chunk.toString("latin1"); // protocol is ASCII + base64
      const lines = buffer.split("\n");
      buffer = lines.pop();
      const batch = coalesceMoves(lines.map((l) => l.trim().split(/\s+/)).filter((p) => p[0]));
      queue = queue.then(() => this._runBatch(batch, info, reply));
    });
    socket.on("error", () => {});
    socket.on("close", () => {
      this._clients.delete(id);
      this._emitClients();
      this.emit("log", `${info.ip} disconnected`);
    });
  }

  async _runBatch(batch, info, reply) {
    for (const [cmd, ...args] of batch) {
      if (cmd === "AUTH") {
        const given = b64decode(args[0]);
        info.authed = !this.password || crypto.timingSafeEqual(sha(given), sha(this.password));
        reply(info.authed ? `AUTH_OK ${OS_NAME}` : "AUTH_FAIL");
        if (!info.authed) this.emit("log", `${info.ip} used a wrong password`);
        this._emitClients();
        continue;
      }
      if (!info.authed && cmd !== "PING") continue;
      try {
        this.commandCount++;
        const note = await handleCommand(cmd, args, reply);
        if (note) this.emit("log", `${info.ip}: ${note}`);
      } catch (e) {
        console.error(`Error running ${cmd}:`, e.message);
      }
    }
  }
}

/** Phones send MOVE far faster than the OS needs; merge consecutive ones into a single jump. */
function coalesceMoves(batch) {
  const out = [];
  for (const parts of batch) {
    const prev = out[out.length - 1];
    if (parts[0] === "MOVE" && prev && prev[0] === "MOVE") {
      prev[1] = String((parseInt(prev[1], 10) || 0) + (parseInt(parts[1], 10) || 0));
      prev[2] = String((parseInt(prev[2], 10) || 0) + (parseInt(parts[2], 10) || 0));
    } else {
      out.push(parts);
    }
  }
  return out;
}

module.exports = { RemoteServer, getLocalIp, DEFAULT_PORT };

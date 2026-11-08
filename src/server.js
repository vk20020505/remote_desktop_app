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

// Virtual adapters (VMs, containers, VPNs) have LAN-looking IPs a phone can never reach.
// Windows often names them "Ethernet 2", so the name alone is not enough: also check the
// MAC vendor prefix and well-known default subnets.
const VIRTUAL_NAME = /vbox|virtualbox|vmnet|vmware|hyper-?v|vethernet|wsl|docker|veth|br-|virbr|utun|tun|tap|zt|tailscale|wireguard|wg\d|parallels|bluetooth|loopback|npcap|hamachi/i;
const VIRTUAL_MAC = [
  "0a:00:27", "08:00:27",                         // VirtualBox
  "00:50:56", "00:0c:29", "00:05:69", "00:1c:14", // VMware
  "00:15:5d",                                     // Hyper-V / WSL
  "02:42:",                                       // Docker
  "00:1c:42",                                     // Parallels
  "00:03:ff",                                     // Virtual PC
];
const VIRTUAL_SUBNET = /^(192\.168\.56\.|192\.168\.99\.|172\.17\.|172\.18\.)/; // VirtualBox, docker-machine, Docker
const LAN = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/;

function isVirtual(name, a) {
  const mac = (a.mac || "").toLowerCase();
  return VIRTUAL_NAME.test(name) || VIRTUAL_MAC.some((p) => mac.startsWith(p)) || VIRTUAL_SUBNET.test(a.address);
}

/** All usable IPv4 addresses, best first: real LAN > other real > virtual. */
function listLocalIps() {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== "IPv4" && a.family !== 4) continue;
      if (a.internal || a.address.startsWith("169.254.")) continue; // loopback / no DHCP
      const virtual = isVirtual(name, a);
      out.push({ address: a.address, name, virtual, score: (virtual ? 0 : 4) + (LAN.test(a.address) ? 2 : 0) });
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

// The address the OS would use to reach the outside world is the real Wi-Fi/Ethernet one.
// A connected UDP socket picks a route without sending any packet.
let routedIp = null;
function refreshRoutedIp() {
  const sock = dgram.createSocket("udp4");
  const done = () => { try { sock.close(); } catch (_) { /* closed */ } };
  sock.on("error", () => { routedIp = null; done(); });
  sock.connect(53, "8.8.8.8", () => {
    try { routedIp = sock.address().address; } catch (_) { routedIp = null; }
    done();
  });
}
refreshRoutedIp();
setInterval(refreshRoutedIp, 5000).unref();

function getLocalIp() {
  const ips = listLocalIps();
  const routed = ips.find((c) => c.address === routedIp && !c.virtual);
  if (routed) return routed.address;
  return ips[0] ? ips[0].address : "127.0.0.1";
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

module.exports = { RemoteServer, getLocalIp, listLocalIps, DEFAULT_PORT };

// Screen mirroring over WebRTC. Signaling rides on the phone's normal command connection:
//
//   phone  -> MIRROR_START <maxWidth>
//   server -> MIRROR_OFFER <base64 SDP>      or  MIRROR_FAIL <base64 reason>
//   phone  -> MIRROR_ANSWER <base64 SDP>
//   phone  -> MIRROR_STOP                    (also implied when the phone disconnects)
//   server -> MIRROR_ENDED                   when the desktop side drops the stream
//
// ICE is not trickled: both SDPs already contain every candidate. Phone and computer are on
// the same network, so host candidates are enough and no STUN/TURN server is used.
// The screen is captured in a hidden window (capture/), only while someone is watching.
const path = require("path");
const { EventEmitter } = require("events");
const { BrowserWindow, desktopCapturer, ipcMain, screen, systemPreferences } = require("electron");

const FPS = 30;
const MAX_WIDTH = 1920;
const DEFAULT_WIDTH = 1280;

const b64 = (s) => Buffer.from(String(s), "utf8").toString("base64");
const unb64 = (s) => Buffer.from(String(s || ""), "base64").toString("utf8");

class ScreenMirror extends EventEmitter {
  constructor() {
    super();
    this._viewers = new Map(); // phone client id -> { ip, reply }
    this._win = null;

    ipcMain.on("mirror-offer", (e, id, sdp) => {
      if (!this._fromCapture(e)) return;
      const v = this._viewers.get(id);
      if (v) v.reply(`MIRROR_OFFER ${b64(sdp)}`);
    });
    ipcMain.on("mirror-failed", (e, id, message) => {
      if (!this._fromCapture(e)) return;
      const v = this._viewers.get(id);
      if (!v) return;
      this.emit("log", `Screen mirroring failed for ${v.ip}: ${message}`);
      v.reply(`MIRROR_FAIL ${b64("Could not capture the screen on the computer.")}`);
      this._remove(id);
    });
    ipcMain.on("mirror-closed", (e, id) => {
      if (!this._fromCapture(e)) return;
      const v = this._viewers.get(id);
      if (!v) return;
      v.reply("MIRROR_ENDED");
      this._remove(id);
    });
  }

  /** Number of phones currently watching. */
  get watching() {
    return this._viewers.size;
  }

  /** Handles a MIRROR_* command from the server: { cmd, args, clientId, ip, reply }. */
  async handle({ cmd, args, clientId, ip, reply }) {
    switch (cmd) {
      case "MIRROR_START": return this._start(clientId, ip, reply, parseInt(args[0], 10));
      case "MIRROR_ANSWER":
        if (this._viewers.has(clientId)) this._send("mirror-answer", clientId, unb64(args[0]));
        return;
      case "MIRROR_STOP":
        if (this._viewers.has(clientId)) {
          this._send("mirror-stop", clientId);
          this._remove(clientId);
        }
        return;
      default:
    }
  }

  stopAll() {
    for (const id of [...this._viewers.keys()]) this._remove(id);
    if (this._win && !this._win.isDestroyed()) this._win.destroy();
    this._win = null;
  }

  async _start(id, ip, reply, maxWidth) {
    const denied = screenPermissionProblem();
    if (denied) {
      this.emit("log", denied);
      reply(`MIRROR_FAIL ${b64(denied)}`);
      return;
    }
    const isNew = !this._viewers.has(id);
    this._viewers.set(id, { ip, reply });
    if (isNew) {
      this.emit("log", `${ip} started screen mirroring`);
      this.emit("change");
    }
    try {
      const display = screen.getPrimaryDisplay();
      const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } });
      const source = sources.find((s) => s.display_id === String(display.id)) || sources[0];
      if (!source) throw new Error("no screen found");
      await this._captureWindow();
      this._send("mirror-start", {
        id,
        sourceId: source.id,
        fps: FPS,
        maxWidth: Math.min(MAX_WIDTH, Math.max(320, maxWidth || DEFAULT_WIDTH)),
      });
    } catch (e) {
      this.emit("log", `Screen mirroring failed for ${ip}: ${e.message}`);
      reply(`MIRROR_FAIL ${b64("Could not capture the screen on the computer.")}`);
      this._remove(id);
    }
  }

  _remove(id) {
    const v = this._viewers.get(id);
    if (!v) return;
    this._viewers.delete(id);
    this.emit("log", `${v.ip} stopped screen mirroring`);
    this.emit("change");
  }

  _send(channel, ...args) {
    if (this._win && !this._win.isDestroyed()) this._win.webContents.send(channel, ...args);
  }

  _fromCapture(e) {
    return this._win && !this._win.isDestroyed() && e.sender === this._win.webContents;
  }

  _captureWindow() {
    if (this._ready && this._win && !this._win.isDestroyed()) return this._ready;
    const win = new BrowserWindow({
      show: false,
      skipTaskbar: true,
      webPreferences: {
        preload: path.join(__dirname, "capture", "capture-preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false, // keep encoding while the window is hidden
      },
    });
    this._win = win;
    win.on("closed", () => {
      if (this._win !== win) return;
      this._win = null;
      this._ready = null;
      for (const [id, v] of this._viewers) { v.reply("MIRROR_ENDED"); this._remove(id); }
    });
    this._ready = win.loadFile(path.join(__dirname, "capture", "capture.html")).then(() => win);
    return this._ready;
  }
}

/** macOS needs Screen Recording permission; without it the capture shows only the wallpaper. */
function screenPermissionProblem() {
  if (process.platform !== "darwin") return null;
  const status = systemPreferences.getMediaAccessStatus("screen");
  if (status === "denied" || status === "restricted") {
    return "Screen mirroring needs permission. On the Mac, open System Settings → Privacy & Security → "
      + "Screen Recording, turn on MouseLink Desktop, then restart the app.";
  }
  return null;
}

module.exports = { ScreenMirror };

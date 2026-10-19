const path = require("path");
const fs = require("fs");
const os = require("os");
const {
  app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, nativeTheme, clipboard, shell,
  systemPreferences, Notification,
} = require("electron");
const { RemoteServer, getLocalIp, DEFAULT_PORT } = require("./server");

const IS_MAC = process.platform === "darwin";
const IS_WIN = process.platform === "win32";
const ASSETS = path.join(__dirname, "assets");

// ---------------- Settings ----------------
const DEFAULT_SETTINGS = {
  port: DEFAULT_PORT,
  password: "",
  autostart: true,     // start the server when the app opens
  closeToTray: true,   // keep running in the background when the window is closed
  openAtLogin: false,
  theme: "system",     // system | light | dark
};
const settingsFile = () => path.join(app.getPath("userData"), "settings.json");
let settings = { ...DEFAULT_SETTINGS };

function loadSettings() {
  try {
    settings = { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(settingsFile(), "utf8")) };
  } catch (_) { /* first run */ }
}

function saveSettings() {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
}

// ---------------- State ----------------
const server = new RemoteServer();
const logs = []; // newest last
let win = null;
let tray = null;
let quitting = false;
let trayHintShown = false;

function accessibilityGranted() {
  // Without this macOS silently ignores injected mouse/keyboard events.
  return IS_MAC ? systemPreferences.isTrustedAccessibilityClient(false) : true;
}

function state() {
  return {
    running: server.running,
    startedAt: server.startedAt,
    commandCount: server.commandCount,
    port: server.running ? server.port : settings.port,
    ip: getLocalIp(),
    hostname: os.hostname(),
    platform: process.platform,
    version: app.getVersion(),
    clients: server.clients(),
    logs: logs.slice(-200),
    settings,
    accessibility: accessibilityGranted(),
    canOpenAtLogin: IS_MAC || IS_WIN,
  };
}

function pushState() {
  if (win && !win.isDestroyed()) win.webContents.send("state", state());
  updateTray();
}

function log(message) {
  logs.push({ time: Date.now(), message });
  if (logs.length > 500) logs.splice(0, logs.length - 500);
  pushState();
}

server.on("state", pushState);
server.on("clients", pushState);
server.on("log", log);

async function startServer() {
  try {
    await server.start(settings.port);
    return { ok: true };
  } catch (e) {
    const message = e.code === "EADDRINUSE"
      ? `Port ${settings.port} is already in use. Another copy of Remote Mouse may be running — or pick a different port in Settings.`
      : e.message;
    log(`Could not start: ${message}`);
    return { ok: false, error: message };
  }
}

// ---------------- Window ----------------
function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 680,
    minWidth: 820,
    minHeight: 580,
    show: false,
    title: "Remote Mouse",
    icon: path.join(ASSETS, "icon.png"),
    backgroundColor: IS_MAC ? "#00000000" : nativeTheme.shouldUseDarkColors ? "#0b0d14" : "#f5f6fa",
    ...(IS_MAC && { titleBarStyle: "hiddenInset", vibrancy: "sidebar", visualEffectState: "active", transparent: false }),
    ...(IS_WIN && { titleBarStyle: "hidden", titleBarOverlay: titleBarOverlay(), backgroundMaterial: "mica" }),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.once("ready-to-show", () => {
    if (!process.argv.includes("--hidden")) win.show();
  });

  // Links open in the real browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.on("close", (e) => {
    if (quitting || !settings.closeToTray) return;
    e.preventDefault();
    win.hide();
    if (IS_MAC) app.dock.hide();
    if (!trayHintShown && Notification.isSupported()) {
      new Notification({ title: "Remote Mouse is still running",
        body: "Your phone stays connected. Use the menu bar / tray icon to open or quit." }).show();
      trayHintShown = true;
    }
  });
  win.on("closed", () => { win = null; });
}

function titleBarOverlay() {
  const dark = nativeTheme.shouldUseDarkColors;
  return { color: "#00000000", symbolColor: dark ? "#e7e9f2" : "#1d2130", height: 44 };
}

function showWindow() {
  if (!win) createWindow();
  if (IS_MAC) app.dock.show();
  win.show();
  win.focus();
}

// ---------------- Tray ----------------
function createTray() {
  let icon;
  if (IS_MAC) {
    icon = nativeImage.createFromPath(path.join(ASSETS, "trayTemplate.png"));
    icon.setTemplateImage(true);
  } else {
    icon = nativeImage.createFromPath(path.join(ASSETS, "icon.png")).resize({ width: IS_WIN ? 16 : 22 });
  }
  tray = new Tray(icon);
  tray.on("click", () => { if (!IS_MAC) showWindow(); });
  updateTray();
}

function updateTray() {
  if (!tray) return;
  const n = server.clients().length;
  const status = server.running
    ? `Running on ${getLocalIp()}:${server.port}${n ? ` · ${n} connected` : ""}`
    : "Server stopped";
  tray.setToolTip(`Remote Mouse — ${status}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: status, enabled: false },
    { type: "separator" },
    { label: "Open Remote Mouse", click: showWindow },
    { label: server.running ? "Stop Server" : "Start Server",
      click: () => (server.running ? server.stop() : startServer()) },
    { type: "separator" },
    { label: "Quit", accelerator: IS_MAC ? "Cmd+Q" : undefined, click: () => app.quit() },
  ]));
}

// ---------------- IPC ----------------
ipcMain.handle("get-state", () => state());
ipcMain.handle("toggle-server", async () => {
  if (server.running) { server.stop(); return { ok: true }; }
  return startServer();
});
ipcMain.handle("update-settings", (_e, patch) => {
  const allowed = Object.keys(DEFAULT_SETTINGS);
  for (const [k, v] of Object.entries(patch || {})) {
    if (allowed.includes(k) && typeof v === typeof DEFAULT_SETTINGS[k]) settings[k] = v;
  }
  settings.port = Math.min(65535, Math.max(1024, Math.round(settings.port) || DEFAULT_PORT));
  server.password = settings.password;
  nativeTheme.themeSource = settings.theme;
  if ("openAtLogin" in (patch || {}) && (IS_MAC || IS_WIN)) {
    app.setLoginItemSettings({ openAtLogin: settings.openAtLogin, args: ["--hidden"] });
  }
  saveSettings();
  pushState();
  return state();
});
ipcMain.handle("disconnect", (_e, id) => server.disconnect(id));
ipcMain.handle("copy-text", (_e, text) => clipboard.writeText(String(text)));
ipcMain.handle("clear-log", () => { logs.length = 0; pushState(); });
ipcMain.handle("open-accessibility", () => {
  systemPreferences.isTrustedAccessibilityClient(true); // shows the system prompt once
  shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility");
});

// ---------------- App lifecycle ----------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showWindow);

  app.whenReady().then(async () => {
    if (IS_WIN) app.setAppUserModelId("com.techtonic.remotemouse");
    loadSettings();
    server.password = settings.password;
    nativeTheme.themeSource = settings.theme;
    nativeTheme.on("updated", () => {
      if (IS_WIN && win) win.setTitleBarOverlay(titleBarOverlay());
    });

    createTray();
    createWindow();
    if (settings.autostart) await startServer();

    // Wi-Fi may change and macOS permission may be granted while the app is open.
    setInterval(pushState, 5000);
  });

  app.on("activate", showWindow); // macOS: click on the Dock icon
  app.on("before-quit", () => { quitting = true; server.stop(); });
  app.on("window-all-closed", () => {
    if (!settings.closeToTray) app.quit();
  });
}

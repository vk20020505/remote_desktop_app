// Everything that actually touches the computer: mouse, keyboard, clipboard, apps, power.
const { execFile, spawn } = require("child_process");
const { clipboard, ClipboardItem } = require("electron");
const { mouse, keyboard, Key, Button, Point } = require("@nut-tree-fork/nut-js");

mouse.config.autoDelayMs = 0;
mouse.config.mouseSpeed = 100000;
keyboard.config.autoDelayMs = 0;

const PLATFORM = process.platform; // "darwin" | "win32" | "linux"
const OS_NAME = { darwin: "Darwin", win32: "Windows", linux: "Linux" }[PLATFORM] || PLATFORM;

// libnut's scroll unit differs per OS: pixels (macOS), raw wheel delta (Windows), clicks (X11).
// The phone sends wheel "notches".
const SCROLL_UNIT = { darwin: 10, win32: 120, linux: 1 }[PLATFORM] || 1;

const BUTTONS = { left: Button.LEFT, right: Button.RIGHT, middle: Button.MIDDLE };

// Key names follow the phone protocol (pynput naming), e.g. "cmd+shift+t", "media_play_pause".
const KEY_ALIASES = {
  win: "cmd", super: "cmd", option: "alt", control: "ctrl", return: "enter",
  escape: "esc", plus: "+",
};
const NAMED_KEYS = {
  alt: Key.LeftAlt, alt_l: Key.LeftAlt, alt_r: Key.RightAlt, alt_gr: Key.RightAlt,
  ctrl: Key.LeftControl, ctrl_l: Key.LeftControl, ctrl_r: Key.RightControl,
  shift: Key.LeftShift, shift_l: Key.LeftShift, shift_r: Key.RightShift,
  cmd: Key.LeftSuper, cmd_l: Key.LeftSuper, cmd_r: Key.RightSuper,
  backspace: Key.Backspace, delete: Key.Delete, enter: Key.Enter, esc: Key.Escape,
  tab: Key.Tab, space: Key.Space, caps_lock: Key.CapsLock,
  up: Key.Up, down: Key.Down, left: Key.Left, right: Key.Right,
  home: Key.Home, end: Key.End, page_up: Key.PageUp, page_down: Key.PageDown,
  insert: Key.Insert, menu: Key.Menu, num_lock: Key.NumLock, pause: Key.Pause,
  print_screen: Key.Print, scroll_lock: Key.ScrollLock,
  media_play_pause: Key.AudioPlay, media_volume_mute: Key.AudioMute,
  media_volume_down: Key.AudioVolDown, media_volume_up: Key.AudioVolUp,
  media_previous: Key.AudioPrev, media_next: Key.AudioNext,
};
for (let i = 1; i <= 24; i++) NAMED_KEYS[`f${i}`] = Key[`F${i}`];

// Characters reachable without shift, and the ones that need it on a US layout.
const CHAR_KEYS = {
  "`": Key.Grave, "-": Key.Minus, "=": Key.Equal, "[": Key.LeftBracket, "]": Key.RightBracket,
  "\\": Key.Backslash, ";": Key.Semicolon, "'": Key.Quote, ",": Key.Comma, ".": Key.Period,
  "/": Key.Slash, " ": Key.Space,
};
const SHIFTED = {
  "~": "`", "!": "1", "@": "2", "#": "3", "$": "4", "%": "5", "^": "6", "&": "7", "*": "8",
  "(": "9", ")": "0", "_": "-", "+": "=", "{": "[", "}": "]", "|": "\\", ":": ";", '"': "'",
  "<": ",", ">": ".", "?": "/",
};

/** Returns the list of nut-js keys for one combo part ("a" -> [A], "A" -> [Shift, A]). */
function parseKey(name) {
  if (name.length > 1) {
    const n = KEY_ALIASES[name.toLowerCase()] || name.toLowerCase();
    if (n.length === 1) return parseKey(n);
    if (NAMED_KEYS[n] !== undefined) return [NAMED_KEYS[n]];
    throw new Error(`unknown key '${name}'`);
  }
  if (/^[a-z]$/.test(name)) return [Key[name.toUpperCase()]];
  if (/^[A-Z]$/.test(name)) return [Key.LeftShift, Key[name]];
  if (/^[0-9]$/.test(name)) return [Key[`Num${name}`]];
  if (CHAR_KEYS[name] !== undefined) return [CHAR_KEYS[name]];
  if (SHIFTED[name]) return [Key.LeftShift, ...parseKey(SHIFTED[name])];
  throw new Error(`unknown key '${name}'`);
}

async function pressCombo(combo) {
  // "cmd+shift+t" -> hold the modifiers and tap the last key. "plus" means "+".
  const keys = combo.split("+").filter(Boolean).flatMap(parseKey);
  await keyboard.pressKey(...keys);
  await keyboard.releaseKey(...keys.reverse());
}

// ---------------- Mouse ----------------
async function moveBy(dx, dy) {
  const p = await mouse.getPosition();
  await mouse.setPosition(new Point(p.x + dx, p.y + dy));
}

async function scroll(dx, dy) {
  // Positive dy = up, positive dx = right (same as the phone / pynput).
  if (dy > 0) await mouse.scrollUp(dy * SCROLL_UNIT);
  if (dy < 0) await mouse.scrollDown(-dy * SCROLL_UNIT);
  if (dx > 0) await mouse.scrollRight(dx * SCROLL_UNIT);
  if (dx < 0) await mouse.scrollLeft(-dx * SCROLL_UNIT);
}

// ---------------- Clipboard ----------------
/** PNG bytes of the image on the clipboard, or null. */
async function clipboardImage() {
  for (const item of await clipboard.read()) {
    if (item.types.includes("image/png")) {
      return Buffer.from(await (await item.getType("image/png")).arrayBuffer());
    }
  }
  return null;
}

// ---------------- Shell helpers ----------------
function run(cmd, args, timeout = 15000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => resolve(err && !stdout ? "" : String(stdout)));
  });
}

const powershell = (script) => run("powershell", ["-NoProfile", "-Command",
  "[Console]::OutputEncoding=[Text.Encoding]::UTF8;" + script]);
const psQuote = (s) => "'" + s.replace(/'/g, "''") + "'";
const which = (bin) => run(PLATFORM === "win32" ? "where" : "which", [bin]).then((o) => !!o.trim());

// ---------------- Apps ----------------
async function listApps() {
  // macOS asks once for Automation permission ("System Events"); until granted this returns nothing.
  let names = [];
  if (PLATFORM === "darwin") {
    const out = await run("osascript", ["-e",
      'tell application "System Events" to get name of (processes where background only is false)']);
    names = out.trim().split(", ");
  } else if (PLATFORM === "win32") {
    const out = await powershell(
      "Get-Process | Where-Object {$_.MainWindowTitle} | Select-Object -ExpandProperty ProcessName");
    names = out.split(/\r?\n/);
  } else if (await which("wmctrl")) {
    // wmctrl -lx: id desktop wm_class host title -> "firefox.Firefox" -> "firefox"
    const out = await run("wmctrl", ["-lx"]);
    names = out.split("\n").map((l) => (l.split(/\s+/)[2] || "").split(".")[0]);
  }
  return [...new Set(names.map((n) => n.trim()).filter(Boolean))]
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

async function openApp(name) {
  // Focus the app if it is running, otherwise launch it.
  if (PLATFORM === "darwin") return run("open", ["-a", name]);
  if (PLATFORM === "win32") {
    return powershell(`$p=Get-Process -Name ${psQuote(name)} -ErrorAction SilentlyContinue | ` +
      "Where-Object {$_.MainWindowTitle} | Select-Object -First 1;" +
      "if($p){(New-Object -ComObject WScript.Shell).AppActivate($p.Id)|Out-Null}" +
      `else{Start-Process ${psQuote(name)}}`);
  }
  if (await which("wmctrl")) {
    const ok = await new Promise((r) => execFile("wmctrl", ["-x", "-a", name], (e) => r(!e)));
    if (ok) return;
  }
  spawn(name, [], { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
}

// ---------------- Power ----------------
const POWER_COMMANDS = {
  darwin: {
    shutdown: ["osascript", ["-e", 'tell application "System Events" to shut down']],
    restart: ["osascript", ["-e", 'tell application "System Events" to restart']],
    sleep: ["pmset", ["sleepnow"]],
    lock: ["pmset", ["displaysleepnow"]],
  },
  win32: {
    shutdown: ["shutdown", ["/s", "/t", "0"]],
    restart: ["shutdown", ["/r", "/t", "0"]],
    sleep: ["rundll32.exe", ["powrprof.dll,SetSuspendState", "0,1,0"]],
    lock: ["rundll32.exe", ["user32.dll,LockWorkStation"]],
  },
  linux: {
    shutdown: ["systemctl", ["poweroff"]],
    restart: ["systemctl", ["reboot"]],
    sleep: ["systemctl", ["suspend"]],
    lock: ["loginctl", ["lock-session"]],
  },
};

function power(action) {
  const cmd = (POWER_COMMANDS[PLATFORM] || {})[action];
  if (cmd) spawn(cmd[0], cmd[1], { detached: true, stdio: "ignore", windowsHide: true }).on("error", () => {}).unref();
}

// ---------------- Protocol ----------------
// One command per line, space separated. Free text / binary is base64.
//   AUTH <b64 password>        -> AUTH_OK <os> | AUTH_FAIL      (handled by server.js)
//   PING                       -> PONG
//   MOVE dx dy
//   CLICK_LEFT | CLICK_RIGHT | CLICK_MIDDLE | DOUBLE_CLICK
//   MOUSE_DOWN <btn> | MOUSE_UP <btn>          (btn = left|right|middle)
//   SCROLL dy (legacy, x3) | SCROLL dx dy      (wheel notches)
//   TYPE <b64 text>
//   KEY <combo>                                (e.g. cmd+shift+t, media_play_pause)
//   APP_LIST                   -> APPS <b64 json list>
//   APP_OPEN <b64 name>
//   POWER shutdown|restart|sleep|lock
//   CLIP_SET <b64 text> | CLIP_GET             -> CLIP <b64 text>
//   CLIP_IMG_SET <b64 png> | CLIP_IMG_GET      -> CLIP_IMG <b64 png> | CLIP_IMG_NONE
//   DESKTOP_LEFT | DESKTOP_RIGHT | NEXT_APP    (legacy)
const b64decode = (s) => (s ? Buffer.from(s, "base64").toString("utf8") : "");
const b64encode = (s) => Buffer.from(s, "utf8").toString("base64");

/** Runs one command. Resolves to a short description for the activity log, or null. */
async function handleCommand(cmd, args, reply) {
  switch (cmd) {
    case "PING": reply("PONG"); break;
    case "MOVE": await moveBy(parseInt(args[0], 10) || 0, parseInt(args[1], 10) || 0); break;
    case "CLICK_LEFT": await mouse.click(Button.LEFT); break;
    case "CLICK_RIGHT": await mouse.click(Button.RIGHT); break;
    case "CLICK_MIDDLE": await mouse.click(Button.MIDDLE); break;
    case "DOUBLE_CLICK": await mouse.doubleClick(Button.LEFT); break;
    case "MOUSE_DOWN": if (BUTTONS[args[0]] !== undefined) await mouse.pressButton(BUTTONS[args[0]]); break;
    case "MOUSE_UP": if (BUTTONS[args[0]] !== undefined) await mouse.releaseButton(BUTTONS[args[0]]); break;
    case "SCROLL":
      if (args.length === 1) await scroll(0, parseInt(args[0], 10) * 3);
      else await scroll(parseInt(args[0], 10) || 0, parseInt(args[1], 10) || 0);
      break;
    case "TYPE": await keyboard.type(b64decode(args[0])); break;
    case "KEY": await pressCombo(args[0] || ""); break;
    case "APP_LIST": reply("APPS " + b64encode(JSON.stringify(await listApps()))); break;
    case "APP_OPEN": {
      const name = b64decode(args[0]);
      await openApp(name);
      return `Opened app “${name}”`;
    }
    case "POWER": power(args[0]); return `Power: ${args[0]}`;
    case "CLIP_SET": await clipboard.writeText(b64decode(args[0])); return "Received clipboard text";
    case "CLIP_GET": reply("CLIP " + b64encode(await clipboard.readText())); return "Sent clipboard text";
    case "CLIP_IMG_SET":
      await clipboard.write([new ClipboardItem({
        "image/png": new Blob([Buffer.from(args[0] || "", "base64")], { type: "image/png" }),
      })]);
      return "Received clipboard image";
    case "CLIP_IMG_GET": {
      const png = await clipboardImage();
      reply(png ? "CLIP_IMG " + png.toString("base64") : "CLIP_IMG_NONE");
      return png ? "Sent clipboard image" : null;
    }
    case "DESKTOP_LEFT": await pressCombo("ctrl+left"); break;
    case "DESKTOP_RIGHT": await pressCombo("ctrl+right"); break;
    case "NEXT_APP": await pressCombo(PLATFORM === "darwin" ? "cmd+tab" : "alt+tab"); break;
    default: console.log(`Unknown command: ${cmd}`);
  }
  return null;
}

module.exports = { handleCommand, b64decode, OS_NAME };

const api = window.remote;
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

let state = null;
let settingsLoaded = false;

document.body.classList.add(`platform-${api.platform}`);

// ---------------- Helpers ----------------
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return node;
}

function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}

function duration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

const clock = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const ago = (t) => (Date.now() - t < 60000 ? "just now" : `${duration(Date.now() - t)} ago`);

function toast(message, kind = "ok") {
  const t = el("div", { class: `toast ${kind}` }, icon(kind === "ok" ? "check" : "alert"), message);
  $("#toasts").append(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, kind === "ok" ? 1800 : 4500);
}

// ---------------- Navigation ----------------
function go(view) {
  $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
  $(".scroll").scrollTop = 0;
}
$$(".nav-item").forEach((b) => b.addEventListener("click", () => go(b.dataset.view)));
$$("[data-goto]").forEach((b) => b.addEventListener("click", () => go(b.dataset.goto)));

// ---------------- Rendering ----------------
function logKind(msg) {
  if (/connected$/.test(msg) && !/disconnected$/.test(msg)) return "green";
  if (/disconnected$|stopped/.test(msg)) return "gray";
  if (/wrong password|Could not|unavailable|error/i.test(msg)) return "red";
  return "";
}

function renderLog(list, entries, emptyText) {
  list.replaceChildren(...(entries.length
    ? entries.map((e) => el("li", {},
        el("span", { class: `tl-dot ${logKind(e.message)}` }),
        el("span", { class: "tl-msg", title: e.message }, e.message),
        el("span", { class: "tl-time" }, clock(e.time))))
    : [el("li", { class: "empty" }, emptyText)]));
}

function renderDevices(clients) {
  const list = $("#device-list");
  if (!clients.length) {
    list.style.display = "block";
    list.replaceChildren(el("div", { class: "card empty empty-big" },
      el("div", { class: "empty-icon" }, icon("phone")),
      el("h3", {}, state.running ? "Waiting for your phone" : "Server is off"),
      el("p", {}, state.running
        ? `Open Remote Mouse on your phone and connect to ${state.ip}.`
        : "Start the server from the Overview page to accept connections.")));
    return;
  }
  list.style.display = "";
  list.replaceChildren(...clients.map((c) => el("div", { class: "card device" },
    el("div", { class: "device-avatar" }, icon("phone")),
    el("div", { class: "device-info" },
      el("div", { class: "device-name" }, c.ip),
      el("div", { class: "device-meta" },
        el("span", { class: c.authed ? "pill" : "pill warn" }, c.authed ? "Connected" : "Needs password"),
        el("span", { "data-since": c.connectedAt }, ago(c.connectedAt)))),
    el("button", { class: "btn btn-danger", onclick: () => api.disconnect(c.id) }, "Disconnect"))));
}

function render(s) {
  state = s;
  const on = s.running;
  const n = s.clients.length;

  // Hero
  $("#hero").classList.toggle("on", on);
  $("#hero-title").textContent = on ? (n ? `${n} device${n > 1 ? "s" : ""} connected` : "Ready to connect") : "Server is off";
  $("#hero-sub").textContent = on
    ? (n ? "Your phone is in control. Have fun!" : "Open Remote Mouse on your phone to get started.")
    : "Turn it on to let your phone connect.";
  const btn = $("#toggle-server");
  btn.className = `btn btn-lg ${on ? "btn-danger" : "btn-primary"}`;
  btn.querySelector("span").textContent = on ? "Stop Server" : "Start Server";

  // Address
  $("#ip").textContent = s.ip;
  $("#port").textContent = s.port;
  $("#hostname").textContent = s.hostname;
  const secure = !!s.settings.password;
  $("#security-chip").classList.toggle("secure", secure);
  $("#security-chip span").textContent = secure ? "Password protected" : "No password";

  // Sidebar
  $("#sidebar-status").classList.toggle("on", on);
  $(".sidebar-status-title").textContent = on ? "Server running" : "Server stopped";
  $(".sidebar-status-sub").textContent = on ? `${s.ip}:${s.port}` : "Not accepting connections";
  $("#nav-device-count").hidden = !n;
  $("#nav-device-count").textContent = n;

  // Stats
  $("#stat-devices").textContent = n;
  $("#stat-commands").textContent = s.commandCount.toLocaleString();
  tick();

  // Lists
  const logs = [...s.logs].reverse();
  renderLog($("#recent-activity"), logs.slice(0, 5), "Nothing yet — connect your phone to see activity here.");
  renderLog($("#activity-log"), logs, "No activity yet.");
  renderDevices(s.clients);

  $("#permission-banner").hidden = s.accessibility;

  // Settings: fill once, then never overwrite what the user is typing.
  if (!settingsLoaded) {
    $("#password").value = s.settings.password;
    $("#port-input").value = s.settings.port;
    $("#login-setting").hidden = !s.canOpenAtLogin;
    $("#about").textContent = `Remote Mouse ${s.version} · ${{ darwin: "macOS", win32: "Windows", linux: "Linux" }[s.platform] || s.platform}`;
    settingsLoaded = true;
  }
  $$("[data-setting]").forEach((cb) => { cb.checked = !!s.settings[cb.dataset.setting]; });
  $$("#theme button").forEach((b) => b.classList.toggle("active", b.dataset.value === s.settings.theme));
  $("#port-input").disabled = on;
  $("#port-desc").textContent = on
    ? "Stop the server to change the port."
    : "The phone app uses 12345 by default.";
}

function tick() {
  if (!state) return;
  $("#stat-uptime").textContent = state.running && state.startedAt ? duration(Date.now() - state.startedAt) : "—";
  $$("[data-since]").forEach((n) => { n.textContent = ago(Number(n.dataset.since)); });
}
setInterval(tick, 1000);

// ---------------- Actions ----------------
$("#toggle-server").addEventListener("click", async () => {
  const res = await api.toggleServer();
  if (!res.ok) toast(res.error, "error");
});

$("#copy-ip").addEventListener("click", async () => {
  await api.copyText(`${state.ip}:${state.port}`);
  const b = $("#copy-ip");
  b.classList.add("done");
  b.querySelector("use").setAttribute("href", "#i-check");
  toast("Address copied");
  setTimeout(() => { b.classList.remove("done"); b.querySelector("use").setAttribute("href", "#i-copy"); }, 1600);
});

$("#open-accessibility").addEventListener("click", () => api.openAccessibility());
$("#clear-log").addEventListener("click", () => api.clearLog());

let pwTimer;
$("#password").addEventListener("input", (e) => {
  clearTimeout(pwTimer);
  pwTimer = setTimeout(() => api.updateSettings({ password: e.target.value }), 300);
});
$("#toggle-password").addEventListener("click", () => {
  const input = $("#password");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  $("#toggle-password use").setAttribute("href", show ? "#i-eye-off" : "#i-eye");
});

$("#port-input").addEventListener("change", async (e) => {
  const s = await api.updateSettings({ port: Number(e.target.value) });
  e.target.value = s.settings.port;
  toast(`Port set to ${s.settings.port}`);
});

$$("[data-setting]").forEach((cb) =>
  cb.addEventListener("change", () => api.updateSettings({ [cb.dataset.setting]: cb.checked })));
$$("#theme button").forEach((b) =>
  b.addEventListener("click", () => api.updateSettings({ theme: b.dataset.value })));

// ---------------- Boot ----------------
api.onState(render);
api.getState().then(render);

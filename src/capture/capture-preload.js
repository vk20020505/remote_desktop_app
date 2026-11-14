// Bridge for the hidden screen-capture window (see ../mirror.js).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("capture", {
  // { id, sourceId, maxWidth, fps } -> reply with offer(id, sdp) or failed(id, message)
  onStart: (cb) => ipcRenderer.on("mirror-start", (_e, req) => cb(req)),
  onAnswer: (cb) => ipcRenderer.on("mirror-answer", (_e, id, sdp) => cb(id, sdp)),
  onStop: (cb) => ipcRenderer.on("mirror-stop", (_e, id) => cb(id)),
  offer: (id, sdp) => ipcRenderer.send("mirror-offer", id, sdp),
  failed: (id, message) => ipcRenderer.send("mirror-failed", id, String(message)),
  closed: (id) => ipcRenderer.send("mirror-closed", id),
});

// The only bridge between the page and the main process.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("remote", {
  platform: process.platform,
  getState: () => ipcRenderer.invoke("get-state"),
  toggleServer: () => ipcRenderer.invoke("toggle-server"),
  updateSettings: (patch) => ipcRenderer.invoke("update-settings", patch),
  disconnect: (id) => ipcRenderer.invoke("disconnect", id),
  copyText: (text) => ipcRenderer.invoke("copy-text", text),
  clearLog: () => ipcRenderer.invoke("clear-log"),
  openAccessibility: () => ipcRenderer.invoke("open-accessibility"),
  onState: (cb) => ipcRenderer.on("state", (_e, s) => cb(s)),
});

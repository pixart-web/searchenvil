const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("searchAnvilDesktop", {
  status: () => ipcRenderer.invoke("searchanvil:status"),
});

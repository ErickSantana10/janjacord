const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getDesktopSources: () => ipcRenderer.invoke('desktop-capturer:get-sources'),
  selectDesktopSource: (options) => ipcRenderer.invoke('desktop-capturer:select-source', options),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
});

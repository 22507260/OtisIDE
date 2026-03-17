const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveProject: (data, options) =>
    ipcRenderer.invoke('save-project', { data, options }),
  loadProject: (options) => ipcRenderer.invoke('load-project', options),
  exportPng: (dataUrl, options) =>
    ipcRenderer.invoke('export-png', { dataUrl, options }),
  aiChat: (params) => ipcRenderer.invoke('ai-chat', params),
  setWindowTitle: (title) => ipcRenderer.send('set-window-title', title),
});

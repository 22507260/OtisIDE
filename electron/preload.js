const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isCustomWindowChrome: process.platform !== 'darwin',
  saveProject: (data, options) =>
    ipcRenderer.invoke('save-project', { data, options }),
  loadProject: (options) => ipcRenderer.invoke('load-project', options),
  exportPng: (dataUrl, options) =>
    ipcRenderer.invoke('export-png', { dataUrl, options }),
  aiChat: (params) => ipcRenderer.invoke('ai-chat', params),
  prepareHardwareIde: (payload) => ipcRenderer.invoke('ide-prepare', payload),
  listHardwareDevices: () => ipcRenderer.invoke('ide-list-devices'),
  verifyHardwareSketch: (payload) =>
    ipcRenderer.invoke('ide-verify-sketch', payload),
  uploadHardwareSketch: (payload) =>
    ipcRenderer.invoke('ide-upload-sketch', payload),
  openHardwareSerialMonitor: (payload) =>
    ipcRenderer.invoke('ide-open-serial-monitor', payload),
  closeHardwareSerialMonitor: () =>
    ipcRenderer.invoke('ide-close-serial-monitor'),
  onHardwareSerialData: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('ide-serial-data', listener);
    return () => ipcRenderer.removeListener('ide-serial-data', listener);
  },
  onHardwareSerialStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('ide-serial-status', listener);
    return () => ipcRenderer.removeListener('ide-serial-status', listener);
  },
  onHardwareSerialError: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('ide-serial-error', listener);
    return () => ipcRenderer.removeListener('ide-serial-error', listener);
  },
  setWindowTitle: (title) => ipcRenderer.send('set-window-title', title),
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window-toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
});

const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('editor', {
  read: name => ipcRenderer.invoke('editor:read', name),
  save: (name, text) => ipcRenderer.invoke('editor:save', name, text),
  restore: name => ipcRenderer.invoke('editor:restore', name)
});

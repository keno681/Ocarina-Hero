const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('editor', {
  preview: text => ipcRenderer.invoke('patch:preview', text),
  apply: () => ipcRenderer.invoke('patch:apply'),
  undo: () => ipcRenderer.invoke('patch:undo'),
  read: name => ipcRenderer.invoke('editor:read', name),
  save: (name, text) => ipcRenderer.invoke('editor:save', name, text),
  restore: name => ipcRenderer.invoke('editor:restore', name)
});

const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('compreesor', {
  pathForFile: (file) => webUtils.getPathForFile(file),
  compressFiles: (payload) => ipcRenderer.invoke('compress-files', payload),
})

const { contextBridge, ipcRenderer, webUtils } = require('electron')

const pathForFile = (file) => webUtils.getPathForFile(file)
const capabilities = Object.freeze({
  nativeInputExtensions: Object.freeze([
    'jpg', 'jpeg', 'png', 'webp', 'avif', 'svg',
  ]),
  nativeOutputFormats: Object.freeze([
    'original', 'jpg', 'jpeg', 'png', 'webp', 'avif', 'svg',
  ]),
  bufferReplacementExtensions: Object.freeze([
    'jpg', 'jpeg', 'png', 'webp', 'avif', 'jxl', 'svg', 'gif',
    'mp4', 'mov', 'webm', 'mkv', 'avi', 'mpg', 'mpeg', 'mp3', 'pdf',
  ]),
})

contextBridge.exposeInMainWorld('compreesorDesktop', Object.freeze({
  isDesktop: true,
  apiVersion: 2,
  capabilities,
  pathForFile,
  compressFile: (payload) => ipcRenderer.invoke('desktop:compress-file', payload),
  compressVariants: (payload) => ipcRenderer.invoke('desktop:compress-variants', payload),
  replaceWithData: (payload) => ipcRenderer.invoke('desktop:replace-with-data', payload),
  writeVariants: (payload) => ipcRenderer.invoke('desktop:write-variants', payload),
  readResultFile: (path) => ipcRenderer.invoke('desktop:read-result-file', path),
  revealResultFile: (path) => ipcRenderer.invoke('desktop:reveal-result-file', path),
}))

// 兼容旧桌面 renderer；共享网页 UI 接入后使用 compreesorDesktop。
contextBridge.exposeInMainWorld('compreesor', {
  pathForFile,
  compressFiles: (payload) => ipcRenderer.invoke('compress-files', payload),
})

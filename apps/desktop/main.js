import { app, BrowserWindow, ipcMain } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compressFile } from 'compreesor-cli/core'

const currentDirectory = dirname(fileURLToPath(import.meta.url))

function createWindow() {
  const window = new BrowserWindow({
    width: 680,
    height: 560,
    minWidth: 520,
    minHeight: 460,
    title: 'Compreesor',
    backgroundColor: '#f6f8fb',
    show: false,
    webPreferences: {
      preload: join(currentDirectory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  window.removeMenu()
  window.loadFile(join(currentDirectory, 'renderer', 'index.html'))
  window.once('ready-to-show', () => window.show())
}

ipcMain.handle('compress-files', async (_event, payload) => {
  const paths = Array.isArray(payload?.paths) ? payload.paths : []
  const format = typeof payload?.format === 'string' ? payload.format : 'original'
  const quality = Number.isFinite(payload?.quality) ? payload.quality : 80
  const results = []
  for (const path of paths) {
    try {
      results.push({
        path,
        ok: true,
        result: await compressFile(path, { format, quality, replace: true }),
      })
    } catch (error) {
      results.push({ path, ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }
  return results
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

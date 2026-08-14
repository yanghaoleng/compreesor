import { app, BrowserWindow, ipcMain, net, protocol, shell } from 'electron'
import { existsSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { compressFile } from 'compreesor-cli/core'
import { mimeTypeForPath, readResultFile, replaceFileWithData, writeVariantFiles } from './native-files.js'
import { DESKTOP_ORIGIN, DESKTOP_SCHEME, resolveWebAssetPath } from './web-protocol.js'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const approvedResultPaths = new Set()
const NATIVE_INPUT_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'svg'])
const NATIVE_OUTPUT_FORMATS = new Set(['original', 'jpg', 'jpeg', 'png', 'webp', 'avif', 'svg'])

protocol.registerSchemesAsPrivileged([{
  scheme: DESKTOP_SCHEME,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
  },
}])

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error ?? '处理失败')
}

function webRootPath() {
  const sharedWebRoot = app.isPackaged
    ? join(process.resourcesPath, 'web')
    : join(currentDirectory, 'web-dist')
  if (existsSync(join(sharedWebRoot, 'index.html'))) return sharedWebRoot
  return join(currentDirectory, 'renderer')
}

function requireApprovedPath(candidate) {
  const absolutePath = resolve(String(candidate ?? ''))
  if (!approvedResultPaths.has(absolutePath)) throw new Error('结果路径未由 Compreesor 生成')
  return absolutePath
}

async function nativeCompress(payload) {
  const inputPath = resolve(String(payload?.path ?? ''))
  const format = typeof payload?.format === 'string' ? payload.format : 'original'
  const inputExtension = inputPath.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''
  if (!NATIVE_INPUT_EXTENSIONS.has(inputExtension) || !NATIVE_OUTPUT_FORMATS.has(format)) {
    throw new Error('桌面原生核心仅处理图片与 SVG；GIF、视频和音频请使用内置网页媒体引擎')
  }
  const preset = typeof payload?.preset === 'string' ? payload.preset : 'balanced'
  const options = { format, preset, replace: true }
  if (Number.isFinite(payload?.quality)) options.quality = payload.quality

  const result = await compressFile(inputPath, options)
  const outputPath = resolve(result.outputPath)
  approvedResultPaths.add(outputPath)
  return {
    ...result,
    outputPath,
    outputName: basename(outputPath),
    sourceRemoved: inputPath !== outputPath,
    mimeType: mimeTypeForPath(outputPath),
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 760,
    minHeight: 580,
    title: 'Compreesor',
    backgroundColor: '#f6f8fb',
    show: false,
    webPreferences: {
      preload: join(currentDirectory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.removeMenu()
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(`${DESKTOP_ORIGIN}/`) || url === window.webContents.getURL()) return
    event.preventDefault()
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
  })
  void window.loadURL(`${DESKTOP_ORIGIN}/index.html`)
  window.once('ready-to-show', () => window.show())
}

ipcMain.handle('desktop:compress-file', async (_event, payload) => nativeCompress(payload))

ipcMain.handle('desktop:replace-with-data', async (_event, payload) => {
  const result = await replaceFileWithData(payload?.sourcePath, payload?.outputExtension, payload?.data)
  approvedResultPaths.add(resolve(result.outputPath))
  return result
})

ipcMain.handle('desktop:write-variants', async (_event, payload) => {
  const results = await writeVariantFiles(payload?.sourcePath, payload?.variants)
  results.forEach((result) => approvedResultPaths.add(resolve(result.outputPath)))
  return results
})

ipcMain.handle('desktop:read-result-file', async (_event, candidate) => {
  return readResultFile(requireApprovedPath(candidate))
})

ipcMain.handle('desktop:reveal-result-file', async (_event, candidate) => {
  shell.showItemInFolder(requireApprovedPath(candidate))
  return true
})

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
        result: await nativeCompress({ path, format, quality, preset: payload?.preset }),
      })
    } catch (error) {
      results.push({ path, ok: false, error: errorMessage(error) })
    }
  }
  return results
})

app.whenReady().then(async () => {
  const webRoot = webRootPath()
  protocol.handle(DESKTOP_SCHEME, (request) => {
    try {
      const assetPath = resolveWebAssetPath(webRoot, request.url)
      return net.fetch(pathToFileURL(assetPath).toString())
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

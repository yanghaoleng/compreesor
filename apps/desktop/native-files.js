import { randomUUID } from 'node:crypto'
import { access, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, parse, resolve } from 'node:path'

const OUTPUT_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'avif', 'jxl', 'svg', 'gif',
  'mp4', 'mov', 'webm', 'mkv', 'avi', 'mpg', 'mpeg', 'mp3',
])

const MIME_TYPES = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.jxl', 'image/jxl'],
  ['.svg', 'image/svg+xml'],
  ['.gif', 'image/gif'],
  ['.mp4', 'video/mp4'],
  ['.mov', 'video/quicktime'],
  ['.webm', 'video/webm'],
  ['.mkv', 'video/x-matroska'],
  ['.avi', 'video/x-msvideo'],
  ['.mpg', 'video/mpeg'],
  ['.mpeg', 'video/mpeg'],
  ['.mp3', 'audio/mpeg'],
])

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function bytesFrom(value) {
  if (Buffer.isBuffer(value)) return value
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
  if (value instanceof ArrayBuffer) return Buffer.from(value)
  throw new TypeError('替换数据必须是 ArrayBuffer 或 Uint8Array')
}

export function normalizeOutputExtension(value) {
  const extension = String(value ?? '').trim().toLowerCase().replace(/^\./, '')
  if (!OUTPUT_EXTENSIONS.has(extension)) throw new Error(`不支持的输出后缀：${extension || '空'}`)
  return extension === 'jpeg' ? 'jpg' : extension
}

export function mimeTypeForPath(filePath) {
  return MIME_TYPES.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream'
}

export async function readResultFile(filePath) {
  const absolutePath = resolve(filePath)
  const info = await stat(absolutePath)
  if (!info.isFile()) throw new Error('结果路径不是文件')
  return {
    path: absolutePath,
    name: basename(absolutePath),
    size: info.size,
    mimeType: mimeTypeForPath(absolutePath),
    data: new Uint8Array(await readFile(absolutePath)),
  }
}

export async function replaceFileWithData(source, outputExtension, value) {
  const sourcePath = resolve(source)
  const sourceInfo = await stat(sourcePath)
  if (!sourceInfo.isFile()) throw new Error('源路径不是文件')

  const extension = normalizeOutputExtension(outputExtension)
  const parsed = parse(sourcePath)
  const targetPath = join(parsed.dir, `${parsed.name}.${extension}`)
  if (sourcePath !== targetPath && await exists(targetPath)) {
    throw new Error(`目标文件已存在，未替换：${targetPath}`)
  }

  const data = bytesFrom(value)
  if (data.byteLength === 0) throw new Error('压缩结果为空，未替换源文件')

  const temporaryPath = join(dirname(targetPath), `.${basename(targetPath)}.compreesor-${randomUUID()}.${extension}`)
  const backupPath = `${sourcePath}.compreesor-backup-${randomUUID()}`
  let sourceMoved = false

  try {
    await writeFile(temporaryPath, data, { flag: 'wx', mode: sourceInfo.mode })
    await rename(sourcePath, backupPath)
    sourceMoved = true
    await rename(temporaryPath, targetPath)
    await rm(backupPath, { force: true })
    sourceMoved = false
    return {
      inputPath: sourcePath,
      outputPath: targetPath,
      outputName: basename(targetPath),
      originalBytes: sourceInfo.size,
      outputBytes: data.byteLength,
      unchanged: false,
      sourceRemoved: sourcePath !== targetPath,
      mimeType: mimeTypeForPath(targetPath),
    }
  } catch (error) {
    await rm(temporaryPath, { force: true })
    if (sourceMoved) {
      await rm(targetPath, { force: true })
      await rename(backupPath, sourcePath)
    }
    throw error
  }
}

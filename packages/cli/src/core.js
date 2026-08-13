import { spawn, spawnSync } from 'node:child_process'
import { constants as fsConstants } from 'node:fs'
import {
  access,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, extname, join, parse, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { optimize } from 'svgo'

const STATIC_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.svg'])
const GIF_EXTENSIONS = new Set(['.gif'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi', '.mpeg', '.mpg'])
const ALL_EXTENSIONS = new Set([...STATIC_IMAGE_EXTENSIONS, ...GIF_EXTENSIONS, ...VIDEO_EXTENSIONS])

export function classifyPath(filePath) {
  const extension = extname(filePath).toLowerCase()
  if (STATIC_IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (GIF_EXTENSIONS.has(extension)) return 'gif'
  if (VIDEO_EXTENSIONS.has(extension)) return 'video'
  return null
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export async function collectMediaFiles(inputs, { recursive = true } = {}) {
  const found = []
  const seen = new Set()

  async function visit(candidate) {
    const absolute = resolve(candidate)
    let info
    try {
      info = await stat(absolute)
    } catch {
      throw new Error(`找不到路径：${candidate}`)
    }
    if (info.isFile()) {
      if (ALL_EXTENSIONS.has(extname(absolute).toLowerCase()) && !seen.has(absolute)) {
        seen.add(absolute)
        found.push(absolute)
      }
      return
    }
    if (!info.isDirectory()) return
    const entries = await readdir(absolute, { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      if (entry.isDirectory() && !recursive) continue
      if (entry.isDirectory() || entry.isFile()) await visit(join(absolute, entry.name))
    }
  }

  for (const input of inputs) await visit(input)
  return found
}

function normalizedFormat(format) {
  if (format === 'jpg') return 'jpeg'
  return format
}

function imageFormatFor(inputPath, requestedFormat) {
  const requested = normalizedFormat(requestedFormat)
  if (requested !== 'original') return requested
  const extension = extname(inputPath).toLowerCase().slice(1)
  return extension === 'jpg' ? 'jpeg' : extension
}

function extensionFor(kind, inputPath, requestedFormat) {
  const requested = normalizedFormat(requestedFormat)
  if (requested !== 'original') return requested === 'jpeg' ? '.jpg' : `.${requested}`
  if (kind === 'video') return extname(inputPath).toLowerCase() || '.mp4'
  return extname(inputPath).toLowerCase()
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function uniqueOutputPath(directory, stem, extension) {
  let index = 1
  let candidate = join(directory, `${stem}-压缩${extension}`)
  while (await exists(candidate)) {
    index += 1
    candidate = join(directory, `${stem}-压缩-${index}${extension}`)
  }
  return candidate
}

async function resolveFfmpeg(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.FFMPEG_PATH,
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/usr/bin/ffmpeg',
  ].filter(Boolean)

  const fromPath = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], {
    encoding: 'utf8',
    windowsHide: true,
  }).stdout?.trim().split(/\r?\n/)[0]
  if (fromPath) candidates.unshift(fromPath)

  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.X_OK)
      return candidate
    } catch {
      // Continue through well-known paths.
    }
  }
  throw new Error('GIF 和视频处理需要 FFmpeg。macOS 可运行 brew install ffmpeg')
}

function runFfmpeg(binary, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(binary, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let errorOutput = ''
    child.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString()
    })
    child.on('error', rejectPromise)
    child.on('close', (code) => {
      if (code === 0) resolvePromise()
      else rejectPromise(new Error(errorOutput.trim() || `FFmpeg 退出码 ${code}`))
    })
  })
}

async function compressStaticImage(inputPath, outputPath, format, quality) {
  if (format === 'svg') {
    const source = await readFile(inputPath, 'utf8')
    const result = optimize(source, {
      path: inputPath,
      multipass: true,
      plugins: ['preset-default', 'removeScripts'],
    })
    await writeFile(outputPath, result.data)
    return
  }

  let pipeline = sharp(inputPath, { failOn: 'none', limitInputPixels: 268_402_689 }).rotate()
  if (format === 'jpeg') pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true })
  else if (format === 'png') pipeline = pipeline.png({ compressionLevel: 9, effort: 10 })
  else if (format === 'webp') pipeline = pipeline.webp({ quality, effort: 6, smartSubsample: true })
  else if (format === 'avif') pipeline = pipeline.avif({ quality: Math.max(30, quality - 20), effort: 7 })
  else throw new Error(`图片不支持输出为 ${format}`)
  await pipeline.toFile(outputPath)
}

async function compressGif(inputPath, outputPath, ffmpegPath) {
  await runFfmpeg(ffmpegPath, [
    '-i', inputPath,
    '-filter_complex', "fps=12,scale='min(960,iw)':-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer",
    '-loop', '0',
    outputPath,
  ])
}

async function compressVideo(inputPath, outputPath, format, quality, ffmpegPath) {
  if (format === 'mp3') {
    await runFfmpeg(ffmpegPath, ['-i', inputPath, '-vn', '-c:a', 'libmp3lame', '-b:a', '160k', outputPath])
    return
  }

  const crf = String(Math.max(18, Math.min(34, Math.round(40 - quality * 0.25))))
  const extension = extname(outputPath).toLowerCase()
  if (extension === '.webm') {
    await runFfmpeg(ffmpegPath, [
      '-i', inputPath, '-vf', "scale=-2:'min(720,ih)'", '-c:v', 'libvpx-vp9', '-crf', crf,
      '-b:v', '0', '-c:a', 'libopus', '-b:a', '128k', outputPath,
    ])
    return
  }
  await runFfmpeg(ffmpegPath, [
    '-i', inputPath, '-vf', "scale=-2:'min(720,ih)'", '-c:v', 'libx264', '-preset', 'medium',
    '-crf', crf, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outputPath,
  ])
}

async function replaceAtomically(sourcePath, temporaryPath, targetPath) {
  if (sourcePath !== targetPath && await exists(targetPath)) {
    throw new Error(`目标文件已存在，未替换：${targetPath}`)
  }
  const backupPath = `${sourcePath}.compreesor-backup-${randomUUID()}`
  await rename(sourcePath, backupPath)
  try {
    await rename(temporaryPath, targetPath)
    await rm(backupPath, { force: true })
  } catch (error) {
    if (await exists(targetPath)) await rm(targetPath, { force: true })
    await rename(backupPath, sourcePath)
    throw error
  }
}

export async function compressFile(input, options = {}) {
  const inputPath = resolve(input)
  const kind = classifyPath(inputPath)
  if (!kind) throw new Error(`不支持的格式：${extname(inputPath) || basename(inputPath)}`)

  const requestedFormat = normalizedFormat(options.format ?? 'original')
  const quality = options.quality ?? 80
  const sourceInfo = await stat(inputPath)
  const parsed = parse(inputPath)
  const targetExtension = extensionFor(kind, inputPath, requestedFormat)
  const outputDirectory = options.outputDirectory ? resolve(options.outputDirectory) : parsed.dir
  await mkdir(outputDirectory, { recursive: true })

  let targetPath
  if (options.replace) targetPath = join(parsed.dir, `${parsed.name}${targetExtension}`)
  else targetPath = await uniqueOutputPath(outputDirectory, parsed.name, targetExtension)
  const temporaryPath = join(dirname(targetPath), `.${basename(targetPath)}.compreesor-${randomUUID()}${targetExtension}`)

  try {
    if (kind === 'image') {
      const format = imageFormatFor(inputPath, requestedFormat)
      if (!['jpeg', 'png', 'webp', 'avif', 'svg'].includes(format)) {
        throw new Error(`图片不能输出为 ${requestedFormat}`)
      }
      if (format === 'svg' && extname(inputPath).toLowerCase() !== '.svg') {
        throw new Error('位图不能转换为 SVG')
      }
      await compressStaticImage(inputPath, temporaryPath, format, quality)
    } else {
      const ffmpegPath = await resolveFfmpeg(options.ffmpegPath)
      if (kind === 'gif') {
        if (!['original', 'gif'].includes(requestedFormat)) throw new Error(`GIF 不能输出为 ${requestedFormat}`)
        await compressGif(inputPath, temporaryPath, ffmpegPath)
      } else {
        if (!['original', 'mp4', 'mov', 'mp3'].includes(requestedFormat)) throw new Error(`视频不能输出为 ${requestedFormat}`)
        await compressVideo(inputPath, temporaryPath, requestedFormat, quality, ffmpegPath)
      }
    }

    const outputInfo = await stat(temporaryPath)
    const sameFormat = targetExtension === extname(inputPath).toLowerCase()
    if (sameFormat && outputInfo.size >= sourceInfo.size) {
      await rm(temporaryPath, { force: true })
      if (options.replace) {
        return { inputPath, outputPath: inputPath, originalBytes: sourceInfo.size, outputBytes: sourceInfo.size, unchanged: true }
      }
      await copyFile(inputPath, targetPath)
      return { inputPath, outputPath: targetPath, originalBytes: sourceInfo.size, outputBytes: sourceInfo.size, unchanged: true }
    }

    if (options.replace) await replaceAtomically(inputPath, temporaryPath, targetPath)
    else await rename(temporaryPath, targetPath)
    return { inputPath, outputPath: targetPath, originalBytes: sourceInfo.size, outputBytes: outputInfo.size, unchanged: false }
  } catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}

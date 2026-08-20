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
import {
  QUALITY_PRESETS,
  SUPPORTED_EXTENSIONS,
  classifyName,
  normalizeQualityPreset,
} from '@compreesor/core'

export { QUALITY_PRESETS, normalizeQualityPreset }

const STATIC_IMAGE_EXTENSIONS = new Set(SUPPORTED_EXTENSIONS.image.filter((extension) => extension !== 'jxl').map((extension) => `.${extension}`))
const GIF_EXTENSIONS = new Set(SUPPORTED_EXTENSIONS.gif.map((extension) => `.${extension}`))
const VIDEO_EXTENSIONS = new Set(SUPPORTED_EXTENSIONS.video.map((extension) => `.${extension}`))
const ALL_EXTENSIONS = new Set([...STATIC_IMAGE_EXTENSIONS, ...GIF_EXTENSIONS, ...VIDEO_EXTENSIONS])

export function resolveCompressionSettings(options = {}) {
  const preset = normalizeQualityPreset(options.preset ?? 'balanced')
  const base = QUALITY_PRESETS[preset]
  const numericQuality = options.quality == null ? null : Number(options.quality)
  if (numericQuality != null && !Number.isFinite(numericQuality)) {
    throw new Error('quality 必须是 1 到 100 之间的数字')
  }
  const quality = numericQuality == null ? null : Math.max(1, Math.min(100, Math.round(numericQuality)))

  const image = { ...base.image }
  const video = { ...base.video }
  if (quality != null && preset !== 'lossless') {
    image.quality = quality
    image.avifQuality = Math.max(1, quality - 20)
    // 保持旧 quality API 的视频画质曲线，预设仅补充分辨率、速度与音频参数。
    video.h264Crf = Math.max(18, Math.min(34, Math.round(40 - quality * 0.25)))
    video.vp9Crf = Math.max(24, Math.min(45, video.h264Crf + 6))
  }

  return {
    preset,
    label: base.label,
    image,
    png: { ...base.png },
    svg: { ...base.svg },
    gif: 'copy' in base.gif ? { ...base.gif } : { ...base.gif, maxWidth: base.gif.maxDimension },
    video,
    mp3: { ...base.mp3 },
    qualityOverride: quality,
  }
}

export function classifyPath(filePath) {
  const kind = classifyName(filePath)
  if (kind === 'image' && !STATIC_IMAGE_EXTENSIONS.has(extname(filePath).toLowerCase())) return null
  return kind === 'pdf' ? null : kind
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

function configureRasterPipeline(source, format, settings) {
  let pipeline = source
  if (settings.image.maxDimension) {
    pipeline = pipeline.resize({
      width: settings.image.maxDimension,
      height: settings.image.maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    })
  }
  if (format === 'jpeg') {
    pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({
      quality: settings.image.quality,
      mozjpeg: true,
      chromaSubsampling: settings.image.lossless ? '4:4:4' : '4:2:0',
    })
  } else if (format === 'png') {
    pipeline = pipeline.png(settings.png)
  } else if (format === 'webp') {
    pipeline = pipeline.webp(settings.image.lossless
      ? { lossless: true, effort: Math.min(6, settings.image.effort) }
      : { quality: settings.image.quality, effort: Math.min(6, settings.image.effort), smartSubsample: true })
  } else if (format === 'avif') {
    pipeline = pipeline.avif(settings.image.lossless
      ? { lossless: true, effort: settings.image.effort }
      : { quality: settings.image.avifQuality, effort: settings.image.effort })
  }
  else throw new Error(`图片不支持输出为 ${format}`)
  return pipeline
}

function optimizeSvgSource(source, inputPath, settings) {
  const overrides = settings.svg.preserveGeometry
    ? {
        cleanupNumericValues: false,
        convertPathData: false,
        convertTransform: false,
        mergePaths: false,
      }
    : {
        cleanupNumericValues: { floatPrecision: settings.svg.floatPrecision },
        convertPathData: { floatPrecision: settings.svg.floatPrecision },
        convertTransform: { floatPrecision: settings.svg.floatPrecision },
      }
  return optimize(source, {
    path: inputPath,
    multipass: settings.svg.multipass,
    plugins: [
      { name: 'preset-default', params: { overrides } },
      'removeScripts',
    ],
  }).data
}

async function compressStaticImage(inputPath, outputPath, format, settings) {
  if (format === 'svg') {
    const source = await readFile(inputPath, 'utf8')
    await writeFile(outputPath, optimizeSvgSource(source, inputPath, settings))
    return
  }

  const source = sharp(inputPath, { failOn: 'none', limitInputPixels: 268_402_689 }).rotate()
  const pipeline = configureRasterPipeline(source, format, settings)
  await pipeline.toFile(outputPath)
}

async function compressGif(inputPath, outputPath, ffmpegPath, settings) {
  if (settings.gif.copy) {
    await copyFile(inputPath, outputPath)
    return
  }
  const paletteUse = settings.gif.dither === 'bayer'
    ? 'paletteuse=dither=bayer:bayer_scale=3'
    : 'paletteuse=dither=none'
  await runFfmpeg(ffmpegPath, [
    '-i', inputPath,
    '-filter_complex', `fps=${settings.gif.fps},scale='min(${settings.gif.maxWidth},iw)':-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=${settings.gif.maxColors}[p];[s1][p]${paletteUse}`,
    '-loop', '0',
    outputPath,
  ])
}

async function compressVideo(inputPath, outputPath, format, ffmpegPath, settings) {
  if (format === 'mp3') {
    await runFfmpeg(ffmpegPath, [
      '-i', inputPath,
      '-vn', '-map', '0:a:0',
      '-c:a', 'libmp3lame', '-b:a', settings.mp3.bitrate,
      outputPath,
    ])
    return
  }

  if (settings.video.copy) {
    await runFfmpeg(ffmpegPath, [
      '-i', inputPath,
      '-map', '0', '-c', 'copy',
      ...(extname(outputPath).toLowerCase() === '.mp4' ? ['-movflags', '+faststart'] : []),
      outputPath,
    ])
    return
  }

  const extension = extname(outputPath).toLowerCase()
  if (extension === '.webm') {
    await runFfmpeg(ffmpegPath, [
      '-i', inputPath,
      '-vf', `scale=-2:'min(${settings.video.maxHeight},ih)'`,
      '-c:v', 'libvpx-vp9', '-crf', String(settings.video.vp9Crf), '-b:v', '0',
      '-deadline', 'good', '-cpu-used', String(settings.video.vp9CpuUsed),
      '-c:a', 'libopus', '-b:a', settings.video.audioBitrate,
      outputPath,
    ])
    return
  }
  await runFfmpeg(ffmpegPath, [
    '-i', inputPath,
    '-vf', `scale=-2:'min(${settings.video.maxHeight},ih)'`,
    '-c:v', 'libx264', '-preset', settings.video.h264Preset,
    '-crf', String(settings.video.h264Crf), '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', settings.video.audioBitrate,
    '-movflags', '+faststart',
    outputPath,
  ])
}

export async function compressImageVariants(input, variants) {
  const inputPath = resolve(input)
  if (classifyPath(inputPath) !== 'image') throw new Error('批量质量输出只支持静态图片与 SVG')
  if (!Array.isArray(variants) || variants.length === 0) throw new Error('没有可生成的质量版本')

  const sourceInfo = await stat(inputPath)
  const sourceExtension = extname(inputPath).toLowerCase()
  const prepared = variants.map((variant) => {
    const requestedFormat = variant.format ?? 'original'
    const format = imageFormatFor(inputPath, requestedFormat)
    if (!['jpeg', 'png', 'webp', 'avif', 'svg'].includes(format)) throw new Error(`图片不能输出为 ${format}`)
    if (format === 'svg' && sourceExtension !== '.svg') throw new Error('位图不能转换为 SVG')
    const outputName = basename(String(variant.outputName ?? ''))
    if (!outputName || outputName !== variant.outputName) throw new Error('压缩结果文件名无效')
    const expectedExtension = extensionFor('image', inputPath, requestedFormat)
    if (extname(outputName).toLowerCase() !== expectedExtension) throw new Error(`压缩结果应使用 ${expectedExtension} 后缀`)
    const targetPath = join(dirname(inputPath), outputName)
    const temporaryPath = join(dirname(inputPath), `.${outputName}.compreesor-${randomUUID()}${expectedExtension}`)
    return {
      preset: normalizeQualityPreset(variant.preset),
      settings: resolveCompressionSettings({ preset: variant.preset }),
      format,
      outputName,
      targetPath,
      temporaryPath,
      expectedExtension,
    }
  })

  if (new Set(prepared.map((item) => item.targetPath)).size !== prepared.length) throw new Error('压缩结果文件名重复')
  for (const item of prepared) {
    if (await exists(item.targetPath)) throw new Error(`目标文件已存在，未保存：${item.targetPath}`)
  }

  const completedPaths = []
  try {
    if (sourceExtension === '.svg') {
      const source = await readFile(inputPath, 'utf8')
      await Promise.all(prepared.map((item) => writeFile(
        item.temporaryPath,
        optimizeSvgSource(source, inputPath, item.settings),
        { flag: 'wx', mode: sourceInfo.mode },
      )))
    } else {
      const sharedPipeline = sharp(inputPath, { failOn: 'none', limitInputPixels: 268_402_689 }).rotate()
      await Promise.all(prepared.map(async (item) => {
        if (item.preset === 'lossless' && item.format === 'jpeg' && sourceExtension === item.expectedExtension) {
          await copyFile(inputPath, item.temporaryPath)
          return
        }
        await configureRasterPipeline(sharedPipeline.clone(), item.format, item.settings).toFile(item.temporaryPath)
        const outputInfo = await stat(item.temporaryPath)
        if (sourceExtension === item.expectedExtension && outputInfo.size >= sourceInfo.size) {
          await rm(item.temporaryPath, { force: true })
          await copyFile(inputPath, item.temporaryPath)
        }
      }))
    }

    for (const item of prepared) {
      await rename(item.temporaryPath, item.targetPath)
      completedPaths.push(item.targetPath)
    }
    return Promise.all(prepared.map(async (item) => {
      const outputInfo = await stat(item.targetPath)
      return {
        preset: item.preset,
        inputPath,
        outputPath: item.targetPath,
        outputName: item.outputName,
        originalBytes: sourceInfo.size,
        outputBytes: outputInfo.size,
        unchanged: outputInfo.size === sourceInfo.size,
        sourceRemoved: false,
      }
    }))
  } catch (error) {
    await Promise.all([
      ...prepared.map((item) => rm(item.temporaryPath, { force: true })),
      ...completedPaths.map((filePath) => rm(filePath, { force: true })),
    ])
    throw error
  }
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
  const settings = resolveCompressionSettings(options)
  const sourceInfo = await stat(inputPath)
  const parsed = parse(inputPath)
  const targetExtension = extensionFor(kind, inputPath, requestedFormat)
  const outputDirectory = options.outputDirectory ? resolve(options.outputDirectory) : parsed.dir
  await mkdir(outputDirectory, { recursive: true })

  let targetPath
  if (options.replace) {
    targetPath = targetExtension.toLowerCase() === extname(inputPath).toLowerCase()
      ? inputPath
      : join(parsed.dir, `${parsed.name}${targetExtension}`)
  }
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
      if (settings.preset === 'lossless' && format === 'jpeg' && targetExtension === extname(inputPath).toLowerCase()) {
        await copyFile(inputPath, temporaryPath)
      } else {
        await compressStaticImage(inputPath, temporaryPath, format, settings)
      }
    } else {
      if (kind === 'gif') {
        if (!['original', 'gif'].includes(requestedFormat)) throw new Error(`GIF 不能输出为 ${requestedFormat}`)
        const ffmpegPath = settings.gif.copy ? null : await resolveFfmpeg(options.ffmpegPath)
        await compressGif(inputPath, temporaryPath, ffmpegPath, settings)
      } else {
        if (!['original', 'mp4', 'mov', 'mp3'].includes(requestedFormat)) throw new Error(`视频不能输出为 ${requestedFormat}`)
        if (settings.video.copy && requestedFormat === 'original') {
          await copyFile(inputPath, temporaryPath)
        } else {
          const ffmpegPath = await resolveFfmpeg(options.ffmpegPath)
          await compressVideo(inputPath, temporaryPath, requestedFormat, ffmpegPath, settings)
        }
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

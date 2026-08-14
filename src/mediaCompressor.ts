import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { MEDIA_PRESET_SETTINGS, qualityPresetFor, targetBytesForPreset } from './compressionPresets'
import type { CompressionPreset } from './types'

export type VideoOutputPreference = 'original' | 'mp4' | 'mov' | 'mov-alpha' | 'mp3'

type ProgressReporter = (progress: number, stage: string) => void
type MediaOutput = {
  blob: Blob
  extension: string
  label: string
}

type TargetVideoProfile = {
  maxHeight: number
  fps: number
  videoBitrate: string
  maxRate: string
  bufferSize: string
  audioBitrate: string
}

let ffmpegInstance: FFmpeg | null = null
let ffmpegLoading: Promise<FFmpeg> | null = null

async function getMediaEngine(onProgress: ProgressReporter) {
  if (ffmpegInstance?.loaded) return ffmpegInstance
  if (!ffmpegLoading) {
    ffmpegLoading = (async () => {
      onProgress(3, '正在准备视频引擎')
      const { FFmpeg } = await import('@ffmpeg/ffmpeg')
      const { toBlobURL } = await import('@ffmpeg/util')
      const instance = new FFmpeg()
      const baseUrl = `${import.meta.env.BASE_URL}ffmpeg`
      await instance.load({
        coreURL: await toBlobURL(`${baseUrl}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseUrl}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      ffmpegInstance = instance
      return instance
    })().catch((error) => {
      ffmpegLoading = null
      throw error
    })
  }
  return ffmpegLoading
}

function safeExtension(file: File) {
  return file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? 'bin'
}

function fileData(value: Uint8Array | string) {
  if (typeof value === 'string') throw new Error('未读取到压缩结果')
  return value.slice().buffer as ArrayBuffer
}

function mimeType(extension: string) {
  if (extension === 'gif') return 'image/gif'
  if (extension === 'mp3') return 'audio/mpeg'
  if (extension === 'mov') return 'video/quicktime'
  if (extension === 'webm') return 'video/webm'
  if (extension === 'mkv') return 'video/x-matroska'
  if (extension === 'avi') return 'video/x-msvideo'
  if (extension === 'mpg' || extension === 'mpeg') return 'video/mpeg'
  return 'video/mp4'
}

async function mediaDuration(file: File) {
  const url = URL.createObjectURL(file)
  const media = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video')
  media.preload = 'metadata'
  media.src = url
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('无法读取媒体时长')), 12000)
      media.onloadedmetadata = () => {
        window.clearTimeout(timer)
        resolve()
      }
      media.onerror = () => {
        window.clearTimeout(timer)
        reject(new Error('无法读取媒体时长'))
      }
    })
    return Number.isFinite(media.duration) && media.duration > 0 ? media.duration : 1
  } finally {
    media.removeAttribute('src')
    media.load()
    URL.revokeObjectURL(url)
  }
}

function targetVideoProfile(targetBytes: number, duration: number): TargetVideoProfile {
  const totalKbps = Math.max(72, Math.floor((targetBytes * 8 * 0.92) / Math.max(duration, 1) / 1000))
  const audioKbps = totalKbps < 180 ? 40 : totalKbps < 420 ? 64 : totalKbps < 900 ? 80 : 96
  const videoKbps = Math.max(48, totalKbps - audioKbps)
  const maxHeight = videoKbps < 220 ? 240 : videoKbps < 420 ? 360 : videoKbps < 850 ? 480 : 720
  const fps = videoKbps < 260 ? 18 : videoKbps < 650 ? 24 : 30
  return {
    maxHeight,
    fps,
    videoBitrate: `${videoKbps}k`,
    maxRate: `${Math.max(videoKbps, Math.round(videoKbps * 1.08))}k`,
    bufferSize: `${Math.max(128, videoKbps * 2)}k`,
    audioBitrate: `${audioKbps}k`,
  }
}

function targetMp3Bitrate(targetBytes: number, duration: number) {
  const ideal = Math.floor((targetBytes * 8 * 0.95) / Math.max(duration, 1) / 1000)
  const candidates = [320, 256, 192, 160, 128, 112, 96, 80, 64, 48, 40, 32]
  return `${candidates.find((value) => value <= ideal) ?? 32}k`
}

async function transcode(
  file: File,
  jobId: string,
  outputExtension: string,
  stage: string,
  command: (inputName: string, outputName: string) => string[],
  onProgress: ProgressReporter,
) {
  const ffmpeg = await getMediaEngine(onProgress)
  const inputName = `input-${jobId}.${safeExtension(file)}`
  const outputName = `output-${jobId}.${outputExtension}`
  let lastLog = ''

  const handleProgress = ({ progress }: { progress: number }) => {
    if (!Number.isFinite(progress)) return
    onProgress(12 + Math.max(0, Math.min(1, progress)) * 84, stage)
  }
  const handleLog = ({ message }: { message: string }) => {
    if (message.trim()) lastLog = message.trim()
  }

  ffmpeg.on('progress', handleProgress)
  ffmpeg.on('log', handleLog)
  try {
    onProgress(8, '正在读取文件')
    await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()))
    const exitCode = await ffmpeg.exec(command(inputName, outputName))
    if (exitCode !== 0) throw new Error(lastLog || '转码失败')
    onProgress(97, '正在生成下载文件')
    const output = await ffmpeg.readFile(outputName)
    return new Blob([fileData(output)], { type: mimeType(outputExtension) })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '转码失败')
    throw new Error(message.includes('memory') ? '文件较大，浏览器内存不足' : message)
  } finally {
    ffmpeg.off('progress', handleProgress)
    ffmpeg.off('log', handleLog)
    await ffmpeg.deleteFile(inputName).catch(() => false)
    await ffmpeg.deleteFile(outputName).catch(() => false)
  }
}

function resolveOriginalVideoOutput(file: File) {
  const inputExtension = safeExtension(file)
  if (inputExtension === 'mov') return { extension: 'mov', label: 'MOV' }
  if (inputExtension === 'webm') return { extension: 'webm', label: 'WebM' }
  if (inputExtension === 'mkv') return { extension: 'mkv', label: 'MKV' }
  if (inputExtension === 'avi') return { extension: 'avi', label: 'AVI' }
  if (inputExtension === 'mpg' || inputExtension === 'mpeg') {
    return { extension: inputExtension, label: inputExtension.toUpperCase() }
  }
  return { extension: 'mp4', label: 'MP4' }
}

function videoCommand(
  extension: string,
  preserveAlpha: boolean,
  preset: CompressionPreset,
  inputName: string,
  outputName: string,
  targetProfile?: TargetVideoProfile,
) {
  const qualityPreset = qualityPresetFor(preset)
  const profile = MEDIA_PRESET_SETTINGS[qualityPreset]
  if ('copy' in profile.video && !preserveAlpha) {
    return [
      '-i', inputName, '-map', '0', '-c', 'copy',
      ...(extension === 'mp4' || extension === 'mov' ? ['-movflags', '+faststart'] : []),
      outputName,
    ]
  }

  const baseVideo = 'copy' in profile.video ? null : profile.video
  const video = targetProfile ?? baseVideo
  const filter = video
    ? `scale=min(${Math.round(video.maxHeight * 16 / 9)}\\,iw):min(${video.maxHeight}\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,fps=${video.fps}`
    : null
  const filterArgs = filter ? ['-vf', filter] : []
  const audioBitrate = profile.video.audioBitrate

  if (preserveAlpha) {
    return [
      '-i', inputName, '-map', '0:v:0', '-map', '0:a?',
      ...filterArgs,
      '-c:v', 'qtrle', '-pix_fmt', 'argb', '-c:a', 'aac', '-b:a', audioBitrate, outputName,
    ]
  }
  if (extension === 'webm') {
    const webm = profile.webm
    if ('copy' in webm) throw new Error('无法创建无损 WebM 命令')
    return [
      '-i', inputName, '-map', '0:v:0', '-map', '0:a?', ...filterArgs,
      '-c:v', 'libvpx-vp9', '-crf', String(webm.crf), '-b:v', '0', '-deadline', 'realtime', '-cpu-used', String(webm.cpuUsed),
      '-c:a', 'libopus', '-b:a', audioBitrate, outputName,
    ]
  }
  if (extension === 'avi') {
    return [
      '-i', inputName, '-map', '0:v:0', '-map', '0:a?', ...filterArgs,
      '-c:v', 'mpeg4', ...(targetProfile ? ['-b:v', targetProfile.videoBitrate] : ['-q:v', qualityPreset === 'extreme' ? '10' : '8']), '-c:a', 'libmp3lame', '-b:a', audioBitrate, outputName,
    ]
  }
  if (extension === 'mpg' || extension === 'mpeg') {
    return [
      '-i', inputName, '-map', '0:v:0', '-map', '0:a?', ...filterArgs,
      '-c:v', 'mpeg2video', ...(targetProfile ? ['-b:v', targetProfile.videoBitrate] : ['-q:v', qualityPreset === 'extreme' ? '12' : '8']), '-c:a', 'mp2', '-b:a', audioBitrate, outputName,
    ]
  }
  if (!video) throw new Error('无法创建无损视频命令')
  return [
    '-i', inputName, '-map', '0:v:0', '-map', '0:a?', ...filterArgs,
    '-c:v', 'libx264', '-preset', 'veryfast', ...(targetProfile ? ['-b:v', targetProfile.videoBitrate] : ['-crf', String(baseVideo!.crf)]),
    '-maxrate', video.maxRate, '-bufsize', video.bufferSize, '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', video.audioBitrate, '-ac', '2', '-metadata:s:v:0', 'rotate=0',
    '-movflags', '+faststart', outputName,
  ]
}

export function compressGif(
  file: File,
  jobId: string,
  preset: CompressionPreset,
  onProgress: ProgressReporter,
) {
  const targetBytes = targetBytesForPreset(preset)
  if (targetBytes && file.size <= targetBytes) {
    onProgress(100, '原文件已满足目标体积')
    return Promise.resolve(file as Blob)
  }
  const baseGif = MEDIA_PRESET_SETTINGS[qualityPresetFor(preset)].gif
  const gif = targetBytes
    ? targetBytes <= 100 * 1024
      ? { fps: 6, maxDimension: 320, maxColors: 32, dither: 'none' as const }
      : targetBytes <= 500 * 1024
        ? { fps: 8, maxDimension: 480, maxColors: 48, dither: 'none' as const }
        : targetBytes <= 2 * 1024 * 1024
          ? { fps: 10, maxDimension: 720, maxColors: 96, dither: 'bayer' as const }
          : { fps: 12, maxDimension: 960, maxColors: 128, dither: 'bayer' as const }
    : baseGif
  if ('copy' in gif) {
    onProgress(100, '已保留原始 GIF')
    return Promise.resolve(file as Blob)
  }
  const paletteUse = gif.dither === 'bayer'
    ? 'paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle'
    : 'paletteuse=dither=none:diff_mode=rectangle'
  return transcode(
    file,
    jobId,
    'gif',
    '正在压缩 GIF',
    (inputName, outputName) => [
      '-i',
      inputName,
      '-filter_complex',
      `[0:v]fps=${gif.fps},scale=min(${gif.maxDimension}\\,iw):min(${gif.maxDimension}\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=${gif.maxColors}:stats_mode=diff[p];[s1][p]${paletteUse}`,
      '-loop',
      '0',
      outputName,
    ],
    onProgress,
  )
}

export async function compressVideo(
  file: File,
  jobId: string,
  preference: VideoOutputPreference,
  preset: CompressionPreset,
  onProgress: ProgressReporter,
): Promise<MediaOutput> {
  const targetBytes = targetBytesForPreset(preset)
  if (targetBytes && file.size <= targetBytes && preference === 'original') {
    onProgress(100, '原文件已满足目标体积')
    return { blob: file, ...resolveOriginalVideoOutput(file) }
  }
  const qualityPreset = qualityPresetFor(preset)
  const duration = targetBytes ? await mediaDuration(file) : 1
  if (preference === 'mp3') {
    const bitrate = targetBytes
      ? targetMp3Bitrate(targetBytes, duration)
      : MEDIA_PRESET_SETTINGS[qualityPreset].mp3Bitrate
    const blob = await transcode(
      file,
      jobId,
      'mp3',
      '正在提取 MP3 音频',
      (inputName, outputName) => [
        '-i', inputName, '-vn', '-map', '0:a:0', '-c:a', 'libmp3lame', '-b:a', bitrate, outputName,
      ],
      onProgress,
    )
    return { blob, extension: 'mp3', label: 'MP3' }
  }

  if (qualityPreset === 'lossless' && preference === 'original') {
    onProgress(100, '已保留原始视频')
    return { blob: file, ...resolveOriginalVideoOutput(file) }
  }

  const preserveAlpha = preference === 'mov-alpha'
  const output = preserveAlpha
    ? { extension: 'mov', label: 'MOV · Alpha' }
    : preference === 'original'
      ? resolveOriginalVideoOutput(file)
      : { extension: preference, label: preference.toUpperCase() }
  const blob = await transcode(
    file,
    jobId,
    output.extension,
    '正在压缩视频',
    (inputName, outputName) => videoCommand(
      output.extension,
      preserveAlpha,
      preset,
      inputName,
      outputName,
      targetBytes && !preserveAlpha ? targetVideoProfile(targetBytes, duration) : undefined,
    ),
    onProgress,
  )
  return { blob, ...output }
}

export function disposeMediaEngine() {
  ffmpegInstance?.terminate()
  ffmpegInstance = null
  ffmpegLoading = null
}

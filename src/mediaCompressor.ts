import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { MEDIA_PRESET_SETTINGS } from './compressionPresets'
import type { CompressionPreset } from './types'

export type VideoOutputPreference = 'original' | 'mp4' | 'mov' | 'mov-alpha' | 'mp3'

type ProgressReporter = (progress: number, stage: string) => void
type MediaOutput = {
  blob: Blob
  extension: string
  label: string
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
) {
  const profile = MEDIA_PRESET_SETTINGS[preset]
  if ('copy' in profile.video && !preserveAlpha) {
    return [
      '-i', inputName, '-map', '0', '-c', 'copy',
      ...(extension === 'mp4' || extension === 'mov' ? ['-movflags', '+faststart'] : []),
      outputName,
    ]
  }

  const video = 'copy' in profile.video ? null : profile.video
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
      '-c:v', 'mpeg4', '-q:v', preset === 'extreme' ? '10' : '8', '-c:a', 'libmp3lame', '-b:a', audioBitrate, outputName,
    ]
  }
  if (extension === 'mpg' || extension === 'mpeg') {
    return [
      '-i', inputName, '-map', '0:v:0', '-map', '0:a?', ...filterArgs,
      '-c:v', 'mpeg2video', '-q:v', preset === 'extreme' ? '12' : '8', '-c:a', 'mp2', '-b:a', audioBitrate, outputName,
    ]
  }
  if (!video) throw new Error('无法创建无损视频命令')
  return [
    '-i', inputName, '-map', '0:v:0', '-map', '0:a?', ...filterArgs,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(video.crf),
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
  const gif = MEDIA_PRESET_SETTINGS[preset].gif
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
  if (preference === 'mp3') {
    const blob = await transcode(
      file,
      jobId,
      'mp3',
      '正在提取 MP3 音频',
      (inputName, outputName) => [
        '-i', inputName, '-vn', '-map', '0:a:0', '-c:a', 'libmp3lame', '-b:a', MEDIA_PRESET_SETTINGS[preset].mp3Bitrate, outputName,
      ],
      onProgress,
    )
    return { blob, extension: 'mp3', label: 'MP3' }
  }

  if (preset === 'lossless' && preference === 'original') {
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
    (inputName, outputName) => videoCommand(output.extension, preserveAlpha, preset, inputName, outputName),
    onProgress,
  )
  return { blob, ...output }
}

export function disposeMediaEngine() {
  ffmpegInstance?.terminate()
  ffmpegInstance = null
  ffmpegLoading = null
}

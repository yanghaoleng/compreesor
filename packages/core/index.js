const STATIC_IMAGE_EXTENSIONS = Object.freeze(['jpg', 'jpeg', 'png', 'webp', 'avif', 'jxl', 'svg'])
const GIF_EXTENSIONS = Object.freeze(['gif'])
const VIDEO_EXTENSIONS = Object.freeze(['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', 'mpeg', 'mpg'])
const PDF_EXTENSIONS = Object.freeze(['pdf'])

export const SUPPORTED_EXTENSIONS = Object.freeze({
  image: STATIC_IMAGE_EXTENSIONS,
  gif: GIF_EXTENSIONS,
  video: VIDEO_EXTENSIONS,
  pdf: PDF_EXTENSIONS,
})

export const QUALITY_PRESET_ORDER = Object.freeze(['extreme', 'balanced', 'lossless'])

export const QUALITY_PRESETS = Object.freeze({
  extreme: Object.freeze({
    label: '极限',
    image: Object.freeze({ quality: 55, avifQuality: 35, effort: 8, maxDimension: 1600 }),
    png: Object.freeze({ compressionLevel: 9, effort: 10, palette: true, quality: 60, colours: 128, dither: 0.75 }),
    svg: Object.freeze({ multipass: true, floatPrecision: 2, preserveGeometry: false }),
    gif: Object.freeze({ fps: 10, maxDimension: 640, maxColors: 64, dither: 'none' }),
    video: Object.freeze({
      maxHeight: 480,
      fps: 24,
      h264Crf: 32,
      h264Preset: 'slow',
      maxRate: '1100k',
      bufferSize: '2200k',
      vp9Crf: 40,
      vp9CpuUsed: 2,
      browserVp9CpuUsed: 6,
      audioBitrate: '80k',
    }),
    mp3: Object.freeze({ bitrate: '96k' }),
  }),
  balanced: Object.freeze({
    label: '够用',
    image: Object.freeze({ quality: 80, avifQuality: 60, effort: 6, maxDimension: 2560 }),
    png: Object.freeze({ compressionLevel: 9, effort: 7, palette: false }),
    svg: Object.freeze({ multipass: true, floatPrecision: 3, preserveGeometry: false }),
    gif: Object.freeze({ fps: 12, maxDimension: 960, maxColors: 128, dither: 'bayer' }),
    video: Object.freeze({
      maxHeight: 720,
      fps: 30,
      h264Crf: 28,
      h264Preset: 'veryfast',
      maxRate: '2200k',
      bufferSize: '4400k',
      vp9Crf: 34,
      vp9CpuUsed: 4,
      browserVp9CpuUsed: 5,
      audioBitrate: '128k',
    }),
    mp3: Object.freeze({ bitrate: '160k' }),
  }),
  lossless: Object.freeze({
    label: '无损',
    image: Object.freeze({ quality: 100, avifQuality: 100, effort: 8, maxDimension: null, lossless: true }),
    png: Object.freeze({ compressionLevel: 9, effort: 10, palette: false }),
    svg: Object.freeze({ multipass: true, preserveGeometry: true }),
    gif: Object.freeze({ copy: true }),
    video: Object.freeze({ copy: true, audioBitrate: '320k' }),
    webm: Object.freeze({ copy: true }),
    mp3: Object.freeze({ bitrate: '320k', inherentlyLossy: true }),
  }),
})

export const TARGET_PRESET_BYTES = Object.freeze({
  'target-100k': 100 * 1024,
  'target-500k': 500 * 1024,
  'target-2m': 2 * 1024 * 1024,
  'target-5m': 5 * 1024 * 1024,
  'target-10m': 10 * 1024 * 1024,
})

const PRESET_ALIASES = new Map([
  ['extreme', 'extreme'],
  ['max', 'extreme'],
  ['极限', 'extreme'],
  ['balanced', 'balanced'],
  ['enough', 'balanced'],
  ['够用', 'balanced'],
  ['lossless', 'lossless'],
  ['无损', 'lossless'],
])

export function normalizeQualityPreset(preset = 'balanced') {
  const normalized = PRESET_ALIASES.get(String(preset).trim().toLowerCase())
  if (!normalized) throw new Error(`未知质量预设：${preset}`)
  return normalized
}

export function isTargetSizePreset(preset) {
  return Object.hasOwn(TARGET_PRESET_BYTES, preset)
}

export function targetBytesForPreset(preset) {
  return isTargetSizePreset(preset) ? TARGET_PRESET_BYTES[preset] : null
}

export function scaledImageDimensions(width, height, scale, minimumShortSide = 0) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new TypeError('图片尺寸必须是正数')
  }
  if (!Number.isFinite(scale) || scale <= 0) throw new TypeError('缩放比例必须是正数')

  const safeMinimum = Number.isFinite(minimumShortSide) ? Math.max(0, minimumShortSide) : 0
  const minimumScale = safeMinimum > 0
    ? Math.min(1, safeMinimum / Math.min(width, height))
    : 0
  const safeScale = Math.min(1, Math.max(scale, minimumScale))
  return {
    width: Math.max(1, Math.round(width * safeScale)),
    height: Math.max(1, Math.round(height * safeScale)),
  }
}

export function qualityPresetFor(preset) {
  if (!isTargetSizePreset(preset)) return preset
  return preset === 'target-100k' || preset === 'target-500k' ? 'extreme' : 'balanced'
}

export function extensionOf(name) {
  return String(name).toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''
}

export function baseName(name) {
  const cleaned = String(name).replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '-').trim()
  return cleaned.slice(0, 120) || 'file'
}

export function classifyName(name, mimeType = '') {
  const extension = extensionOf(name)
  if (mimeType === 'application/pdf' || PDF_EXTENSIONS.includes(extension)) return 'pdf'
  if (mimeType === 'image/gif' || GIF_EXTENSIONS.includes(extension)) return 'gif'
  if (String(mimeType).startsWith('video/') || VIDEO_EXTENSIONS.includes(extension)) return 'video'
  if (STATIC_IMAGE_EXTENSIONS.includes(extension)) return 'image'
  return null
}

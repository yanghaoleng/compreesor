import type { CompressionPreset, CompressionSettings, QualityPreset, TargetSizePreset } from './types'

export const DEFAULT_COMPRESSION_PRESET: CompressionPreset = 'balanced'

export const TARGET_PRESET_BYTES: Record<TargetSizePreset, number> = {
  'target-100k': 100 * 1024,
  'target-500k': 500 * 1024,
  'target-2m': 2 * 1024 * 1024,
  'target-5m': 5 * 1024 * 1024,
  'target-10m': 10 * 1024 * 1024,
}

export function isTargetSizePreset(preset: CompressionPreset): preset is TargetSizePreset {
  return preset in TARGET_PRESET_BYTES
}

export function targetBytesForPreset(preset: CompressionPreset) {
  return isTargetSizePreset(preset) ? TARGET_PRESET_BYTES[preset] : null
}

export function qualityPresetFor(preset: CompressionPreset): QualityPreset {
  if (!isTargetSizePreset(preset)) return preset
  return preset === 'target-100k' || preset === 'target-500k' ? 'extreme' : 'balanced'
}

export const IMAGE_PRESET_SETTINGS: Record<CompressionPreset, Pick<CompressionSettings, 'quality' | 'maxDimension'>> = {
  extreme: { quality: 55, maxDimension: 1600 },
  balanced: { quality: 80, maxDimension: 2560 },
  lossless: { quality: 100, maxDimension: 0 },
  'target-100k': { quality: 72, maxDimension: 1440 },
  'target-500k': { quality: 80, maxDimension: 2200 },
  'target-2m': { quality: 84, maxDimension: 2800 },
  'target-5m': { quality: 88, maxDimension: 3600 },
  'target-10m': { quality: 90, maxDimension: 4096 },
}

export const MEDIA_PRESET_SETTINGS = {
  extreme: {
    gif: { fps: 10, maxDimension: 640, maxColors: 64, dither: 'none' },
    video: { maxHeight: 480, fps: 24, crf: 32, maxRate: '1100k', bufferSize: '2200k', audioBitrate: '80k' },
    webm: { crf: 40, cpuUsed: 6 },
    mp3Bitrate: '96k',
  },
  balanced: {
    gif: { fps: 12, maxDimension: 960, maxColors: 128, dither: 'bayer' },
    video: { maxHeight: 720, fps: 30, crf: 28, maxRate: '2200k', bufferSize: '4400k', audioBitrate: '128k' },
    webm: { crf: 34, cpuUsed: 5 },
    mp3Bitrate: '160k',
  },
  lossless: {
    gif: { copy: true },
    video: { copy: true, audioBitrate: '320k' },
    webm: { copy: true },
    mp3Bitrate: '320k',
  },
} as const satisfies Record<QualityPreset, object>

import type { CompressionPreset, CompressionSettings } from './types'

export const DEFAULT_COMPRESSION_PRESET: CompressionPreset = 'balanced'

export const IMAGE_PRESET_SETTINGS: Record<CompressionPreset, Pick<CompressionSettings, 'quality' | 'maxDimension'>> = {
  extreme: { quality: 55, maxDimension: 1600 },
  balanced: { quality: 80, maxDimension: 2560 },
  lossless: { quality: 100, maxDimension: 0 },
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
} as const satisfies Record<CompressionPreset, object>

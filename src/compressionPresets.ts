import {
  QUALITY_PRESETS as SHARED_QUALITY_PRESETS,
  TARGET_PRESET_BYTES as SHARED_TARGET_PRESET_BYTES,
  isTargetSizePreset as sharedIsTargetSizePreset,
  qualityPresetFor as sharedQualityPresetFor,
  targetBytesForPreset as sharedTargetBytesForPreset,
} from '@compreesor/core'
import type { CompressionPreset, CompressionSettings, QualityPreset, TargetSizePreset } from './types'

export const DEFAULT_COMPRESSION_PRESET: CompressionPreset = 'balanced'

export const TARGET_PRESET_BYTES = SHARED_TARGET_PRESET_BYTES as Record<TargetSizePreset, number>

export function isTargetSizePreset(preset: CompressionPreset): preset is TargetSizePreset {
  return sharedIsTargetSizePreset(preset)
}

export function targetBytesForPreset(preset: CompressionPreset) {
  return sharedTargetBytesForPreset(preset)
}

export function qualityPresetFor(preset: CompressionPreset): QualityPreset {
  return sharedQualityPresetFor(preset)
}

const QUALITY_IMAGE_SETTINGS = Object.fromEntries(
  Object.entries(SHARED_QUALITY_PRESETS).map(([preset, settings]) => [preset, {
    quality: settings.image.quality,
    maxDimension: settings.image.maxDimension ?? 0,
  }]),
) as Record<QualityPreset, Pick<CompressionSettings, 'quality' | 'maxDimension'>>

export const IMAGE_PRESET_SETTINGS: Record<CompressionPreset, Pick<CompressionSettings, 'quality' | 'maxDimension'>> = {
  ...QUALITY_IMAGE_SETTINGS,
  'target-100k': { quality: 72, maxDimension: 1440 },
  'target-500k': { quality: 80, maxDimension: 2200 },
  'target-2m': { quality: 84, maxDimension: 2800 },
  'target-5m': { quality: 88, maxDimension: 3600 },
  'target-10m': { quality: 90, maxDimension: 4096 },
}

function browserMediaPreset(preset: QualityPreset) {
  const shared = SHARED_QUALITY_PRESETS[preset]
  if ('copy' in shared.video || 'copy' in shared.gif) {
    return {
      gif: { copy: true } as const,
      video: { copy: true, audioBitrate: shared.video.audioBitrate } as const,
      webm: { copy: true } as const,
      mp3Bitrate: shared.mp3.bitrate,
    }
  }
  return {
    gif: {
      fps: shared.gif.fps,
      maxDimension: shared.gif.maxDimension,
      maxColors: shared.gif.maxColors,
      dither: shared.gif.dither,
    },
    video: {
      maxHeight: shared.video.maxHeight,
      fps: shared.video.fps,
      crf: shared.video.h264Crf,
      maxRate: shared.video.maxRate,
      bufferSize: shared.video.bufferSize,
      audioBitrate: shared.video.audioBitrate,
    },
    webm: {
      crf: shared.video.vp9Crf,
      cpuUsed: shared.video.browserVp9CpuUsed,
    },
    mp3Bitrate: shared.mp3.bitrate,
  }
}

export const MEDIA_PRESET_SETTINGS = {
  extreme: browserMediaPreset('extreme'),
  balanced: browserMediaPreset('balanced'),
  lossless: browserMediaPreset('lossless'),
} as const satisfies Record<QualityPreset, object>

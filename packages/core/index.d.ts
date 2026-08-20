export type QualityPreset = 'extreme' | 'balanced' | 'lossless'
export type TargetSizePreset = 'target-100k' | 'target-500k' | 'target-2m' | 'target-5m' | 'target-10m'
export type CompressionPreset = QualityPreset | TargetSizePreset
export type MediaKind = 'image' | 'gif' | 'video' | 'pdf'

type ImagePreset = { quality: number; avifQuality: number; effort: number; maxDimension: number | null; lossless?: true }
type GifPreset = { fps: number; maxDimension: number; maxColors: number; dither: 'none' | 'bayer' } | { copy: true }
type VideoPreset = {
  maxHeight: number
  fps: number
  h264Crf: number
  h264Preset: string
  maxRate: string
  bufferSize: string
  vp9Crf: number
  vp9CpuUsed: number
  browserVp9CpuUsed: number
  audioBitrate: string
} | { copy: true; audioBitrate: string }

export const SUPPORTED_EXTENSIONS: Readonly<Record<MediaKind, readonly string[]>>
export const QUALITY_PRESET_ORDER: readonly QualityPreset[]
export const QUALITY_PRESETS: Readonly<Record<QualityPreset, {
  label: string
  image: ImagePreset
  png: Readonly<Record<string, string | number | boolean>>
  svg: Readonly<{ multipass: boolean; floatPrecision?: number; preserveGeometry: boolean }>
  gif: GifPreset
  video: VideoPreset
  webm?: { copy: true }
  mp3: Readonly<{ bitrate: string; inherentlyLossy?: true }>
}>>
export const TARGET_PRESET_BYTES: Readonly<Record<TargetSizePreset, number>>

export function normalizeQualityPreset(preset?: unknown): QualityPreset
export function isTargetSizePreset(preset: CompressionPreset | string): preset is TargetSizePreset
export function targetBytesForPreset(preset: CompressionPreset): number | null
export function qualityPresetFor(preset: CompressionPreset): QualityPreset
export function extensionOf(name: string): string
export function baseName(name: string): string
export function classifyName(name: string, mimeType?: string): MediaKind | null

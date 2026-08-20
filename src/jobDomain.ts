import {
  QUALITY_PRESET_ORDER,
  baseName,
  classifyName,
  extensionOf,
} from '@compreesor/core'
import type { DesktopNativeFormat } from './desktop'
import type { Messages } from './i18n'
import type { VideoOutputPreference } from './mediaCompressor'
import type { CompressionPreset, CompressionSettings, QualityPreset } from './types'

export type JobKind = 'image' | 'gif' | 'video' | 'pdf'
export type JobStatus = 'queued' | 'processing' | 'done' | 'error' | 'cancelled'
export type ImageOutputPreference = 'original' | 'jpeg' | 'webp' | 'png' | 'pdf'
export type CompressionSelection = CompressionPreset | 'all'

export type JobPreferences = {
  compressionPreset: CompressionPreset
  imageOutput: ImageOutputPreference
  videoOutput: VideoOutputPreference
}

export type ProcessedFile = {
  blob: Blob
  previewBlob?: Blob
  outputName: string
  outputLabel: string
  resultPath?: string
  unchanged?: boolean
  savedInPlace?: boolean
}

export type ResultVariant = ProcessedFile & {
  preset: QualityPreset | CompressionPreset
  url: string
  previewUrl?: string
}

export type MediaJob = {
  id: string
  file: File
  originFile: File
  kind: JobKind
  preferences: JobPreferences
  allQualities: boolean
  sourcePath: string | null
  preserveSource: boolean
  originalUrl: string
  thumbnailUrl: string | null
  resultBlob: Blob | null
  resultUrl: string | null
  outputName: string | null
  outputLabel: string | null
  resultPath: string | null
  status: JobStatus
  progress: number
  stage: string
  error: string | null
  variants: ResultVariant[]
}

export const QUALITY_PRESETS = [...QUALITY_PRESET_ORDER] as QualityPreset[]

export { baseName, extensionOf }

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 100 * 1024 ? 1 : 0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 2 : 1)} MB`
}

export function compactFileName(name: string, maxLength = 5) {
  return Array.from(baseName(name)).slice(0, maxLength).join('')
}

export function packageName(jobs: MediaJob[]) {
  const leadingNames = jobs.slice(0, 2).map((job) => compactFileName(job.file.name)).join('、')
  return `${leadingNames || '文件'}等${jobs.length}个文件的压缩.zip`
}

export function originalImageFormat(file: File): CompressionSettings['outputFormat'] {
  const extension = extensionOf(file.name)
  if (extension === 'jpg' || extension === 'jpeg') return 'jpeg'
  if (extension === 'png' || extension === 'webp' || extension === 'avif' || extension === 'jxl') return extension
  if (file.type === 'image/jpeg') return 'jpeg'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/avif') return 'avif'
  return 'webp'
}

export function imageOutputExtension(
  file: File,
  format: CompressionSettings['outputFormat'],
  preference: ImageOutputPreference,
) {
  if (preference === 'original') return extensionOf(file.name) || (format === 'jpeg' ? 'jpg' : format)
  return format === 'jpeg' ? 'jpg' : format
}

export function desktopFormatForJob(job: MediaJob): DesktopNativeFormat | null {
  if (job.kind === 'pdf') return null
  if (job.kind === 'gif') return 'gif'
  if (job.kind === 'video') {
    if (job.preferences.videoOutput === 'mov-alpha') return null
    return job.preferences.videoOutput
  }
  if (job.preferences.imageOutput === 'pdf') return null
  if (job.preferences.imageOutput === 'original') return 'original'
  return job.preferences.imageOutput === 'jpeg' ? 'jpg' : job.preferences.imageOutput
}

export function outputLabelFromName(name: string) {
  const extension = extensionOf(name)
  if (extension === 'jpg' || extension === 'jpeg') return 'JPEG'
  if (extension === 'webp') return 'WebP'
  if (extension === 'png') return 'PNG'
  if (extension === 'avif') return 'AVIF'
  if (extension === 'jxl') return 'JXL'
  if (extension === 'svg') return 'SVG'
  if (extension === 'gif') return 'GIF'
  if (extension === 'mp3') return 'MP3'
  if (extension === 'mov') return 'MOV'
  if (extension === 'pdf') return 'PDF'
  return extension.toUpperCase() || 'FILE'
}

export function blobFromDesktopData(data: Uint8Array, mimeType: string) {
  const bytes = new Uint8Array(data.byteLength)
  bytes.set(data)
  return new Blob([bytes.buffer], { type: mimeType })
}

export function classifyFile(file: File): JobKind | null {
  return classifyName(file.name, file.type)
}

export function isSvgFile(file: File) {
  return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
}

export function kindLabel(kind: JobKind, messages: Messages) {
  if (kind === 'video') return messages.videoKind
  if (kind === 'gif') return messages.gifKind
  if (kind === 'pdf') return messages.pdfKind
  return messages.imageKind
}

export function qualityLabel(preset: QualityPreset, messages: Messages) {
  if (preset === 'extreme') return messages.extreme
  if (preset === 'balanced') return messages.balanced
  return messages.lossless
}

export function statusText(job: MediaJob, messages: Messages) {
  if (job.status === 'queued') return messages.waiting
  if (job.status === 'processing') return job.stage
  if (job.status === 'error') return job.error ?? messages.failed
  return job.stage
}

export function isPdfVariant(variant: ResultVariant) {
  return variant.outputLabel === 'PDF' || variant.outputName.toLowerCase().endsWith('.pdf')
}

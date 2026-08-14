import type { CompressionPreset } from './types'

export type DesktopNativeFormat =
  | 'original'
  | 'jpg'
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'avif'
  | 'svg'
  | 'gif'
  | 'mp4'
  | 'mov'
  | 'mp3'

export type DesktopCompressionResult = {
  inputPath: string
  outputPath: string
  outputName: string
  originalBytes: number
  outputBytes: number
  unchanged: boolean
  sourceRemoved: boolean
  mimeType: string
}

export type DesktopResultFile = {
  path: string
  name: string
  size: number
  mimeType: string
  data: Uint8Array
}

export type CompreesorDesktopBridge = {
  readonly isDesktop: true
  readonly apiVersion: 1
  readonly capabilities: {
    readonly nativeInputExtensions: readonly string[]
    readonly nativeOutputFormats: readonly DesktopNativeFormat[]
    readonly bufferReplacementExtensions: readonly string[]
  }
  pathForFile(file: File): string
  compressFile(payload: {
    path: string
    format?: DesktopNativeFormat
    preset?: CompressionPreset
    quality?: number
  }): Promise<DesktopCompressionResult>
  replaceWithData(payload: {
    sourcePath: string
    outputExtension: string
    data: ArrayBuffer | Uint8Array
  }): Promise<DesktopCompressionResult>
  readResultFile(path: string): Promise<DesktopResultFile>
  revealResultFile(path: string): Promise<boolean>
}

declare global {
  interface Window {
    compreesorDesktop?: CompreesorDesktopBridge
  }
}

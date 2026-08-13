export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'jxl'

export type CompressionSettings = {
  outputFormat: ImageFormat
  quality: number
  targetBytes: number | null
  maxDimension: number
}

export type WorkerRequest = {
  type: 'compress'
  jobId: string
  buffer: ArrayBuffer
  fileName: string
  mimeType: string
  settings: CompressionSettings
}

export type WorkerProgress = {
  type: 'progress'
  jobId: string
  progress: number
  stage: string
}

export type WorkerSuccess = {
  type: 'result'
  jobId: string
  outputBuffer: ArrayBuffer
  previewBuffer: ArrayBuffer | null
  outputFormat: ImageFormat
  mimeType: string
  width: number
  height: number
  qualityUsed: number | null
}

export type WorkerFailure = {
  type: 'error'
  jobId: string
  message: string
}

export type WorkerResponse = WorkerProgress | WorkerSuccess | WorkerFailure

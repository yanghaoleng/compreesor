/// <reference lib="webworker" />

import { scaledImageDimensions } from '@compreesor/core'
import type {
  CompressionPreset,
  CompressionVariantSettings,
  ImageFormat,
  WorkerRequest,
  WorkerResponse,
  WorkerResult,
} from './types'

type EncodedResult = {
  buffer: ArrayBuffer
  image: ImageData
  quality: number | null
}

type ProgressReporter = (progress: number, stage: string) => void

const MIME_TYPES: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  jxl: 'image/jxl',
}

function send(message: WorkerResponse, transfers: Transferable[] = []) {
  self.postMessage(message, { transfer: transfers })
}

function report(jobId: string, variantId: string, progress: number, stage: string) {
  send({ type: 'progress', jobId, variantId, progress, stage })
}

function detectFormat(buffer: ArrayBuffer, fileName: string, mimeType: string): ImageFormat {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 32))
  const ascii = String.fromCharCode(...bytes)
  const lowerName = fileName.toLowerCase()

  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg'
  if (bytes[0] === 0x89 && ascii.slice(1, 4) === 'PNG') return 'png'
  if (ascii.slice(0, 4) === 'RIFF' && ascii.slice(8, 12) === 'WEBP') return 'webp'
  if (ascii.includes('ftypavif') || ascii.includes('ftypavis')) return 'avif'
  if ((bytes[0] === 0xff && bytes[1] === 0x0a) || ascii.includes('JXL ') || lowerName.endsWith('.jxl')) return 'jxl'
  if (mimeType.includes('jpeg') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'jpeg'
  if (mimeType.includes('png') || lowerName.endsWith('.png')) return 'png'
  if (mimeType.includes('webp') || lowerName.endsWith('.webp')) return 'webp'
  if (mimeType.includes('avif') || lowerName.endsWith('.avif')) return 'avif'
  throw new Error('暂不支持这种图片格式')
}

async function decode(buffer: ArrayBuffer, format: ImageFormat): Promise<ImageData> {
  switch (format) {
    case 'jpeg': {
      const { decode: decodeJpeg } = await import('@jsquash/jpeg')
      return decodeJpeg(buffer, { preserveOrientation: true })
    }
    case 'png': {
      const { decode: decodePng } = await import('@jsquash/png')
      const decoded = await decodePng(buffer)
      if (!(decoded.data instanceof Uint8ClampedArray)) throw new Error('暂不支持 16 位 PNG')
      return decoded
    }
    case 'webp': {
      const { decode: decodeWebp } = await import('@jsquash/webp')
      return decodeWebp(buffer)
    }
    case 'avif': {
      const { decode: decodeAvif } = await import('@jsquash/avif')
      const decoded = await decodeAvif(buffer)
      if (!decoded) throw new Error('AVIF 解码失败')
      if (!(decoded.data instanceof Uint8ClampedArray)) throw new Error('暂不支持高于 8 位的 AVIF 输入')
      return decoded
    }
    case 'jxl': {
      const { decode: decodeJxl } = await import('@jsquash/jxl')
      return decodeJxl(buffer)
    }
  }
}

async function resizeImage(image: ImageData, width: number, height: number) {
  if (image.width === width && image.height === height) return image
  const { default: resize } = await import('@jsquash/resize')
  // @jsquash 的 contain 会裁剪原图；这里只传入等比尺寸，用 stretch 保留全部像素。
  return resize(image, {
    width,
    height,
    method: 'lanczos3',
    fitMethod: 'stretch',
    premultiply: true,
    linearRGB: true,
  })
}

async function constrainDimensions(image: ImageData, maxDimension: number) {
  if (!maxDimension || Math.max(image.width, image.height) <= maxDimension) return image
  const scale = maxDimension / Math.max(image.width, image.height)
  const dimensions = scaledImageDimensions(image.width, image.height, scale)
  return resizeImage(image, dimensions.width, dimensions.height)
}

function flattenTransparency(image: ImageData) {
  const data = new Uint8ClampedArray(image.data)
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] / 255
    if (alpha >= 1) continue
    data[index] = Math.round(data[index] * alpha + 255 * (1 - alpha))
    data[index + 1] = Math.round(data[index + 1] * alpha + 255 * (1 - alpha))
    data[index + 2] = Math.round(data[index + 2] * alpha + 255 * (1 - alpha))
    data[index + 3] = 255
  }
  return new ImageData(data, image.width, image.height)
}

async function encode(image: ImageData, format: ImageFormat, quality: number, preset: CompressionPreset) {
  const lossless = preset === 'lossless'
  switch (format) {
    case 'jpeg': {
      const { encode: encodeJpeg } = await import('@jsquash/jpeg')
      return encodeJpeg(image, {
        quality,
        progressive: true,
        optimize_coding: true,
        trellis_multipass: true,
        trellis_opt_zero: true,
        trellis_opt_table: true,
        trellis_loops: 2,
      })
    }
    case 'webp': {
      const { encode: encodeWebp } = await import('@jsquash/webp')
      return encodeWebp(image, {
        quality,
        method: lossless ? 6 : preset === 'extreme' ? 5 : 4,
        pass: lossless ? 2 : preset === 'extreme' ? 4 : 2,
        use_sharp_yuv: 1,
        alpha_quality: 100,
        lossless: lossless ? 1 : 0,
        exact: lossless ? 1 : 0,
      })
    }
    case 'avif': {
      const { encode: encodeAvif } = await import('@jsquash/avif')
      return encodeAvif(image, {
        quality,
        qualityAlpha: lossless ? 100 : -1,
        speed: lossless ? 4 : preset === 'extreme' ? 5 : 6,
        bitDepth: 8,
        subsample: lossless ? 3 : 1,
        tune: 0,
        lossless,
      })
    }
    case 'jxl': {
      const { encode: encodeJxl } = await import('@jsquash/jxl')
      return encodeJxl(image, {
        quality,
        effort: lossless ? 8 : preset === 'extreme' ? 7 : 6,
        progressive: false,
        lossless,
      })
    }
    case 'png': {
      const { optimise } = await import('@jsquash/oxipng')
      return optimise(image, {
        level: preset === 'balanced' ? 4 : 6,
        interlace: false,
        optimiseAlpha: true,
      })
    }
  }
}

async function encodeToTarget(
  reportProgress: ProgressReporter,
  initialImage: ImageData,
  format: ImageFormat,
  maxQuality: number,
  targetBytes: number,
  preset: CompressionPreset,
): Promise<EncodedResult> {
  let working = initialImage
  let smallest: EncodedResult | null = null

  for (let scaleAttempt = 0; scaleAttempt < 4; scaleAttempt += 1) {
    if (format === 'png') {
      const buffer = await encode(working, format, maxQuality, preset)
      smallest = { buffer, image: working, quality: null }
      if (buffer.byteLength <= targetBytes) return smallest
    } else {
      const highQuality = Math.max(12, Math.min(96, maxQuality))
      reportProgress(34 + scaleAttempt * 12, `正在评估目标体积，画质 ${highQuality}%`)
      const highBuffer = await encode(working, format, highQuality, preset)
      const highCandidate = { buffer: highBuffer, image: working, quality: highQuality }
      if (!smallest || highBuffer.byteLength < smallest.buffer.byteLength) smallest = highCandidate
      if (highBuffer.byteLength <= targetBytes) return highCandidate

      reportProgress(38 + scaleAttempt * 12, '正在评估最低体积')
      const lowBuffer = await encode(working, format, 12, preset)
      let bestUnder: EncodedResult | null = lowBuffer.byteLength <= targetBytes
        ? { buffer: lowBuffer, image: working, quality: 12 }
        : null
      if (!smallest || lowBuffer.byteLength < smallest.buffer.byteLength) {
        smallest = { buffer: lowBuffer, image: working, quality: 12 }
      }

      if (bestUnder) {
        let low = 13
        let high = highQuality - 1
        for (let iteration = 0; iteration < 5 && low <= high; iteration += 1) {
          const quality = Math.round((low + high) / 2)
          reportProgress(42 + scaleAttempt * 12 + iteration * 1.6, `正在逼近目标体积，画质 ${quality}%`)
          const buffer = await encode(working, format, quality, preset)
          const candidate = { buffer, image: working, quality }
          if (!smallest || buffer.byteLength < smallest.buffer.byteLength) smallest = candidate
          if (buffer.byteLength <= targetBytes) {
            bestUnder = candidate
            low = quality + 1
          } else {
            high = quality - 1
          }
        }
        return bestUnder
      }
    }

    if (!smallest || Math.min(working.width, working.height) <= 96) break
    const idealScale = Math.sqrt(targetBytes / Math.max(1, smallest.buffer.byteLength)) * 0.94
    const scale = Math.max(0.42, Math.min(0.88, idealScale))
    const { width, height } = scaledImageDimensions(working.width, working.height, scale, 96)
    reportProgress(58 + scaleAttempt * 10, `调整尺寸至 ${width} × ${height}`)
    working = await resizeImage(working, width, height)
  }

  if (!smallest) {
    const quality = format === 'png' ? maxQuality : 12
    const buffer = await encode(working, format, quality, preset)
    smallest = { buffer, image: working, quality: format === 'png' ? null : quality }
  }
  return smallest
}

async function createJxlPreview(image: ImageData) {
  const preview = await constrainDimensions(image, 1200)
  const { encode: encodePng } = await import('@jsquash/png')
  return encodePng(preview)
}

async function compressVariant(
  jobId: string,
  sourceImage: ImageData,
  settings: CompressionVariantSettings,
): Promise<WorkerResult> {
  const reportProgress = (progress: number, stage: string) => report(jobId, settings.variantId, progress, stage)
  reportProgress(24, '正在优化像素')
  let image = await constrainDimensions(sourceImage, settings.maxDimension)
  if (settings.outputFormat === 'jpeg') image = flattenTransparency(image)

  let result: EncodedResult
  if (settings.targetBytes) {
    result = await encodeToTarget(
      reportProgress,
      image,
      settings.outputFormat,
      settings.quality,
      settings.targetBytes,
      settings.preset,
    )
  } else {
    reportProgress(48, `正在编码 ${settings.outputFormat.toUpperCase()}`)
    const outputBuffer = await encode(image, settings.outputFormat, settings.quality, settings.preset)
    result = {
      buffer: outputBuffer,
      image,
      quality: settings.outputFormat === 'png' ? null : settings.quality,
    }
  }

  reportProgress(92, '正在生成预览')
  const previewBuffer = settings.outputFormat === 'jxl' ? await createJxlPreview(result.image) : null
  reportProgress(100, '完成')
  return {
    variantId: settings.variantId,
    outputBuffer: result.buffer,
    previewBuffer,
    outputFormat: settings.outputFormat,
    mimeType: MIME_TYPES[settings.outputFormat],
    width: result.image.width,
    height: result.image.height,
    qualityUsed: result.quality,
  }
}

async function compress(request: WorkerRequest) {
  if (request.variants.length === 0) throw new Error('没有可处理的图片输出')
  const firstVariant = request.variants[0]
  report(request.jobId, firstVariant.variantId, 5, '正在识别图片')
  const inputFormat = detectFormat(request.buffer, request.fileName, request.mimeType)
  report(request.jobId, firstVariant.variantId, 12, `正在解码 ${inputFormat.toUpperCase()}`)
  const sourceImage = await decode(request.buffer, inputFormat)
  report(request.jobId, firstVariant.variantId, 20, '图片解码完成')

  const results: WorkerResult[] = []
  for (const settings of request.variants) {
    results.push(await compressVariant(request.jobId, sourceImage, settings))
  }
  const transfers = results.flatMap((result) => result.previewBuffer
    ? [result.outputBuffer, result.previewBuffer]
    : [result.outputBuffer])
  send({ type: 'result', jobId: request.jobId, results }, transfers)
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type !== 'compress') return
  compress(event.data).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : '压缩失败，请重试'
    send({ type: 'error', jobId: event.data.jobId, message })
  })
})

export {}

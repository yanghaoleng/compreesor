/// <reference lib="webworker" />

import type {
  CompressionPreset,
  ImageFormat,
  WorkerRequest,
  WorkerResponse,
} from './types'

type EncodedResult = {
  buffer: ArrayBuffer
  image: ImageData
  quality: number | null
}

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

function report(jobId: string, progress: number, stage: string) {
  send({ type: 'progress', jobId, progress, stage })
}

function detectFormat(buffer: ArrayBuffer, fileName: string, mimeType: string): ImageFormat {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 32))
  const ascii = String.fromCharCode(...bytes)
  const lowerName = fileName.toLowerCase()

  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg'
  if (bytes[0] === 0x89 && ascii.slice(1, 4) === 'PNG') return 'png'
  if (ascii.slice(0, 4) === 'RIFF' && ascii.slice(8, 12) === 'WEBP') return 'webp'
  if (ascii.includes('ftypavif') || ascii.includes('ftypavis')) return 'avif'
  if (
    (bytes[0] === 0xff && bytes[1] === 0x0a) ||
    ascii.includes('JXL ') ||
    lowerName.endsWith('.jxl')
  ) {
    return 'jxl'
  }
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
      if (!(decoded.data instanceof Uint8ClampedArray)) {
        throw new Error('暂不支持 16 位 PNG')
      }
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
      if (!(decoded.data instanceof Uint8ClampedArray)) {
        throw new Error('暂不支持高于 8 位的 AVIF 输入')
      }
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
  return resizeImage(
    image,
    Math.max(1, Math.round(image.width * scale)),
    Math.max(1, Math.round(image.height * scale)),
  )
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

async function encode(
  image: ImageData,
  format: ImageFormat,
  quality: number,
  preset: CompressionPreset,
) {
  const lossless = preset === 'lossless'
  switch (format) {
    case 'jpeg': {
      const { encode: encodeJpeg } = await import('@jsquash/jpeg')
      return encodeJpeg(flattenTransparency(image), {
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
  jobId: string,
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
      let low = 12
      let high = Math.max(12, Math.min(96, maxQuality))
      let bestUnder: EncodedResult | null = null
      let localSmallest: EncodedResult | null = null

      for (let iteration = 0; iteration < 7 && low <= high; iteration += 1) {
        const quality = Math.round((low + high) / 2)
        report(jobId, 35 + scaleAttempt * 12 + iteration * 1.5, `正在逼近目标体积，画质 ${quality}%`)
        const buffer = await encode(working, format, quality, preset)
        const candidate = { buffer, image: working, quality }
        if (!localSmallest || buffer.byteLength < localSmallest.buffer.byteLength) localSmallest = candidate

        if (buffer.byteLength <= targetBytes) {
          if (!bestUnder || quality > (bestUnder.quality ?? 0)) bestUnder = candidate
          low = quality + 1
        } else {
          high = quality - 1
        }
      }

      if (bestUnder) return bestUnder
      if (localSmallest) smallest = localSmallest
    }

    if (!smallest || Math.min(working.width, working.height) <= 96) break
    const idealScale = Math.sqrt(targetBytes / Math.max(1, smallest.buffer.byteLength)) * 0.94
    const scale = Math.max(0.42, Math.min(0.88, idealScale))
    const width = Math.max(96, Math.round(working.width * scale))
    const height = Math.max(96, Math.round(working.height * scale))
    report(jobId, 58 + scaleAttempt * 10, `调整尺寸至 ${width} × ${height}`)
    working = await resizeImage(working, width, height)
    smallest = null
  }

  if (!smallest) {
    const buffer = await encode(working, format, Math.max(12, Math.min(maxQuality, 30)), preset)
    smallest = { buffer, image: working, quality: format === 'png' ? null : 30 }
  }
  return smallest
}

async function createJxlPreview(image: ImageData) {
  const preview = await constrainDimensions(image, 1200)
  const { encode: encodePng } = await import('@jsquash/png')
  return encodePng(preview)
}

async function compress(request: WorkerRequest) {
  const { jobId, buffer, fileName, mimeType, settings } = request
  report(jobId, 5, '正在识别图片')
  const inputFormat = detectFormat(buffer, fileName, mimeType)
  report(jobId, 14, `正在解码 ${inputFormat.toUpperCase()}`)
  let image = await decode(buffer, inputFormat)
  report(jobId, 27, '正在优化像素')
  image = await constrainDimensions(image, settings.maxDimension)

  let result: EncodedResult
  if (settings.targetBytes) {
    result = await encodeToTarget(
      jobId,
      image,
      settings.outputFormat,
      settings.quality,
      settings.targetBytes,
      settings.preset,
    )
  } else {
    report(jobId, 48, `正在编码 ${settings.outputFormat.toUpperCase()}`)
    const outputBuffer = await encode(image, settings.outputFormat, settings.quality, settings.preset)
    result = {
      buffer: outputBuffer,
      image,
      quality: settings.outputFormat === 'png' ? null : settings.quality,
    }
  }

  report(jobId, 92, '正在生成预览')
  const previewBuffer = settings.outputFormat === 'jxl' ? await createJxlPreview(result.image) : null
  report(jobId, 100, '完成')
  send(
    {
      type: 'result',
      jobId,
      outputBuffer: result.buffer,
      previewBuffer,
      outputFormat: settings.outputFormat,
      mimeType: MIME_TYPES[settings.outputFormat],
      width: result.image.width,
      height: result.image.height,
      qualityUsed: result.quality,
    },
    previewBuffer ? [result.buffer, previewBuffer] : [result.buffer],
  )
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type !== 'compress') return
  compress(event.data).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : '压缩失败，请重试'
    send({ type: 'error', jobId: event.data.jobId, message })
  })
})

export {}

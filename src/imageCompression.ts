import { IMAGE_PRESET_SETTINGS, targetBytesForPreset } from './compressionPresets'
import { ImageCompressionPool } from './imageCompressionPool'
import {
  baseName,
  imageOutputExtension,
  isSvgFile,
  originalImageFormat,
  type MediaJob,
  type ProcessedFile,
} from './jobDomain'
import { loadPdfCompressor } from './lazyModules'
import type { CompressionPreset, CompressionSettings } from './types'

const FORMAT_LABELS = {
  jpeg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
  avif: 'AVIF',
  jxl: 'JXL',
} as const

export type ImageVariantOutput = {
  preset: CompressionPreset
  processed: ProcessedFile
}

export type ImageProgressReporter = (
  preset: CompressionPreset,
  progress: number,
  stage: string,
) => void

function sanitizeSvg(source: string) {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml')
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg') {
    throw new Error('SVG 文件无法解析')
  }
  document.querySelectorAll('script, foreignObject').forEach((element) => element.remove())
  document.querySelectorAll('*').forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name)
      if (/^(?:href|xlink:href)$/i.test(attribute.name)) {
        const value = attribute.value.trim()
        if (value && !value.startsWith('#') && !/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(value)) {
          element.removeAttribute(attribute.name)
        }
      }
    }
  })
  return new XMLSerializer().serializeToString(document.documentElement)
}

async function optimizeSvgSource(
  safeSource: string,
  fileName: string,
  preset: CompressionPreset,
  onProgress: (progress: number, stage: string) => void,
) {
  onProgress(34, '正在优化矢量路径')
  const { optimize } = await import('svgo/browser')
  const preserveGeometry = preset === 'lossless'
  const floatPrecision = preset === 'extreme' ? 2 : 3
  const result = optimize(safeSource, {
    path: fileName,
    multipass: true,
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: preserveGeometry
            ? {
                cleanupNumericValues: false,
                convertPathData: false,
                convertTransform: false,
                mergePaths: false,
              }
            : {
                cleanupNumericValues: { floatPrecision },
                convertPathData: { floatPrecision },
                convertTransform: { floatPrecision },
              },
        },
      },
      'removeScripts',
    ],
  })
  onProgress(72, '正在整理 SVG 结构')
  return result.data
}

function svgDimensions(svg: string) {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = document.documentElement
  const viewBox = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number)
  const viewBoxWidth = viewBox.length === 4 && Number.isFinite(viewBox[2]) && viewBox[2] > 0 ? viewBox[2] : 0
  const viewBoxHeight = viewBox.length === 4 && Number.isFinite(viewBox[3]) && viewBox[3] > 0 ? viewBox[3] : 0
  const width = Number.parseFloat(root.getAttribute('width') ?? '') || viewBoxWidth || 1024
  const height = Number.parseFloat(root.getAttribute('height') ?? '') || viewBoxHeight || 1024
  const scale = Math.min(2560 / Math.max(width, height), 1)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function rasterizeSvg(svg: string) {
  const dimensions = svgDimensions(svg)
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const image = new Image()
  try {
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = dimensions.width
    canvas.height = dimensions.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法转换 SVG')
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height)
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (!value) {
          reject(new Error('SVG 转换失败'))
          return
        }
        void value.arrayBuffer().then(resolve, reject)
      }, 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function compressImageVariants(
  job: MediaJob,
  presets: CompressionPreset[],
  pool: ImageCompressionPool,
  reportProgress: ImageProgressReporter,
): Promise<ImageVariantOutput[]> {
  const outputPreference = job.preferences.imageOutput
  const makeOutput = async (
    preset: CompressionPreset,
    blob: Blob,
    outputFormat: CompressionSettings['outputFormat'],
    previewBlob?: Blob,
  ): Promise<ImageVariantOutput> => {
    if (outputPreference === 'pdf') {
      reportProgress(preset, 94, '正在生成 PDF')
      const { imageBlobToPdf } = await loadPdfCompressor()
      return {
        preset,
        processed: {
          blob: await imageBlobToPdf(blob),
          outputName: `${baseName(job.file.name)}-压缩.pdf`,
          outputLabel: 'PDF',
        },
      }
    }
    return {
      preset,
      processed: {
        blob,
        previewBlob,
        outputName: `${baseName(job.file.name)}-压缩.${imageOutputExtension(job.file, outputFormat, outputPreference)}`,
        outputLabel: FORMAT_LABELS[outputFormat],
      },
    }
  }

  if (isSvgFile(job.file)) {
    reportProgress(presets[0], 8, '正在读取 SVG')
    const safeSource = sanitizeSvg(await job.file.text())
    const outputs: ImageVariantOutput[] = []
    for (const preset of presets) {
      const svg = await optimizeSvgSource(safeSource, job.file.name, preset, (progress, stage) => {
        reportProgress(preset, progress, stage)
      })
      if (outputPreference === 'original') {
        reportProgress(preset, 96, '正在生成 SVG')
        outputs.push({
          preset,
          processed: {
            blob: new Blob([svg], { type: 'image/svg+xml' }),
            outputName: `${baseName(job.file.name)}-压缩.svg`,
            outputLabel: 'SVG',
          },
        })
        continue
      }
      reportProgress(preset, 78, '正在渲染 SVG')
      const rasterBuffer = await rasterizeSvg(svg)
      const sourceFormat = outputPreference === 'pdf'
        ? preset === 'lossless' ? 'png' : 'jpeg'
        : outputPreference
      const presetSettings = IMAGE_PRESET_SETTINGS[preset]
      const [result] = await pool.compress({
        type: 'compress',
        jobId: `${job.id}-${preset}`,
        buffer: rasterBuffer,
        fileName: `${job.file.name}.png`,
        mimeType: 'image/png',
        variants: [{
          variantId: preset,
          outputFormat: sourceFormat,
          preset,
          quality: presetSettings.quality,
          targetBytes: targetBytesForPreset(preset),
          maxDimension: presetSettings.maxDimension,
        }],
      }, (_variantId, progress, stage) => reportProgress(preset, progress, stage))
      outputs.push(await makeOutput(
        preset,
        new Blob([result.outputBuffer], { type: result.mimeType }),
        result.outputFormat,
        result.previewBuffer ? new Blob([result.previewBuffer], { type: 'image/png' }) : undefined,
      ))
    }
    return outputs
  }

  const outputFormatForPreset = (preset: CompressionPreset): CompressionSettings['outputFormat'] => {
    if (outputPreference === 'pdf') {
      if (preset === 'lossless') return originalImageFormat(job.file) === 'jpeg' ? 'jpeg' : 'png'
      return 'jpeg'
    }
    return outputPreference === 'original' ? originalImageFormat(job.file) : outputPreference
  }
  const outputs: ImageVariantOutput[] = []
  const workerPresets = presets.filter((preset) => {
    const outputFormat = outputFormatForPreset(preset)
    if (preset !== 'lossless' || outputPreference !== 'original' || outputFormat !== 'jpeg') return true
    reportProgress(preset, 100, '已保留原始 JPEG')
    outputs.push({
      preset,
      processed: {
        blob: job.file,
        outputName: `${baseName(job.file.name)}-压缩.${imageOutputExtension(job.file, outputFormat, outputPreference)}`,
        outputLabel: FORMAT_LABELS[outputFormat],
        unchanged: true,
      },
    })
    return false
  })

  if (workerPresets.length > 0) {
    const buffer = await job.file.arrayBuffer()
    const variants = workerPresets.map((preset) => {
      const presetSettings = IMAGE_PRESET_SETTINGS[preset]
      return {
        variantId: preset,
        outputFormat: outputFormatForPreset(preset),
        preset,
        quality: presetSettings.quality,
        targetBytes: targetBytesForPreset(preset),
        maxDimension: presetSettings.maxDimension,
      }
    })
    const results = await pool.compress({
      type: 'compress',
      jobId: job.id,
      buffer,
      fileName: job.file.name,
      mimeType: job.file.type,
      variants,
    }, (variantId, progress, stage) => reportProgress(variantId as CompressionPreset, progress, stage))

    for (const result of results) {
      outputs.push(await makeOutput(
        result.variantId as CompressionPreset,
        new Blob([result.outputBuffer], { type: result.mimeType }),
        result.outputFormat,
        result.previewBuffer ? new Blob([result.previewBuffer], { type: 'image/png' }) : undefined,
      ))
    }
  }

  return presets.map((preset) => outputs.find((output) => output.preset === preset)!)
}

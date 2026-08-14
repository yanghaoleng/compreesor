import { PDFDocument } from 'pdf-lib'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { targetBytesForPreset } from './compressionPresets'
import type { CompressionPreset } from './types'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

type ProgressReporter = (progress: number, stage: string) => void
export type PdfPageImageFormat = 'jpeg' | 'webp' | 'png'

type PdfProfile = {
  dpi: number
  quality: number
}

const PDF_PROFILES: Record<CompressionPreset, PdfProfile | null> = {
  extreme: { dpi: 96, quality: 0.58 },
  balanced: { dpi: 144, quality: 0.78 },
  lossless: null,
  'target-100k': { dpi: 72, quality: 0.4 },
  'target-500k': { dpi: 96, quality: 0.58 },
  'target-2m': { dpi: 132, quality: 0.72 },
  'target-5m': { dpi: 160, quality: 0.8 },
  'target-10m': { dpi: 180, quality: 0.84 },
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PDF 页面编码失败')), type, quality)
  })
}

function safeBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(value.byteLength)
  copy.set(value)
  return copy
}

async function saveStructureOnly(source: Uint8Array) {
  const document = await PDFDocument.load(source, { updateMetadata: false })
  return safeBytes(await document.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 40 }))
}

async function rasterizePdf(
  source: Uint8Array,
  profile: PdfProfile,
  attempt: number,
  maxAttempts: number,
  onProgress: ProgressReporter,
) {
  const loadingTask = getDocument({ data: source.slice() })
  const input = await loadingTask.promise
  const output = await PDFDocument.create()

  try {
    for (let pageNumber = 1; pageNumber <= input.numPages; pageNumber += 1) {
      const page = await input.getPage(pageNumber)
      const baseViewport = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: profile.dpi / 72 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))
      const context = canvas.getContext('2d', { alpha: false })
      if (!context) throw new Error('浏览器无法创建 PDF 画布')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvas, canvasContext: context, viewport, background: '#ffffff' }).promise
      const jpeg = await canvasBlob(canvas, 'image/jpeg', profile.quality)
      const embedded = await output.embedJpg(await jpeg.arrayBuffer())
      const outputPage = output.addPage([baseViewport.width, baseViewport.height])
      outputPage.drawImage(embedded, {
        x: 0,
        y: 0,
        width: baseViewport.width,
        height: baseViewport.height,
      })
      canvas.width = 1
      canvas.height = 1
      page.cleanup()
      const completed = attempt + pageNumber / input.numPages
      onProgress(8 + (completed / maxAttempts) * 82, `正在压缩 PDF · 第 ${pageNumber}/${input.numPages} 页`)
    }
    return safeBytes(await output.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 30 }))
  } finally {
    await loadingTask.destroy()
  }
}

export async function createPdfThumbnail(file: File) {
  const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const pdf = await loadingTask.promise
  try {
    const page = await pdf.getPage(1)
    const original = page.getViewport({ scale: 1 })
    const scale = Math.min(1.5, 180 / Math.max(original.width, original.height))
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(viewport.width))
    canvas.height = Math.max(1, Math.round(viewport.height))
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('浏览器无法创建 PDF 缩略图')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: context, viewport, background: '#ffffff' }).promise
    const thumbnail = await canvasBlob(canvas, 'image/jpeg', 0.78)
    page.cleanup()
    return thumbnail
  } finally {
    await loadingTask.destroy()
  }
}

export async function imageBlobToPdf(blob: Blob) {
  const output = await PDFDocument.create()
  const bytes = await blob.arrayBuffer()
  const image = blob.type === 'image/png'
    ? await output.embedPng(bytes)
    : await output.embedJpg(bytes)
  const maxPageDimension = 1440
  const scale = Math.min(1, maxPageDimension / Math.max(image.width, image.height))
  const width = Math.max(1, image.width * scale)
  const height = Math.max(1, image.height * scale)
  const page = output.addPage([width, height])
  page.drawImage(image, { x: 0, y: 0, width, height })
  const saved = safeBytes(await output.save({ useObjectStreams: true, addDefaultPage: false }))
  return new Blob([saved.buffer], { type: 'application/pdf' })
}

export async function extractPdfPages(
  file: File,
  format: PdfPageImageFormat,
  maxPages: number,
  onProgress: ProgressReporter,
) {
  const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const pdf = await loadingTask.promise
  const pages: File[] = []
  const pageCount = Math.min(pdf.numPages, Math.max(1, maxPages))
  const stem = file.name.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]/g, '-').trim() || 'PDF'
  const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png'
  const extension = format === 'jpeg' ? 'jpg' : format

  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const original = page.getViewport({ scale: 1 })
      const scale = Math.min(160 / 72, 2400 / Math.max(original.width, original.height))
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))
      const context = canvas.getContext('2d', { alpha: false })
      if (!context) throw new Error('浏览器无法创建 PDF 页面画布')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvas, canvasContext: context, viewport, background: '#ffffff' }).promise
      const blob = await canvasBlob(canvas, mimeType, format === 'png' ? undefined : 0.92)
      pages.push(new File([blob], `${stem}-第${pageNumber}页.${extension}`, { type: mimeType }))
      canvas.width = 1
      canvas.height = 1
      page.cleanup()
      onProgress(Math.round((pageNumber / pageCount) * 100), `正在展开 PDF · 第 ${pageNumber}/${pageCount} 页`)
    }
    return { pages, totalPages: pdf.numPages }
  } finally {
    await loadingTask.destroy()
  }
}

export async function compressPdf(
  file: File,
  preset: CompressionPreset,
  onProgress: ProgressReporter,
) {
  const source = new Uint8Array(await file.arrayBuffer())
  const targetBytes = targetBytesForPreset(preset)
  if (targetBytes && file.size <= targetBytes) {
    onProgress(100, '原文件已满足目标体积')
    return file as Blob
  }

  onProgress(3, '正在读取 PDF')
  if (preset === 'lossless') {
    const structured = await saveStructureOnly(source)
    onProgress(100, 'PDF 无损整理完成')
    return structured.byteLength < file.size
      ? new Blob([structured.buffer], { type: 'application/pdf' })
      : file as Blob
  }

  let profile = PDF_PROFILES[preset] ?? PDF_PROFILES.balanced!
  let smallest: Uint8Array | null = null
  const maxAttempts = targetBytes ? 4 : 1

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const output = await rasterizePdf(source, profile, attempt, maxAttempts, onProgress)
    if (!smallest || output.byteLength < smallest.byteLength) smallest = output
    if (!targetBytes || output.byteLength <= targetBytes) break

    const ratio = Math.sqrt(targetBytes / Math.max(output.byteLength, 1)) * 0.94
    profile = {
      dpi: Math.max(48, Math.round(profile.dpi * Math.max(0.58, Math.min(0.88, ratio)))),
      quality: Math.max(0.3, profile.quality - 0.12),
    }
  }

  if (!smallest) throw new Error('PDF 压缩失败')
  onProgress(100, targetBytes && smallest.byteLength > targetBytes ? '已尽量接近目标体积' : 'PDF 压缩完成')
  return smallest.byteLength < file.size
    ? new Blob([smallest.buffer as ArrayBuffer], { type: 'application/pdf' })
    : file as Blob
}

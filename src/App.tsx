import {
  Check,
  CheckCircle,
  Package,
  Plus,
  SpinnerGap,
  Trash,
  UploadSimple,
  WarningCircle,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import './App.css'
import { JobList } from './components/JobList'
import { CLI_INSTALL_COMMAND, GuideDialogs } from './components/GuideDialogs'
import { Preferences } from './components/Preferences'
import { PreviewPanel } from './components/PreviewPanel'
import { SiteFooter, type SiteFooterHandle } from './components/SiteFooter'
import { TopBar } from './components/TopBar'
import {
  DEFAULT_COMPRESSION_PRESET,
  targetBytesForPreset,
} from './compressionPresets'
import type { VideoOutputPreference } from './mediaCompressor'
import { compressImageVariants as runImageCompression } from './imageCompression'
import { ImageCompressionPool } from './imageCompressionPool'
import {
  QUALITY_PRESETS,
  baseName,
  blobFromDesktopData,
  classifyFile,
  desktopFormatForJob,
  extensionOf,
  imageOutputExtension,
  originalImageFormat,
  outputLabelFromName,
  packageName,
  type CompressionSelection,
  type ImageOutputPreference,
  type JobKind,
  type MediaJob,
  type ProcessedFile,
  type ResultVariant,
} from './jobDomain'
import { disposeLoadedMediaEngine, loadMediaCompressor, loadPdfCompressor } from './lazyModules'
import { jobReducer } from './jobReducer'
import { createStoredZip } from './streamingZip'
import type {
  CompressionPreset,
  CompressionSettings,
  QualityPreset,
} from './types'
import {
  getInitialLocale,
  getInitialTheme,
  I18N,
  LANGUAGE_OPTIONS,
  persistLocale,
  persistTheme,
  type Locale,
  type Theme,
} from './i18n'

const MAX_FILES = 30
const MAX_IMAGE_BYTES = 100 * 1024 * 1024
const MAX_MEDIA_BYTES = 500 * 1024 * 1024
const MAX_PDF_BYTES = 100 * 1024 * 1024

function waitFor(target: EventTarget, eventName: string, timeout = 6000) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer)
      target.removeEventListener(eventName, handleSuccess)
      target.removeEventListener('error', handleError)
    }
    const handleSuccess = () => {
      cleanup()
      resolve()
    }
    const handleError = () => {
      cleanup()
      reject(new Error('无法读取视频预览'))
    }
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('预览读取超时'))
    }, timeout)
    target.addEventListener(eventName, handleSuccess, { once: true })
    target.addEventListener('error', handleError, { once: true })
  })
}

async function createVideoThumbnail(sourceUrl: string) {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = sourceUrl
  await waitFor(video, 'loadeddata')

  if (Number.isFinite(video.duration) && video.duration > 0.2) {
    video.currentTime = Math.min(1, video.duration * 0.08)
    await waitFor(video, 'seeked')
  }

  const sourceWidth = video.videoWidth || 320
  const sourceHeight = video.videoHeight || 180
  const scale = Math.min(320 / sourceWidth, 200 / sourceHeight, 1)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sourceWidth * scale))
  canvas.height = Math.max(1, Math.round(sourceHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('浏览器无法生成视频预览')
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  video.removeAttribute('src')
  video.load()

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('视频预览生成失败'))),
      'image/jpeg',
      0.78,
    )
  })
}

function download(url: string, name: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

async function copyText(value: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('Copy command failed')
}

function App() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale)
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [jobs, dispatchJobs] = useReducer(jobReducer, [])
  const [isDragging, setIsDragging] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [isZipping, setIsZipping] = useState(false)
  const [packageDownloadState, setPackageDownloadState] = useState<'idle' | 'downloaded' | 'again'>('idle')
  const [usageGuideOpen, setUsageGuideOpen] = useState(false)
  const [cliGuideOpen, setCliGuideOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  const [hoveredPreviewJobId, setHoveredPreviewJobId] = useState<string | null>(null)
  const [pinnedPreviewJobId, setPinnedPreviewJobId] = useState<string | null>(null)
  const [reprocessVisible, setReprocessVisible] = useState(false)
  const [reprocessReady, setReprocessReady] = useState(false)
  const [compressionPreset, setCompressionPreset] = useState<CompressionSelection>('all')
  const [imageOutput, setImageOutput] = useState<ImageOutputPreference>('original')
  const [videoOutput, setVideoOutput] = useState<VideoOutputPreference>('mp3')
  const imagePoolRef = useRef<ImageCompressionPool | null>(null)
  const queueRef = useRef<MediaJob[]>([])
  const processingRef = useRef(false)
  const jobsRef = useRef<MediaJob[]>([])
  const urlsRef = useRef(new Set<string>())
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)
  const footerRef = useRef<SiteFooterHandle>(null)
  const toastTimerRef = useRef<number | null>(null)
  const packageDownloadTimerRef = useRef<number | null>(null)
  const messages = I18N[locale]
  const currentLanguage = LANGUAGE_OPTIONS.find((option) => option.id === locale) ?? LANGUAGE_OPTIONS[0]

  useEffect(() => {
    jobsRef.current = jobs
  }, [jobs])

  const showToast = useCallback((message: string, tone: 'success' | 'error') => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    setToast({ message, tone })
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, 2200)
  }, [])

  const resetPackageDownloadState = useCallback(() => {
    if (packageDownloadTimerRef.current !== null) {
      window.clearTimeout(packageDownloadTimerRef.current)
      packageDownloadTimerRef.current = null
    }
    setPackageDownloadState('idle')
  }, [])

  const copyCliInstallCommand = useCallback(async () => {
    try {
      await copyText(CLI_INSTALL_COMMAND)
      showToast(messages.commandCopied, 'success')
    } catch {
      showToast(messages.copyFailed, 'error')
    }
  }, [messages.commandCopied, messages.copyFailed, showToast])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    persistTheme(theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = currentLanguage.htmlLang
  }, [currentLanguage.htmlLang])

  useEffect(() => {
    const urls = urlsRef.current
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
      if (packageDownloadTimerRef.current !== null) window.clearTimeout(packageDownloadTimerRef.current)
      imagePoolRef.current?.dispose()
      disposeLoadedMediaEngine()
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  const createUrl = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob)
    urlsRef.current.add(url)
    return url
  }, [])

  const revokeUrl = useCallback((url: string | null) => {
    if (!url) return
    URL.revokeObjectURL(url)
    urlsRef.current.delete(url)
  }, [])

  const updateJob = useCallback((id: string, patch: Partial<MediaJob>) => {
    dispatchJobs({ type: 'patch', id, patch })
  }, [])

  const compressImageVariants = useCallback(async (
    job: MediaJob,
    presets: CompressionPreset[],
    reportProgress: (preset: CompressionPreset, progress: number, stage: string) => void,
  ) => {
    const pool = imagePoolRef.current ??= new ImageCompressionPool()
    return runImageCompression(job, presets, pool, reportProgress)
  }, [])

  const compressImage = useCallback(
    async (job: MediaJob, reportProgress: (progress: number, stage: string) => void) => {
      const [output] = await compressImageVariants(
        job,
        [job.preferences.compressionPreset],
        (_preset, progress, stage) => reportProgress(progress, stage),
      )
      return output.processed
    },
    [compressImageVariants],
  )

  const processSingleJob = useCallback(
    async (
      job: MediaJob,
      progressBase = 0,
      progressSpan = 100,
      allowDesktop = true,
    ): Promise<ProcessedFile> => {
      const onProgress = (progress: number, stage: string) => {
        const mapped = progressBase + (Math.max(0, Math.min(100, progress)) / 100) * progressSpan
        updateJob(job.id, { progress: Math.max(1, Math.min(99, Math.round(mapped))), stage })
      }

      const desktop = window.compreesorDesktop
      const desktopFormat = desktopFormatForJob(job)
      const inputExtension = extensionOf(job.file.name)
      if (
        allowDesktop
        && desktop
        && job.sourcePath
        && desktopFormat
        && targetBytesForPreset(job.preferences.compressionPreset) === null
        && desktop.capabilities.nativeInputExtensions.includes(inputExtension)
        && desktop.capabilities.nativeOutputFormats.includes(desktopFormat)
      ) {
        onProgress(12, '正在使用桌面压缩引擎')
        const nativeResult = await desktop.compressFile({
          path: job.sourcePath,
          format: desktopFormat,
          preset: job.preferences.compressionPreset,
        })
        onProgress(88, '正在读取替换结果')
        const resultFile = await desktop.readResultFile(nativeResult.outputPath)
        return {
          blob: blobFromDesktopData(resultFile.data, resultFile.mimeType),
          outputName: nativeResult.outputName,
          outputLabel: outputLabelFromName(nativeResult.outputName),
          resultPath: nativeResult.outputPath,
          unchanged: nativeResult.unchanged,
          savedInPlace: true,
        }
      }

      let processed: ProcessedFile
      if (job.kind === 'image') {
        if (job.preferences.imageOutput === 'pdf') {
          const sourceFormat = job.preferences.compressionPreset === 'lossless'
            ? originalImageFormat(job.file) === 'jpeg' ? 'jpeg' : 'png'
            : 'jpeg'
          const imageResult = await compressImage({
            ...job,
            preferences: { ...job.preferences, imageOutput: sourceFormat },
          }, (progress, stage) => onProgress(progress * 0.9, stage))
          onProgress(94, '正在生成 PDF')
          const { imageBlobToPdf } = await loadPdfCompressor()
          processed = {
            blob: await imageBlobToPdf(imageResult.blob),
            outputName: `${baseName(job.file.name)}-压缩.pdf`,
            outputLabel: 'PDF',
          }
        } else {
          processed = await compressImage(job, onProgress)
        }
      } else if (job.kind === 'gif') {
        const { compressGif } = await loadMediaCompressor()
        const blob = await compressGif(job.file, job.id, job.preferences.compressionPreset, onProgress)
        processed = {
          blob,
          outputName: `${baseName(job.file.name)}-压缩.gif`,
          outputLabel: 'GIF',
        }
      } else if (job.kind === 'video') {
        const { compressVideo } = await loadMediaCompressor()
        const result = await compressVideo(
          job.file,
          job.id,
          job.preferences.videoOutput,
          job.preferences.compressionPreset,
          onProgress,
        )
        processed = {
          blob: result.blob,
          outputName: `${baseName(job.file.name)}-压缩.${result.extension}`,
          outputLabel: result.label,
        }
      } else {
        const { compressPdf } = await loadPdfCompressor()
        const blob = await compressPdf(job.file, job.preferences.compressionPreset, onProgress)
        processed = {
          blob,
          outputName: `${baseName(job.file.name)}-压缩.pdf`,
          outputLabel: 'PDF',
        }
      }

      const mayKeepOriginal = job.kind === 'gif'
        || (job.kind === 'image' && job.preferences.imageOutput === 'original')
        || job.kind === 'pdf'
        || (job.kind === 'video' && job.preferences.videoOutput === 'original')
      if (mayKeepOriginal && processed.blob.size >= job.file.size) {
        const originalExtension = extensionOf(job.file.name) || (job.kind === 'gif' ? 'gif' : 'bin')
        processed = {
          blob: job.file,
          outputName: `${baseName(job.file.name)}-压缩.${originalExtension}`,
          outputLabel: '保持原格式',
          unchanged: true,
        }
      }

      if (!allowDesktop || !desktop || !job.sourcePath) return processed
      if (processed.blob === job.file) {
        return {
          ...processed,
          outputName: job.file.name,
          resultPath: job.sourcePath,
          savedInPlace: true,
        }
      }

      const outputExtension = extensionOf(processed.outputName)
      if (!desktop.capabilities.bufferReplacementExtensions.includes(outputExtension)) {
        throw new Error(`桌面版暂不支持替换为 ${outputExtension.toUpperCase()}`)
      }
      onProgress(91, '正在安全替换原文件')
      const replacement = await desktop.replaceWithData({
        sourcePath: job.sourcePath,
        outputExtension,
        data: await processed.blob.arrayBuffer(),
      })
      return {
        ...processed,
        outputName: replacement.outputName,
        resultPath: replacement.outputPath,
        savedInPlace: true,
      }
    },
    [compressImage, updateJob],
  )

  const pumpQueue = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true

    const runJob = async (job: MediaJob) => {
      let variants: ResultVariant[] = []
      updateJob(job.id, {
        status: 'processing',
        progress: 1,
        stage: job.kind === 'video'
          ? job.preferences.videoOutput === 'mp3' ? '准备提取音频' : '准备压缩视频'
          : '准备压缩',
        error: null,
      })

      try {
        if (job.allQualities) {
          const addVariant = (preset: QualityPreset, input: ProcessedFile) => {
            const shouldKeepOriginal = (
              (job.kind === 'image' && job.preferences.imageOutput === 'original')
              || job.kind === 'gif'
              || job.kind === 'pdf'
              || (job.kind === 'video' && job.preferences.videoOutput === 'original')
            ) && input.blob.size >= job.file.size
            const processed = shouldKeepOriginal
              ? {
                  ...input,
                  blob: job.file,
                  outputName: `${baseName(job.file.name)}-压缩.${extensionOf(job.file.name) || 'bin'}`,
                  outputLabel: '保持原格式',
                  unchanged: true,
                }
              : input
            const dot = processed.outputName.lastIndexOf('.')
            const qualityName = preset === 'extreme' ? '极限' : preset === 'balanced' ? '够用' : '无损'
            const outputName = processed.outputName.includes(`-${qualityName}-压缩`)
              ? processed.outputName
              : dot > 0
                ? `${processed.outputName.slice(0, dot).replace(/-压缩$/, '')}-${qualityName}-压缩${processed.outputName.slice(dot)}`
                : `${processed.outputName}-${qualityName}`
            variants.push({
              ...processed,
              preset,
              outputName,
              url: createUrl(processed.blob),
              previewUrl: processed.previewBlob ? createUrl(processed.previewBlob) : undefined,
            })
          }

          if (job.kind === 'image') {
            const desktop = window.compreesorDesktop
            const desktopFormat = desktopFormatForJob(job)
            const inputExtension = extensionOf(job.file.name)
            if (
              desktop
              && job.sourcePath
              && desktopFormat
              && desktop.capabilities.nativeInputExtensions.includes(inputExtension)
              && desktop.capabilities.nativeOutputFormats.includes(desktopFormat)
            ) {
              updateJob(job.id, { progress: 8, stage: '正在使用桌面多档压缩引擎' })
              const outputFormat = job.preferences.imageOutput === 'original'
                ? originalImageFormat(job.file)
                : job.preferences.imageOutput as CompressionSettings['outputFormat']
              const outputExtension = imageOutputExtension(job.file, outputFormat, job.preferences.imageOutput)
              const nativeResults = await desktop.compressVariants({
                path: job.sourcePath,
                format: desktopFormat,
                variants: QUALITY_PRESETS.map((preset) => ({
                  preset,
                  outputName: `${baseName(job.file.name)}-${preset === 'extreme' ? '极限' : preset === 'balanced' ? '够用' : '无损'}-压缩.${outputExtension}`,
                })),
              })
              for (let index = 0; index < nativeResults.length; index += 1) {
                const nativeResult = nativeResults[index]
                const resultFile = await desktop.readResultFile(nativeResult.outputPath)
                addVariant(QUALITY_PRESETS[index], {
                  blob: blobFromDesktopData(resultFile.data, resultFile.mimeType),
                  outputName: nativeResult.outputName,
                  outputLabel: outputLabelFromName(nativeResult.outputName),
                  resultPath: nativeResult.outputPath,
                  unchanged: nativeResult.unchanged,
                  savedInPlace: true,
                })
                updateJob(job.id, {
                  progress: Math.round(((index + 1) / nativeResults.length) * 96),
                  stage: '正在读取桌面压缩结果',
                })
              }
            } else {
              const progressByPreset = new Map<CompressionPreset, number>(QUALITY_PRESETS.map((preset) => [preset, 0]))
              const outputs = await compressImageVariants(job, QUALITY_PRESETS, (preset, progress, stage) => {
                progressByPreset.set(preset, progress)
                const totalProgress = QUALITY_PRESETS.reduce((sum, quality) => sum + (progressByPreset.get(quality) ?? 0), 0)
                updateJob(job.id, {
                  progress: Math.max(1, Math.min(99, Math.round(totalProgress / QUALITY_PRESETS.length))),
                  stage,
                })
              })
              outputs.forEach(({ preset, processed }) => addVariant(preset as QualityPreset, processed))
            }
          } else if (job.kind === 'pdf') {
            const progressByPreset = new Map<QualityPreset, number>(QUALITY_PRESETS.map((preset) => [preset, 0]))
            const { compressPdfVariants } = await loadPdfCompressor()
            const outputs = await compressPdfVariants(job.file, QUALITY_PRESETS, (preset, progress, stage) => {
              progressByPreset.set(preset, progress)
              const totalProgress = QUALITY_PRESETS.reduce((sum, quality) => sum + (progressByPreset.get(quality) ?? 0), 0)
              updateJob(job.id, {
                progress: Math.max(1, Math.min(99, Math.round(totalProgress / QUALITY_PRESETS.length))),
                stage,
              })
            })
            outputs.forEach(({ preset, blob }) => addVariant(preset, {
              blob,
              outputName: `${baseName(job.file.name)}-压缩.pdf`,
              outputLabel: 'PDF',
            }))
          } else if (job.kind === 'gif' || job.kind === 'video') {
            const progressByPreset = new Map<QualityPreset, number>(QUALITY_PRESETS.map((preset) => [preset, 0]))
            const { compressMediaVariants } = await loadMediaCompressor()
            const outputs = await compressMediaVariants(
              job.file,
              job.id,
              job.kind,
              job.preferences.videoOutput,
              QUALITY_PRESETS,
              (preset, progress, stage) => {
                progressByPreset.set(preset as QualityPreset, progress)
                const totalProgress = QUALITY_PRESETS.reduce((sum, quality) => sum + (progressByPreset.get(quality) ?? 0), 0)
                updateJob(job.id, {
                  progress: Math.max(1, Math.min(99, Math.round(totalProgress / QUALITY_PRESETS.length))),
                  stage,
                })
              },
            )
            outputs.forEach(({ preset, output }) => addVariant(preset as QualityPreset, {
              blob: output.blob,
              outputName: `${baseName(job.file.name)}-压缩.${output.extension}`,
              outputLabel: output.label,
            }))
          } else {
            for (let index = 0; index < QUALITY_PRESETS.length; index += 1) {
              const preset = QUALITY_PRESETS[index]
              const variantJob: MediaJob = {
                ...job,
                preferences: { ...job.preferences, compressionPreset: preset },
              }
              const processed = await processSingleJob(
                variantJob,
                (index / QUALITY_PRESETS.length) * 100,
                100 / QUALITY_PRESETS.length,
                false,
              )
              addVariant(preset, processed)
            }
          }
        } else {
          const processed = await processSingleJob(job, 0, 100, !job.preserveSource)
          variants.push({
            ...processed,
            preset: job.preferences.compressionPreset,
            url: createUrl(processed.blob),
            previewUrl: processed.previewBlob ? createUrl(processed.previewBlob) : undefined,
          })
        }
        if (
          (job.allQualities || job.preserveSource)
          && window.compreesorDesktop
          && job.sourcePath
          && !variants.every((variant) => variant.savedInPlace)
        ) {
          updateJob(job.id, { progress: 98, stage: '正在保存结果到原文件夹' })
          const saved = await window.compreesorDesktop.writeVariants({
            sourcePath: job.sourcePath,
            variants: await Promise.all(variants.map(async (variant) => ({
              outputName: variant.outputName,
              data: await variant.blob.arrayBuffer(),
            }))),
          })
          variants = variants.map((variant, index) => ({
            ...variant,
            outputName: saved[index].outputName,
            resultPath: saved[index].outputPath,
            savedInPlace: true,
          }))
        }
        const primary = variants.find((variant) => variant.preset === 'balanced') ?? variants[0]
        const keptOriginal = primary.blob === job.file
        updateJob(job.id, {
          variants,
          resultBlob: primary.blob,
          resultUrl: primary.previewUrl ?? primary.url,
          outputName: primary.outputName,
          outputLabel: primary.outputLabel,
          resultPath: primary.resultPath ?? null,
          status: 'done',
          progress: 100,
          stage: (job.allQualities || job.preserveSource) && primary.savedInPlace
            ? '结果已保存到原文件夹'
            : primary.savedInPlace
              ? primary.unchanged ? '原文件已保留' : '已替换原路径文件'
            : job.allQualities ? job.sourcePath && window.compreesorDesktop ? '三档结果已保存到原文件夹' : '三档结果已完成'
            : keptOriginal ? '原文件已经很紧凑，未再增大' : '压缩完成',
        })
      } catch (error) {
        variants.forEach((variant) => {
          revokeUrl(variant.url)
          if (variant.previewUrl !== variant.url) revokeUrl(variant.previewUrl ?? null)
        })
        const message = error instanceof Error ? error.message : String(error ?? '处理失败，请重试')
        updateJob(job.id, {
          status: 'error',
          progress: 0,
          stage: '处理失败',
          error: message,
        })
      }
    }

    try {
      while (queueRef.current.length > 0) {
        const imageBatch = queueRef.current.filter((job) => job.kind === 'image').slice(0, imagePoolRef.current?.size ?? 2)
        if (imageBatch.length > 0) {
          const imageIds = new Set(imageBatch.map((job) => job.id))
          queueRef.current = queueRef.current.filter((job) => !imageIds.has(job.id))
          await Promise.all(imageBatch.map(runJob))
          continue
        }
        const mediaJob = queueRef.current.shift()
        if (mediaJob) await runJob(mediaJob)
      }
    } finally {
      processingRef.current = false
    }
  }, [compressImageVariants, createUrl, processSingleJob, revokeUrl, updateJob])

  const addFiles = useCallback(
    async (incoming: File[], replaceExisting = false) => {
      const classified = incoming
        .map((file) => ({ file, kind: classifyFile(file) }))
        .filter((item): item is { file: File; kind: JobKind } => item.kind !== null)
      const withinLimit = classified.filter(({ file, kind }) =>
        file.size <= (kind === 'image' ? MAX_IMAGE_BYTES : kind === 'pdf' ? MAX_PDF_BYTES : MAX_MEDIA_BYTES),
      )
      const availableSlots = Math.max(0, MAX_FILES - (replaceExisting ? 0 : jobs.length))
      const expanded: Array<{ file: File; originFile: File; kind: JobKind; sourcePath: string | null; preserveSource: boolean }> = []
      let pageLimitReached = false

      for (const item of withinLimit) {
        if (expanded.length >= availableSlots) break
        let sourcePath: string | null = null
        try {
          sourcePath = window.compreesorDesktop?.pathForFile(item.file) || null
        } catch {
          sourcePath = null
        }

        if (item.kind === 'pdf' && imageOutput !== 'original' && imageOutput !== 'pdf') {
          setNotice(messages.splittingPdf)
          try {
            const remaining = availableSlots - expanded.length
            const { extractPdfPages } = await loadPdfCompressor()
            const extracted = await extractPdfPages(item.file, imageOutput, remaining, (_progress, stage) => setNotice(stage))
            extracted.pages.forEach((file) => expanded.push({
              file,
              originFile: item.file,
              kind: 'image',
              sourcePath,
              preserveSource: true,
            }))
            if (extracted.totalPages > extracted.pages.length) pageLimitReached = true
          } catch {
            setNotice(messages.pdfSplitFailed)
          }
          continue
        }

        expanded.push({ ...item, originFile: item.file, sourcePath, preserveSource: false })
      }
      const selected = expanded.slice(0, availableSlots)

      if (selected.length === 0) {
        setNotice(
          classified.length > withinLimit.length
            ? messages.tooLarge
            : classified.length === 0 ? messages.unsupported : messages.pdfSplitFailed,
        )
        return false
      }

      resetPackageDownloadState()

      const nextJobs = selected.map<MediaJob>(({ file, originFile, kind, sourcePath, preserveSource }) => {
        const originalUrl = createUrl(file)
        return {
          id: crypto.randomUUID(),
          file,
          originFile,
          kind,
          preferences: {
            compressionPreset: compressionPreset === 'all' ? DEFAULT_COMPRESSION_PRESET : compressionPreset,
            imageOutput,
            videoOutput,
          },
          allQualities: compressionPreset === 'all',
          sourcePath,
          preserveSource,
          originalUrl,
          thumbnailUrl: kind === 'video' || kind === 'pdf' ? null : originalUrl,
          resultBlob: null,
          resultUrl: null,
          outputName: null,
          outputLabel: null,
          resultPath: null,
          status: 'queued',
          progress: 0,
          stage: '等待处理',
          error: null,
          variants: [],
        }
      })

      if (replaceExisting) {
        jobs.forEach((job) => {
          revokeUrl(job.originalUrl)
          if (job.thumbnailUrl !== job.originalUrl) revokeUrl(job.thumbnailUrl)
          if (job.variants.length > 0) job.variants.forEach((variant) => {
            revokeUrl(variant.url)
            if (variant.previewUrl !== variant.url) revokeUrl(variant.previewUrl ?? null)
          })
          else revokeUrl(job.resultUrl)
        })
        queueRef.current = [...nextJobs]
        jobsRef.current = nextJobs
        dispatchJobs({ type: 'replace-all', jobs: nextJobs })
        setHoveredPreviewJobId(null)
        setPinnedPreviewJobId(null)
      } else {
        jobsRef.current = [...jobsRef.current, ...nextJobs]
        dispatchJobs({ type: 'append', jobs: nextJobs })
        queueRef.current.push(...nextJobs)
      }
      setNotice(
        classified.length !== incoming.length
          ? messages.ignored
          : pageLimitReached || withinLimit.length > selected.length
            ? messages.maxFiles
            : null,
      )
      void pumpQueue()

      if (
        nextJobs.some((job) => job.kind === 'gif' || job.kind === 'video')
        && nextJobs.some((job) => job.kind === 'image' || job.kind === 'pdf')
      ) {
        void loadMediaCompressor().then(({ preloadMediaEngine }) => preloadMediaEngine()).catch(() => undefined)
      }

      nextJobs.filter((job) => job.kind === 'video' || job.kind === 'pdf').forEach((job) => {
        const thumbnailPromise = job.kind === 'pdf'
          ? loadPdfCompressor().then(({ createPdfThumbnail }) => createPdfThumbnail(job.file))
          : createVideoThumbnail(job.originalUrl)
        void thumbnailPromise
          .then((blob) => {
            const thumbnailUrl = createUrl(blob)
            if (!jobsRef.current.some((item) => item.id === job.id)) {
              revokeUrl(thumbnailUrl)
              return
            }
            dispatchJobs({ type: 'patch', id: job.id, patch: { thumbnailUrl } })
          })
          .catch(() => undefined)
      })
      return true
    },
    [compressionPreset, createUrl, imageOutput, jobs, messages, pumpQueue, resetPackageDownloadState, revokeUrl, videoOutput],
  )

  const completedJobs = useMemo(
    () => jobs.filter((job) => job.status === 'done' && job.resultBlob && job.resultUrl && job.outputName),
    [jobs],
  )
  const previewableJobs = useMemo(
    () => jobs.filter((job) => job.status === 'done' && job.resultUrl),
    [jobs],
  )
  const activePreviewJobId = pinnedPreviewJobId ?? hoveredPreviewJobId
  const previewJob = previewableJobs.find((job) => job.id === activePreviewJobId) ?? null

  const pinPreview = useCallback((jobId: string) => {
    setPinnedPreviewJobId(jobId)
    setHoveredPreviewJobId(null)
  }, [])

  const closePreview = useCallback(() => {
    setHoveredPreviewJobId(null)
    setPinnedPreviewJobId(null)
  }, [])

  const clearPreviewSelectionFromBlank = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!activePreviewJobId || !(event.target instanceof Element)) return
    if (event.target.closest('.job-row, .result-preview, button, a, input, select, textarea, label, [role="dialog"], [role="menu"], [role="tab"], [contenteditable="true"]')) return
    closePreview()
  }, [activePreviewJobId, closePreview])

  useEffect(() => {
    if (hoveredPreviewJobId && !previewableJobs.some((job) => job.id === hoveredPreviewJobId)) {
      setHoveredPreviewJobId(null)
    }
    if (pinnedPreviewJobId && !previewableJobs.some((job) => job.id === pinnedPreviewJobId)) {
      setPinnedPreviewJobId(null)
    }
  }, [hoveredPreviewJobId, pinnedPreviewJobId, previewableJobs])
  const isProcessing = jobs.some((job) => job.status === 'queued' || job.status === 'processing')
  const originalTotal = completedJobs.reduce((sum, job) => sum + job.file.size, 0)
  const resultTotal = completedJobs.reduce((sum, job) => sum + (job.resultBlob?.size ?? 0), 0)
  const totalSaved = originalTotal > 0 ? Math.max(0, Math.round((1 - resultTotal / originalTotal) * 100)) : 0
  const addDroppedFiles = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    dragDepthRef.current = 0
    setIsDragging(false)
    void addFiles(Array.from(event.dataTransfer.files))
  }, [addFiles])

  const enterDropTarget = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    dragDepthRef.current += 1
    setIsDragging(true)
  }, [])

  const leaveDropTarget = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setIsDragging(false)
  }, [])

  const retryJob = useCallback(
    (job: MediaJob) => {
      const retry = { ...job, status: 'queued' as const, progress: 0, stage: '等待处理', error: null }
      dispatchJobs({ type: 'replace-one', job: retry })
      queueRef.current.push(retry)
      void pumpQueue()
    },
    [pumpQueue],
  )

  const clearAll = useCallback(() => {
    if (isProcessing) return
    jobs.forEach((job) => {
      revokeUrl(job.originalUrl)
      if (job.thumbnailUrl !== job.originalUrl) revokeUrl(job.thumbnailUrl)
      if (job.variants.length > 0) job.variants.forEach((variant) => {
        revokeUrl(variant.url)
        if (variant.previewUrl !== variant.url) revokeUrl(variant.previewUrl ?? null)
      })
      else revokeUrl(job.resultUrl)
    })
    queueRef.current = []
    jobsRef.current = []
    dispatchJobs({ type: 'clear' })
    setNotice(null)
    setReprocessVisible(false)
    setReprocessReady(false)
    resetPackageDownloadState()
  }, [isProcessing, jobs, resetPackageDownloadState, revokeUrl])

  const markPreferencesChanged = useCallback(() => {
    if (jobs.length === 0) return
    setReprocessVisible(true)
    setReprocessReady(true)
  }, [jobs.length])

  const reprocessAllJobs = useCallback(async () => {
    if (!reprocessReady || isProcessing || jobs.length === 0) return
    setReprocessReady(false)
    const origins = Array.from(new Set(jobs.map((job) => job.originFile)))
    const replaced = await addFiles(origins, true)
    if (!replaced) setReprocessReady(true)
  }, [addFiles, isProcessing, jobs, reprocessReady])

  const downloadJob = useCallback((job: MediaJob, selectedVariant?: ResultVariant) => {
    const variant = selectedVariant ?? job.variants.find((item) => item.preset === 'balanced') ?? job.variants[0]
    const resultPath = variant?.resultPath ?? job.resultPath
    if (resultPath && window.compreesorDesktop) {
      void window.compreesorDesktop.revealResultFile(resultPath).catch(() => setNotice(messages.failed))
      return
    }
    const resultUrl = variant?.url ?? job.resultUrl
    const outputName = variant?.outputName ?? job.outputName
    if (!resultUrl || !outputName) return
    download(resultUrl, outputName)
  }, [messages.failed])

  const downloadAll = useCallback(async () => {
    if (completedJobs.length === 0 || isProcessing || isZipping) return
    if (packageDownloadTimerRef.current !== null) {
      window.clearTimeout(packageDownloadTimerRef.current)
      packageDownloadTimerRef.current = null
    }
    setIsZipping(true)
    setNotice(null)
    try {
      const names = new Map<string, number>()
      const entries: Array<{ name: string; blob: Blob }> = []
      for (const job of completedJobs) {
        const available = job.variants.length > 0 ? job.variants : []
        const selected = available.length > 0
          ? available
          : [{ blob: job.resultBlob!, outputName: job.outputName ?? `${baseName(job.file.name)}-压缩` }]
        for (const variant of selected) {
          const desiredName = variant.outputName
          const count = names.get(desiredName) ?? 0
          names.set(desiredName, count + 1)
          const dot = desiredName.lastIndexOf('.')
          const uniqueName = count === 0
            ? desiredName
            : dot > 0
              ? `${desiredName.slice(0, dot)}-${count + 1}${desiredName.slice(dot)}`
              : `${desiredName}-${count + 1}`
          entries.push({ name: uniqueName, blob: variant.blob })
        }
      }

      const blob = await createStoredZip(entries, (completed, total) => {
        setNotice(`正在打包 · ${completed}/${total}`)
      })
      const url = URL.createObjectURL(blob)
      download(url, packageName(completedJobs))
      window.setTimeout(() => URL.revokeObjectURL(url), 1500)
      setNotice(null)
      setPackageDownloadState('downloaded')
      packageDownloadTimerRef.current = window.setTimeout(() => {
        setPackageDownloadState('again')
        packageDownloadTimerRef.current = null
      }, 6000)
      footerRef.current?.openDonation()
    } catch {
      setNotice(messages.packageFailed)
    } finally {
      setIsZipping(false)
    }
  }, [completedJobs, isProcessing, isZipping, messages.packageFailed])

  const startPackageDownload = useCallback(() => {
    void downloadAll()
  }, [downloadAll])

  return (
    <div
      className={`app-shell${jobs.length > 0 ? ' has-jobs' : ''}`}
      onPointerDown={clearPreviewSelectionFromBlank}
    >
      <TopBar
        locale={locale}
        messages={messages}
        theme={theme}
        onLocaleChange={(nextLocale) => {
          setLocale(nextLocale)
          persistLocale(nextLocale)
        }}
        onThemeChange={setTheme}
      />

      <main id="top" className="workspace">
        <section className="tool-panel" aria-labelledby="page-title">
          <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml,.jxl,image/gif,application/pdf,.pdf,video/*,.mov,.m4v,.mkv,.avi,.mpeg,.mpg"
            multiple
            hidden
            onChange={(event) => {
              void addFiles(Array.from(event.target.files ?? []))
              event.target.value = ''
            }}
          />

          <Preferences
            messages={messages}
            compressionPreset={compressionPreset}
            imageOutput={imageOutput}
            videoOutput={videoOutput}
            onCompressionPresetChange={(value) => {
              setCompressionPreset(value)
              markPreferencesChanged()
            }}
            onImageOutputChange={(value) => {
              setImageOutput(value)
              markPreferencesChanged()
            }}
            onVideoOutputChange={(value) => {
              setVideoOutput(value)
              markPreferencesChanged()
            }}
            showReprocess={reprocessVisible}
            reprocessDisabled={!reprocessReady || isProcessing}
            onReprocess={() => void reprocessAllJobs()}
          />

          {jobs.length === 0 && (
              <div
                className={`drop-zone ${isDragging ? 'is-dragging' : ''}`}
                onDragEnter={enterDropTarget}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={leaveDropTarget}
                onDrop={addDroppedFiles}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click()
                }}
                role="button"
                tabIndex={0}
                aria-label={messages.chooseDrop}
              >
                <span className="drop-icon"><UploadSimple size={31} weight="bold" /></span>
                <h2>{isDragging ? messages.releaseDrop : messages.chooseDrop}</h2>
                <p>{messages.formats}</p>
                <span className="select-button">{messages.chooseFiles}</span>
              </div>
          )}

          {notice && <div className="notice" role="status"><WarningCircle size={18} />{notice}</div>}

          {jobs.length > 0 && (
            <section
              className={`queue-section has-preferences${jobs.length < 3 ? ' is-spacious' : ''} ${isDragging ? 'is-dragging' : ''}`}
              aria-labelledby="queue-title"
              onDragEnter={enterDropTarget}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={leaveDropTarget}
              onDrop={addDroppedFiles}
            >
              {isDragging && (
                <div className="queue-drop-overlay" aria-hidden="true">
                  <UploadSimple size={30} weight="bold" />
                  <strong>{messages.dragMore}</strong>
                </div>
              )}
              <div className="queue-header">
                <div className="queue-summary">
                  <h2 id="queue-title">{messages.files(jobs.length)}</h2>
                  <p>
                    {isProcessing
                      ? messages.processingCount(jobs.filter((job) => job.status === 'processing').length || 1)
                      : messages.completedSummary(completedJobs.length, totalSaved)}
                  </p>
                </div>
                <div className="queue-controls">
                  <button className="clear-button" type="button" onClick={clearAll} disabled={isProcessing}>
                    <Trash size={16} />{messages.clear}
                  </button>
                  <button className="add-more-button" type="button" onClick={() => inputRef.current?.click()}>
                    <Plus size={16} weight="bold" />{messages.continueUpload}
                  </button>
                  {!isProcessing && completedJobs.length > 0 ? (
                    <button
                      className={`download-all${packageDownloadState !== 'idle' ? ' has-downloaded' : ''}${packageDownloadState === 'downloaded' ? ' is-downloaded' : ''}${packageDownloadState === 'again' ? ' is-download-again' : ''}`}
                      type="button"
                      onClick={startPackageDownload}
                      disabled={isZipping || packageDownloadState === 'downloaded'}
                      aria-busy={isZipping}
                    >
                      {isZipping ? (
                        <SpinnerGap className="spin" size={17} />
                      ) : packageDownloadState === 'downloaded' ? (
                        <Check size={17} weight="bold" />
                      ) : (
                        <Package size={17} weight="bold" />
                      )}
                      <span aria-live="polite">
                        {isZipping
                          ? messages.zipping
                          : packageDownloadState === 'downloaded'
                            ? messages.packageDownloaded
                            : packageDownloadState === 'again'
                              ? messages.packageDownloadAgain
                              : messages.packageDownload}
                      </span>
                    </button>
                  ) : null}
                </div>
              </div>

              <JobList
                jobs={jobs}
                locale={locale}
                messages={messages}
                onDownload={downloadJob}
                selectedJobId={activePreviewJobId}
                onPreviewHover={setHoveredPreviewJobId}
                onPreviewPin={pinPreview}
                onRetry={retryJob}
              />
            </section>
          )}
        </section>

      </main>

      <SiteFooter
        ref={footerRef}
        htmlLang={currentLanguage.htmlLang}
        messages={messages}
        onOpenCliGuide={() => setCliGuideOpen(true)}
        onOpenUsageGuide={() => setUsageGuideOpen(true)}
      />

      {toast && (
        <div className={`app-toast is-${toast.tone}`} role="status" aria-live="polite" aria-atomic="true">
          {toast.tone === 'success' ? <CheckCircle size={17} weight="fill" /> : <WarningCircle size={17} weight="fill" />}
          <span>{toast.message}</span>
        </div>
      )}

      {previewJob && previewJob.resultUrl ? (
        <PreviewPanel
          job={previewJob}
          jobs={previewableJobs}
          messages={messages}
          pinned={pinnedPreviewJobId === previewJob.id}
          onClose={closePreview}
          onSelect={pinPreview}
          onDownload={downloadJob}
        />
      ) : null}

      <GuideDialogs
        cliOpen={cliGuideOpen}
        locale={locale}
        messages={messages}
        usageOpen={usageGuideOpen}
        onCliClose={() => setCliGuideOpen(false)}
        onCopyCliCommand={() => void copyCliInstallCommand()}
        onLocaleChange={(nextLocale) => {
          setLocale(nextLocale)
          persistLocale(nextLocale)
        }}
        onUsageClose={() => setUsageGuideOpen(false)}
      />
    </div>
  )
}

export default App

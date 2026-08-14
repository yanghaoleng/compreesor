import {
  ArrowDown,
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  ChatCircle,
  CopySimple,
  DownloadSimple,
  Eye,
  FileImage,
  FilmStrip,
  Info,
  Moon,
  Package,
  Plus,
  SpinnerGap,
  Sun,
  TerminalWindow,
  ThumbsUp,
  Trash,
  Translate,
  UploadSimple,
  Wallet,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import { zip } from 'fflate'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  DEFAULT_COMPRESSION_PRESET,
  IMAGE_PRESET_SETTINGS,
} from './compressionPresets'
import {
  compressGif,
  compressVideo,
  disposeMediaEngine,
  type VideoOutputPreference,
} from './mediaCompressor'
import type {
  CompressionPreset,
  CompressionSettings,
  WorkerRequest,
  WorkerResponse,
  WorkerSuccess,
} from './types'
import type { DesktopNativeFormat } from './desktop'
import {
  getInitialLocale,
  getInitialTheme,
  I18N,
  LANGUAGE_OPTIONS,
  persistLocale,
  persistTheme,
  type Locale,
  type Messages,
  type Theme,
} from './i18n'

type JobKind = 'image' | 'gif' | 'video'
type JobStatus = 'queued' | 'processing' | 'done' | 'error'
type ImageOutputPreference = 'original' | 'jpeg' | 'webp' | 'png'

type JobPreferences = {
  compressionPreset: CompressionPreset
  imageOutput: ImageOutputPreference
  videoOutput: VideoOutputPreference
}

type MediaJob = {
  id: string
  file: File
  kind: JobKind
  preferences: JobPreferences
  sourcePath: string | null
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
}

type ProcessedFile = {
  blob: Blob
  outputName: string
  outputLabel: string
  resultPath?: string
  unchanged?: boolean
  savedInPlace?: boolean
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.jxl', '.svg']
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi', '.mpeg', '.mpg']
const MAX_FILES = 30
const MAX_IMAGE_BYTES = 100 * 1024 * 1024
const MAX_MEDIA_BYTES = 500 * 1024 * 1024
const FORMAT_LABELS = {
  jpeg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
  avif: 'AVIF',
  jxl: 'JXL',
} as const
const AUTHOR_HOME_URL = 'https://mikeywa.icu/'
const CLI_INSTALL_COMMAND = 'npm install -g compreesor-cli'
const SPRING_SCALE_IN = {
  duration: 259,
  stagger: 68,
  easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  initialDelayMax: 400,
} as const

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 100 * 1024 ? 1 : 0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 2 : 1)} MB`
}

function baseName(name: string) {
  const cleaned = name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '-').trim()
  return cleaned.slice(0, 120) || 'file'
}

function compactFileName(name: string, maxLength = 5) {
  return Array.from(baseName(name)).slice(0, maxLength).join('')
}

function packageName(jobs: MediaJob[]) {
  const leadingNames = jobs.slice(0, 2).map((job) => compactFileName(job.file.name)).join('、')
  return `${leadingNames || '文件'}等${jobs.length}个文件的压缩.zip`
}

function isElementInViewport(element: Element | null) {
  if (!element) return false
  const bounds = element.getBoundingClientRect()
  return bounds.bottom > 0
    && bounds.top < window.innerHeight
    && bounds.right > 0
    && bounds.left < window.innerWidth
}

function extensionOf(name: string) {
  return name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''
}

function originalImageFormat(file: File): CompressionSettings['outputFormat'] {
  const extension = extensionOf(file.name)
  if (extension === 'jpg' || extension === 'jpeg') return 'jpeg'
  if (extension === 'png' || extension === 'webp' || extension === 'avif' || extension === 'jxl') return extension
  if (file.type === 'image/jpeg') return 'jpeg'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/avif') return 'avif'
  return 'webp'
}

function imageOutputExtension(file: File, format: CompressionSettings['outputFormat'], preference: ImageOutputPreference) {
  if (preference === 'original') return extensionOf(file.name) || (format === 'jpeg' ? 'jpg' : format)
  return format === 'jpeg' ? 'jpg' : format
}

function desktopFormatForJob(job: MediaJob): DesktopNativeFormat | null {
  if (job.kind === 'gif') return 'gif'
  if (job.kind === 'video') {
    if (job.preferences.videoOutput === 'mov-alpha') return null
    return job.preferences.videoOutput
  }
  if (job.preferences.imageOutput === 'original') return 'original'
  return job.preferences.imageOutput === 'jpeg' ? 'jpg' : job.preferences.imageOutput
}

function outputLabelFromName(name: string) {
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
  return extension.toUpperCase() || 'FILE'
}

function blobFromDesktopData(data: Uint8Array, mimeType: string) {
  const bytes = new Uint8Array(data.byteLength)
  bytes.set(data)
  return new Blob([bytes.buffer], { type: mimeType })
}

function classifyFile(file: File): JobKind | null {
  const lowerName = file.name.toLowerCase()
  if (file.type === 'image/gif' || lowerName.endsWith('.gif')) return 'gif'
  if (file.type.startsWith('video/') || VIDEO_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
    return 'video'
  }
  if (IMAGE_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) return 'image'
  return null
}

function isSvgFile(file: File) {
  return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
}

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

async function optimizeSvg(
  file: File,
  preset: CompressionPreset,
  onProgress: (progress: number, stage: string) => void,
) {
  onProgress(8, '正在读取 SVG')
  const safeSource = sanitizeSvg(await file.text())
  onProgress(34, '正在优化矢量路径')
  const { optimize } = await import('svgo/browser')
  const preserveGeometry = preset === 'lossless'
  const floatPrecision = preset === 'extreme' ? 2 : 3
  const result = optimize(safeSource, {
    path: file.name,
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
    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('SVG 转换失败')), 'image/png')
    })
    return pngBlob.arrayBuffer()
  } finally {
    URL.revokeObjectURL(url)
  }
}

function kindLabel(kind: JobKind, messages: Messages) {
  if (kind === 'video') return messages.videoKind
  if (kind === 'gif') return messages.gifKind
  return messages.imageKind
}

function statusText(job: MediaJob, messages: Messages) {
  if (job.status === 'queued') return messages.waiting
  if (job.status === 'processing') return job.stage
  if (job.status === 'error') return job.error ?? messages.failed
  return job.stage
}

function AnimatedPercentage({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(value)
      return undefined
    }
    let frame = 0
    const startedAt = performance.now()
    const duration = 760
    const update = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - (1 - progress) ** 3
      setDisplayValue(Math.round(value * eased))
      if (progress < 1) frame = window.requestAnimationFrame(update)
    }
    setDisplayValue(0)
    frame = window.requestAnimationFrame(update)
    return () => window.cancelAnimationFrame(frame)
  }, [value])

  return (
    <span className="result-ratio" data-target-ratio={value} data-animation="count-up">
      {displayValue}%
    </span>
  )
}

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

function splitAnimatedWords(text: string, locale: string) {
  if (typeof Intl.Segmenter === 'function') {
    const segments = Array.from(
      new Intl.Segmenter(locale, { granularity: 'word' }).segment(text),
      ({ segment, isWordLike }) => ({ text: segment, animate: Boolean(isWordLike) }),
    )

    return segments.reduce<Array<{ text: string; animate: boolean }>>((parts, part) => {
      if (part.animate || /^\s+$/u.test(part.text) || parts.length === 0) {
        parts.push(part)
      } else {
        parts[parts.length - 1].text += part.text
      }
      return parts
    }, [])
  }

  return (text.match(/(\S+|\s+)/g) ?? [text]).map((part) => ({
    text: part,
    animate: !/^\s+$/u.test(part),
  }))
}

function SpringScaleText({ text, locale }: { text: string; locale: string }) {
  const hostRef = useRef<HTMLSpanElement>(null)
  const parts = useMemo(() => splitAnimatedWords(text, locale), [locale, text])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    const units = Array.from(host.querySelectorAll<HTMLElement>('.spring-scale-word'))
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      units.forEach((unit) => {
        unit.style.opacity = '1'
        unit.style.transform = 'translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) rotate(0deg) scale(1)'
      })
      return undefined
    }

    const initialDelay = Math.round(Math.random() * SPRING_SCALE_IN.initialDelayMax)
    const animations = units.map((unit, index) => unit.animate(
      [
        {
          opacity: 0,
          transform: 'translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) rotate(0deg) scale(0.7)',
        },
        {
          opacity: 1,
          transform: 'translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) rotate(0deg) scale(1)',
        },
      ],
      {
        delay: initialDelay + index * SPRING_SCALE_IN.stagger,
        duration: SPRING_SCALE_IN.duration,
        easing: SPRING_SCALE_IN.easing,
        fill: 'forwards',
      },
    ))

    return () => animations.forEach((animation) => animation.cancel())
  }, [parts])

  return (
    <span className="spring-scale-text" ref={hostRef}>
      {parts.map((part, index) => part.animate ? (
        <span className="spring-scale-word" key={`${part.text}-${index}`}>{part.text}</span>
      ) : (
        <span key={`${part.text}-${index}`}>{part.text}</span>
      ))}
    </span>
  )
}

function nextRandomIndex(length: number, currentIndex: number) {
  if (length <= 1) return 0
  if (currentIndex < 0) return Math.floor(Math.random() * length)
  return (currentIndex + 1 + Math.floor(Math.random() * (length - 1))) % length
}

type PreferencesProps = {
  messages: Messages
  compressionPreset: CompressionPreset
  imageOutput: ImageOutputPreference
  videoOutput: VideoOutputPreference
  onCompressionPresetChange: (value: CompressionPreset) => void
  onImageOutputChange: (value: ImageOutputPreference) => void
  onVideoOutputChange: (value: VideoOutputPreference) => void
}

function Preferences({
  messages,
  compressionPreset,
  imageOutput,
  videoOutput,
  onCompressionPresetChange,
  onImageOutputChange,
  onVideoOutputChange,
}: PreferencesProps) {
  return (
    <section className="preferences" aria-labelledby="page-title">
      <h1 id="page-title">{messages.outputPreferences}</h1>
      <label>
        <span>{messages.compressionLevel}</span>
        <select value={compressionPreset} onChange={(event) => onCompressionPresetChange(event.target.value as CompressionPreset)}>
          <option value="extreme">{messages.extreme}</option>
          <option value="balanced">{messages.balanced}</option>
          <option value="lossless">{messages.lossless}</option>
        </select>
      </label>
      <label>
        <span>{messages.image}</span>
        <select value={imageOutput} onChange={(event) => onImageOutputChange(event.target.value as ImageOutputPreference)}>
          <option value="original">{messages.imageOriginal}</option>
          <option value="jpeg">{messages.jpg}</option>
          <option value="webp">{messages.webp}</option>
          <option value="png">{messages.png}</option>
        </select>
      </label>
      <label>
        <span>{messages.video}</span>
        <select value={videoOutput} onChange={(event) => onVideoOutputChange(event.target.value as VideoOutputPreference)}>
          <option value="original">{messages.original}</option>
          <option value="mp4">{messages.mp4}</option>
          <option value="mov">{messages.mov}</option>
          <option value="mov-alpha">{messages.movAlpha}</option>
          <option value="mp3">{messages.extractMp3}</option>
        </select>
      </label>
    </section>
  )
}

function App() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale)
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [jobs, setJobs] = useState<MediaJob[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [isZipping, setIsZipping] = useState(false)
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const [usageGuideOpen, setUsageGuideOpen] = useState(false)
  const [cliGuideOpen, setCliGuideOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  const [previewJobId, setPreviewJobId] = useState<string | null>(null)
  const [donateMethod, setDonateMethod] = useState<'wechat' | 'alipay'>('wechat')
  const [donatePraiseIndex, setDonatePraiseIndex] = useState(-1)
  const [donatePanelState, setDonatePanelState] = useState<'closed' | 'open' | 'closing'>('closed')
  const [donatePanelPinned, setDonatePanelPinned] = useState(false)
  const [compressionPreset, setCompressionPreset] = useState<CompressionPreset>(DEFAULT_COMPRESSION_PRESET)
  const [imageOutput, setImageOutput] = useState<ImageOutputPreference>('original')
  const [videoOutput, setVideoOutput] = useState<VideoOutputPreference>('mp3')
  const workerPoolRef = useRef<Worker[]>([])
  const workerCursorRef = useRef(0)
  const queueRef = useRef<MediaJob[]>([])
  const processingRef = useRef(false)
  const urlsRef = useRef(new Set<string>())
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)
  const languageMenuRef = useRef<HTMLDivElement>(null)
  const donateWidgetRef = useRef<HTMLDivElement>(null)
  const donateTriggerRef = useRef<HTMLButtonElement>(null)
  const usageGuideCloseRef = useRef<HTMLButtonElement>(null)
  const cliGuideCloseRef = useRef<HTMLButtonElement>(null)
  const toastTimerRef = useRef<number | null>(null)
  const messages = I18N[locale]
  const currentLanguage = LANGUAGE_OPTIONS.find((option) => option.id === locale) ?? LANGUAGE_OPTIONS[0]
  const donatePraise = messages.donatePraises[Math.max(0, donatePraiseIndex) % messages.donatePraises.length]

  const chooseNextDonatePraise = useCallback(() => {
    setDonatePraiseIndex((current) => nextRandomIndex(messages.donatePraises.length, current))
  }, [messages.donatePraises.length])

  const openDonatePanel = useCallback((pinned: boolean) => {
    chooseNextDonatePraise()
    setDonatePanelPinned(pinned)
    setDonatePanelState('open')
  }, [chooseNextDonatePraise])

  const showToast = useCallback((message: string, tone: 'success' | 'error') => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    setToast({ message, tone })
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, 2200)
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
    if (!languageMenuOpen) return undefined
    const closeMenu = (event: MouseEvent | FocusEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) setLanguageMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLanguageMenuOpen(false)
    }
    document.addEventListener('mousedown', closeMenu)
    document.addEventListener('focusin', closeMenu)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeMenu)
      document.removeEventListener('focusin', closeMenu)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [languageMenuOpen])

  useEffect(() => {
    if (!usageGuideOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => usageGuideCloseRef.current?.focus())
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setUsageGuideOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [usageGuideOpen])

  useEffect(() => {
    if (!cliGuideOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => cliGuideCloseRef.current?.focus())
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCliGuideOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [cliGuideOpen])

  useEffect(() => {
    if (donatePanelState !== 'open') return undefined
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!donateWidgetRef.current?.contains(event.target as Node)) setDonatePanelState('closing')
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDonatePanelState('closing')
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [donatePanelState])

  useEffect(() => {
    if (donatePanelState === 'closed') {
      setDonatePanelPinned(false)
      return undefined
    }
    const trigger = donateTriggerRef.current
    if (!trigger) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => setDonatePanelPinned(!entry?.isIntersecting),
      { threshold: 0.01 },
    )
    observer.observe(trigger)
    return () => observer.disconnect()
  }, [donatePanelState])

  useEffect(() => {
    const urls = urlsRef.current
    const workers = workerPoolRef.current
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
      workers.forEach((worker) => worker.terminate())
      disposeMediaEngine()
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
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...patch } : job)))
  }, [])

  const ensureWorker = useCallback(() => {
    while (workerPoolRef.current.length < 2) {
      workerPoolRef.current.push(new Worker(new URL('./compressor.worker.ts', import.meta.url), { type: 'module' }))
    }
    const worker = workerPoolRef.current[workerCursorRef.current % workerPoolRef.current.length]
    workerCursorRef.current += 1
    return worker
  }, [])

  const compressImage = useCallback(
    async (job: MediaJob) => {
      let buffer: ArrayBuffer
      if (isSvgFile(job.file)) {
        const svg = await optimizeSvg(job.file, job.preferences.compressionPreset, (progress, stage) => {
          updateJob(job.id, { progress, stage })
        })
        if (job.preferences.imageOutput === 'original') {
          updateJob(job.id, { progress: 96, stage: '正在生成 SVG' })
          return {
            blob: new Blob([svg], { type: 'image/svg+xml' }),
            outputName: `${baseName(job.file.name)}-压缩.svg`,
            outputLabel: 'SVG',
          }
        }
        updateJob(job.id, { progress: 82, stage: '正在渲染 SVG' })
        buffer = await rasterizeSvg(svg)
      } else {
        buffer = await job.file.arrayBuffer()
      }
      const outputFormat = job.preferences.imageOutput === 'original'
        ? originalImageFormat(job.file)
        : job.preferences.imageOutput
      if (
        job.preferences.compressionPreset === 'lossless'
        && job.preferences.imageOutput === 'original'
        && outputFormat === 'jpeg'
      ) {
        updateJob(job.id, { progress: 96, stage: '已保留原始 JPEG' })
        return {
          blob: job.file,
          outputName: `${baseName(job.file.name)}-压缩.${imageOutputExtension(job.file, outputFormat, job.preferences.imageOutput)}`,
          outputLabel: FORMAT_LABELS[outputFormat],
        }
      }
      const presetSettings = IMAGE_PRESET_SETTINGS[job.preferences.compressionPreset]
      const settings: CompressionSettings = {
        outputFormat,
        preset: job.preferences.compressionPreset,
        quality: presetSettings.quality,
        targetBytes: null,
        maxDimension: presetSettings.maxDimension,
      }
      const result = await new Promise<WorkerSuccess>((resolve, reject) => {
        const worker = ensureWorker()
        const handleMessage = (event: MessageEvent<WorkerResponse>) => {
          const message = event.data
          if (message.jobId !== job.id) return
          if (message.type === 'progress') {
            updateJob(job.id, { progress: Math.round(message.progress), stage: message.stage })
            return
          }
          worker.removeEventListener('message', handleMessage)
          if (message.type === 'error') reject(new Error(message.message))
          else resolve(message)
        }

        worker.addEventListener('message', handleMessage)
        const request: WorkerRequest = {
          type: 'compress',
          jobId: job.id,
          buffer,
          fileName: job.file.name,
          mimeType: job.file.type,
          settings,
        }
        worker.postMessage(request, [buffer])
      })

      return {
        blob: new Blob([result.outputBuffer], { type: result.mimeType }),
        outputName: `${baseName(job.file.name)}-压缩.${imageOutputExtension(job.file, result.outputFormat, job.preferences.imageOutput)}`,
        outputLabel: FORMAT_LABELS[result.outputFormat],
      }
    },
    [ensureWorker, updateJob],
  )

  const processJob = useCallback(
    async (job: MediaJob): Promise<ProcessedFile> => {
      const onProgress = (progress: number, stage: string) => {
        updateJob(job.id, { progress: Math.max(1, Math.min(99, Math.round(progress))), stage })
      }

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
        processed = await compressImage(job)
      } else if (job.kind === 'gif') {
        const blob = await compressGif(job.file, job.id, job.preferences.compressionPreset, onProgress)
        processed = {
          blob,
          outputName: `${baseName(job.file.name)}-压缩.gif`,
          outputLabel: 'GIF',
        }
      } else {
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
      }

      const mayKeepOriginal = job.kind === 'gif'
        || (job.kind === 'image' && job.preferences.imageOutput === 'original')
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

      if (!desktop || !job.sourcePath) return processed
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
      updateJob(job.id, {
        status: 'processing',
        progress: 1,
        stage: job.kind === 'video'
          ? job.preferences.videoOutput === 'mp3' ? '准备提取音频' : '准备压缩视频'
          : '准备压缩',
        error: null,
      })

      try {
        const processed = await processJob(job)
        const resultUrl = createUrl(processed.blob)
        const keptOriginal = processed.blob === job.file
        updateJob(job.id, {
          resultBlob: processed.blob,
          resultUrl,
          outputName: processed.outputName,
          outputLabel: processed.outputLabel,
          resultPath: processed.resultPath ?? null,
          status: 'done',
          progress: 100,
          stage: processed.savedInPlace
            ? processed.unchanged ? '原文件已保留' : '已替换原路径文件'
            : keptOriginal ? '原文件已经很紧凑，未再增大' : '压缩完成',
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error ?? '处理失败，请重试')
        updateJob(job.id, {
          status: 'error',
          progress: 0,
          stage: '处理失败',
          error: message,
        })
      }
    }

    while (queueRef.current.length > 0) {
      const imageBatch = queueRef.current.filter((job) => job.kind === 'image').slice(0, 2)
      if (imageBatch.length > 0) {
        const imageIds = new Set(imageBatch.map((job) => job.id))
        queueRef.current = queueRef.current.filter((job) => !imageIds.has(job.id))
        await Promise.all(imageBatch.map(runJob))
        continue
      }
      const mediaJob = queueRef.current.shift()
      if (mediaJob) await runJob(mediaJob)
    }

    processingRef.current = false
  }, [createUrl, processJob, updateJob])

  const addFiles = useCallback(
    (incoming: File[]) => {
      const classified = incoming
        .map((file) => ({ file, kind: classifyFile(file) }))
        .filter((item): item is { file: File; kind: JobKind } => item.kind !== null)
      const withinLimit = classified.filter(({ file, kind }) =>
        file.size <= (kind === 'image' ? MAX_IMAGE_BYTES : MAX_MEDIA_BYTES),
      )
      const selected = withinLimit.slice(0, Math.max(0, MAX_FILES - jobs.length))

      if (selected.length === 0) {
        setNotice(
          classified.length > withinLimit.length
            ? messages.tooLarge
            : messages.unsupported,
        )
        return
      }

      const nextJobs = selected.map<MediaJob>(({ file, kind }) => {
        const originalUrl = createUrl(file)
        let sourcePath: string | null = null
        try {
          sourcePath = window.compreesorDesktop?.pathForFile(file) || null
        } catch {
          sourcePath = null
        }
        return {
          id: crypto.randomUUID(),
          file,
          kind,
          preferences: { compressionPreset, imageOutput, videoOutput },
          sourcePath,
          originalUrl,
          thumbnailUrl: kind === 'video' ? null : originalUrl,
          resultBlob: null,
          resultUrl: null,
          outputName: null,
          outputLabel: null,
          resultPath: null,
          status: 'queued',
          progress: 0,
          stage: '等待处理',
          error: null,
        }
      })

      setJobs((current) => [...current, ...nextJobs])
      queueRef.current.push(...nextJobs)
      setNotice(
        classified.length !== incoming.length
          ? messages.ignored
          : withinLimit.length > selected.length
            ? messages.maxFiles
            : null,
      )
      void pumpQueue()

      nextJobs.filter((job) => job.kind === 'video').forEach((job) => {
        void createVideoThumbnail(job.originalUrl)
          .then((blob) => {
            const thumbnailUrl = createUrl(blob)
            setJobs((current) => {
              if (!current.some((item) => item.id === job.id)) {
                revokeUrl(thumbnailUrl)
                return current
              }
              return current.map((item) => (item.id === job.id ? { ...item, thumbnailUrl } : item))
            })
          })
          .catch(() => undefined)
      })
    },
    [compressionPreset, createUrl, imageOutput, jobs.length, messages, pumpQueue, revokeUrl, videoOutput],
  )

  const completedJobs = useMemo(
    () => jobs.filter((job) => job.status === 'done' && job.resultBlob && job.resultUrl && job.outputName),
    [jobs],
  )
  const previewableJobs = useMemo(
    () => jobs.filter((job) => job.status === 'done' && job.resultUrl),
    [jobs],
  )
  const previewJob = previewableJobs.find((job) => job.id === previewJobId) ?? null
  const previewIndex = previewJob ? previewableJobs.findIndex((job) => job.id === previewJob.id) : -1

  useEffect(() => {
    if (previewJobId && !previewableJobs.some((job) => job.id === previewJobId)) setPreviewJobId(null)
  }, [previewJobId, previewableJobs])
  const isProcessing = jobs.some((job) => job.status === 'queued' || job.status === 'processing')
  const originalTotal = completedJobs.reduce((sum, job) => sum + job.file.size, 0)
  const resultTotal = completedJobs.reduce((sum, job) => sum + (job.resultBlob?.size ?? 0), 0)
  const totalSaved = originalTotal > 0 ? Math.max(0, Math.round((1 - resultTotal / originalTotal) * 100)) : 0
  const addDroppedFiles = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    dragDepthRef.current = 0
    setIsDragging(false)
    addFiles(Array.from(event.dataTransfer.files))
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
      setJobs((current) => current.map((item) => (item.id === job.id ? retry : item)))
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
      revokeUrl(job.resultUrl)
    })
    queueRef.current = []
    setJobs([])
    setNotice(null)
    setDonatePanelState('closed')
  }, [isProcessing, jobs, revokeUrl])

  const downloadJob = useCallback((job: MediaJob) => {
    if (job.resultPath && window.compreesorDesktop) {
      void window.compreesorDesktop.revealResultFile(job.resultPath).catch(() => setNotice(messages.failed))
      return
    }
    if (!job.resultUrl || !job.outputName) return
    download(job.resultUrl, job.outputName)
  }, [messages.failed])

  const downloadAll = useCallback(async () => {
    if (completedJobs.length === 0 || isProcessing || isZipping) return
    setIsZipping(true)
    setNotice(null)
    try {
      const names = new Map<string, number>()
      const entries: Record<string, Uint8Array> = {}
      for (const job of completedJobs) {
        const desiredName = job.outputName ?? `${baseName(job.file.name)}-压缩`
        const count = names.get(desiredName) ?? 0
        names.set(desiredName, count + 1)
        const dot = desiredName.lastIndexOf('.')
        const uniqueName = count === 0
          ? desiredName
          : dot > 0
            ? `${desiredName.slice(0, dot)}-${count + 1}${desiredName.slice(dot)}`
            : `${desiredName}-${count + 1}`
        entries[uniqueName] = new Uint8Array(await job.resultBlob!.arrayBuffer())
      }

      await new Promise<void>((resolve, reject) => {
        zip(entries, { level: 0 }, (error, data) => {
          if (error) {
            reject(error)
            return
          }
          const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/zip' })
          const url = URL.createObjectURL(blob)
          download(url, packageName(completedJobs))
          window.setTimeout(() => URL.revokeObjectURL(url), 1500)
          resolve()
        })
      })
      openDonatePanel(!isElementInViewport(donateTriggerRef.current))
    } catch {
      setNotice(messages.packageFailed)
    } finally {
      setIsZipping(false)
    }
  }, [completedJobs, isProcessing, isZipping, messages.packageFailed, openDonatePanel])

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label={messages.homeLabel}>
          <span className="brand-mark"><ArrowDown size={24} weight="bold" /></span>
          <span>
            <strong>Compreesor</strong>
            <small>{messages.brandSubtitle}</small>
          </span>
        </a>
        <div className="topbar-actions">
          <div className="language-menu-wrap" ref={languageMenuRef}>
            <button
              className="icon-button language-button"
              type="button"
              onClick={() => setLanguageMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={languageMenuOpen}
              aria-label={messages.languageMenuLabel(currentLanguage.label)}
              title={messages.languageMenuLabel(currentLanguage.label)}
            >
              <Translate size={17} />
              <span>{currentLanguage.short}</span>
            </button>
            {languageMenuOpen && (
              <div className="language-menu" role="menu" aria-label={messages.languageListLabel}>
                {LANGUAGE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    className={locale === option.id ? 'active' : ''}
                    type="button"
                    role="menuitemradio"
                    aria-checked={locale === option.id}
                    lang={option.htmlLang}
                    onClick={() => {
                      setLocale(option.id)
                      persistLocale(option.id)
                      setLanguageMenuOpen(false)
                    }}
                  >
                    <span>{option.label}</span>
                    {locale === option.id && <Check size={15} weight="bold" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
            aria-label={messages.themeToggle(theme)}
            title={messages.themeToggle(theme)}
          >
            {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
          </button>
        </div>
      </header>

      <main id="top" className="workspace">
        <section className="tool-panel" aria-labelledby="page-title">
          <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml,.jxl,image/gif,video/*,.mov,.m4v,.mkv,.avi,.mpeg,.mpg"
            multiple
            hidden
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []))
              event.target.value = ''
            }}
          />

          <Preferences
            messages={messages}
            compressionPreset={compressionPreset}
            imageOutput={imageOutput}
            videoOutput={videoOutput}
            onCompressionPresetChange={setCompressionPreset}
            onImageOutputChange={setImageOutput}
            onVideoOutputChange={setVideoOutput}
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
              className={`queue-section has-preferences ${isDragging ? 'is-dragging' : ''}`}
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
                  <button
                    className="download-all"
                    type="button"
                    onClick={downloadAll}
                    disabled={completedJobs.length === 0 || isProcessing || isZipping}
                  >
                    {isZipping ? <SpinnerGap className="spin" size={17} /> : <Package size={17} weight="bold" />}
                    {isZipping ? messages.zipping : messages.packageDownload}
                  </button>
                </div>
              </div>

              <div className="job-list">
                {jobs.map((job) => {
                  const outputBytes = job.resultBlob?.size ?? 0
                  const outputRatio = outputBytes > 0 ? Math.round((outputBytes / job.file.size) * 100) : 0
                  return (
                    <article className={`job-row status-${job.status}`} key={job.id}>
                      <div className="thumbnail" aria-hidden="true">
                        {job.thumbnailUrl ? (
                          <img src={job.thumbnailUrl} alt="" />
                        ) : job.kind === 'video' ? (
                          <FilmStrip size={25} />
                        ) : (
                          <FileImage size={25} />
                        )}
                        <span>{kindLabel(job.kind, messages)}</span>
                      </div>

                      <div className="job-copy">
                        <strong title={job.file.name}>{job.file.name}</strong>
                        <p>
                          {job.status === 'done' && job.resultBlob
                            ? `${formatBytes(job.file.size)} → ${formatBytes(job.resultBlob.size)}`
                            : formatBytes(job.file.size)}
                        </p>
                        <div
                          className="job-progress"
                          role="progressbar"
                          aria-label={messages.progressLabel(job.file.name)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={job.progress}
                          title={`${statusText(job, messages)} ${job.progress}%`}
                        >
                          <span style={{ transform: `scaleX(${Math.max(0, Math.min(100, job.progress)) / 100})` }} />
                        </div>
                        {job.status === 'error' && (
                          <small className="error-text">
                            {locale === 'zh' || locale === 'zh-Hant' ? job.error : messages.failed}
                          </small>
                        )}
                      </div>

                      <div className="job-state">
                        {job.status === 'processing' && (
                          <span className="processing-state" title={statusText(job, messages)}>
                            <SpinnerGap className="spin" size={17} />
                            <span>{job.progress}%</span>
                          </span>
                        )}
                        {job.status === 'queued' && (
                          <span className="processing-state">
                            <span className="queue-dot" />
                            <span>{job.progress}%</span>
                          </span>
                        )}
                        {job.status === 'done' && (
                          <>
                            <CheckCircle size={18} weight="fill" />
                            <span title={job.outputLabel ?? undefined}>
                              {job.kind === 'image' ? <AnimatedPercentage value={outputRatio} /> : job.outputLabel}
                            </span>
                          </>
                        )}
                        {job.status === 'error' && <WarningCircle size={21} weight="fill" />}
                      </div>

                      <div className="job-action">
                        {job.status === 'done' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setPreviewJobId(job.id)}
                              aria-label={`${messages.preview} ${job.file.name}`}
                              title={messages.preview}
                            >
                              <Eye size={15} weight="bold" />
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadJob(job)}
                              aria-label={`${job.resultPath && window.compreesorDesktop ? messages.reveal : messages.download} ${job.file.name}`}
                              title={job.resultPath && window.compreesorDesktop ? messages.reveal : messages.download}
                            >
                              <DownloadSimple size={15} weight="bold" />
                            </button>
                          </>
                        )}
                        {job.status === 'error' && (
                          <button type="button" onClick={() => retryJob(job)}>{messages.retry}</button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}
        </section>

      </main>

      <footer className="site-footer">
        <button className="footer-text-link" type="button" onClick={() => setUsageGuideOpen(true)}>
          <Info size={14} weight="bold" />{messages.usageGuide}
        </button>
        <a className="footer-text-link" href={AUTHOR_HOME_URL} target="_blank" rel="noreferrer">
          <ArrowSquareOut size={14} weight="bold" />{messages.authorHomepage}
        </a>
        <button className="footer-text-link" type="button" onClick={() => setCliGuideOpen(true)}>
          <TerminalWindow size={14} weight="bold" />{messages.cliGuide}
        </button>
        <div className="donate-widget" ref={donateWidgetRef}>
          {donatePanelState !== 'closed' && (
            <aside
              id="donate-panel"
              className={`donate-popover${donatePanelPinned ? ' is-viewport-pinned' : ''}${donatePanelState === 'closing' ? ' is-closing' : ''}`}
              role="dialog"
              aria-label={messages.donateTitle}
              aria-hidden={donatePanelState === 'closing'}
              onAnimationEnd={(event) => {
                if (event.target === event.currentTarget && donatePanelState === 'closing') {
                  setDonatePanelState('closed')
                }
              }}
            >
              <section className="donate-section">
                <strong className="donate-popover-title">{messages.donateTitle}</strong>
                <p className="donate-copy">
                  <span className="donate-copy-line">{messages.donateIntro}</span>
                  <span className="donate-copy-line donate-praise-line">
                    <SpringScaleText text={donatePraise} locale={currentLanguage.htmlLang} />
                  </span>
                  <span className="donate-copy-line">{messages.donateRequest}</span>
                </p>
                <div className="donate-tabs" role="tablist" aria-label={messages.donateTitle}>
                  <button
                    className={donateMethod === 'wechat' ? 'active wechat' : 'wechat'}
                    type="button"
                    role="tab"
                    aria-selected={donateMethod === 'wechat'}
                    onClick={() => setDonateMethod('wechat')}
                  >
                    <ChatCircle size={15} weight="fill" />{messages.wechat}
                  </button>
                  <button
                    className={donateMethod === 'alipay' ? 'active alipay' : 'alipay'}
                    type="button"
                    role="tab"
                    aria-selected={donateMethod === 'alipay'}
                    onClick={() => setDonateMethod('alipay')}
                  >
                    <Wallet size={15} weight="fill" />{messages.alipay}
                  </button>
                </div>
                <div className="donate-qr-frame" role="tabpanel">
                  <img
                    src={`${import.meta.env.BASE_URL}donate/${donateMethod}-qr.webp`}
                    alt={messages.qrAlt(donateMethod === 'wechat' ? messages.wechat : messages.alipay)}
                  />
                </div>
              </section>
            </aside>
          )}
          <button
            ref={donateTriggerRef}
            className="footer-text-link donate-trigger"
            type="button"
            aria-controls="donate-panel"
            aria-expanded={donatePanelState === 'open'}
            onClick={() => {
              if (donatePanelState === 'open') {
                setDonatePanelState('closing')
                return
              }
              openDonatePanel(false)
            }}
          >
            <ThumbsUp size={14} weight="bold" />{messages.donateTitle}
          </button>
        </div>
      </footer>

      {toast && (
        <div className={`app-toast is-${toast.tone}`} role="status" aria-live="polite" aria-atomic="true">
          {toast.tone === 'success' ? <CheckCircle size={17} weight="fill" /> : <WarningCircle size={17} weight="fill" />}
          <span>{toast.message}</span>
        </div>
      )}

      {previewJob && previewJob.resultUrl && (
        <aside className="result-preview" aria-label={`${messages.preview} ${previewJob.file.name}`}>
          <header>
            <div>
              <strong title={previewJob.outputName ?? previewJob.file.name}>{previewJob.outputName ?? previewJob.file.name}</strong>
              <span>{previewJob.outputLabel}</span>
            </div>
            <button type="button" onClick={() => setPreviewJobId(null)} aria-label={messages.closePreview} title={messages.closePreview}>
              <X size={16} weight="bold" />
            </button>
          </header>
          {previewJob.kind === 'video' ? (
            previewJob.outputLabel === 'MP3' ? (
              <audio key={previewJob.resultUrl} src={previewJob.resultUrl} controls autoPlay />
            ) : (
              <video key={previewJob.resultUrl} src={previewJob.resultUrl} controls autoPlay playsInline />
            )
          ) : (
            <div className="image-preview-stage">
              <img src={previewJob.resultUrl} alt={previewJob.outputName ?? previewJob.file.name} />
              {previewableJobs.length > 1 && (
                <>
                  <button
                    className="preview-page previous"
                    type="button"
                    onClick={() => setPreviewJobId(previewableJobs[(previewIndex - 1 + previewableJobs.length) % previewableJobs.length].id)}
                    aria-label={messages.previousPreview}
                    title={messages.previousPreview}
                  ><CaretLeft size={17} weight="bold" /></button>
                  <button
                    className="preview-page next"
                    type="button"
                    onClick={() => setPreviewJobId(previewableJobs[(previewIndex + 1) % previewableJobs.length].id)}
                    aria-label={messages.nextPreview}
                    title={messages.nextPreview}
                  ><CaretRight size={17} weight="bold" /></button>
                </>
              )}
            </div>
          )}
        </aside>
      )}

      {cliGuideOpen && (
        <div className="usage-guide-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setCliGuideOpen(false)
        }}>
          <section className="usage-guide-dialog cli-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="cli-guide-title">
            <header>
              <h2 id="cli-guide-title">{messages.cliTitle}</h2>
              <button ref={cliGuideCloseRef} type="button" aria-label={messages.closeCliGuide} onClick={() => setCliGuideOpen(false)}>
                <X size={19} weight="bold" />
              </button>
            </header>
            <div className="usage-guide-content cli-guide-content">
              <p>{messages.cliIntro}</p>
              <div className="cli-command" aria-label={messages.cliInstallLabel}>
                <span>{messages.cliInstallLabel}</span>
                <div className="cli-command-row">
                  <code>{CLI_INSTALL_COMMAND}</code>
                  <button type="button" onClick={copyCliInstallCommand} aria-label={messages.copyCommand} title={messages.copyCommand}>
                    <CopySimple size={17} weight="bold" />
                  </button>
                </div>
              </div>
              <div className="guide-grid cli-guide-grid">
                <article><h4>{messages.cliFolderTitle}</h4><p>{messages.cliFolderText}</p><code>compreesor ./图片目录</code></article>
                <article><h4>{messages.cliPresetTitle}</h4><p>{messages.cliPresetText}</p><code>compreesor . --preset extreme</code></article>
                <article><h4>{messages.cliFormatTitle}</h4><p>{messages.cliFormatText}</p><code>compreesor . --format webp</code></article>
                <article><h4>{messages.cliReplaceTitle}</h4><p>{messages.cliReplaceText}</p><code>compreesor . --replace --yes</code></article>
              </div>
              <p className="cli-ai-tip">{messages.cliAiTip}</p>
              <a className="cli-package-link" href="https://www.npmjs.com/package/compreesor-cli" target="_blank" rel="noreferrer">
                npmjs.com/package/compreesor-cli <ArrowSquareOut size={14} weight="bold" />
              </a>
            </div>
          </section>
        </div>
      )}

      {usageGuideOpen && (
        <div className="usage-guide-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setUsageGuideOpen(false)
        }}>
          <section className="usage-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="usage-guide-title">
            <header>
              <h2 id="usage-guide-title">{messages.usageGuide}</h2>
              <button ref={usageGuideCloseRef} type="button" aria-label={messages.closeUsage} onClick={() => setUsageGuideOpen(false)}>
                <X size={19} weight="bold" />
              </button>
            </header>
            <div className="usage-guide-content">
              <h3>{messages.guideHeading}</h3>
              <p>{messages.guideIntro}</p>
              <div className="guide-grid">
                <article><h4>{messages.guideFormatTitle}</h4><p>{messages.guideFormatText}</p></article>
                <article><h4>{messages.guideQueueTitle}</h4><p>{messages.guideQueueText}</p></article>
                <article><h4>{messages.guideDownloadTitle}</h4><p>{messages.guideDownloadText}</p></article>
              </div>
              <nav className="guide-languages" aria-label={messages.languageListLabel}>
                {LANGUAGE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    className={locale === option.id ? 'active' : ''}
                    type="button"
                    lang={option.htmlLang}
                    onClick={() => { setLocale(option.id); persistLocale(option.id) }}
                  >{option.label}</button>
                ))}
              </nav>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default App

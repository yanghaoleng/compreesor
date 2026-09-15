import { CaretLeft, CaretRight, DownloadSimple, X } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  formatBytes,
  isPdfVariant,
  qualityLabel,
  type MediaJob,
  type ResultVariant,
} from '../jobDomain'
import type { Messages } from '../i18n'
import type { QualityPreset } from '../types'
import { AnimatedPercentage } from './AnimatedText'
import { CustomSelect } from './CustomSelect'

const COMMON_ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]
const MIN_PREVIEW_HEIGHT = 220
type PreviewDimensions = { width: number; height: number }

function clampScale(scale: number) {
  return Math.max(0.25, Math.min(5, scale))
}

function pdfPreviewUrl(url: string | null | undefined, scale: number, fitToView: boolean) {
  if (!url) return undefined
  const zoom = fitToView ? 'page-fit' : Math.round(scale * 100)
  return `${url}#page=1&zoom=${zoom}&toolbar=0&navpanes=0`
}

type PreviewPanelProps = {
  job: MediaJob
  jobs: MediaJob[]
  messages: Messages
  rememberedHeight: number | null
  pinned: boolean
  exiting: boolean
  onClose: () => void
  onSelect: (jobId: string) => void
  onDownload: (job: MediaJob, variant?: ResultVariant) => void
  onHeightChange: (height: number) => void
}

export function PreviewPanel({ job, jobs, messages, rememberedHeight, pinned, exiting, onClose, onSelect, onDownload, onHeightChange }: PreviewPanelProps) {
  const initialHeight = pinned ? rememberedHeight : MIN_PREVIEW_HEIGHT
  const [height, setHeight] = useState<number | null>(initialHeight)
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const [fitToView, setFitToView] = useState(false)
  const [previewDimensions, setPreviewDimensions] = useState<Record<string, PreviewDimensions>>({})
  const [resizeAffordanceActive, setResizeAffordanceActive] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLElement>(null)
  const heightRef = useRef<number | null>(initialHeight)
  const heightBeforeMaximizeRef = useRef<number | null>(null)
  const manuallyResizedRef = useRef(false)
  const resizeRef = useRef<{ pointerId: number; clientY: number; height: number; moved: boolean } | null>(null)
  const dragRef = useRef<{ pointerId: number; clientX: number; clientY: number; x: number; y: number } | null>(null)
  const index = jobs.findIndex((candidate) => candidate.id === job.id)
  const supportsImageView = (job.kind === 'image' || job.kind === 'gif')
    && (job.variants.length === 0 || job.variants.every((variant) => !isPdfVariant(variant)))
  const supportsPdfView = job.kind === 'pdf'
    || job.outputLabel === 'PDF'
    || (job.variants.length > 0 && job.variants.every(isPdfVariant))
  const supportsZoomControls = supportsImageView || supportsPdfView

  useEffect(() => {
    setView({ scale: 1, x: 0, y: 0 })
    setFitToView(false)
    dragRef.current = null
    resizeRef.current = null
  }, [job.id])

  const rememberDimensions = useCallback((key: string, width: number, height: number) => {
    if (width <= 0 || height <= 0) return
    setPreviewDimensions((current) => {
      const previous = current[key]
      if (previous?.width === width && previous.height === height) return current
      return { ...current, [key]: { width, height } }
    })
  }, [])

  useEffect(() => {
    const nextHeight = pinned ? rememberedHeight : MIN_PREVIEW_HEIGHT
    heightRef.current = nextHeight
    setHeight(nextHeight)
  }, [pinned, rememberedHeight])

  useEffect(() => {
    const keepBelowSelectedFile = () => {
      if (manuallyResizedRef.current) return
      const panel = panelRef.current
      const selectedRow = document.querySelector<HTMLElement>(`[data-job-id="${CSS.escape(job.id)}"]`)
      if (!panel || !selectedRow) return
      const selectedBottom = selectedRow.getBoundingClientRect().bottom
      const availableHeight = Math.max(MIN_PREVIEW_HEIGHT, Math.floor(window.innerHeight - selectedBottom - 16))
      const currentHeight = heightRef.current ?? panel.getBoundingClientRect().height
      if (currentHeight <= availableHeight) return
      heightRef.current = availableHeight
      setHeight(availableHeight)
    }

    const handleWindowResize = () => window.requestAnimationFrame(keepBelowSelectedFile)
    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [job.id])

  useEffect(() => {
    const panel = panelRef.current
    const shell = panel?.closest<HTMLElement>('.app-shell')
    if (!panel || !shell) return

    const updateOccupiedHeight = () => {
      shell.style.setProperty('--preview-occupied-height', `${panel.offsetHeight}px`)
    }
    updateOccupiedHeight()
    const observer = new ResizeObserver(updateOccupiedHeight)
    observer.observe(panel)
    return () => {
      observer.disconnect()
      shell.style.removeProperty('--preview-occupied-height')
    }
  }, [])

  const toggleMaxHeight = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault()
    const panel = panelRef.current
    if (!panel) return
    manuallyResizedRef.current = true
    const maximumHeight = Math.max(MIN_PREVIEW_HEIGHT, window.innerHeight - 48)
    const currentHeight = panel.getBoundingClientRect().height
    const currentTargetHeight = heightRef.current ?? currentHeight
    const isMaximum = Math.abs(currentTargetHeight - maximumHeight) <= 2
    let nextHeight = maximumHeight

    if (isMaximum) {
      nextHeight = Math.min(
        heightBeforeMaximizeRef.current ?? rememberedHeight ?? MIN_PREVIEW_HEIGHT,
        maximumHeight,
      )
    } else {
      heightBeforeMaximizeRef.current = currentHeight
    }

    heightRef.current = nextHeight
    setHeight(nextHeight)
    onHeightChange(nextHeight)
  }, [onHeightChange, rememberedHeight])

  const beginResize = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    manuallyResizedRef.current = true
    setIsResizing(true)
    setResizeAffordanceActive(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeRef.current = {
      pointerId: event.pointerId,
      clientY: event.clientY,
      height: panelRef.current?.getBoundingClientRect().height ?? 420,
      moved: false,
    }
  }, [])

  const moveResize = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const resize = resizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    if (!resize.moved) {
      if (Math.abs(event.clientY - resize.clientY) <= 3) return
      resize.moved = true
      heightBeforeMaximizeRef.current = null
    }
    const maxHeight = Math.max(MIN_PREVIEW_HEIGHT, window.innerHeight - 48)
    const nextHeight = Math.max(MIN_PREVIEW_HEIGHT, Math.min(maxHeight, resize.height + resize.clientY - event.clientY))
    heightRef.current = nextHeight
    setHeight(nextHeight)
  }, [])

  const endResize = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (resizeRef.current?.pointerId !== event.pointerId) return
    resizeRef.current = null
    setIsResizing(false)
    setResizeAffordanceActive(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (heightRef.current !== null) onHeightChange(heightRef.current)
  }, [onHeightChange])

  const isHeaderControl = useCallback((target: EventTarget | null) => (
    target instanceof Element && Boolean(target.closest('.preview-title, .preview-header-actions'))
  ), [])

  const beginHeaderResize = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (isHeaderControl(event.target)) return
    beginResize(event)
  }, [beginResize, isHeaderControl])

  const moveHeaderResize = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (resizeRef.current) {
      moveResize(event)
      return
    }
    setResizeAffordanceActive(!isHeaderControl(event.target))
  }, [isHeaderControl, moveResize])

  const endHeaderResize = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!resizeRef.current) return
    endResize(event)
  }, [endResize])

  const toggleHeaderMaxHeight = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (isHeaderControl(event.target)) return
    toggleMaxHeight(event)
  }, [isHeaderControl, toggleMaxHeight])

  const beginDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button, select'))) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      x: view.x,
      y: view.y,
    }
  }, [view.x, view.y])

  const moveDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setView((current) => ({
      ...current,
      x: drag.x + event.clientX - drag.clientX,
      y: drag.y + event.clientY - drag.clientY,
    }))
  }, [])

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  const stepZoom = useCallback((delta: number) => {
    setFitToView(false)
    setView((current) => ({
      ...current,
      scale: clampScale((fitToView ? 1 : current.scale) + delta),
    }))
  }, [fitToView])

  const selectZoom = useCallback((value: string) => {
    if (value === 'fit') {
      setFitToView(true)
      setView({ scale: 1, x: 0, y: 0 })
      return
    }
    const scale = Number(value)
    if (!Number.isFinite(scale)) return
    setFitToView(false)
    setView({ scale: clampScale(scale), x: 0, y: 0 })
  }, [])

  const wheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const stage = event.currentTarget
    const stageBox = stage.getBoundingClientRect()
    const image = stage.querySelector('img')
    const pointerX = event.clientX - stageBox.left - stageBox.width / 2
    const pointerY = event.clientY - stageBox.top - stageBox.height / 2
    const fitScale = fitToView && image instanceof HTMLImageElement && image.naturalWidth > 0
      ? Math.min(stageBox.width / image.naturalWidth, stageBox.height / image.naturalHeight)
      : 1
    setFitToView(false)
    setView((current) => {
      const previousScale = fitToView ? fitScale : current.scale
      const previousX = fitToView ? 0 : current.x
      const previousY = fitToView ? 0 : current.y
      const nextScale = clampScale(previousScale + (event.deltaY < 0 ? 0.25 : -0.25))
      const zoomRatio = nextScale / previousScale
      return {
        scale: nextScale,
        x: pointerX - (pointerX - previousX) * zoomRatio,
        y: pointerY - (pointerY - previousY) * zoomRatio,
      }
    })
  }, [fitToView])

  useEffect(() => {
    const handlePreviewShortcut = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      const target = event.target
      const isInteractiveTarget = target instanceof Element
        && Boolean(target.closest('button, a, input, select, textarea, [contenteditable="true"]'))
      if (event.key === 'Enter') {
        if (isInteractiveTarget) return
        event.preventDefault()
        void onDownload(job)
        return
      }
      if (!supportsZoomControls || isInteractiveTarget || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === '=' || event.key === '+') {
        event.preventDefault()
        stepZoom(0.25)
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        stepZoom(-0.25)
      }
    }
    window.addEventListener('keydown', handlePreviewShortcut)
    return () => window.removeEventListener('keydown', handlePreviewShortcut)
  }, [job, onClose, onDownload, stepZoom, supportsZoomControls])

  const zoomValue = fitToView ? 'fit' : String(view.scale)
  const isCommonZoomLevel = COMMON_ZOOM_LEVELS.includes(view.scale)
  const zoomOptions = [
    { value: 'fit', label: messages.fitPreview },
    ...(!fitToView && !isCommonZoomLevel
      ? [{ value: zoomValue, label: `${Math.round(view.scale * 100)}%` }]
      : []),
    ...COMMON_ZOOM_LEVELS.map((scale) => ({ value: String(scale), label: `${Math.round(scale * 100)}%` })),
  ]
  const showComparison = job.variants.length > 1 || (jobs.length === 1 && job.variants.length === 1)
  const originalDimensions = previewDimensions[job.originalUrl]
  const dimensionsChanged = (variant: ResultVariant) => {
    const compressed = previewDimensions[variant.url]
    return Boolean(
      originalDimensions
      && compressed
      && (originalDimensions.width !== compressed.width || originalDimensions.height !== compressed.height),
    )
  }
  const hasDimensionChange = job.variants.some(dimensionsChanged)
  return (
    <aside
      className={`result-preview${showComparison ? ' is-comparison' : ''}${height !== null ? ' is-resized' : ''}${pinned ? ' is-pinned' : ' is-transient'}${exiting ? ' is-exiting' : ''}${resizeAffordanceActive ? ' is-resize-active' : ''}${isResizing ? ' is-resizing' : ''}`}
      ref={panelRef}
      style={height !== null ? { height: `${height}px` } : undefined}
      aria-label={`${messages.preview} ${job.file.name}`}
      aria-hidden={exiting || undefined}
    >
      <div
        className="preview-resize-handle"
        role="separator"
        aria-orientation="horizontal"
        aria-label={messages.resizePreview}
        aria-valuemin={MIN_PREVIEW_HEIGHT}
        aria-valuemax={Math.max(MIN_PREVIEW_HEIGHT, window.innerHeight - 48)}
        aria-valuenow={Math.round(height ?? MIN_PREVIEW_HEIGHT)}
        title={messages.resizePreview}
        onPointerEnter={() => setResizeAffordanceActive(true)}
        onPointerLeave={() => {
          if (!resizeRef.current) setResizeAffordanceActive(false)
        }}
        onPointerDown={beginResize}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        onDoubleClick={toggleMaxHeight}
      />
      <header
        onPointerDown={beginHeaderResize}
        onPointerMove={moveHeaderResize}
        onPointerUp={endHeaderResize}
        onPointerCancel={endHeaderResize}
        onPointerLeave={() => {
          if (!resizeRef.current) setResizeAffordanceActive(false)
        }}
        onDoubleClick={toggleHeaderMaxHeight}
      >
        <div className="preview-title">
          <strong title={job.file.name}>{job.file.name}</strong>
          <span className="preview-source-size">{formatBytes(job.file.size)}</span>
        </div>
        <div className="preview-header-actions">
          {supportsZoomControls ? (
            <div className="comparison-toolbar">
              <button type="button" onClick={() => stepZoom(-0.25)} aria-label={messages.zoomOut} title={`${messages.zoomOut} (-)`}>−</button>
              <CustomSelect
                value={zoomValue}
                options={zoomOptions}
                onChange={selectZoom}
                ariaLabel={fitToView ? messages.fitPreview : view.scale === 1 ? messages.zoomReset : messages.zoomLevel}
                className="zoom-select"
              />
              <button type="button" onClick={() => stepZoom(0.25)} aria-label={messages.zoomIn} title={`${messages.zoomIn} (=)`}>＋</button>
            </div>
          ) : null}
          <button className="preview-close" type="button" onClick={onClose} aria-label={messages.closePreview} title={messages.closePreview}>
            <X size={16} weight="bold" />
          </button>
        </div>
      </header>
      {showComparison ? (
        <div className={`comparison-grid${job.variants.length === 1 ? ' is-two-up' : ''}`}>
          <article className="comparison-card is-original" data-comparison-kind="original">
            <header>
              <div className="comparison-download-row comparison-original-row" title={messages.originalFile}>
                <span className="comparison-summary">
                  <strong className="comparison-size">{formatBytes(job.file.size)}</strong>
                  {hasDimensionChange && originalDimensions ? (
                    <span className="comparison-dimensions is-original-dimensions">{originalDimensions.width} × {originalDimensions.height}</span>
                  ) : null}
                  <span className="comparison-ratio is-original-label">{messages.originalFile}</span>
                </span>
              </div>
            </header>
            {job.kind === 'video' ? (
              <video
                src={job.originalUrl}
                controls
                playsInline
                onLoadedMetadata={(event) => rememberDimensions(job.originalUrl, event.currentTarget.videoWidth, event.currentTarget.videoHeight)}
              />
            ) : job.kind === 'pdf' ? (
              <iframe src={pdfPreviewUrl(job.originalUrl, view.scale, fitToView)} title={`${job.file.name} ${messages.originalFile}`} />
            ) : (
              <div
                className={`comparison-image-stage${fitToView ? ' is-fit' : ''}`}
                onPointerDown={beginDrag}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onWheel={wheel}
              >
                <img
                  src={job.originalUrl}
                  alt={`${job.file.name} ${messages.originalFile}`}
                  draggable={false}
                  onLoad={(event) => rememberDimensions(job.originalUrl, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}
                  style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale}) translate(-50%, -50%)` }}
                />
              </div>
            )}
          </article>
          {job.variants.map((variant) => {
            const compressedDimensions = previewDimensions[variant.url]
            const showDimensions = dimensionsChanged(variant) && compressedDimensions
            return (
              <article className="comparison-card" data-comparison-kind={variant.preset} key={variant.preset}>
                <header>
                  <button className="comparison-download-row" type="button" onClick={() => onDownload(job, variant)} aria-label={`${messages.download} ${qualityLabel(variant.preset as QualityPreset, messages)}`}>
                    <span className="comparison-summary">
                      <strong className="comparison-size">{formatBytes(variant.blob.size)}</strong>
                      {showDimensions ? (
                        <span className="comparison-dimensions">{compressedDimensions.width} × {compressedDimensions.height}</span>
                      ) : null}
                      <AnimatedPercentage
                        value={job.file.size > 0 ? Math.round((variant.blob.size / job.file.size) * 100) : 0}
                        className="comparison-ratio"
                      />
                    </span>
                    <DownloadSimple className="comparison-download-icon" size={14} weight="bold" />
                  </button>
                </header>
                {job.kind === 'video' ? (
                  variant.outputLabel === 'MP3' ? (
                    <audio src={variant.previewUrl ?? variant.url} controls />
                  ) : (
                    <video
                      src={variant.previewUrl ?? variant.url}
                      controls
                      playsInline
                      onLoadedMetadata={(event) => rememberDimensions(variant.url, event.currentTarget.videoWidth, event.currentTarget.videoHeight)}
                    />
                  )
                ) : isPdfVariant(variant) ? (
                  <iframe src={pdfPreviewUrl(variant.previewUrl ?? variant.url, view.scale, fitToView)} title={`${qualityLabel(variant.preset as QualityPreset, messages)} PDF`} />
                ) : (
                  <div
                    className={`comparison-image-stage${fitToView ? ' is-fit' : ''}`}
                    onPointerDown={beginDrag}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onWheel={wheel}
                  >
                    <img
                      src={variant.previewUrl ?? variant.url}
                      alt={`${job.file.name} ${qualityLabel(variant.preset as QualityPreset, messages)}`}
                      draggable={false}
                      onLoad={(event) => rememberDimensions(variant.url, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}
                      style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale}) translate(-50%, -50%)` }}
                    />
                  </div>
                )}
              </article>
            )
          })}
        </div>
      ) : job.kind === 'video' ? (
        job.outputLabel === 'MP3' ? (
          <audio key={job.resultUrl} src={job.resultUrl ?? undefined} controls autoPlay />
        ) : (
          <video key={job.resultUrl} src={job.resultUrl ?? undefined} controls autoPlay playsInline />
        )
      ) : job.kind === 'pdf' || job.outputLabel === 'PDF' ? (
        <iframe className="pdf-preview-frame" src={pdfPreviewUrl(job.resultUrl, view.scale, fitToView)} title={job.file.name} />
      ) : (
        <div
          className={`image-preview-stage is-pannable${fitToView ? ' is-fit' : ''}`}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={wheel}
        >
          <img
            src={job.resultUrl ?? undefined}
            alt={job.file.name}
            draggable={false}
            style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale}) translate(-50%, -50%)` }}
          />
        </div>
      )}
      {!showComparison && supportsImageView && jobs.length > 1 ? (
        <>
          <button
            className="preview-page previous"
            type="button"
            onClick={() => onSelect(jobs[(index - 1 + jobs.length) % jobs.length].id)}
            aria-label={messages.previousPreview}
            title={messages.previousPreview}
          ><CaretLeft size={17} weight="bold" /></button>
          <button
            className="preview-page next"
            type="button"
            onClick={() => onSelect(jobs[(index + 1) % jobs.length].id)}
            aria-label={messages.nextPreview}
            title={messages.nextPreview}
          ><CaretRight size={17} weight="bold" /></button>
        </>
      ) : null}
    </aside>
  )
}

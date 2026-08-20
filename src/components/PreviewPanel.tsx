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

const COMMON_ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]

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
  pinned: boolean
  onClose: () => void
  onSelect: (jobId: string) => void
  onDownload: (job: MediaJob, variant?: ResultVariant) => void
}

export function PreviewPanel({ job, jobs, messages, pinned, onClose, onSelect, onDownload }: PreviewPanelProps) {
  const [height, setHeight] = useState<number | null>(null)
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const [fitToView, setFitToView] = useState(false)
  const panelRef = useRef<HTMLElement>(null)
  const resizeRef = useRef<{ pointerId: number; clientY: number; height: number } | null>(null)
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
    setHeight(null)
    dragRef.current = null
    resizeRef.current = null
  }, [job.id])

  const beginResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeRef.current = {
      pointerId: event.pointerId,
      clientY: event.clientY,
      height: panelRef.current?.getBoundingClientRect().height ?? 420,
    }
  }, [])

  const moveResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    const maxHeight = Math.max(220, window.innerHeight - 48)
    setHeight(Math.max(220, Math.min(maxHeight, resize.height + resize.clientY - event.clientY)))
  }, [])

  const endResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (resizeRef.current?.pointerId !== event.pointerId) return
    resizeRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

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
    setFitToView(false)
    setView((current) => ({
      ...current,
      scale: clampScale((fitToView ? 1 : current.scale) + (event.deltaY < 0 ? 0.25 : -0.25)),
    }))
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
  const zoomHint = job.variants.length > 1
    ? supportsImageView ? messages.dragZoomHint : messages.syncZoomHint
    : messages.zoomHint

  return (
    <aside
      className={`result-preview${job.variants.length > 1 ? ' is-comparison' : ''}${height !== null ? ' is-resized' : ''}${pinned ? ' is-pinned' : ' is-transient'}`}
      ref={panelRef}
      style={height !== null ? { height: `${height}px` } : undefined}
      aria-label={`${messages.preview} ${job.file.name}`}
    >
      <div
        className="preview-resize-handle"
        role="separator"
        aria-label={messages.resizePreview}
        title={messages.resizePreview}
        onPointerDown={beginResize}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      />
      <header>
        <div>
          <strong title={job.file.name}>{job.file.name}</strong>
          <span>{job.outputLabel}</span>
        </div>
        <button type="button" onClick={onClose} aria-label={messages.closePreview} title={messages.closePreview}>
          <X size={16} weight="bold" />
        </button>
      </header>
      {supportsZoomControls ? (
        <div className="comparison-toolbar">
          <span>{zoomHint}</span>
          <div>
            <button type="button" onClick={() => stepZoom(-0.25)} aria-label={messages.zoomOut} title={`${messages.zoomOut} (-)`}>−</button>
            <select
              value={zoomValue}
              onChange={(event) => selectZoom(event.target.value)}
              aria-label={messages.zoomLevel}
              title={fitToView ? messages.fitPreview : view.scale === 1 ? messages.zoomReset : messages.zoomLevel}
            >
              {!fitToView && !isCommonZoomLevel ? <option value={zoomValue}>{Math.round(view.scale * 100)}%</option> : null}
              {COMMON_ZOOM_LEVELS.map((scale) => <option key={scale} value={scale}>{Math.round(scale * 100)}%</option>)}
              <option value="fit">{messages.fitPreview}</option>
            </select>
            <button type="button" onClick={() => stepZoom(0.25)} aria-label={messages.zoomIn} title={`${messages.zoomIn} (=)`}>＋</button>
          </div>
        </div>
      ) : null}
      {job.variants.length > 1 ? (
        <div className="comparison-grid">
          {job.variants.map((variant) => (
            <article className="comparison-card" key={variant.preset}>
              <header>
                <button type="button" onClick={() => onDownload(job, variant)} aria-label={`${messages.download} ${qualityLabel(variant.preset as QualityPreset, messages)}`}>
                  <DownloadSimple size={13} weight="bold" />
                </button>
                <div>
                  <strong>{qualityLabel(variant.preset as QualityPreset, messages)}</strong>
                  <span>{formatBytes(job.file.size)} → {formatBytes(variant.blob.size)}</span>
                </div>
              </header>
              {job.kind === 'video' ? (
                variant.outputLabel === 'MP3' ? (
                  <audio src={variant.previewUrl ?? variant.url} controls />
                ) : (
                  <video src={variant.previewUrl ?? variant.url} controls playsInline />
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
                    style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }}
                  />
                </div>
              )}
            </article>
          ))}
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
            style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }}
          />
          {jobs.length > 1 ? (
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
        </div>
      )}
    </aside>
  )
}

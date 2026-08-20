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

type PreviewPanelProps = {
  job: MediaJob
  jobs: MediaJob[]
  messages: Messages
  onClose: () => void
  onSelect: (jobId: string) => void
  onDownload: (job: MediaJob, variant?: ResultVariant) => void
}

export function PreviewPanel({ job, jobs, messages, onClose, onSelect, onDownload }: PreviewPanelProps) {
  const [height, setHeight] = useState<number | null>(null)
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const panelRef = useRef<HTMLElement>(null)
  const resizeRef = useRef<{ pointerId: number; clientY: number; height: number } | null>(null)
  const dragRef = useRef<{ pointerId: number; clientX: number; clientY: number; x: number; y: number } | null>(null)
  const index = jobs.findIndex((candidate) => candidate.id === job.id)
  const supportsSynchronizedView = job.variants.length > 1
    && (job.kind === 'image' || job.kind === 'gif')
    && job.variants.every((variant) => !isPdfVariant(variant))

  useEffect(() => {
    setView({ scale: 1, x: 0, y: 0 })
    setHeight(null)
    dragRef.current = null
    resizeRef.current = null
  }, [job.id])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

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
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
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

  const zoom = useCallback((nextScale: number) => {
    setView((current) => ({ ...current, scale: Math.max(1, Math.min(5, nextScale)) }))
  }, [])

  const wheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    setView((current) => ({
      ...current,
      scale: Math.max(1, Math.min(5, current.scale + (event.deltaY < 0 ? 0.25 : -0.25))),
    }))
  }, [])

  return (
    <aside
      className={`result-preview${job.variants.length > 1 ? ' is-comparison' : ''}${height !== null ? ' is-resized' : ''}`}
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
      {supportsSynchronizedView ? (
        <div className="comparison-toolbar">
          <span>{messages.dragZoomHint}</span>
          <div>
            <button type="button" onClick={() => zoom(view.scale - 0.25)} aria-label={messages.zoomOut} title={messages.zoomOut}>−</button>
            <button type="button" onClick={() => setView({ scale: 1, x: 0, y: 0 })} aria-label={messages.zoomReset} title={messages.zoomReset}>{Math.round(view.scale * 100)}%</button>
            <button type="button" onClick={() => zoom(view.scale + 0.25)} aria-label={messages.zoomIn} title={messages.zoomIn}>＋</button>
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
                <iframe src={`${variant.previewUrl ?? variant.url}#page=1&toolbar=0&navpanes=0`} title={`${qualityLabel(variant.preset as QualityPreset, messages)} PDF`} />
              ) : (
                <div
                  className="comparison-image-stage"
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
        <iframe className="pdf-preview-frame" src={`${job.resultUrl}#page=1&toolbar=0&navpanes=0`} title={job.file.name} />
      ) : (
        <div className="image-preview-stage">
          <img src={job.resultUrl ?? undefined} alt={job.file.name} />
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

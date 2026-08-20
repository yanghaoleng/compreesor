import {
  CheckCircle,
  DownloadSimple,
  Eye,
  FileImage,
  FilePdf,
  FilmStrip,
  SpinnerGap,
  WarningCircle,
} from '@phosphor-icons/react'
import { useEffect, useRef } from 'react'
import type { Messages } from '../i18n'
import {
  formatBytes,
  isPdfVariant,
  kindLabel,
  qualityLabel,
  statusText,
  type MediaJob,
  type ResultVariant,
} from '../jobDomain'
import type { Locale } from '../i18n'
import type { QualityPreset } from '../types'
import { AnimatedPercentage, AnimatedPercentageRange } from './AnimatedText'

type JobListProps = {
  jobs: MediaJob[]
  locale: Locale
  messages: Messages
  onDownload: (job: MediaJob, variant?: ResultVariant) => void | Promise<void>
  onPreview: (jobId: string) => void
  onRetry: (job: MediaJob) => void | Promise<void>
}

export function JobList({ jobs, locale, messages, onDownload, onPreview, onRetry }: JobListProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const previousProcessingIdsRef = useRef(new Set<string>())

  useEffect(() => {
    const processingIds = new Set(
      jobs.filter((job) => job.status === 'processing').map((job) => job.id),
    )
    const newlyProcessingId = [...processingIds].find(
      (id) => !previousProcessingIdsRef.current.has(id),
    )
    previousProcessingIdsRef.current = processingIds
    if (!newlyProcessingId) return

    const frame = window.requestAnimationFrame(() => {
      const list = listRef.current
      const row = list?.querySelector<HTMLElement>(`[data-job-id="${newlyProcessingId}"]`)
      if (!list || !row) return
      const listRect = list.getBoundingClientRect()
      const rowRect = row.getBoundingClientRect()
      const topOffset = rowRect.top - listRect.top - 8
      const bottomOffset = rowRect.bottom - listRect.bottom + 8
      const topTarget = topOffset < 0 ? topOffset : bottomOffset > 0 ? bottomOffset : 0
      if (topTarget === 0) return
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      list.scrollBy({ top: topTarget, behavior: reducedMotion ? 'auto' : 'smooth' })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [jobs])

  return (
    <div className="job-list" ref={listRef}>
      {jobs.map((job) => {
        const outputBytes = job.resultBlob?.size ?? 0
        const outputRatio = outputBytes > 0 ? Math.round((outputBytes / job.file.size) * 100) : 0
        const extremeVariant = job.variants.find((variant) => variant.preset === 'extreme')
        const losslessVariant = job.variants.find((variant) => variant.preset === 'lossless')
        const extremeRatio = extremeVariant ? Math.round((extremeVariant.blob.size / job.file.size) * 100) : 0
        const losslessRatio = losslessVariant ? Math.round((losslessVariant.blob.size / job.file.size) * 100) : 0

        return (
          <article
            className={`job-row status-${job.status}${job.variants.length > 1 ? ' has-variants' : ''}`}
            data-job-id={job.id}
            key={job.id}
          >
            <div className="thumbnail" aria-hidden="true">
              {job.thumbnailUrl ? (
                <img src={job.thumbnailUrl} alt="" />
              ) : job.kind === 'video' ? (
                <FilmStrip size={25} />
              ) : job.kind === 'pdf' ? (
                <FilePdf size={25} />
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
              {job.status === 'error' ? (
                <small className="error-text">
                  {locale === 'zh' || locale === 'zh-Hant' ? job.error : messages.failed}
                </small>
              ) : null}
            </div>

            {job.status === 'done' && job.variants.length > 1 ? (
              <div className="variant-results" aria-label={messages.allQualities}>
                {job.variants.map((variant) => (
                  <div className="variant-result-item" key={variant.preset} tabIndex={0}>
                    <b>{qualityLabel(variant.preset as QualityPreset, messages)}</b>
                    <small>{formatBytes(variant.blob.size)}</small>
                    <div className="variant-hover-preview">
                      <span className="actual-size-badge">1:1</span>
                      {job.kind === 'video' ? (
                        variant.outputLabel === 'MP3'
                          ? <audio src={variant.previewUrl ?? variant.url} controls />
                          : <video src={variant.previewUrl ?? variant.url} muted playsInline />
                      ) : isPdfVariant(variant) ? (
                        <iframe src={`${variant.previewUrl ?? variant.url}#page=1&toolbar=0&navpanes=0`} title={`${qualityLabel(variant.preset as QualityPreset, messages)} PDF`} />
                      ) : (
                        <div className="actual-size-viewport">
                          <img src={variant.previewUrl ?? variant.url} alt={`${job.file.name} ${qualityLabel(variant.preset as QualityPreset, messages)}`} />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => onDownload(job, variant)}
                        aria-label={`${messages.download} ${qualityLabel(variant.preset as QualityPreset, messages)}`}
                        title={messages.download}
                      >
                        <DownloadSimple size={13} weight="bold" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="job-state">
              {job.status === 'processing' ? (
                <span className="processing-state" title={statusText(job, messages)}>
                  <SpinnerGap className="spin" size={17} />
                  <span>{job.progress}%</span>
                </span>
              ) : null}
              {job.status === 'queued' ? (
                <span className="processing-state">
                  <span className="queue-dot" />
                  <span>{job.progress}%</span>
                </span>
              ) : null}
              {job.status === 'done' ? (
                <>
                  <CheckCircle size={18} weight="fill" />
                  <span title={job.outputLabel ?? undefined}>
                    {job.allQualities && extremeVariant && losslessVariant
                      ? <AnimatedPercentageRange from={extremeRatio} to={losslessRatio} />
                      : job.kind === 'image' || job.kind === 'pdf'
                        ? <AnimatedPercentage value={outputRatio} />
                        : job.outputLabel}
                  </span>
                </>
              ) : null}
              {job.status === 'error' ? <WarningCircle size={21} weight="fill" /> : null}
            </div>

            <div className="job-action">
              {job.status === 'done' ? (
                <>
                  <button
                    type="button"
                    onClick={() => onPreview(job.id)}
                    aria-label={`${messages.preview} ${job.file.name}`}
                    title={messages.preview}
                  >
                    <Eye size={15} weight="bold" />
                  </button>
                  {job.variants.length <= 1 ? (
                    <button
                      type="button"
                      onClick={() => onDownload(job)}
                      aria-label={`${job.resultPath && window.compreesorDesktop ? messages.reveal : messages.download} ${job.file.name}`}
                      title={job.resultPath && window.compreesorDesktop ? messages.reveal : messages.download}
                    >
                      <DownloadSimple size={15} weight="bold" />
                    </button>
                  ) : null}
                </>
              ) : null}
              {job.status === 'error' ? (
                <button type="button" onClick={() => onRetry(job)}>{messages.retry}</button>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}

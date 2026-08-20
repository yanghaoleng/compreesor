import {
  CheckCircle,
  DownloadSimple,
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
  selectedJobId: string | null
  onPreviewHover: (jobId: string | null) => void
  onPreviewPin: (jobId: string) => void
  onRetry: (job: MediaJob) => void | Promise<void>
}

export function JobList({
  jobs,
  locale,
  messages,
  onDownload,
  selectedJobId,
  onPreviewHover,
  onPreviewPin,
  onRetry,
}: JobListProps) {
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

  const selectAdjacentJob = (jobId: string, direction: -1 | 1) => {
    const selectableJobs = jobs.filter((job) => job.status === 'done' && job.resultUrl)
    const currentIndex = selectableJobs.findIndex((job) => job.id === jobId)
    if (currentIndex < 0 || selectableJobs.length === 0) return
    const nextJob = selectableJobs[(currentIndex + direction + selectableJobs.length) % selectableJobs.length]
    onPreviewPin(nextJob.id)
    window.requestAnimationFrame(() => {
      const nextRow = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-job-id]') ?? [])]
        .find((row) => row.dataset.jobId === nextJob.id)
      nextRow?.focus({ preventScroll: true })
      nextRow?.scrollIntoView({ block: 'nearest' })
    })
  }

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
            className={`job-row status-${job.status}${job.variants.length > 1 ? ' has-variants' : ''}${selectedJobId === job.id ? ' is-selected' : ''}`}
            data-job-id={job.id}
            key={job.id}
            tabIndex={job.status === 'done' && job.resultUrl ? 0 : undefined}
            aria-current={selectedJobId === job.id ? 'true' : undefined}
            onPointerEnter={() => {
              if (job.status === 'done' && job.resultUrl) onPreviewHover(job.id)
            }}
            onPointerLeave={() => onPreviewHover(null)}
            onClick={(event) => {
              if (job.status !== 'done' || !job.resultUrl) return
              if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea')) return
              onPreviewPin(job.id)
              event.currentTarget.focus({ preventScroll: true })
            }}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return
              if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
              event.preventDefault()
              selectAdjacentJob(job.id, event.key === 'ArrowDown' ? 1 : -1)
            }}
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
                  <div
                    className="variant-result-item"
                    key={variant.preset}
                  >
                    <b>{qualityLabel(variant.preset as QualityPreset, messages)}</b>
                    <small>{formatBytes(variant.blob.size)}</small>
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
                job.variants.length <= 1 ? (
                  <button
                    type="button"
                    onClick={() => onDownload(job)}
                    aria-label={`${job.resultPath && window.compreesorDesktop ? messages.reveal : messages.download} ${job.file.name}`}
                    title={job.resultPath && window.compreesorDesktop ? messages.reveal : messages.download}
                  >
                    <DownloadSimple size={15} weight="bold" />
                  </button>
                ) : null
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

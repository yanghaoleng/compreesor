import { ArrowSquareOut, CopySimple, X } from '@phosphor-icons/react'
import { useEffect, useRef } from 'react'
import { LANGUAGE_OPTIONS, type Locale, type Messages } from '../i18n'

export const CLI_INSTALL_COMMAND = 'npm install -g compreesor-cli'

type GuideDialogsProps = {
  cliOpen: boolean
  locale: Locale
  messages: Messages
  usageOpen: boolean
  onCliClose: () => void
  onCopyCliCommand: () => void
  onLocaleChange: (locale: Locale) => void
  onUsageClose: () => void
}

export function GuideDialogs({
  cliOpen,
  locale,
  messages,
  usageOpen,
  onCliClose,
  onCopyCliCommand,
  onLocaleChange,
  onUsageClose,
}: GuideDialogsProps) {
  const usageCloseRef = useRef<HTMLButtonElement>(null)
  const cliCloseRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!usageOpen && !cliOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => {
      if (usageOpen) usageCloseRef.current?.focus()
      else cliCloseRef.current?.focus()
    })
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (usageOpen) onUsageClose()
      else onCliClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [cliOpen, onCliClose, onUsageClose, usageOpen])

  return (
    <>
      {cliOpen ? (
        <div className="usage-guide-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) onCliClose()
        }}>
          <section className="usage-guide-dialog cli-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="cli-guide-title">
            <header>
              <h2 id="cli-guide-title">{messages.cliTitle}</h2>
              <button ref={cliCloseRef} type="button" aria-label={messages.closeCliGuide} onClick={onCliClose}>
                <X size={19} weight="bold" />
              </button>
            </header>
            <div className="usage-guide-content cli-guide-content">
              <p>{messages.cliIntro}</p>
              <div className="cli-command" aria-label={messages.cliInstallLabel}>
                <span>{messages.cliInstallLabel}</span>
                <div className="cli-command-row">
                  <code>{CLI_INSTALL_COMMAND}</code>
                  <button type="button" onClick={onCopyCliCommand} aria-label={messages.copyCommand} title={messages.copyCommand}>
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
      ) : null}

      {usageOpen ? (
        <div className="usage-guide-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) onUsageClose()
        }}>
          <section className="usage-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="usage-guide-title">
            <header>
              <h2 id="usage-guide-title">{messages.usageGuide}</h2>
              <button ref={usageCloseRef} type="button" aria-label={messages.closeUsage} onClick={onUsageClose}>
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
                    onClick={() => onLocaleChange(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </nav>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}

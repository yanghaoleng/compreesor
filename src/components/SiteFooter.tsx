import { ArrowSquareOut, ChatCircle, Info, TerminalWindow, ThumbsUp, Wallet } from '@phosphor-icons/react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Messages } from '../i18n'
import { SpringScaleText } from './AnimatedText'

const AUTHOR_HOME_URL = 'https://mikeywa.icu/'

export type SiteFooterHandle = {
  openDonation: () => void
}

type SiteFooterProps = {
  htmlLang: string
  messages: Messages
  onOpenCliGuide: () => void
  onOpenUsageGuide: () => void
}

function isElementInViewport(element: Element | null) {
  if (!element) return false
  const bounds = element.getBoundingClientRect()
  return bounds.bottom > 0
    && bounds.top < window.innerHeight
    && bounds.right > 0
    && bounds.left < window.innerWidth
}

function nextRandomIndex(length: number, currentIndex: number) {
  if (length <= 1) return 0
  if (currentIndex < 0) return Math.floor(Math.random() * length)
  return (currentIndex + 1 + Math.floor(Math.random() * (length - 1))) % length
}

export const SiteFooter = forwardRef<SiteFooterHandle, SiteFooterProps>(function SiteFooter({
  htmlLang,
  messages,
  onOpenCliGuide,
  onOpenUsageGuide,
}, forwardedRef) {
  const [donateMethod, setDonateMethod] = useState<'wechat' | 'alipay'>('wechat')
  const [praiseIndex, setPraiseIndex] = useState(-1)
  const [panelState, setPanelState] = useState<'closed' | 'open' | 'closing'>('closed')
  const [panelPinned, setPanelPinned] = useState(false)
  const widgetRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const praise = messages.donatePraises[Math.max(0, praiseIndex) % messages.donatePraises.length]

  const openPanel = useCallback((pinned: boolean) => {
    setPraiseIndex((current) => nextRandomIndex(messages.donatePraises.length, current))
    setPanelPinned(pinned)
    setPanelState('open')
  }, [messages.donatePraises.length])

  useImperativeHandle(forwardedRef, () => ({
    openDonation: () => openPanel(!isElementInViewport(triggerRef.current)),
  }), [openPanel])

  useEffect(() => {
    if (panelState !== 'open') return undefined
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!widgetRef.current?.contains(event.target as Node)) setPanelState('closing')
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanelState('closing')
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [panelState])

  useEffect(() => {
    if (panelState === 'closed') {
      setPanelPinned(false)
      return undefined
    }
    const trigger = triggerRef.current
    if (!trigger) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => setPanelPinned(!entry?.isIntersecting),
      { threshold: 0.01 },
    )
    observer.observe(trigger)
    return () => observer.disconnect()
  }, [panelState])

  return (
    <footer className="site-footer">
      <button className="footer-text-link" type="button" onClick={onOpenUsageGuide}>
        <Info size={14} weight="bold" />{messages.usageGuide}
      </button>
      <a className="footer-text-link" href={AUTHOR_HOME_URL} target="_blank" rel="noreferrer">
        <ArrowSquareOut size={14} weight="bold" />{messages.authorHomepage}
      </a>
      <button className="footer-text-link" type="button" onClick={onOpenCliGuide}>
        <TerminalWindow size={14} weight="bold" />{messages.cliGuide}
      </button>
      <div className="donate-widget" ref={widgetRef}>
        {panelState !== 'closed' ? (
          <aside
            id="donate-panel"
            className={`donate-popover${panelPinned ? ' is-viewport-pinned' : ''}${panelState === 'closing' ? ' is-closing' : ''}`}
            role="dialog"
            aria-label={messages.donateTitle}
            aria-hidden={panelState === 'closing'}
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget && panelState === 'closing') setPanelState('closed')
            }}
          >
            <section className="donate-section">
              <strong className="donate-popover-title">{messages.donateTitle}</strong>
              <p className="donate-copy">
                <span className="donate-copy-line">{messages.donateIntro}</span>
                <span className="donate-copy-line donate-praise-line">
                  <SpringScaleText text={praise} locale={htmlLang} />
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
        ) : null}
        <button
          ref={triggerRef}
          className="footer-text-link donate-trigger"
          type="button"
          aria-controls="donate-panel"
          aria-expanded={panelState === 'open'}
          onClick={() => {
            if (panelState === 'open') {
              setPanelState('closing')
              return
            }
            openPanel(false)
          }}
        >
          <ThumbsUp size={14} weight="bold" />{messages.donateTitle}
        </button>
      </div>
    </footer>
  )
})

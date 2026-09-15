import { Check, Moon, Sun, Translate } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { LANGUAGE_OPTIONS, type Locale, type Messages, type Theme } from '../i18n'
import { SoftBlurTitle } from './AnimatedText'

type TopBarProps = {
  locale: Locale
  messages: Messages
  theme: Theme
  onLocaleChange: (locale: Locale) => void
  onThemeChange: (theme: Theme) => void
}

export function TopBar({ locale, messages, theme, onLocaleChange, onThemeChange }: TopBarProps) {
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const languageMenuRef = useRef<HTMLDivElement>(null)
  const brandMarkRef = useRef<HTMLSpanElement>(null)
  const currentLanguage = LANGUAGE_OPTIONS.find((option) => option.id === locale) ?? LANGUAGE_OPTIONS[0]

  const triggerBrandBounce = useCallback(() => {
    const mark = brandMarkRef.current
    if (!mark || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    mark.classList.remove('brand-mark-in', 'brand-mark-bounce-trigger')
    void mark.offsetWidth
    mark.classList.add('brand-mark-bounce-trigger')
  }, [])

  const stopBrandBounce = useCallback(() => {
    brandMarkRef.current?.classList.remove('brand-mark-in', 'brand-mark-bounce-trigger')
  }, [])

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

  return (
    <header className="topbar">
      <a
        className="brand"
        href="#top"
        aria-label={messages.homeLabel}
        onClick={triggerBrandBounce}
        onMouseEnter={triggerBrandBounce}
        onMouseLeave={stopBrandBounce}
      >
        <span className="brand-mark brand-mark-in" ref={brandMarkRef}>
          <img src={theme === 'dark' ? '/brand/robot-paper-dark.png' : '/brand/robot-paper-light.png'} alt="" />
        </span>
        <span>
          <strong><SoftBlurTitle text={messages.brandSubtitle} /></strong>
          <small>Compressor Studio</small>
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
          {languageMenuOpen ? (
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
                    onLocaleChange(option.id)
                    setLanguageMenuOpen(false)
                  }}
                >
                  <span>{option.label}</span>
                  {locale === option.id ? <Check size={15} weight="bold" /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
          aria-label={messages.themeToggle(theme)}
          title={messages.themeToggle(theme)}
        >
          {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
        </button>
      </div>
    </header>
  )
}

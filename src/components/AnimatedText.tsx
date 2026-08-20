import { useEffect, useMemo, useRef, useState } from 'react'

const SPRING_SCALE_IN = {
  duration: 259,
  stagger: 68,
  easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  initialDelayMax: 400,
} as const

export function AnimatedPercentage({ value }: { value: number }) {
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

export function AnimatedPercentageRange({ from, to }: { from: number; to: number }) {
  return (
    <span className="result-ratio-range" aria-label={`${from}%–${to}%`}>
      <AnimatedPercentage value={from} />
      <i aria-hidden="true">–</i>
      <AnimatedPercentage value={to} />
    </span>
  )
}

function splitAnimatedWords(text: string, locale: string) {
  if (typeof Intl.Segmenter === 'function') {
    const segments = Array.from(
      new Intl.Segmenter(locale, { granularity: 'word' }).segment(text),
      ({ segment, isWordLike }) => ({ text: segment, animate: Boolean(isWordLike) }),
    )

    return segments.reduce<Array<{ text: string; animate: boolean }>>((parts, part) => {
      if (part.animate || /^\s+$/u.test(part.text) || parts.length === 0) parts.push(part)
      else parts[parts.length - 1].text += part.text
      return parts
    }, [])
  }

  return (text.match(/(\S+|\s+)/g) ?? [text]).map((part) => ({
    text: part,
    animate: !/^\s+$/u.test(part),
  }))
}

export function SpringScaleText({ text, locale }: { text: string; locale: string }) {
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
        { opacity: 0, transform: 'translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) rotate(0deg) scale(0.7)' },
        { opacity: 1, transform: 'translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) rotate(0deg) scale(1)' },
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

export function SoftBlurTitle({ text }: { text: string }) {
  const hostRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const letters = Array.from(hostRef.current?.querySelectorAll<HTMLElement>('.brand-title-letter') ?? [])
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      letters.forEach((letter) => {
        letter.style.opacity = '1'
        letter.style.filter = 'blur(0)'
        letter.style.transform = 'translateY(0)'
      })
      return undefined
    }
    const animations = letters.map((letter, index) => letter.animate(
      [
        { opacity: 0, filter: 'blur(6px)', transform: 'translateY(9px)' },
        { opacity: 1, filter: 'blur(0)', transform: 'translateY(0)' },
      ],
      {
        duration: 648,
        delay: index * 15,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards',
      },
    ))
    return () => animations.forEach((animation) => animation.cancel())
  }, [text])

  return (
    <span className="brand-title" ref={hostRef} aria-label={text}>
      {Array.from(text).map((letter, index) => (
        <span className="brand-title-letter" aria-hidden="true" key={`${letter}-${index}`}>{letter}</span>
      ))}
    </span>
  )
}

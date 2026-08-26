import { CaretDown, Check } from '@phosphor-icons/react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

export type CustomSelectOption<T extends string> = {
  value: T
  label: string
}

type CustomSelectProps<T extends string> = {
  value: T
  options: Array<CustomSelectOption<T>>
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}

export function CustomSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [highlightedValue, setHighlightedValue] = useState<T>(value)
  const rootRef = useRef<HTMLDivElement>(null)
  const pressRef = useRef<{ pointerId: number; openedFromClosed: boolean } | null>(null)
  const listboxId = useId()
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value],
  )

  useEffect(() => {
    setHighlightedValue(value)
  }, [value])

  useEffect(() => {
    if (!open) return
    const closeFromOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeFromOutside)
    document.addEventListener('keydown', closeFromEscape)
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside)
      document.removeEventListener('keydown', closeFromEscape)
    }
  }, [open])

  const selectOption = (nextValue: T) => {
    onChange(nextValue)
    setHighlightedValue(nextValue)
    setOpen(false)
  }

  const optionAtPoint = (clientX: number, clientY: number) => {
    const target = document.elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>('[data-custom-select-option]')
    if (!target || !rootRef.current?.contains(target)) return null
    const nextValue = target.dataset.value as T | undefined
    return options.find((option) => option.value === nextValue) ?? null
  }

  const moveHighlight = (direction: -1 | 1) => {
    const currentIndex = Math.max(0, options.findIndex((option) => option.value === highlightedValue))
    const nextIndex = (currentIndex + direction + options.length) % options.length
    setHighlightedValue(options[nextIndex].value)
  }

  return (
    <div className={`custom-select${className ? ` ${className}` : ''}${open ? ' is-open' : ''}`} ref={rootRef}>
      <select
        className="custom-select-native"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        aria-hidden="true"
        tabIndex={-1}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <button
        className="custom-select-trigger"
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? `${listboxId}-${highlightedValue}` : undefined}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          event.currentTarget.focus()
          setOpen(true)
          setHighlightedValue(value)
          pressRef.current = { pointerId: event.pointerId, openedFromClosed: !open }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (pressRef.current?.pointerId !== event.pointerId) return
          const option = optionAtPoint(event.clientX, event.clientY)
          if (option) setHighlightedValue(option.value)
        }}
        onPointerUp={(event) => {
          const press = pressRef.current
          if (press?.pointerId !== event.pointerId) return
          const option = optionAtPoint(event.clientX, event.clientY)
          pressRef.current = null
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
          if (option) selectOption(option.value)
          else if (!press.openedFromClosed) setOpen(false)
        }}
        onPointerCancel={(event) => {
          if (pressRef.current?.pointerId !== event.pointerId) return
          pressRef.current = null
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) {
              setOpen(true)
              setHighlightedValue(value)
            } else {
              moveHighlight(event.key === 'ArrowDown' ? 1 : -1)
            }
            return
          }
          if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault()
            setOpen(true)
            setHighlightedValue(options[event.key === 'Home' ? 0 : options.length - 1].value)
            return
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (open) selectOption(highlightedValue)
            else setOpen(true)
            return
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            setOpen(false)
          }
        }}
      >
        <span>{selectedOption?.label}</span>
        <CaretDown size={13} weight="bold" aria-hidden="true" />
      </button>
      {open ? (
        <div className="custom-select-menu" id={listboxId} role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <div
              className={`custom-select-option${option.value === value ? ' is-selected' : ''}${option.value === highlightedValue ? ' is-highlighted' : ''}`}
              id={`${listboxId}-${option.value}`}
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              data-custom-select-option="true"
              data-value={option.value}
              onPointerEnter={() => setHighlightedValue(option.value)}
              onPointerDown={(event) => {
                event.preventDefault()
                setHighlightedValue(option.value)
              }}
              onPointerUp={() => selectOption(option.value)}
              onClick={() => selectOption(option.value)}
            >
              <span>{option.label}</span>
              <Check size={13} weight="bold" aria-hidden="true" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

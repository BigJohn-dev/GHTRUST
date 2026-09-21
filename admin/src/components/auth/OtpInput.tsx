import { useEffect, useRef } from 'react'
import clsx from 'clsx'

interface OtpInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  error?: boolean
  variant?: 'light' | 'dark'
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  disabled,
  error,
  variant = 'light',
}: OtpInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const digits = value.padEnd(length, ' ').slice(0, length).split('')
  const dark = variant === 'dark'

  const focusAt = (index: number) => {
    const el = inputs.current[index]
    if (el) {
      el.focus()
      el.select()
    }
  }

  useEffect(() => {
    if (value.length === 0) focusAt(0)
  }, [])

  const applyDigits = (next: string) => {
    const cleaned = next.replace(/\D/g, '').slice(0, length)
    onChange(cleaned)
    if (cleaned.length < length) focusAt(cleaned.length)
  }

  const handleChange = (index: number, char: string) => {
    const digit = char.replace(/\D/g, '').slice(-1)
    const arr = value.split('')
    arr[index] = digit
    const next = arr.join('').slice(0, length)
    onChange(next)
    if (digit && index < length - 1) focusAt(index + 1)
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const arr = value.split('')
      if (arr[index]) {
        arr[index] = ''
        onChange(arr.join(''))
      } else if (index > 0) {
        focusAt(index - 1)
        const prev = value.split('')
        prev[index - 1] = ''
        onChange(prev.join(''))
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) focusAt(index - 1)
    if (e.key === 'ArrowRight' && index < length - 1) focusAt(index + 1)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    applyDigits(e.clipboardData.getData('text'))
  }

  return (
    <div className="flex justify-center gap-2.5 sm:gap-3" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={d.trim()}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={clsx(
            'h-12 w-11 sm:h-14 sm:w-12 rounded-md border text-center text-lg font-semibold transition-colors duration-150 outline-none',
            dark
              ? clsx(
                  'bg-slate-50 text-slate-900 border-slate-200',
                  'focus:border-navy focus:ring-2 focus:ring-navy/10',
                  error && 'border-rose-400 shake',
                  d.trim() && 'border-navy/40',
                )
              : clsx(
                  'bg-white text-slate-900 border-slate-200',
                  'focus:border-navy focus:ring-2 focus:ring-navy/10',
                  error && 'border-rose-400 shake',
                  d.trim() && 'border-slate-400',
                ),
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        />
      ))}
    </div>
  )
}

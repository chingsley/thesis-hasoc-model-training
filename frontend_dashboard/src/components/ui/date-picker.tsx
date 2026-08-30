import { useMemo, useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

function toIso(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

function parseDay(iso: string | undefined): Date | null {
  if (!iso) return null
  try {
    return startOfDay(parseISO(iso))
  } catch {
    return null
  }
}

interface DatePickerFieldProps {
  label: string
  value: string
  min?: string
  max?: string
  /** Other end of a range — used for in-range highlight */
  rangeMate?: string
  rangeRole?: 'start' | 'end'
  onChange: (iso: string) => void
  /** Allow Reset to clear the value (empty string) instead of falling back to today/min */
  clearable?: boolean
  className?: string
}

export function DatePickerField({
  label,
  value,
  min,
  max,
  rangeMate,
  rangeRole = 'start',
  onChange,
  clearable = false,
  className,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false)
  const selected = parseDay(value)
  const mate = parseDay(rangeMate)
  const minDay = parseDay(min)
  const maxDay = parseDay(max)

  const [cursor, setCursor] = useState(() => selected ?? startOfDay(new Date()))

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [cursor])

  const display = selected ? format(selected, 'MMM d, yyyy') : 'Select date'

  const isDisabled = (day: Date) => {
    if (minDay && isBefore(day, minDay)) return true
    if (maxDay && isAfter(day, maxDay)) return true
    return false
  }

  const inRange = (day: Date) => {
    if (!selected || !mate) return false
    const a = isBefore(selected, mate) ? selected : mate
    const b = isBefore(selected, mate) ? mate : selected
    return (isAfter(day, a) || isSameDay(day, a)) && (isBefore(day, b) || isSameDay(day, b))
  }

  const pick = (day: Date) => {
    if (isDisabled(day)) return
    onChange(toIso(day))
    setOpen(false)
  }

  const goToday = () => {
    const today = startOfDay(new Date())
    if (isDisabled(today)) return
    setCursor(today)
    onChange(toIso(today))
    setOpen(false)
  }

  const clear = () => {
    if (clearable) {
      onChange('')
      setOpen(false)
      return
    }
    // Keep a valid value for volume range — jump to min or today
    const fallback = minDay ?? startOfDay(new Date())
    if (!isDisabled(fallback)) {
      onChange(toIso(fallback))
    }
    setOpen(false)
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next && selected) setCursor(selected)
      }}
    >
      <div className={cn('flex items-center gap-2', className)}>
        <span className="text-[11px] font-medium tracking-wide text-[var(--hg-muted)] uppercase">
          {label}
        </span>
        <Popover.Trigger
          type="button"
          className={cn(
            'inline-flex h-8 min-w-[9.5rem] items-center gap-2 rounded-[4px] border border-[var(--hg-border)] bg-white px-2.5 text-xs font-medium text-black transition-colors',
            'hover:border-[var(--hg-muted)] hover:bg-[var(--hg-soft)]',
            'data-popup-open:border-[#625885] data-popup-open:bg-[var(--hg-soft)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#625885]/25',
          )}
        >
          <CalendarDays className="size-3.5 shrink-0 text-[var(--hg-muted)]" />
          <span className="flex-1 text-left tabular-nums">{display}</span>
          <ChevronDown className="size-3.5 shrink-0 text-[var(--hg-subtle)]" />
        </Popover.Trigger>
      </div>

      <Popover.Portal>
        <Popover.Positioner side="bottom" align={rangeRole === 'end' ? 'end' : 'start'} sideOffset={6} className="z-50">
          <Popover.Popup
            className={cn(
              'w-[280px] origin-(--transform-origin) rounded-[4px] border border-[var(--hg-border)] bg-white p-3 shadow-[var(--hg-shadow)] outline-none',
              'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
              'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--hg-ink)]">
                {format(cursor, 'MMMM yyyy')}
              </p>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setCursor((c) => subMonths(c, 1))}
                  className="flex size-7 items-center justify-center rounded-[4px] text-[var(--hg-muted)] transition-colors hover:bg-[var(--hg-soft)] hover:text-black"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => setCursor((c) => addMonths(c, 1))}
                  className="flex size-7 items-center justify-center rounded-[4px] text-[var(--hg-muted)] transition-colors hover:bg-[var(--hg-soft)] hover:text-black"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-0.5">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div
                  key={`${d}-${i}`}
                  className="flex h-7 items-center justify-center text-[10px] font-medium tracking-wide text-[var(--hg-subtle)] uppercase"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {days.map((day) => {
                const outside = !isSameMonth(day, cursor)
                const disabled = isDisabled(day)
                const isSelected = selected ? isSameDay(day, selected) : false
                const isMate = mate ? isSameDay(day, mate) : false
                const ranged = inRange(day) && !isSelected && !isMate
                const isToday = isSameDay(day, new Date())

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    disabled={disabled}
                    onClick={() => pick(day)}
                    className={cn(
                      'relative flex h-8 items-center justify-center rounded-[4px] text-xs tabular-nums transition-colors',
                      outside && !isSelected && 'text-[var(--hg-subtle)]',
                      !outside && !isSelected && !ranged && 'text-black',
                      !disabled && !isSelected && 'hover:bg-[var(--hg-soft)]',
                      ranged && 'bg-[var(--hg-soft)] text-black',
                      isMate && !isSelected && 'bg-[var(--hg-soft-selected)] font-medium text-black',
                      isSelected &&
                        'bg-[#625885] font-semibold text-white hover:bg-[#625885]',
                      isToday && !isSelected && 'ring-1 ring-[var(--hg-border)] ring-inset',
                      disabled && 'cursor-not-allowed opacity-30',
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-[var(--hg-border)] pt-2">
              <button
                type="button"
                onClick={clear}
                className="text-xs font-medium text-[var(--hg-muted)] transition-colors hover:text-black"
              >
                {clearable ? 'Clear' : 'Reset'}
              </button>
              <button
                type="button"
                onClick={goToday}
                className="text-xs font-semibold text-[#625885] transition-colors hover:text-[#4a3f6e]"
              >
                Today
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

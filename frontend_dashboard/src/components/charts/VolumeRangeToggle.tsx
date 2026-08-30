import { cn } from '@/lib/utils'
import { DatePickerField } from '@/components/ui/date-picker'
import { MAX_CUSTOM_DAYS, VOLUME_RANGE_OPTIONS, type VolumeMode } from '@/lib/volume-range'

interface VolumeRangeToggleProps {
  mode: VolumeMode
  customFrom: string
  customTo: string
  onPreset: (id: Exclude<VolumeMode, 'custom'>) => void
  onCustomMode: () => void
  onCustomRange: (from: string, to: string) => void
}

export function VolumeRangeToggle({
  mode,
  customFrom,
  customTo,
  onPreset,
  onCustomMode,
  onCustomRange,
}: VolumeRangeToggleProps) {
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex flex-col items-end gap-2.5">
      <div
        className="inline-flex flex-wrap items-center justify-end rounded-[4px] border border-[var(--hg-border)] bg-[var(--hg-canvas)] p-0.5"
        role="group"
        aria-label="Volume time range"
      >
        {VOLUME_RANGE_OPTIONS.map((option) => {
          const active = mode === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onPreset(option.id)}
              aria-pressed={active}
              className={cn(
                'rounded-[4px] px-2.5 py-1 text-xs font-medium transition-colors',
                active
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[var(--hg-muted)] hover:bg-[var(--hg-soft)] hover:text-black',
              )}
            >
              {option.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={onCustomMode}
          aria-pressed={mode === 'custom'}
          className={cn(
            'rounded-[4px] px-2.5 py-1 text-xs font-medium transition-colors',
            mode === 'custom'
              ? 'bg-white text-black shadow-sm'
              : 'text-[var(--hg-muted)] hover:bg-[var(--hg-soft)] hover:text-black',
          )}
        >
          Custom
        </button>
      </div>

      {mode === 'custom' && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <DatePickerField
            label="From"
            value={customFrom}
            max={customTo || today}
            rangeMate={customTo}
            rangeRole="start"
            onChange={(from) => onCustomRange(from, customTo || from)}
          />
          <DatePickerField
            label="To"
            value={customTo}
            min={customFrom}
            max={today}
            rangeMate={customFrom}
            rangeRole="end"
            onChange={(to) => onCustomRange(customFrom || to, to)}
          />
          <span className="text-[10px] text-[var(--hg-subtle)]">Max {MAX_CUSTOM_DAYS} days · UTC</span>
        </div>
      )}
    </div>
  )
}

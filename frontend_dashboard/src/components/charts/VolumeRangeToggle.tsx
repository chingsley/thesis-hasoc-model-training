import { cn } from '@/lib/utils'
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
    <div className="flex flex-col items-end gap-2">
      <div
        className="inline-flex flex-wrap items-center justify-end rounded-[8px] border border-[var(--hg-border)] bg-[var(--hg-canvas)] p-0.5"
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
                'rounded-[6px] px-2.5 py-1 text-xs font-medium transition-colors',
                active
                  ? 'bg-white text-[var(--hg-ink)] shadow-sm'
                  : 'text-[var(--hg-muted)] hover:text-[var(--hg-ink)]',
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
            'rounded-[6px] px-2.5 py-1 text-xs font-medium transition-colors',
            mode === 'custom'
              ? 'bg-white text-[var(--hg-ink)] shadow-sm'
              : 'text-[var(--hg-muted)] hover:text-[var(--hg-ink)]',
          )}
        >
          Custom
        </button>
      </div>

      {mode === 'custom' && (
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-[var(--hg-muted)]">
          <label className="flex items-center gap-1.5">
            <span>From</span>
            <input
              type="date"
              value={customFrom}
              max={customTo || today}
              onChange={(e) => onCustomRange(e.target.value, customTo || e.target.value)}
              className="rounded-[6px] border border-[var(--hg-border)] bg-white px-2 py-1 text-xs text-[var(--hg-ink)]"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span>To</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={today}
              onChange={(e) => onCustomRange(customFrom || e.target.value, e.target.value)}
              className="rounded-[6px] border border-[var(--hg-border)] bg-white px-2 py-1 text-xs text-[var(--hg-ink)]"
            />
          </label>
          <span className="text-[10px] text-[var(--hg-subtle)]">Max {MAX_CUSTOM_DAYS} days · UTC</span>
        </div>
      )}
    </div>
  )
}

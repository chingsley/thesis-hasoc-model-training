import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

type PercentRangeFilterProps = {
  label: string
  minValue: string
  maxValue: string
  onMinChange: (value: string) => void
  onMaxChange: (value: string) => void
  className?: string
  step?: number
}

function parsePercent(value: string, fallback: number) {
  if (value === '') return fallback
  const n = Number(value)
  return Number.isNaN(n) ? fallback : Math.min(100, Math.max(0, n))
}

/**
 * Dual-thumb percent range control (shadcn-style price filter pattern).
 * Empty min/max strings mean “no bound” on that side (full 0–100 range).
 */
export function PercentRangeFilter({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  className,
  step = 5,
}: PercentRangeFilterProps) {
  const lo = parsePercent(minValue, 0)
  const hi = parsePercent(maxValue, 100)
  const sliderValue = [lo, hi]

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-[var(--hg-muted)] uppercase">
          {label}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--hg-ink)]">
          {lo}% – {hi}%
        </span>
      </div>
      <div className="rounded-[4px] border border-[var(--hg-border)] bg-[var(--hg-canvas)] px-3 py-4">
        <Slider
          value={sliderValue}
          min={0}
          max={100}
          step={step}
          onValueChange={(next) => {
            const [a, b] = next as number[]
            const low = Math.min(a, b)
            const high = Math.max(a, b)
            onMinChange(low <= 0 ? '' : String(low))
            onMaxChange(high >= 100 ? '' : String(high))
          }}
          className="**:data-[slot=slider-range]:bg-[var(--hg-brand)]"
        />
        <div className="mt-2 flex justify-between text-[10px] tabular-nums text-[var(--hg-subtle)]">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  )
}

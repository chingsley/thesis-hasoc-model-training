import { cn } from '@/lib/utils'

interface DotGridProps {
  /** Dots filled, out of 100. */
  filled: number
  color: string
  /** 'square' is 10 × 10; 'strip' is 20 × 5 on wide screens and 10 × 10 on narrow ones. */
  shape?: 'square' | 'strip'
  /** Read out in place of the 100 dots. */
  label: string
  className?: string
}

/** 100 dots with the first `filled` coloured: a picture of "N out of every 100". */
export function DotGrid({ filled, color, shape = 'square', label, className }: DotGridProps) {
  const count = Math.max(0, Math.min(100, Math.round(filled)))
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        'grid w-fit gap-1',
        shape === 'strip' ? 'grid-cols-10 sm:grid-cols-20' : 'grid-cols-10',
        className,
      )}
    >
      {Array.from({ length: 100 }, (_, i) => (
        <span
          key={i}
          className="size-2 rounded-full"
          style={{ backgroundColor: i < count ? color : 'var(--hg-chart-bar-muted)' }}
        />
      ))}
    </div>
  )
}

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function pageNumbers(current: number, total: number): number[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages = new Set<number>([1, total, current, current - 1, current + 1])
  return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
}

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: {
  /** Zero-based page index */
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  className?: string
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = page + 1
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)

  if (total === 0) {
    return null
  }

  const numbers = pageNumbers(current, pageCount)

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-t border-[var(--hg-border)] pt-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-xs text-[var(--hg-muted)] tabular-nums">
        Showing {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 rounded-[4px] border-[var(--hg-border)] px-2.5 text-xs"
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-3.5" />
          Prev
        </Button>
        <div className="flex items-center gap-0.5 px-1">
          {numbers.map((n, i) => {
            const prev = numbers[i - 1]
            const gap = prev !== undefined && n - prev > 1
            return (
              <span key={n} className="flex items-center gap-0.5">
                {gap ? (
                  <span className="px-1 text-xs text-[var(--hg-subtle)]" aria-hidden>…</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => onPageChange(n - 1)}
                  aria-current={n === current ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-8 min-w-8 items-center justify-center rounded-[4px] px-2 text-xs font-medium tabular-nums transition-colors',
                    n === current
                      ? 'bg-[var(--hg-brand)] text-white'
                      : 'text-[var(--hg-muted)] hover:bg-[var(--hg-soft)] hover:text-[var(--hg-ink)]',
                  )}
                >
                  {n}
                </button>
              </span>
            )
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 rounded-[4px] border-[var(--hg-border)] px-2.5 text-xs"
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

interface ConfusionMatrixProps {
  matrix: number[][]
}

const LABELS = ['Normal', 'Abuse', 'Hate'] as const

function cellStyle(value: number, max: number, isDiagonal: boolean): CSSProperties {
  if (max <= 0 || value <= 0) {
    return {
      backgroundColor: 'var(--hg-canvas)',
      color: 'var(--hg-subtle)',
    }
  }
  const t = Math.min(1, value / max)
  if (isDiagonal) {
    // Correct predictions: brand purple scale
    const alpha = 0.12 + t * 0.78
    return {
      backgroundColor: `rgba(98, 88, 133, ${alpha})`,
      color: t > 0.45 ? '#ffffff' : 'var(--hg-ink)',
    }
  }
  // Misclassifications: soft red scale (alert accent, lighter than diagonal)
  const alpha = 0.08 + t * 0.55
  return {
    backgroundColor: `rgba(193, 0, 44, ${alpha})`,
    color: t > 0.55 ? '#ffffff' : '#5a0014',
  }
}

export function ConfusionMatrix({ matrix }: ConfusionMatrixProps) {
  const flat = matrix.flat()
  const maxVal = Math.max(...flat, 1)
  const total = flat.reduce((sum, n) => sum + n, 0)
  const correct = matrix.reduce((sum, row, i) => sum + (row[i] ?? 0), 0)
  const accuracy = total > 0 ? correct / total : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-[var(--hg-muted)] uppercase">
          Predicted label →
        </p>
        <p className="text-[11px] font-medium text-[var(--hg-subtle)] tabular-nums">
          {correct.toLocaleString()} / {total.toLocaleString()} correct ·{' '}
          {(accuracy * 100).toFixed(1)}%
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-grid min-w-full grid-cols-[72px_repeat(3,minmax(0,1fr))] gap-1.5 sm:grid-cols-[88px_repeat(3,minmax(0,1fr))]">
          <div aria-hidden />
          {LABELS.map((label) => (
            <div
              key={label}
              className="px-1 pb-1 text-center text-[11px] font-semibold tracking-wide text-[var(--hg-muted)] uppercase"
            >
              {label}
            </div>
          ))}

          {matrix.map((row, i) => (
            <div key={LABELS[i]} className="contents">
              <div className="flex items-center pr-2 text-[11px] font-semibold tracking-wide text-[var(--hg-muted)] uppercase">
                <span className="leading-tight">
                  <span className="block text-[9px] font-medium tracking-wide text-[var(--hg-subtle)] normal-case">
                    Actual
                  </span>
                  {LABELS[i]}
                </span>
              </div>
              {row.map((cell, j) => {
                const isDiagonal = i === j
                return (
                  <div
                    key={`${i}-${j}`}
                    title={`${LABELS[i]} → ${LABELS[j]}: ${cell.toLocaleString()}${
                      isDiagonal ? ' (correct)' : ' (misclassified)'
                    }`}
                    style={cellStyle(cell, maxVal, isDiagonal)}
                    className={cn(
                      'flex min-h-[64px] items-center justify-center rounded-[4px] text-sm font-bold tabular-nums transition-colors sm:min-h-[72px] sm:text-base',
                      isDiagonal && 'ring-1 ring-inset ring-black/5',
                    )}
                  >
                    {cell.toLocaleString()}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-[var(--hg-border)] pt-3 text-[11px] text-[var(--hg-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-[rgba(98,88,133,0.75)]" aria-hidden />
          Correct (diagonal)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-[rgba(193,0,44,0.45)]" aria-hidden />
          Misclassified
        </span>
        <span className="text-[var(--hg-subtle)]">Darker = more examples</span>
      </div>
    </div>
  )
}

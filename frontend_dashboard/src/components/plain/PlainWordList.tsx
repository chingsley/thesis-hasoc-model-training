import { Loader2 } from 'lucide-react'
import { useWordCloudTerms, type WordCloudSource } from '@/hooks/use-word-cloud'
import { plural } from '@/lib/plain-language'

const MAX_WORDS = 10

/** The same terms as the word cloud, as a ranked list: the strongest word comes first. */
export function PlainWordList({ source }: { source: WordCloudSource }) {
  const { words, isPending } = useWordCloudTerms(source)

  if (isPending) {
    return (
      <div className="flex min-h-[240px] items-center justify-center gap-2 text-[var(--hg-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">{source === 'toxic' ? 'Measuring each word…' : 'Loading…'}</span>
      </div>
    )
  }

  if (words.length === 0) {
    return (
      <p className="min-h-[240px] py-8 text-center text-sm text-[var(--hg-muted)]">
        No words to show yet. Words appear after posts are labelled hateful or abusive.
      </p>
    )
  }

  const ranked = [...words].sort((a, b) => b.value - a.value).slice(0, MAX_WORDS)
  const max = Math.max(...ranked.map((word) => word.value), source === 'toxic' ? 0.0001 : 1)
  const color = source === 'toxic' ? 'var(--hg-matrix-error)' : 'var(--hg-brand)'

  return (
    <ol className="space-y-2.5" aria-label={source === 'toxic' ? 'Strongest words' : 'Most used words'}>
      {ranked.map((word, index) => {
        const times = source === 'toxic' ? word.count : word.value
        return (
          <li key={word.text} className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-2">
            <span className="text-sm text-[var(--hg-subtle)] tabular-nums">{index + 1}.</span>
            <div className="min-w-0 space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 text-sm font-semibold break-words text-[var(--hg-ink)]">
                  {word.text}
                </span>
                {times !== undefined ? (
                  <span className="shrink-0 text-xs text-[var(--hg-muted)] tabular-nums">
                    {times.toLocaleString()} {plural(times, 'time')}
                  </span>
                ) : null}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--hg-canvas)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, (Math.max(0, word.value) / max) * 100)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

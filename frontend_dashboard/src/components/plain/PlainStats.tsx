import { StatsCards } from '@/components/dashboard/StatsCards'
import { useVolume } from '@/hooks/use-volume'
import { PLAIN_LABELS, plural } from '@/lib/plain-language'
import { plainRangePhrase } from '@/lib/volume-plain'
import { sumVolume } from '@/lib/volume-csv'

const FIELD = {
  Normal: 'normal_count',
  Abuse: 'abuse_count',
  Hate: 'hate_count',
} as const

/** Same overview strip as the technical view, with a short reading of the counts. */
export function PlainStats() {
  const { language, mode, range, data, isLoading } = useVolume()
  const points = data ?? []
  const total = sumVolume(points, 'total')
  const hate = sumVolume(points, FIELD.Hate)
  const abuse = sumVolume(points, FIELD.Abuse)
  const phrase = plainRangePhrase(mode, range)
  const languageName = language.charAt(0).toUpperCase() + language.slice(1)
  const loading = isLoading && !data

  return (
    <section className="space-y-4" aria-label="Summary of posts checked">
      <div className="space-y-1">
        <p className="text-sm leading-relaxed text-[var(--hg-ink)]">
          {loading ? (
            <span className="text-[var(--hg-muted)]">Counting posts…</span>
          ) : total === 0 ? (
            <>HateGuard checked no {languageName} posts {phrase}.</>
          ) : (
            <>
              HateGuard checked <strong className="tabular-nums">{total.toLocaleString()}</strong>{' '}
              {languageName} {plural(total, 'post')} {phrase}. It labelled{' '}
              <strong className="tabular-nums">{hate.toLocaleString()}</strong> as hateful and{' '}
              <strong className="tabular-nums">{abuse.toLocaleString()}</strong> as abusive.
            </>
          )}
        </p>
        <p className="text-xs leading-relaxed text-[var(--hg-muted)]">
          {PLAIN_LABELS.Hate.name}: {PLAIN_LABELS.Hate.definition} {PLAIN_LABELS.Abuse.name}:{' '}
          {PLAIN_LABELS.Abuse.definition} {PLAIN_LABELS.Normal.name}: {PLAIN_LABELS.Normal.definition}
        </p>
      </div>
      <StatsCards volume={points} periodLabel={phrase} />
    </section>
  )
}

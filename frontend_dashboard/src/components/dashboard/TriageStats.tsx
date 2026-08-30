import { cn } from '@/lib/utils'
import type { Post } from '@/lib/types'
import type { TriageBucket } from './TriageTable'

const BUCKET_LABELS: Record<TriageBucket, string> = {
  pending: 'Pending Reviews',
  cleared: 'Cleared Posts',
  flagged: 'Flagged Posts',
  relabelled: 'Relabelled Posts',
}

const BUCKET_SUBTITLES: Record<TriageBucket, string> = {
  pending: 'Awaiting review',
  cleared: 'Cleared',
  flagged: 'Flagged',
  relabelled: 'Relabelled',
}

interface TriageStatsProps {
  bucket: TriageBucket
  posts: Post[]
}

export function TriageStats({ bucket, posts }: TriageStatsProps) {
  const abuse = posts.filter((p) => p.predicted_label === 'Abuse').length
  const hate = posts.filter((p) => p.predicted_label === 'Hate').length

  const items = [
    {
      label: BUCKET_LABELS[bucket],
      value: posts.length,
      subtitle: BUCKET_SUBTITLES[bucket],
      danger: false,
    },
    {
      label: 'Abusive Posts',
      value: abuse,
      subtitle: 'Detected',
      danger: false,
    },
    {
      label: 'Hateful Posts',
      value: hate,
      subtitle: 'Detected',
      danger: true,
    },
  ] as const

  return (
    <div className="ml-[calc(50%-50cqi)] w-[100cqi] max-w-[100cqi] bg-white">
      <div className="grid grid-cols-1 divide-y divide-[var(--hg-border)] pl-4 sm:grid-cols-3 sm:divide-y-0 md:pl-6 lg:pl-8">
        {items.map((item, index) => (
          <div
            key={item.label}
            className={cn(
              'relative flex min-h-[112px] items-stretch justify-between gap-4 px-5 py-5 md:px-6',
              item.danger && 'bg-[#4a3f6e] text-white md:pr-6 lg:pr-8',
            )}
          >
            {index > 0 && !item.danger && (
              <span
                aria-hidden
                className="pointer-events-none absolute top-4 bottom-4 left-0 hidden w-px bg-[var(--hg-border)] sm:block"
              />
            )}
            <div className="flex min-w-0 flex-col justify-between gap-3">
              <p
                className={cn(
                  'text-[13px] font-medium',
                  item.danger ? 'text-white/85' : 'text-[var(--hg-muted)]',
                )}
              >
                {item.label}
              </p>
              <p
                className={cn(
                  'text-[1.75rem] leading-none font-bold tracking-tight tabular-nums',
                  item.danger ? 'text-white' : 'text-[var(--hg-ink)]',
                )}
              >
                {item.value.toLocaleString()}
              </p>
              <p className={cn('text-xs', item.danger ? 'text-white/75' : 'text-[var(--hg-subtle)]')}>
                {item.subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

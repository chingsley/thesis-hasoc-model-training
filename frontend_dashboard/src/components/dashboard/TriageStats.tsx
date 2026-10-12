import type { TriageBucket, TriageBucketCounts, TriageStatsData } from '@/lib/types'
import {
  SummaryStatCell,
  SummaryStatGrid,
  SummaryStatStrip,
  SummaryStatTile,
} from '@/components/ui/summary-stat-strip'

const BUCKET_LABELS: Record<TriageBucket, string> = {
  pending: 'All posts',
  flagged: 'Flagged Posts',
  relabelled: 'Relabelled Posts',
}

const BUCKET_SUBTITLES: Record<TriageBucket, string> = {
  pending: 'All classified predictions',
  flagged: 'Flagged for incident report',
  relabelled: 'Manual label corrections',
}

interface TriageStatsProps {
  bucket: TriageBucket
  stats?: TriageStatsData
  loading?: boolean
}

function formatDetailCount(
  loading: boolean,
  counts: TriageBucketCounts | undefined,
  n: number | undefined,
) {
  if (loading || !counts || n === undefined) return '—'
  return n.toLocaleString()
}

function labelDetails(
  loading: boolean,
  counts: TriageBucketCounts | undefined,
  kind: 'normal' | 'abuse' | 'hate',
) {
  const prefix = kind
  return [
    {
      label: 'flagged',
      value: formatDetailCount(loading, counts, counts?.[`${prefix}_flagged`]),
    },
    {
      label: 'relabelled',
      value: formatDetailCount(loading, counts, counts?.[`${prefix}_relabelled`]),
    },
    {
      label: 'others',
      value: formatDetailCount(loading, counts, counts?.[`${prefix}_other`]),
    },
  ]
}

export function TriageStats({ bucket, stats, loading }: TriageStatsProps) {
  const counts = stats?.[bucket]
  const placeholder = '—'

  const items = [
    {
      label: BUCKET_LABELS[bucket],
      value: loading || !counts ? placeholder : counts.total,
      subtitle: BUCKET_SUBTITLES[bucket],
      accent: false,
      details: undefined,
    },
    {
      label: 'Normal Posts',
      value: loading || !counts ? placeholder : counts.normal,
      subtitle: 'Detected',
      accent: false,
      details: counts || loading ? labelDetails(Boolean(loading), counts, 'normal') : undefined,
    },
    {
      label: 'Abusive Posts',
      value: loading || !counts ? placeholder : counts.abuse,
      subtitle: 'Detected',
      accent: false,
      details: counts || loading ? labelDetails(Boolean(loading), counts, 'abuse') : undefined,
    },
    {
      label: 'Hateful Posts',
      value: loading || !counts ? placeholder : counts.hate,
      subtitle: 'Detected',
      accent: true,
      details: counts || loading ? labelDetails(Boolean(loading), counts, 'hate') : undefined,
    },
  ] as const

  return (
    <SummaryStatStrip>
      <SummaryStatGrid columns={4}>
        {items.map((item, index) => (
          <SummaryStatCell key={item.label} index={index} columns={4} accent={item.accent}>
            <SummaryStatTile
              label={item.label}
              value={
                typeof item.value === 'number' ? item.value.toLocaleString() : item.value
              }
              subtitle={item.subtitle}
              accent={item.accent}
              details={item.details}
            />
          </SummaryStatCell>
        ))}
      </SummaryStatGrid>
    </SummaryStatStrip>
  )
}

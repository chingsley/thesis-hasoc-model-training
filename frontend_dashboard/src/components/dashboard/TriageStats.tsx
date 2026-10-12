import type { TriageLabelFilter } from '@/components/dashboard/TriageTable';
import type { TriageBucketCounts, TriageStatsData } from '@/lib/types';
import {
  SummaryStatCell,
  SummaryStatGrid,
  SummaryStatStrip,
  SummaryStatTile,
} from '@/components/ui/summary-stat-strip';

interface TriageStatsProps {
  labelFilter: TriageLabelFilter;
  stats?: TriageStatsData;
  loading?: boolean;
}

function isAccentCard(
  labelFilter: TriageLabelFilter,
  card: 'total' | 'normal' | 'abuse' | 'hate',
): boolean {
  if (labelFilter === 'all') return card === 'total';
  if (labelFilter === 'Normal') return card === 'normal';
  if (labelFilter === 'Abuse') return card === 'abuse';
  if (labelFilter === 'Hate') return card === 'hate';
  return false;
}

function formatDetailCount(
  loading: boolean,
  counts: TriageBucketCounts | undefined,
  n: number | undefined,
) {
  if (loading || !counts || n === undefined) return '—';
  return n.toLocaleString();
}

function labelDetails(
  loading: boolean,
  counts: TriageBucketCounts | undefined,
  kind: 'normal' | 'abuse' | 'hate',
) {
  const prefix = kind;
  return [
    {
      label: 'Flagged',
      value: formatDetailCount(loading, counts, counts?.[`${prefix}_flagged`]),
    },
    {
      label: 'Relabelled',
      value: formatDetailCount(loading, counts, counts?.[`${prefix}_relabelled`]),
    },
  ];
}

export function TriageStats({ labelFilter, stats, loading }: TriageStatsProps) {
  /** Summary strip always reflects the full queue (All bucket), not Flagged/Relabelled tabs. */
  const counts = stats?.pending;
  const placeholder = '—';

  const items = [
    {
      key: 'total' as const,
      label: 'Total posts',
      value: loading || !counts ? placeholder : counts.total,
      details: undefined,
    },
    {
      key: 'normal' as const,
      label: 'Normal Posts',
      value: loading || !counts ? placeholder : counts.normal,
      details: counts || loading ? labelDetails(Boolean(loading), counts, 'normal') : undefined,
    },
    {
      key: 'abuse' as const,
      label: 'Abusive Posts',
      value: loading || !counts ? placeholder : counts.abuse,
      details: counts || loading ? labelDetails(Boolean(loading), counts, 'abuse') : undefined,
    },
    {
      key: 'hate' as const,
      label: 'Hateful Posts',
      value: loading || !counts ? placeholder : counts.hate,
      details: counts || loading ? labelDetails(Boolean(loading), counts, 'hate') : undefined,
    },
  ].map((item) => ({
    ...item,
    accent: isAccentCard(labelFilter, item.key),
  }));

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
              accent={item.accent}
              details={item.details}
            />
          </SummaryStatCell>
        ))}
      </SummaryStatGrid>
    </SummaryStatStrip>
  );
}

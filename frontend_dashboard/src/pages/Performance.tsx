import { useModelMetrics } from '@/hooks/use-metrics'
import { ConfusionMatrix } from '@/components/charts/ConfusionMatrix'
import { PerClassMetrics } from '@/components/charts/PerClassMetrics'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import type { ModelMetrics } from '@/lib/types'

const OVERALL_METRICS = [
  {
    key: 'accuracy',
    label: 'Accuracy',
    subtitle: 'Overall',
    format: (m: ModelMetrics) => `${(m.accuracy * 100).toFixed(1)}%`,
    accent: true,
  },
  {
    key: 'macro_f1',
    label: 'Macro F1',
    subtitle: 'Balanced',
    format: (m: ModelMetrics) => `${(m.macro_f1 * 100).toFixed(1)}%`,
    accent: false,
  },
  {
    key: 'weighted_f1',
    label: 'Weighted F1',
    subtitle: 'Support-weighted',
    format: (m: ModelMetrics) => `${(m.weighted_f1 * 100).toFixed(1)}%`,
    accent: false,
  },
  {
    key: 'mcc',
    label: 'MCC',
    subtitle: 'Correlation',
    format: (m: ModelMetrics) => m.mcc.toFixed(3),
    accent: false,
  },
  {
    key: 'macro_precision',
    label: 'Macro Precision',
    subtitle: 'Positive class',
    format: (m: ModelMetrics) => `${(m.macro_precision * 100).toFixed(1)}%`,
    accent: false,
  },
  {
    key: 'macro_recall',
    label: 'Macro Recall',
    subtitle: 'Coverage',
    format: (m: ModelMetrics) => `${(m.macro_recall * 100).toFixed(1)}%`,
    accent: false,
  },
  {
    key: 'roc_auc_ovr',
    label: 'ROC-AUC (OvR)',
    subtitle: 'Ranking',
    format: (m: ModelMetrics) => m.roc_auc_ovr?.toFixed(3) ?? 'N/A',
    accent: false,
  },
  {
    key: 'support',
    label: 'Total Support',
    subtitle: 'Test examples',
    format: (m: ModelMetrics) => m.support.toLocaleString(),
    accent: false,
  },
] as const

export default function Performance() {
  const { data: metrics, isLoading, isError } = useModelMetrics()

  if (isLoading) {
    return (
      <div className="space-y-8">
        <SectionTitle description="Held-out test metrics for the active language model.">
          Performance
        </SectionTitle>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (isError || !metrics) {
    return (
      <div className="space-y-8">
        <SectionTitle description="Held-out test metrics for the active language model.">
          Performance
        </SectionTitle>
        <p className="py-8 text-sm text-muted-foreground">
          Metrics unavailable. Copy <code className="text-xs">test_metrics.json</code> from the server
          into <code className="text-xs">runs/</code> and check <code className="text-xs">METRICS_PATH_*</code>{' '}
          in <code className="text-xs">backend_api_server/.env</code>.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <SectionTitle description="Held-out test metrics for the active language model.">
        Performance
      </SectionTitle>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="gap-0 py-0">
          <CardHeader className="border-b border-[var(--hg-border)] py-5">
            <SectionTitle size="md" description="Predicted vs actual labels on the test set.">
              Confusion Matrix
            </SectionTitle>
          </CardHeader>
          <CardContent className="py-5">
            <ConfusionMatrix matrix={metrics.confusion_matrix} />
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b border-[var(--hg-border)] py-5">
            <SectionTitle size="md" description="Precision, recall, and F1 by class.">
              Per-Class Performance
            </SectionTitle>
          </CardHeader>
          <CardContent className="py-5">
            <PerClassMetrics metrics={metrics.per_class} />
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b border-[var(--hg-border)] py-5">
          <SectionTitle size="md" description="Aggregate scores across the held-out set.">
            Overall Metrics
          </SectionTitle>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {OVERALL_METRICS.map((tile, index) => (
              <div
                key={tile.key}
                className={cn(
                  'relative flex min-h-[112px] items-stretch px-5 py-5 md:px-6',
                  tile.accent
                    ? 'bg-[#4a3f6e] text-white'
                    : 'border-b border-[var(--hg-border)]',
                  !tile.accent && index >= 6 && 'border-b-0',
                  !tile.accent && index >= 4 && 'md:border-b-0',
                  tile.accent && 'border-b-0',
                )}
              >
                {!tile.accent && index % 4 !== 0 && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute top-4 bottom-4 left-0 hidden w-px bg-[var(--hg-border)] md:block"
                  />
                )}
                {!tile.accent && index % 2 !== 0 && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute top-4 bottom-4 left-0 w-px bg-[var(--hg-border)] md:hidden"
                  />
                )}
                <div className="flex min-w-0 flex-col justify-between gap-3">
                  <p
                    className={cn(
                      'text-[13px] font-medium',
                      tile.accent ? 'text-white/85' : 'text-[var(--hg-muted)]',
                    )}
                  >
                    {tile.label}
                  </p>
                  <p
                    className={cn(
                      'text-[1.75rem] leading-none font-bold tracking-tight tabular-nums',
                      tile.accent ? 'text-white' : 'text-[var(--hg-ink)]',
                    )}
                  >
                    {tile.format(metrics)}
                  </p>
                  <p className={cn('text-xs', tile.accent ? 'text-white/75' : 'text-[var(--hg-subtle)]')}>
                    {tile.subtitle}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

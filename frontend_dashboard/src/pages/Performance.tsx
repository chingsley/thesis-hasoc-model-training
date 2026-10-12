import { useModelMetrics } from '@/hooks/use-metrics'
import { ConfusionMatrix } from '@/components/charts/ConfusionMatrix'
import { PerClassMetrics } from '@/components/charts/PerClassMetrics'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/data-source-badge'
import {
  SummaryStatCell,
  SummaryStatGrid,
  SummaryStatTile,
} from '@/components/ui/summary-stat-strip'
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
          <SummaryStatGrid columns={4} dense bleedPadding={false}>
            {OVERALL_METRICS.map((tile, index) => (
              <SummaryStatCell
                key={tile.key}
                index={index}
                columns={4}
                dense
                accent={tile.accent}
              >
                <SummaryStatTile
                  label={tile.label}
                  value={tile.format(metrics)}
                  subtitle={tile.subtitle}
                  accent={tile.accent}
                />
              </SummaryStatCell>
            ))}
          </SummaryStatGrid>
        </CardContent>
      </Card>
    </div>
  )
}

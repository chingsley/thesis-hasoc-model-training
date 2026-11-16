import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useModelMetrics } from '@/hooks/use-metrics';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { VolumePanel } from '@/components/charts/VolumePanel';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SectionTitle } from '@/components/ui/data-source-badge';
import {
  SummaryStatCell,
  SummaryStatGrid,
  SummaryStatTile,
} from '@/components/ui/summary-stat-strip';
import { buttonVariants } from '@/components/ui/button';
import { TechnicalName } from '@/components/ui/technical-name';
import { ViewModeToggle } from '@/components/ui/view-mode-toggle';
import { PlainPerformanceSummary } from '@/components/plain/PlainPerformance';
import { PlainStats } from '@/components/plain/PlainStats';
import { PlainVolume } from '@/components/plain/PlainVolume';
import { useViewMode } from '@/lib/store/view-mode';
import { cn } from '@/lib/utils';
import type { VolumeDataPoint } from '@/lib/types';

const METRIC_TILES = [
  {
    key: 'accuracy',
    label: 'Accuracy',
    subtitle: 'Overall',
    format: (m: { accuracy: number; }) => `${(m.accuracy * 100).toFixed(1)}%`,
    accent: false,
  },
  {
    key: 'macro_f1',
    label: 'Macro F1',
    subtitle: 'Balanced',
    format: (m: { macro_f1: number; }) => `${(m.macro_f1 * 100).toFixed(1)}%`,
    accent: false,
  },
  {
    key: 'macro_precision',
    label: 'Macro Precision',
    subtitle: 'Positive class',
    format: (m: { macro_precision: number; }) => `${(m.macro_precision * 100).toFixed(1)}%`,
    accent: false,
  },
  {
    key: 'macro_recall',
    label: 'Macro Recall',
    subtitle: 'Coverage',
    format: (m: { macro_recall: number; }) => `${(m.macro_recall * 100).toFixed(1)}%`,
    accent: false,
  },
] as const;

function MetricsUnavailable({ plain }: { plain: boolean }) {
  return (
    <div className="mx-5 my-5 rounded-[4px] border border-dashed border-[var(--hg-border)] bg-[var(--hg-canvas)] px-4 py-6 text-sm text-[var(--hg-muted)] md:mx-6">
      {plain ? (
        <>The test results are not available right now. Please try again later.</>
      ) : (
        <>
          Metrics unavailable. The backend reads <code className="text-xs">test_metrics.json</code> from
          the model&apos;s Hugging Face repo — ensure the backend is running and the repo includes it.
        </>
      )}
    </div>
  );
}

export default function Overview() {
  const viewMode = useViewMode();
  const { data: metrics, isError: metricsError } = useModelMetrics();
  const [volume, setVolume] = useState<VolumeDataPoint[] | undefined>();
  const [periodLabel, setPeriodLabel] = useState('24 Hours');
  const handleVolumeChange = useCallback((data: VolumeDataPoint[] | undefined, label: string) => {
    setVolume(data);
    setPeriodLabel(label);
  }, []);

  const heading = (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <SectionTitle
        description={
          viewMode === 'plain'
            ? 'What HateGuard found in the posts it checked.'
            : 'Totals and trends for the selected volume window.'
        }
      >
        Post Overview
      </SectionTitle>
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        <ViewModeToggle />
        <Link
          to="/testing"
          className={cn(buttonVariants({ variant: 'default' }), 'h-9 rounded-[4px] px-3.5')}
        >
          <Sparkles aria-hidden />
          Classify a post
        </Link>
      </div>
    </div>
  );

  if (viewMode === 'plain') {
    return (
      <div className="space-y-8">
        {heading}

        <PlainStats />

        <PlainVolume />

        <Card className="pt-0">
          <CardHeader className="rounded-t-[4px] border-b-2 border-[var(--hg-soft-selected)] bg-[var(--hg-soft)] pt-(--card-spacing) pb-4">
            <SectionTitle size="md" description="How far you can rely on its labels.">
              How often is HateGuard right?
            </SectionTitle>
            <TechnicalName className="bg-white">Model Performance Summary (Accuracy)</TechnicalName>
          </CardHeader>
          <CardContent className="pt-5">
            {metrics && <PlainPerformanceSummary metrics={metrics} />}
            {metricsError && <MetricsUnavailable plain />}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {heading}

      <StatsCards volume={volume} periodLabel={periodLabel} />

      <VolumePanel onVolumeChange={handleVolumeChange} />

      <Card className="pt-0">
        <CardHeader className="rounded-t-[4px] border-b-2 border-[var(--hg-soft-selected)] bg-[var(--hg-soft)] pt-(--card-spacing) pb-4">
          <SectionTitle size="md" description="Held-out test metrics for the active language model.">
            Model Performance Summary
          </SectionTitle>
        </CardHeader>
        <CardContent className="px-0 pt-0">
          {metrics && (
            <SummaryStatGrid columns={4} bleedPadding={false}>
              {METRIC_TILES.map((tile, index) => (
                <SummaryStatCell key={tile.key} index={index} columns={4}>
                  <SummaryStatTile
                    label={tile.label}
                    value={tile.format(metrics)}
                    subtitle={tile.subtitle}
                    valueClassName={tile.accent ? 'text-[var(--hg-secondary)]' : undefined}
                  />
                </SummaryStatCell>
              ))}
            </SummaryStatGrid>
          )}
          {metricsError && <MetricsUnavailable plain={false} />}
        </CardContent>
      </Card>
    </div>
  );
}

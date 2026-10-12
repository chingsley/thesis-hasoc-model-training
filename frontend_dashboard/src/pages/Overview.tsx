import { useCallback, useState } from 'react';
import { useModelMetrics } from '@/hooks/use-metrics';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { VolumePanel } from '@/components/charts/VolumePanel';
import { VolumeRangeToggle } from '@/components/charts/VolumeRangeToggle';
import { useVolumeSelectionStore } from '@/lib/store/volume-selection';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SectionTitle } from '@/components/ui/data-source-badge';
import {
  SummaryStatCell,
  SummaryStatGrid,
  SummaryStatTile,
} from '@/components/ui/summary-stat-strip';
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

export default function Overview() {
  const { data: metrics, isError: metricsError } = useModelMetrics();
  const [volume, setVolume] = useState<VolumeDataPoint[] | undefined>();
  const [periodLabel, setPeriodLabel] = useState('24 Hours');
  const mode = useVolumeSelectionStore((s) => s.mode);
  const customFrom = useVolumeSelectionStore((s) => s.customFrom);
  const customTo = useVolumeSelectionStore((s) => s.customTo);
  const setPreset = useVolumeSelectionStore((s) => s.setPreset);
  const setCustomMode = useVolumeSelectionStore((s) => s.setCustomMode);
  const setCustomRange = useVolumeSelectionStore((s) => s.setCustomRange);

  const handleVolumeChange = useCallback((data: VolumeDataPoint[] | undefined, label: string) => {
    setVolume(data);
    setPeriodLabel(label);
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionTitle description="Totals and trends for the selected volume window.">
          Post Overview
        </SectionTitle>
        <VolumeRangeToggle
          mode={mode}
          customFrom={customFrom}
          customTo={customTo}
          onPreset={setPreset}
          onCustomMode={setCustomMode}
          onCustomRange={setCustomRange}
        />
      </div>

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
          {metricsError && (
            <div className="mx-5 my-5 rounded-[4px] border border-dashed border-[var(--hg-border)] bg-[var(--hg-canvas)] px-4 py-6 text-sm text-[var(--hg-muted)] md:mx-6">
              Metrics unavailable. The backend reads <code className="text-xs">test_metrics.json</code> from
              the model&apos;s Hugging Face repo — ensure the backend is running and the repo includes it.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

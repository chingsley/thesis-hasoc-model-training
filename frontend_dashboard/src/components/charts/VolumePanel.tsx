import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Layers, LineChart as LineChartIcon, Loader2 } from 'lucide-react'
import { VolumeChart } from '@/components/charts/VolumeChart'
import { VolumeRangeToggle } from '@/components/charts/VolumeRangeToggle'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { fetchVolumeData } from '@/lib/api/client'
import { useDashboardStore } from '@/lib/store/dashboard'
import { useVolumeSelectionStore } from '@/lib/store/volume-selection'
import { downloadVolumeCsv } from '@/lib/volume-csv'
import { resolveVolumeRange } from '@/lib/volume-range'
import { cn } from '@/lib/utils'
import type { VolumeDataPoint } from '@/lib/types'

interface VolumePanelProps {
  onVolumeChange?: (data: VolumeDataPoint[] | undefined, rangeLabel: string) => void
}

export function VolumePanel({ onVolumeChange }: VolumePanelProps) {
  const language = useDashboardStore((s) => s.language)
  const mode = useVolumeSelectionStore((s) => s.mode)
  const customFrom = useVolumeSelectionStore((s) => s.customFrom)
  const customTo = useVolumeSelectionStore((s) => s.customTo)
  const chartStyle = useVolumeSelectionStore((s) => s.chartStyle)
  const setPreset = useVolumeSelectionStore((s) => s.setPreset)
  const setCustomMode = useVolumeSelectionStore((s) => s.setCustomMode)
  const setCustomRange = useVolumeSelectionStore((s) => s.setCustomRange)
  const setChartStyle = useVolumeSelectionStore((s) => s.setChartStyle)

  const range = useMemo(
    () => resolveVolumeRange(mode, customFrom, customTo),
    [mode, customFrom, customTo],
  )

  const { data: volumeData, isLoading, isFetching } = useQuery({
    queryKey: ['volume', language, ...range.queryKey],
    queryFn: () =>
      fetchVolumeData(language, {
        hours: range.query.hours,
        since: range.query.since,
        until: range.query.until,
      }),
  })

  useEffect(() => {
    onVolumeChange?.(volumeData, range.shortLabel)
  }, [volumeData, range.shortLabel, onVolumeChange])

  const hasData = Boolean(volumeData && volumeData.some((p) => p.total > 0))
  const volumeDescription = (() => {
    if (isLoading && !volumeData) return 'Loading volume…'
    const updating = isFetching && volumeData ? ' · Updating…' : ''
    // Chart axis shows clock times only for ≤24h windows
    if (range.hours <= 24) {
      return `${range.title} · Time in UTC${updating}`
    }
    return `${range.title}${updating}`
  })()

  const handleDownload = () => {
    if (!volumeData?.length) return
    const stamp = new Date().toISOString().slice(0, 10)
    downloadVolumeCsv(volumeData, `hateguard-volume-${language}-${stamp}.csv`)
  }

  return (
    <Card>
      <CardHeader className="gap-4 border-b border-[var(--hg-border)] pb-4">
        <SectionTitle size="md" description={volumeDescription}>
          Post Volume
        </SectionTitle>
        <CardAction>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <div
                className="inline-flex rounded-[8px] border border-[var(--hg-border)] bg-[var(--hg-canvas)] p-0.5"
                role="group"
                aria-label="Chart style"
              >
                <button
                  type="button"
                  aria-pressed={chartStyle === 'line'}
                  onClick={() => setChartStyle('line')}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-[6px] px-2.5 py-1.5 text-xs font-medium transition-colors',
                    chartStyle === 'line'
                      ? 'bg-white text-[var(--hg-ink)] shadow-sm'
                      : 'text-[var(--hg-muted)] hover:text-[var(--hg-ink)]',
                  )}
                  title="Line chart"
                >
                  <LineChartIcon className="h-3.5 w-3.5" />
                  Line
                </button>
                <button
                  type="button"
                  aria-pressed={chartStyle === 'stacked'}
                  onClick={() => setChartStyle('stacked')}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-[6px] px-2.5 py-1.5 text-xs font-medium transition-colors',
                    chartStyle === 'stacked'
                      ? 'bg-white text-[var(--hg-ink)] shadow-sm'
                      : 'text-[var(--hg-muted)] hover:text-[var(--hg-ink)]',
                  )}
                  title="Stacked area"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Stacked
                </button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-[8px] border-[var(--hg-border)] text-xs"
                onClick={handleDownload}
                disabled={!volumeData?.length}
                title="Download CSV"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            </div>
            <VolumeRangeToggle
              mode={mode}
              customFrom={customFrom}
              customTo={customTo}
              onPreset={setPreset}
              onCustomMode={setCustomMode}
              onCustomRange={setCustomRange}
            />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="pt-5">
        {isLoading && !volumeData ? (
          <div className="flex h-[300px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--hg-subtle)]" />
          </div>
        ) : !hasData ? (
          <div className="flex h-[300px] flex-col items-center justify-center gap-1 rounded-[8px] border border-dashed border-[var(--hg-border)] bg-[var(--hg-canvas)] text-center">
            <p className="text-sm font-medium text-[var(--hg-ink)]">No posts in this window</p>
            <p className="max-w-sm text-xs text-[var(--hg-muted)]">
              Try a wider range, switch language, or classify posts in Testing Tools.
            </p>
          </div>
        ) : (
          <VolumeChart data={volumeData!} range={range} chartStyle={chartStyle} />
        )}
      </CardContent>
    </Card>
  )
}

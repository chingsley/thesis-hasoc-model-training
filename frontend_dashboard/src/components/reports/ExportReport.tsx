import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Popover } from '@base-ui/react/popover'
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { DatePickerField } from '@/components/ui/date-picker'
import { fetchPosts } from '@/lib/api/client'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { useDashboardStore } from '@/lib/store/dashboard'
import { useUpdateTriageStatus } from '@/hooks/use-posts'
import { DateCell, HateProbCell, PostIdCell, PostTextCell, PredictionCell } from '@/components/dashboard/post-cells'
import type { Post } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Download, FlagOff, ListFilter, Loader2, Search, X } from 'lucide-react'

type LabelFilter = 'all' | 'Hate' | 'Abuse'

const CSV_HEADER = 'id,tweet,label,predicted_label,hate_probability,flagged,reported_date'

const LABEL_FILTERS: { id: LabelFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'Hate', label: 'Hate' },
  { id: 'Abuse', label: 'Abuse' },
]

const COLUMNS: DataTableColumn<Post>[] = [
  { id: 'id', header: 'Post ID', cell: (p) => <PostIdCell id={p.id} />, className: 'whitespace-nowrap' },
  {
    id: 'post',
    header: 'Post',
    className: 'max-w-[28rem] whitespace-normal',
    cell: (p) => <PostTextCell text={p.tweet} />,
  },
  {
    id: 'prediction',
    header: 'Prediction',
    className: 'whitespace-nowrap',
    cell: (p) => <PredictionCell label={p.predicted_label} />,
  },
  {
    id: 'hate',
    header: 'Hate %',
    className: 'whitespace-nowrap',
    cell: (p) => <HateProbCell value={p.probabilities.hate} />,
  },
  {
    id: 'date',
    header: 'Date',
    className: 'whitespace-nowrap',
    cell: (p) => <DateCell timestamp={p.timestamp} />,
  },
]

function toCsvRow(p: Post): string {
  const date = (p.timestamp || '').split('T')[0]
  return `${p.id},"${p.tweet.replace(/"/g, '""')}",${p.label},${p.predicted_label},${p.probabilities.hate.toFixed(3)},${p.flagged},${date}`
}

function defaultStartDate() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().split('T')[0]
}

function ExportStats({
  flagged,
  abuse,
  hate,
}: {
  flagged: number
  abuse: number
  hate: number
}) {
  const items = [
    {
      label: 'Flagged Posts',
      value: flagged,
      subtitle: 'In current filters',
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

export function ExportReport() {
  const language = useDashboardStore((s) => s.language)
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [search, setSearch] = useState('')
  const [labelFilter, setLabelFilter] = useState<LabelFilter>('all')
  const [minHate, setMinHate] = useState('')
  const [maxHate, setMaxHate] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const removeMutation = useUpdateTriageStatus()

  const { data: posts, isLoading } = useQuery({
    queryKey: ['reported-posts', language],
    queryFn: () => fetchPosts(language, 5000),
  })

  const reportedInRange = useMemo(() => {
    return (posts ?? []).filter((p) => {
      if (p.triage_status !== 'flagged') return false
      const day = (p.timestamp || '').split('T')[0]
      if (startDate && day && day < startDate) return false
      if (endDate && day && day > endDate) return false
      return true
    })
  }, [posts, startDate, endDate])

  const filtered = useMemo(() => {
    const min = minHate === '' ? null : Number(minHate) / 100
    const max = maxHate === '' ? null : Number(maxHate) / 100
    return reportedInRange.filter((p) => {
      if (labelFilter !== 'all' && p.predicted_label !== labelFilter) return false
      if (min !== null && !Number.isNaN(min) && p.probabilities.hate < min) return false
      if (max !== null && !Number.isNaN(max) && p.probabilities.hate > max) return false
      if (search) {
        const q = search.toLowerCase()
        if (!p.tweet.toLowerCase().includes(q) && !p.id.includes(q)) return false
      }
      return true
    })
  }, [reportedInRange, labelFilter, search, minHate, maxHate])

  const labelCounts: Record<LabelFilter, number> = {
    all: reportedInRange.length,
    Hate: reportedInRange.filter((p) => p.predicted_label === 'Hate').length,
    Abuse: reportedInRange.filter((p) => p.predicted_label === 'Abuse').length,
  }

  const hateCount = filtered.filter((p) => p.predicted_label === 'Hate').length
  const abuseCount = filtered.filter((p) => p.predicted_label === 'Abuse').length

  const activeFilterCount = [startDate, endDate, minHate, maxHate].filter(Boolean).length
  const hasRangeFilters = activeFilterCount > 0

  const clearRangeFilters = () => {
    setStartDate('')
    setEndDate('')
    setMinHate('')
    setMaxHate('')
  }

  const handleExportCSV = () => {
    setExporting(true)
    try {
      const csv = [CSV_HEADER, ...filtered.map(toCsvRow)].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `incident_report_${language}_${startDate || 'all'}_${endDate || 'all'}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <ExportStats flagged={filtered.length} abuse={abuseCount} hate={hateCount} />
      </div>

      <Card>
        <CardHeader className="gap-4 border-b border-[var(--hg-border)] pb-4">
          <SectionTitle
            size="md"
            description="Mirrors the Flagged bucket in Triage. Unflag returns a post to Pending. Export downloads the rows shown below."
          >
            Incident Report
          </SectionTitle>
          <CardAction className="self-center">
            <Button
              type="button"
              onClick={handleExportCSV}
              disabled={exporting || filtered.length === 0}
              className="h-9 rounded-[4px] bg-[#4a3f6e] px-3 text-white hover:bg-[#3d355c]"
            >
              {exporting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              Export CSV
              <span className="tabular-nums text-white/80">({filtered.length})</span>
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="pt-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-0 w-full sm:w-56 sm:max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--hg-subtle)]" />
                <Input
                  placeholder="Search posts or IDs…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 rounded-[4px] border-[var(--hg-border)] bg-[var(--hg-canvas)] pl-9 text-sm shadow-none focus-visible:border-[var(--hg-brand)] focus-visible:bg-white"
                  aria-label="Search flagged posts"
                />
              </div>

              <Popover.Root open={filterOpen} onOpenChange={setFilterOpen}>
                <Popover.Trigger
                  type="button"
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-[4px] border px-2.5 text-xs font-medium transition-colors',
                    hasRangeFilters
                      ? 'border-[var(--hg-brand)] bg-[var(--hg-soft)] text-[var(--hg-ink)]'
                      : 'border-[var(--hg-border)] bg-white text-[var(--hg-muted)] hover:bg-[var(--hg-soft)] hover:text-black',
                    'data-popup-open:border-[var(--hg-brand)] data-popup-open:bg-[var(--hg-soft)] data-popup-open:text-[var(--hg-ink)]',
                  )}
                >
                  <ListFilter className="size-3.5" />
                  Filter
                  {hasRangeFilters && (
                    <span className="inline-flex min-w-4 items-center justify-center rounded-[3px] bg-[var(--hg-brand)] px-1 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                      {activeFilterCount}
                    </span>
                  )}
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-50">
                    <Popover.Popup
                      className={cn(
                        'w-[320px] origin-(--transform-origin) rounded-[4px] border border-[var(--hg-border)] bg-white p-5 shadow-[var(--hg-shadow)] outline-none',
                        'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
                        'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
                      )}
                    >
                      <div className="mb-5 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--hg-ink)]">Filters</p>
                          <p className="mt-0.5 text-xs text-[var(--hg-muted)]">
                            Narrow the flagged posts shown below
                          </p>
                        </div>
                        {hasRangeFilters && (
                          <button
                            type="button"
                            onClick={clearRangeFilters}
                            className="inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-xs font-medium text-[var(--hg-muted)] transition-colors hover:bg-[var(--hg-canvas)] hover:text-[var(--hg-ink)]"
                          >
                            <X className="size-3" />
                            Clear
                          </button>
                        )}
                      </div>

                      <div className="space-y-5">
                        <section className="space-y-3">
                          <p className="text-[11px] font-semibold tracking-wide text-[var(--hg-muted)] uppercase">
                            Date range
                          </p>
                          <div className="space-y-3 rounded-[4px] border border-[var(--hg-border)] bg-[var(--hg-canvas)] p-3">
                            <DatePickerField
                              label="From"
                              value={startDate}
                              max={endDate || undefined}
                              rangeMate={endDate}
                              rangeRole="start"
                              clearable
                              onChange={setStartDate}
                              className="w-full justify-between gap-3 [&_button]:min-w-0 [&_button]:flex-1"
                            />
                            <DatePickerField
                              label="To"
                              value={endDate}
                              min={startDate || undefined}
                              rangeMate={startDate}
                              rangeRole="end"
                              clearable
                              onChange={setEndDate}
                              className="w-full justify-between gap-3 [&_button]:min-w-0 [&_button]:flex-1"
                            />
                          </div>
                        </section>

                        <section className="space-y-3">
                          <p className="text-[11px] font-semibold tracking-wide text-[var(--hg-muted)] uppercase">
                            Hate probability
                          </p>
                          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 rounded-[4px] border border-[var(--hg-border)] bg-[var(--hg-canvas)] p-3">
                            <label className="space-y-1.5">
                              <span className="text-[11px] font-medium tracking-wide text-[var(--hg-muted)] uppercase">
                                Min
                              </span>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step={5}
                                placeholder="0"
                                value={minHate}
                                onChange={(e) => setMinHate(e.target.value)}
                                className="h-8 rounded-[4px] border-[var(--hg-border)] bg-white text-sm tabular-nums shadow-none"
                                aria-label="Minimum hate probability percent"
                              />
                            </label>
                            <span className="mb-2 text-sm text-[var(--hg-subtle)]" aria-hidden>
                              –
                            </span>
                            <label className="space-y-1.5">
                              <span className="text-[11px] font-medium tracking-wide text-[var(--hg-muted)] uppercase">
                                Max
                              </span>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step={5}
                                placeholder="100"
                                value={maxHate}
                                onChange={(e) => setMaxHate(e.target.value)}
                                className="h-8 rounded-[4px] border-[var(--hg-border)] bg-white text-sm tabular-nums shadow-none"
                                aria-label="Maximum hate probability percent"
                              />
                            </label>
                          </div>
                        </section>
                      </div>
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>

              {hasRangeFilters && (
                <button
                  type="button"
                  onClick={clearRangeFilters}
                  className="inline-flex h-9 items-center gap-1 rounded-[4px] px-2 text-xs font-medium text-[var(--hg-muted)] transition-colors hover:text-[var(--hg-ink)]"
                >
                  <X className="size-3" />
                  Clear
                </button>
              )}

              <div className="ml-auto flex flex-wrap items-center gap-3">
                <div
                  className="inline-flex w-fit shrink-0 rounded-[4px] border border-[var(--hg-border)] bg-[var(--hg-canvas)] p-0.5"
                  role="group"
                  aria-label="Filter by prediction"
                >
                  {LABEL_FILTERS.map((f) => {
                    const active = labelFilter === f.id
                    return (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setLabelFilter(f.id)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 text-xs font-medium transition-colors',
                          active
                            ? 'bg-white text-[var(--hg-ink)] shadow-sm'
                            : 'text-[var(--hg-muted)] hover:bg-[var(--hg-soft)] hover:text-black',
                        )}
                      >
                        {f.label}
                        <span
                          className={cn(
                            'tabular-nums',
                            active ? 'text-[var(--hg-brand)]' : 'text-[var(--hg-subtle)]',
                          )}
                        >
                          {labelCounts[f.id]}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--hg-subtle)]" />
              </div>
            ) : (
              <DataTable
                columns={COLUMNS}
                data={filtered}
                getRowId={(p) => p.id}
                maxHeight="520px"
                caption="Flagged posts for incident report"
                empty={
                  <div className="text-center text-[var(--hg-muted)]">
                    <p className="text-sm font-medium text-[var(--hg-ink)]">No flagged posts in this range</p>
                    <p className="mt-1 text-xs">
                      Flag posts in Triage (Pending) to add them to your incident report.
                    </p>
                  </div>
                }
                actions={(p) => (
                  <Button
                    variant="outline"
                    size="sm"
                    title="Unflag — returns the post to Pending in Triage"
                    aria-label={`Unflag ${p.id}`}
                    disabled={removeMutation.isPending}
                    className="h-8 rounded-[4px] border-[var(--hg-border)] text-xs"
                    onClick={() => removeMutation.mutate({ postId: p.id, status: 'pending' })}
                  >
                    <FlagOff className="size-3.5" /> Unflag
                  </Button>
                )}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

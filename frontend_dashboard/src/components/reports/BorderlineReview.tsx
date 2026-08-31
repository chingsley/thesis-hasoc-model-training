import { useMemo, useState } from 'react'
import { useBorderlinePosts } from '@/hooks/use-posts'
import { Popover } from '@base-ui/react/popover'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { DatePickerField } from '@/components/ui/date-picker'
import {
  DateCell,
  HateProbCell,
  PostIdCell,
  PostTextCell,
  PredictionCell,
} from '@/components/dashboard/post-cells'
import type { Post } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ListFilter, Loader2, Search, X } from 'lucide-react'

type LabelFilter = 'all' | 'Hate' | 'Abuse' | 'Normal'

const LABEL_FILTERS: { id: LabelFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'Hate', label: 'Hate' },
  { id: 'Abuse', label: 'Abuse' },
  { id: 'Normal', label: 'Normal' },
]

const COLUMNS: DataTableColumn<Post>[] = [
  {
    id: 'id',
    header: 'Post ID',
    cell: (p) => <PostIdCell id={p.id} />,
    className: 'whitespace-nowrap',
  },
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
    id: 'normal',
    header: 'Normal',
    className: 'whitespace-nowrap',
    cell: (p) => (
      <span className="font-mono text-[11px] tabular-nums text-[var(--hg-muted)]">
        {Math.round(p.probabilities.normal * 100)}%
      </span>
    ),
  },
  {
    id: 'abuse',
    header: 'Abuse',
    className: 'whitespace-nowrap',
    cell: (p) => (
      <span className="font-mono text-[11px] tabular-nums text-[var(--hg-muted)]">
        {Math.round(p.probabilities.abuse * 100)}%
      </span>
    ),
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

export function BorderlineReview() {
  const { data: posts, isLoading } = useBorderlinePosts()
  const [search, setSearch] = useState('')
  const [labelFilter, setLabelFilter] = useState<LabelFilter>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)

  const allPosts = posts ?? []

  const filtered = useMemo(() => {
    return allPosts.filter((p) => {
      if (labelFilter !== 'all' && p.predicted_label !== labelFilter) return false
      const day = (p.timestamp || '').split('T')[0]
      if (startDate && day && day < startDate) return false
      if (endDate && day && day > endDate) return false
      if (search) {
        const q = search.toLowerCase()
        if (!p.tweet.toLowerCase().includes(q) && !p.id.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [allPosts, labelFilter, search, startDate, endDate])

  const labelCounts: Record<LabelFilter, number> = {
    all: allPosts.length,
    Hate: allPosts.filter((p) => p.predicted_label === 'Hate').length,
    Abuse: allPosts.filter((p) => p.predicted_label === 'Abuse').length,
    Normal: allPosts.filter((p) => p.predicted_label === 'Normal').length,
  }

  const activeFilterCount = [startDate, endDate].filter(Boolean).length
  const hasRangeFilters = activeFilterCount > 0

  const clearRangeFilters = () => {
    setStartDate('')
    setEndDate('')
  }

  return (
    <Card>
      <CardHeader className="gap-4 border-b border-[var(--hg-border)] pb-4">
        <SectionTitle
          size="md"
          description="Posts with 40–60% hate confidence — uncertain predictions worth a second look in Triage."
        >
          Borderline Queue
        </SectionTitle>
      </CardHeader>

      <CardContent className="pt-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--hg-subtle)]" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-0 w-full sm:w-56 sm:max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--hg-subtle)]" />
                <Input
                  placeholder="Search posts or IDs…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 rounded-[4px] border-[var(--hg-border)] bg-[var(--hg-canvas)] pl-9 text-sm shadow-none focus-visible:border-[var(--hg-brand)] focus-visible:bg-white"
                  aria-label="Search borderline posts"
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
                            Narrow the borderline posts shown below
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

            <DataTable
              columns={COLUMNS}
              data={filtered}
              getRowId={(p) => p.id}
              maxHeight="520px"
              caption="Borderline posts with uncertain hate confidence"
              empty={
                <div className="text-center text-[var(--hg-muted)]">
                  <p className="text-sm font-medium text-[var(--hg-ink)]">No borderline posts found</p>
                  <p className="mt-1 text-xs">
                    Posts with 40–60% hate confidence will appear here.
                  </p>
                </div>
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

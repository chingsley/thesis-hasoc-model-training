import { useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import type { Post, TriageStatus } from '@/lib/types'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DatePickerField } from '@/components/ui/date-picker'
import type { RelabelMode } from './RelabelSheet'
import { DateCell, HateProbCell, PostIdCell, PostTextCell, PredictionCell } from './post-cells'
import { useFlagPost, useUpdateTriageStatus } from '@/hooks/use-posts'
import { cn } from '@/lib/utils'
import {
  CheckCircle,
  Flag,
  FlagOff,
  ListFilter,
  Pencil,
  RotateCcw,
  Search,
  Tags,
  X,
} from 'lucide-react'

export type TriageBucket = 'pending' | 'cleared' | 'flagged' | 'relabelled'
export type TriageLabelFilter = 'all' | 'Hate' | 'Abuse'

interface TriageTableProps {
  bucket: TriageBucket
  posts: Post[]
  labelFilter: TriageLabelFilter
  onLabelFilterChange: (filter: TriageLabelFilter) => void
  onRelabel: (post: Post, mode: RelabelMode) => void
}

const manualLabelCell = (p: Post) =>
  p.manual_label ? (
    <PredictionCell label={p.manual_label} />
  ) : (
    <span className="text-muted-foreground">--</span>
  )

const BASE_COLUMNS: DataTableColumn<Post>[] = [
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
    cell: (p) => (
      <div className="flex items-center gap-1.5">
        <PredictionCell label={p.predicted_label} />
        {p.predicted_label !== p.label && (
          <Badge variant="outline" className="rounded-[4px] border-destructive/40 text-[10px] text-destructive">
            True: {p.label}
          </Badge>
        )}
      </div>
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

const MAIN_COLUMNS: DataTableColumn<Post>[] = [
  ...BASE_COLUMNS.slice(0, 3),
  {
    id: 'manual',
    header: 'Manual label',
    className: 'whitespace-nowrap',
    cell: manualLabelCell,
  },
  ...BASE_COLUMNS.slice(3),
]

const RELABEL_COLUMNS: DataTableColumn<Post>[] = [
  { id: 'id', header: 'Post ID', cell: (p) => <PostIdCell id={p.id} />, className: 'whitespace-nowrap' },
  {
    id: 'post',
    header: 'Post',
    className: 'max-w-[28rem] whitespace-normal',
    cell: (p) => <PostTextCell text={p.tweet} />,
  },
  {
    id: 'machine',
    header: 'Prediction',
    className: 'whitespace-nowrap',
    cell: (p) => <PredictionCell label={p.predicted_label} />,
  },
  {
    id: 'manual',
    header: 'Manual label',
    className: 'whitespace-nowrap',
    cell: manualLabelCell,
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

const COLUMNS_BY_BUCKET: Record<TriageBucket, DataTableColumn<Post>[]> = {
  pending: MAIN_COLUMNS,
  cleared: MAIN_COLUMNS,
  flagged: MAIN_COLUMNS,
  relabelled: RELABEL_COLUMNS,
}

const EMPTY_TEXT: Record<TriageBucket, string> = {
  pending: 'No pending posts — all caught up',
  cleared: 'No cleared posts yet',
  flagged: 'No flagged posts yet',
  relabelled: 'No relabelled posts — use Relabel on a pending post you disagree with',
}

const LABEL_FILTERS: { id: TriageLabelFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'Hate', label: 'Hate' },
  { id: 'Abuse', label: 'Abuse' },
]

export function TriageTable({
  bucket,
  posts,
  labelFilter,
  onLabelFilterChange,
  onRelabel,
}: TriageTableProps) {
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [minHate, setMinHate] = useState('')
  const [maxHate, setMaxHate] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const flagMutation = useFlagPost()
  const statusMutation = useUpdateTriageStatus()

  const minProb = minHate === '' ? null : Number(minHate) / 100
  const maxProb = maxHate === '' ? null : Number(maxHate) / 100

  const filtered = posts.filter((p) => {
    if (labelFilter !== 'all' && p.predicted_label !== labelFilter) return false
    if (search && !p.tweet.toLowerCase().includes(search.toLowerCase()) && !p.id.includes(search))
      return false
    const day = (p.timestamp || '').split('T')[0]
    if (startDate && day && day < startDate) return false
    if (endDate && day && day > endDate) return false
    if (minProb !== null && !Number.isNaN(minProb) && p.probabilities.hate < minProb) return false
    if (maxProb !== null && !Number.isNaN(maxProb) && p.probabilities.hate > maxProb) return false
    return true
  })

  const activeFilterCount = [startDate, endDate, minHate, maxHate].filter(Boolean).length
  const hasRangeFilters = activeFilterCount > 0

  const labelCounts = {
    all: posts.length,
    Hate: posts.filter((p) => p.predicted_label === 'Hate').length,
    Abuse: posts.filter((p) => p.predicted_label === 'Abuse').length,
  }

  const clearRangeFilters = () => {
    setStartDate('')
    setEndDate('')
    setMinHate('')
    setMaxHate('')
  }

  const busy =
    (flagMutation.isPending && flagMutation.variables) ||
    (statusMutation.isPending && statusMutation.variables?.postId) ||
    null

  const setStatus = (postId: string, status: TriageStatus) =>
    statusMutation.mutate({ postId, status })

  const rowActions = (post: Post) => {
    const disabled = busy === post.id
    const actionClass =
      'h-7 rounded-[4px] border border-[var(--hg-border)] bg-white px-2 text-xs font-medium text-[var(--hg-muted)] shadow-none hover:border-[var(--hg-muted)] hover:bg-[var(--hg-soft)] hover:text-[var(--hg-ink)]'
    switch (bucket) {
      case 'pending':
        return (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              className={actionClass}
              onClick={() => flagMutation.mutate(post.id)}
            >
              <Flag className="size-3.5" /> Flag
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              className={actionClass}
              onClick={() => setStatus(post.id, 'cleared')}
            >
              <CheckCircle className="size-3.5" /> Clear
            </Button>
            <Button
              size="sm"
              variant="outline"
              title="Relabel (correct the model's label)"
              disabled={disabled}
              className={actionClass}
              onClick={() => onRelabel(post, 'create')}
            >
              <Tags className="size-3.5" /> Relabel
            </Button>
          </>
        )
      case 'cleared':
        return (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              className={actionClass}
              onClick={() => setStatus(post.id, 'pending')}
            >
              <RotateCcw className="size-3.5" /> Reopen
            </Button>
          </>
        )
      case 'flagged':
        return (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              className={actionClass}
              onClick={() => setStatus(post.id, 'pending')}
            >
              <FlagOff className="size-3.5" /> Unflag
            </Button>
          </>
        )
      case 'relabelled':
        return (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              className={actionClass}
              onClick={() => onRelabel(post, 'edit')}
            >
              <Pencil className="size-3.5" /> Edit
            </Button>
          </>
        )
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 w-full sm:w-56 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--hg-subtle)]" />
          <Input
            placeholder="Search posts or IDs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-[4px] border-[var(--hg-border)] bg-[var(--hg-canvas)] pl-9 text-sm shadow-none focus-visible:border-[var(--hg-brand)] focus-visible:bg-white"
            aria-label="Search posts"
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
                    <p className="mt-0.5 text-xs text-[var(--hg-muted)]">Narrow the posts shown below</p>
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
                  onClick={() => onLabelFilterChange(f.id)}
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
        columns={COLUMNS_BY_BUCKET[bucket]}
        data={filtered}
        getRowId={(p) => p.id}
        maxHeight="520px"
        caption={`${bucket} triage posts`}
        empty={
          <div className="text-center text-[var(--hg-muted)]">
            <p className="text-sm font-medium text-[var(--hg-ink)]">{EMPTY_TEXT[bucket]}</p>
          </div>
        }
        actions={rowActions}
      />
    </div>
  )
}
